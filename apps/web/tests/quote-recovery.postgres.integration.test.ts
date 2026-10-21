/**
 * Real PostgreSQL checks for quote-recovery double opt-in: the confirm token
 * is single-use and expires, a converted/sent row can never be confirmed, and
 * markRecoveryConverted matches mixed-case legacy addresses. Runs only with
 * RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!enabled)('quote recovery against real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  const emails = new Set<string>();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.quoteRecovery.deleteMany({ where: { email: { in: [...emails] } } });
  });

  async function seed(patch: Record<string, unknown> = {}, email = `qr-${tag}-${emails.size}@Example.test`) {
    const { db } = await import('@/lib/db');
    const { newConfirmToken } = await import('@/lib/quote-recovery');
    const { token, hash } = newConfirmToken();
    emails.add(email);
    const row = await db.quoteRecovery.create({
      data: { email, consentedAt: new Date(), confirmTokenHash: hash, confirmSentAt: new Date(), ...patch },
    });
    return { db, token, row, email };
  }

  async function confirm(token: string) {
    const { POST } = await import('@/app/api/quote-recovery/confirm/route');
    const body = new URLSearchParams({ token });
    const res = await POST(new Request('http://localhost/api/quote-recovery/confirm', { method: 'POST', body }));
    return res.text();
  }

  it('confirms once: sets confirmedAt, clears the hash, and a replay is refused', async () => {
    const { db, token, row } = await seed();
    expect(await confirm(token)).toContain('Reminder confirmed');
    const after = await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.confirmedAt).not.toBeNull();
    expect(after.confirmTokenHash).toBeNull();
    const firstConfirmedAt = after.confirmedAt!.getTime();

    expect(await confirm(token)).toContain('expired or was already used');
    expect((await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } })).confirmedAt!.getTime()).toBe(firstConfirmedAt);
  });

  it('refuses a token older than 7 days and leaves the row unconfirmed', async () => {
    const { db, token, row } = await seed({ confirmSentAt: new Date(Date.now() - 8 * DAY) });
    expect(await confirm(token)).toContain('expired or was already used');
    expect((await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } })).confirmedAt).toBeNull();
  });

  it('accepts a token just inside the 7 day window', async () => {
    const { db, token, row } = await seed({ confirmSentAt: new Date(Date.now() - 6 * DAY - 23 * 3_600_000) });
    expect(await confirm(token)).toContain('Reminder confirmed');
    expect((await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } })).confirmedAt).not.toBeNull();
  });

  it('never confirms a row that was already converted or already sent, and ignores unknown tokens', async () => {
    const converted = await seed({ convertedAt: new Date() });
    const sent = await seed({ sentAt: new Date() });
    expect(await confirm(converted.token)).toContain('expired or was already used');
    expect(await confirm(sent.token)).toContain('expired or was already used');
    expect(await confirm('not-a-real-token')).toContain('expired or was already used');
    expect((await converted.db.quoteRecovery.findUniqueOrThrow({ where: { id: converted.row.id } })).confirmedAt).toBeNull();
    expect((await sent.db.quoteRecovery.findUniqueOrThrow({ where: { id: sent.row.id } })).confirmedAt).toBeNull();
  });

  it('a row with a token but no confirmSentAt is refused', async () => {
    const { db, token, row } = await seed({ confirmSentAt: null });
    expect(await confirm(token)).toContain('expired or was already used');
    expect((await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } })).confirmedAt).toBeNull();
  });

  it('parallel confirms of one token leave a single consistent confirmed row', async () => {
    const { db, token, row } = await seed();
    const pages = await Promise.all(Array.from({ length: 5 }, () => confirm(token)));
    expect(pages.filter((p) => p.includes('Reminder confirmed')).length).toBeGreaterThanOrEqual(1);
    const after = await db.quoteRecovery.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.confirmedAt).not.toBeNull();
    expect(after.confirmTokenHash).toBeNull();
    expect(await confirm(token)).toContain('expired or was already used');
  });

  it('markRecoveryConverted cancels pending rows case-insensitively, but not sent or other addresses', async () => {
    const { markRecoveryConverted } = await import('@/lib/quote-recovery');
    const mixed = await seed({}, `Mixed.Case-${tag}@Example.TEST`);
    const lower = await seed({}, `mixed.case-${tag}@example.test`);
    const sent = await seed({ sentAt: new Date() }, `MIXED.CASE-${tag}@example.test`);
    const other = await seed({}, `other-${tag}@example.test`);

    await markRecoveryConverted(`  mixed.CASE-${tag}@EXAMPLE.test `);

    const get = (r: typeof mixed) => mixed.db.quoteRecovery.findUniqueOrThrow({ where: { id: r.row.id } });
    expect((await get(mixed)).convertedAt).not.toBeNull();
    expect((await get(lower)).convertedAt).not.toBeNull();
    expect((await get(sent)).convertedAt).toBeNull(); // already sent: untouched
    expect((await get(other)).convertedAt).toBeNull();

    // Idempotent and null-safe.
    await markRecoveryConverted(`mixed.case-${tag}@example.test`);
    await markRecoveryConverted(null);
    await markRecoveryConverted(undefined);
  });
});
