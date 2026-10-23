/**
 * Real PostgreSQL checks for the two cron emails: the quote-recovery reminder
 * and the post-job review request.
 *
 * The defect these pin down: both paths used to conflate "claimed" with "sent".
 * A provider failure (e.g. an unverified Resend domain) permanently burned the
 * one reminder, and the review request retried hourly forever with no limit and
 * no persisted error. Now `sentAt` is written only after the provider accepts
 * the message, every attempt carries the same idempotency key, failures back
 * off and are bounded, and an exhausted row is visible in the counts.
 *
 * The mailer is a fake: no real email is ever sent. Time is moved by editing the
 * timestamps in the database (never by sleeping), so the suite is fast.
 *
 * Runs only with RUN_POSTGRES_INTEGRATION=1, against a disposable database.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
const SECRET = 'cron-secret-for-tests';

const mail = vi.hoisted(() => ({
  calls: [] as Array<{ to: string; idempotencyKey?: string }>,
  review: [] as Array<{ to: string; idempotencyKey?: string }>,
  failWith: null as string | null,
  delayMs: 0,
  hang: false,
}));

vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; idempotencyKey?: string }) => {
    mail.calls.push({ to: m.to, idempotencyKey: m.idempotencyKey });
    if (mail.hang) return new Promise<void>(() => undefined);
    if (mail.delayMs) await new Promise((r) => setTimeout(r, mail.delayMs));
    if (mail.failWith) throw new Error(mail.failWith);
  },
  sendReviewRequestEmail: async (m: { to: string; idempotencyKey?: string }) => {
    mail.review.push({ to: m.to, idempotencyKey: m.idempotencyKey });
    if (mail.hang) return new Promise<void>(() => undefined);
    if (mail.delayMs) await new Promise((r) => setTimeout(r, mail.delayMs));
    if (mail.failWith) throw new Error(mail.failWith);
  },
}));

const HOUR = 3600_000;
const ago = (ms: number) => new Date(Date.now() - ms);

describe.skipIf(!enabled)('cron email delivery against real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const projectIds: string[] = [];
  const quoteIds: string[] = [];
  let seq = 0;

  beforeEach(async () => {
    process.env.CRON_SECRET = SECRET;
    mail.calls.length = 0;
    mail.review.length = 0;
    mail.failWith = null;
    mail.delayMs = 0;
    mail.hang = false;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // The suite owns the table for its duration (disposable database, serial CI run).
    const { db } = await import('@/lib/db');
    await db.quoteRecovery.deleteMany({});
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.quoteRecovery.deleteMany({});
    await db.quoteRequest.deleteMany({ where: { id: { in: quoteIds } } });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  /* ── helpers ─────────────────────────────────────────────────────────── */

  async function runRecoveryCron() {
    const { GET } = await import('@/app/api/cron/quote-recovery/route');
    const res = await GET(new Request('http://localhost/api/cron/quote-recovery', { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(res.status).toBe(200);
    return (await res.json()) as { ok: boolean; due: number; sent: number; failed: number; exhausted: number };
  }

  async function runReviewCron() {
    const { GET } = await import('@/app/api/cron/review-requests/route');
    const res = await GET(new Request('http://localhost/api/cron/review-requests', { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(res.status).toBe(200);
    return (await res.json()) as { ok: boolean; due: number; sent: number; failed: number; skipped: number; exhausted: number };
  }

  async function seedRecovery(patch: Record<string, unknown> = {}) {
    const { db } = await import('@/lib/db');
    const email = `qr-${tag}-${++seq}@example.test`;
    const row = await db.quoteRecovery.create({
      data: { email, name: 'Pat', consentedAt: ago(4 * HOUR), confirmedAt: ago(3 * HOUR), createdAt: ago(3 * HOUR), ...patch },
    });
    return { db, row, email };
  }

  const getRecovery = async (id: string) => (await import('@/lib/db')).db.quoteRecovery.findUniqueOrThrow({ where: { id } });

  /** Make the backoff / lease of a row "elapse" without sleeping. */
  async function elapseRecovery(id: string) {
    const { db } = await import('@/lib/db');
    await db.$executeRaw`UPDATE "ecowoods"."QuoteRecovery" SET "sendNextAttemptAt" = now() - interval '1 second', "sendLeaseUntil" = NULL WHERE "id" = ${id}::uuid`;
  }

  async function seedProject(patch: Record<string, unknown> = {}, updatedAgoMs = 2 * HOUR) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `rv-${tag}-${++seq}@example.test`, name: 'Pat Reviewer' } });
    userIds.push(user.id);
    const project = await db.project.create({ data: { userId: user.id, title: `RV-${tag}-${seq}`, status: 'COMPLETED', ...patch } });
    projectIds.push(project.id);
    const at = new Date(Date.now() - updatedAgoMs);
    await db.$executeRaw`UPDATE "ecowoods"."Project" SET "updatedAt" = ${at} WHERE "id" = ${project.id}::uuid`;
    return { db, project, user };
  }

  const getProject = async (id: string) => (await import('@/lib/db')).db.project.findUniqueOrThrow({ where: { id } });

  async function elapseProject(id: string) {
    const { db } = await import('@/lib/db');
    await db.$executeRaw`UPDATE "ecowoods"."Project" SET "reviewEmailNextAttemptAt" = now() - interval '1 second' WHERE "id" = ${id}::uuid`;
  }

  /* ── quote recovery ──────────────────────────────────────────────────── */

  describe('quote recovery', () => {
    it('provider failure leaves sentAt NULL, attempts=1, a backoff, and a sanitised error', async () => {
      const { row, email } = await seedRecovery();
      mail.failWith = `Resend error: You can only send testing emails to your own email address (owner@secret.test), not ${email}. ${'x'.repeat(400)}`;

      const out = await runRecoveryCron();
      expect(out).toMatchObject({ ok: true, due: 1, sent: 0, failed: 1, exhausted: 0 });
      expect(mail.calls).toHaveLength(1);

      const after = await getRecovery(row.id);
      expect(after.sentAt).toBeNull();
      expect(after.sendAttempts).toBe(1);
      expect(after.sendLeaseUntil).toBeNull();
      expect(after.sendNextAttemptAt!.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
      expect(after.sendNextAttemptAt!.getTime() - Date.now()).toBeLessThanOrEqual(HOUR + 5_000);
      expect(after.sendLastError).toContain('You can only send testing emails');
      expect(after.sendLastError!.length).toBeLessThanOrEqual(300);
      expect(after.sendLastError).not.toContain('@'); // recipient and owner addresses are redacted
      expect(after.sendLastError).not.toContain(email);
    });

    it('an immediate second run does not retry (backoff)', async () => {
      const { row } = await seedRecovery();
      mail.failWith = 'Resend error: domain not verified';
      await runRecoveryCron();
      const second = await runRecoveryCron();
      expect(second).toMatchObject({ due: 0, sent: 0, failed: 0 });
      expect(mail.calls).toHaveLength(1);
      expect((await getRecovery(row.id)).sendAttempts).toBe(1);
    });

    it('after the backoff it retries with the SAME idempotency key, sets sentAt once, and a further run sends nothing', async () => {
      const { row, email } = await seedRecovery();
      mail.failWith = 'Resend error: domain not verified';
      await runRecoveryCron();

      mail.failWith = null;
      await elapseRecovery(row.id);
      const retry = await runRecoveryCron();
      expect(retry).toMatchObject({ due: 1, sent: 1, failed: 0 });
      expect(mail.calls.map((c) => c.idempotencyKey)).toEqual([`quote-recovery/${row.id}/v1`, `quote-recovery/${row.id}/v1`]);
      expect(mail.calls.every((c) => c.to === email)).toBe(true);

      const after = await getRecovery(row.id);
      expect(after.sentAt).toBeInstanceOf(Date);
      expect(after.sendAttempts).toBe(2);
      expect(after.sendLastError).toBeNull();
      expect(after.sendNextAttemptAt).toBeNull();
      const firstSentAt = after.sentAt!.getTime();

      const again = await runRecoveryCron();
      expect(again).toMatchObject({ due: 0, sent: 0 });
      expect(mail.calls).toHaveLength(2);
      expect((await getRecovery(row.id)).sentAt!.getTime()).toBe(firstSentAt);
    });

    it('two concurrent cron runs make exactly one provider call', async () => {
      await seedRecovery();
      mail.delayMs = 150;
      const [a, b] = await Promise.all([runRecoveryCron(), runRecoveryCron()]);
      expect(mail.calls).toHaveLength(1);
      expect(a.sent + b.sent).toBe(1);
    });

    it('crash simulation: a held lease blocks others; once it expires the reminder is re-sent once with the same key', async () => {
      const { db, row } = await seedRecovery();
      // A holder claimed (attempt 1) and died before calling the provider.
      await db.$executeRaw`UPDATE "ecowoods"."QuoteRecovery" SET "sendAttempts" = 1, "sendLeaseUntil" = now() + interval '2 minutes' WHERE "id" = ${row.id}::uuid`;
      expect(await runRecoveryCron()).toMatchObject({ due: 0, sent: 0 });
      expect(mail.calls).toHaveLength(0);

      await db.$executeRaw`UPDATE "ecowoods"."QuoteRecovery" SET "sendLeaseUntil" = now() - interval '1 second' WHERE "id" = ${row.id}::uuid`;
      expect(await runRecoveryCron()).toMatchObject({ due: 1, sent: 1 });
      expect(mail.calls).toHaveLength(1);
      expect(mail.calls[0]!.idempotencyKey).toBe(`quote-recovery/${row.id}/v1`);
      const after = await getRecovery(row.id);
      expect(after.sentAt).toBeInstanceOf(Date);
      expect(after.sendAttempts).toBe(2);

      await runRecoveryCron();
      expect(mail.calls).toHaveLength(1);
    });

    it('a provider call that hangs is an unknown outcome: it times out, backs off, and is retried with the same key', async () => {
      const { row } = await seedRecovery();
      mail.hang = true;
      const { runQuoteRecoveryCron } = await import('@/lib/quote-recovery-delivery');
      const out = await runQuoteRecoveryCron({ sendTimeoutMs: 50 });
      expect(out).toMatchObject({ due: 1, sent: 0, failed: 1 });
      const after = await getRecovery(row.id);
      expect(after.sentAt).toBeNull();
      expect(after.sendLastError).toContain('outcome unknown');

      mail.hang = false;
      await elapseRecovery(row.id);
      await runRecoveryCron();
      expect(mail.calls.map((c) => c.idempotencyKey)).toEqual([`quote-recovery/${row.id}/v1`, `quote-recovery/${row.id}/v1`]);
      expect((await getRecovery(row.id)).sentAt).toBeInstanceOf(Date);
    });

    it('5 failures exhaust the row: backoff 1h/3h/6h/12h, no 6th attempt, sentAt stays null, counts report it', async () => {
      const { row } = await seedRecovery();
      mail.failWith = 'Resend error: boom';
      const expectedHours = [1, 3, 6, 12];
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const out = await runRecoveryCron();
        expect(out).toMatchObject({ due: 1, sent: 0, failed: 1, exhausted: attempt === 5 ? 1 : 0 });
        const r = await getRecovery(row.id);
        expect(r.sendAttempts).toBe(attempt);
        if (attempt < 5) {
          const waitH = (r.sendNextAttemptAt!.getTime() - Date.now()) / HOUR;
          expect(waitH).toBeGreaterThan(expectedHours[attempt - 1]! - 0.02);
          expect(waitH).toBeLessThanOrEqual(expectedHours[attempt - 1]! + 0.01);
          await elapseRecovery(row.id);
        }
      }
      expect(mail.calls).toHaveLength(5);

      await elapseRecovery(row.id);
      const sixth = await runRecoveryCron();
      expect(sixth).toMatchObject({ due: 0, sent: 0, failed: 0, exhausted: 1 });
      expect(mail.calls).toHaveLength(5);
      const r = await getRecovery(row.id);
      expect(r.sentAt).toBeNull();
      expect(r.sendAttempts).toBe(5);
      expect(r.sendLastError).toContain('boom');
    });

    it('failing rows cannot starve healthy ones: exhausted and in-backoff rows are excluded in SQL', async () => {
      const { db } = await import('@/lib/db');
      for (let i = 0; i < 55; i += 1) {
        const { row } = await seedRecovery({ createdAt: ago(6 * HOUR + i * 1000) });
        await db.$executeRaw`UPDATE "ecowoods"."QuoteRecovery" SET "sendAttempts" = 5, "sendLastError" = 'old' WHERE "id" = ${row.id}::uuid`;
      }
      const healthy = await seedRecovery({ createdAt: ago(3 * HOUR) }); // the NEWEST row
      const out = await runRecoveryCron();
      expect(out).toMatchObject({ due: 1, sent: 1, exhausted: 55 });
      expect(mail.calls.map((c) => c.to)).toEqual([healthy.email]);
    });

    it('the batch is oldest first', async () => {
      const newer = await seedRecovery({ createdAt: ago(3 * HOUR) });
      const older = await seedRecovery({ createdAt: ago(5 * HOUR) });
      await runRecoveryCron();
      expect(mail.calls.map((c) => c.to)).toEqual([older.email, newer.email]);
    });

    it('never claims unconfirmed, converted, already-sent or out-of-window rows; window edges are inclusive of 2h..7d', async () => {
      await seedRecovery({ confirmedAt: null }); // no double opt-in
      await seedRecovery({ convertedAt: new Date() });
      await seedRecovery({ sentAt: new Date() });
      await seedRecovery({ createdAt: ago(2 * HOUR - 60_000) }); // too new
      await seedRecovery({ createdAt: ago(7 * 24 * HOUR + 60_000) }); // too old
      const ok1 = await seedRecovery({ createdAt: ago(2 * HOUR + 60_000) });
      const ok2 = await seedRecovery({ createdAt: ago(7 * 24 * HOUR - 60_000) });
      const out = await runRecoveryCron();
      expect(out).toMatchObject({ due: 2, sent: 2 });
      expect(mail.calls.map((c) => c.to).sort()).toEqual([ok1.email, ok2.email].sort());
    });

    it('the claim itself re-checks eligibility: a row that changed after selection is not claimed', async () => {
      const { row } = await seedRecovery();
      const { claimQuoteRecovery } = await import('@/lib/quote-recovery-store');
      const { db } = await import('@/lib/db');
      await db.quoteRecovery.update({ where: { id: row.id }, data: { convertedAt: new Date() } });
      expect(await claimQuoteRecovery(row.id)).toBeNull();
      await db.quoteRecovery.update({ where: { id: row.id }, data: { convertedAt: null, confirmedAt: null } });
      expect(await claimQuoteRecovery(row.id)).toBeNull();
      await db.quoteRecovery.update({ where: { id: row.id }, data: { confirmedAt: new Date() } });
      expect(await claimQuoteRecovery(row.id)).toBe(1);
      expect(await claimQuoteRecovery(row.id)).toBeNull(); // lease held
    });

    it('a later QuoteRequest marks the row converted without sending', async () => {
      const { db, row, email } = await seedRecovery();
      const q = await db.quoteRequest.create({ data: { name: 'Pat', email: email.toUpperCase(), phone: '416-555-0100', address: '1 Test St', createdAt: new Date() } });
      quoteIds.push(q.id);
      const out = await runRecoveryCron();
      expect(mail.calls).toHaveLength(0);
      expect(out).toMatchObject({ sent: 0, failed: 0 });
      const after = await getRecovery(row.id);
      expect(after.convertedAt).toBeInstanceOf(Date);
      expect(after.sentAt).toBeNull();
      expect(after.sendAttempts).toBeNull();
    });
  });

  /* ── review requests ─────────────────────────────────────────────────── */

  describe('review requests', () => {
    it('provider failure releases the stamp, records attempts=1, a backoff and a sanitised error', async () => {
      const { project, user } = await seedProject();
      mail.failWith = `Resend error: You can only send testing emails to your own email address (owner@secret.test), not ${user.email}. ${'y'.repeat(400)}`;
      const out = await runReviewCron();
      expect(out).toMatchObject({ ok: true, due: 1, sent: 0, failed: 1, skipped: 0, exhausted: 0 });
      expect(mail.review).toHaveLength(1);

      const after = await getProject(project.id);
      expect(after.reviewRequestedAt).toBeNull();
      expect(after.reviewEmailAttempts).toBe(1);
      expect(after.reviewEmailNextAttemptAt!.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
      expect(after.reviewEmailLastError).toContain('You can only send testing emails');
      expect(after.reviewEmailLastError!.length).toBeLessThanOrEqual(300);
      expect(after.reviewEmailLastError).not.toContain('@');
    });

    it('an immediate second run does not retry (backoff); after it, the SAME key is used and one request is stamped', async () => {
      const { project } = await seedProject();
      mail.failWith = 'Resend error: domain not verified';
      await runReviewCron();
      expect(await runReviewCron()).toMatchObject({ due: 0, sent: 0, failed: 0 });
      expect(mail.review).toHaveLength(1);

      mail.failWith = null;
      await elapseProject(project.id);
      expect(await runReviewCron()).toMatchObject({ due: 1, sent: 1, failed: 0 });
      expect(mail.review.map((c) => c.idempotencyKey)).toEqual([`review-request/${project.id}/v1`, `review-request/${project.id}/v1`]);
      const after = await getProject(project.id);
      expect(after.reviewRequestedAt).toBeInstanceOf(Date);
      expect(after.reviewEmailLastError).toBeNull();
      expect(after.reviewEmailNextAttemptAt).toBeNull();

      expect(await runReviewCron()).toMatchObject({ due: 0, sent: 0 });
      expect(mail.review).toHaveLength(2);
    });

    it('two concurrent cron runs make exactly one provider call', async () => {
      await seedProject();
      mail.delayMs = 150;
      const [a, b] = await Promise.all([runReviewCron(), runReviewCron()]);
      expect(mail.review).toHaveLength(1);
      expect(a.sent + b.sent).toBe(1);
    });

    it('5 failures exhaust the project: backoff 1h/3h/6h/12h, no 6th attempt, counts report it', async () => {
      const { project } = await seedProject();
      mail.failWith = 'Resend error: boom';
      const expectedHours = [1, 3, 6, 12];
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const out = await runReviewCron();
        expect(out).toMatchObject({ due: 1, sent: 0, failed: 1, exhausted: attempt === 5 ? 1 : 0 });
        const p = await getProject(project.id);
        expect(p.reviewEmailAttempts).toBe(attempt);
        expect(p.reviewRequestedAt).toBeNull();
        if (attempt < 5) {
          const waitH = (p.reviewEmailNextAttemptAt!.getTime() - Date.now()) / HOUR;
          expect(waitH).toBeGreaterThan(expectedHours[attempt - 1]! - 0.02);
          expect(waitH).toBeLessThanOrEqual(expectedHours[attempt - 1]! + 0.01);
          await elapseProject(project.id);
        }
      }
      await elapseProject(project.id);
      expect(await runReviewCron()).toMatchObject({ due: 0, sent: 0, failed: 0, exhausted: 1 });
      expect(mail.review).toHaveLength(5);
      expect((await getProject(project.id)).reviewEmailLastError).toContain('boom');
    });

    it('window bounds: 1 hour and 30 days (a project outside them is never selected)', async () => {
      await seedProject({}, HOUR - 60_000); // completed 59 minutes ago: too new
      await seedProject({}, 30 * 24 * HOUR + 60_000); // 30 days and a minute: too old
      const justOld = await seedProject({}, HOUR + 60_000);
      const justYoung = await seedProject({}, 30 * 24 * HOUR - 60_000);
      const out = await runReviewCron();
      expect(out).toMatchObject({ due: 2, sent: 2 });
      expect(mail.review.map((c) => c.to).sort()).toEqual([justOld.user.email, justYoung.user.email].sort());
    });

    it('a project that is not COMPLETED, or already requested, is never claimed', async () => {
      const { requestReviewForProject } = await import('@/lib/review-request');
      const draft = await seedProject({ status: 'DRAFT' });
      expect(await requestReviewForProject(draft.project.id)).toEqual({ sent: false, reason: 'not_completed' });
      const done = await seedProject({ reviewRequestedAt: new Date() });
      expect(await requestReviewForProject(done.project.id)).toEqual({ sent: false, reason: 'already_requested' });
      expect(mail.review).toHaveLength(0);
    });

    it('the immediate trigger shares the same accounting: failure counts an attempt and respects the backoff', async () => {
      const { requestReviewForProject } = await import('@/lib/review-request');
      const { project } = await seedProject({}, 5 * 60_000); // marked complete 5 minutes ago
      mail.failWith = 'Resend error: boom';
      expect(await requestReviewForProject(project.id)).toEqual({ sent: false, reason: 'send_failed' });
      expect((await getProject(project.id)).reviewEmailAttempts).toBe(1);
      expect(await requestReviewForProject(project.id)).toEqual({ sent: false, reason: 'backoff' });
      expect(mail.review).toHaveLength(1);
      expect(mail.review[0]!.idempotencyKey).toBe(`review-request/${project.id}/v1`);
    });
  });
});
