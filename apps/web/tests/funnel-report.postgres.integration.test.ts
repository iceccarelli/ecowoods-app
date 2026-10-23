/**
 * Real PostgreSQL check of the conversion report: exact counts over seeded rows,
 * America/Toronto day boundaries (summer EDT and winter EST), and that the
 * queries never read customer PII columns. Runs only with RUN_POSTGRES_INTEGRATION=1.
 *
 * Fixed past dates (2024) keep this independent of rows other tests create "now".
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('funnel report against real PostgreSQL', () => {
  const queries: string[] = [];
  const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  (client as unknown as { $on: (e: 'query', cb: (q: { query: string }) => void) => void }).$on('query', (q) => {
    queries.push(q.query);
  });

  const tag = randomUUID().slice(0, 6).toUpperCase();
  // designIds are 12 Crockford base32 chars (no I, L, O, U).
  const did = (n: number) => `FR${tag.replace(/[ILOU]/g, 'A')}${String(n).padStart(4, '0')}`.slice(0, 12);
  const ids = { quotes: [] as string[], convs: [] as string[], recs: [] as string[], events: [] as string[], projects: [] as string[], users: [] as string[] };

  afterAll(async () => {
    if (!enabled) return;
    await client.funnelEvent.deleteMany({ where: { id: { in: ids.events } } });
    await client.appointment.deleteMany({ where: { quoteRequestId: { in: ids.quotes } } });
    await client.assistantConversation.deleteMany({ where: { id: { in: ids.convs } } });
    await client.quoteRecovery.deleteMany({ where: { id: { in: ids.recs } } });
    await client.quoteRequest.deleteMany({ where: { id: { in: ids.quotes } } });
    await client.project.deleteMany({ where: { id: { in: ids.projects } } });
    await client.user.deleteMany({ where: { id: { in: ids.users } } });
    await client.$disconnect();
  });

  async function quote(createdAt: Date, designId: string | null = null) {
    const q = await client.quoteRequest.create({
      data: { name: 'Pat Pii-Name', email: `pii-${tag}@example.test`, phone: '416-555-0199', address: '1 Secret St', createdAt, designId },
    });
    ids.quotes.push(q.id);
    return q.id;
  }
  async function ev(stage: string, occurredAt: string, p: { source?: string; designId?: string; quoteId?: string; projectId?: string } = {}) {
    const e = await client.funnelEvent.create({
      data: { stage: stage as never, occurredAt: new Date(occurredAt), source: p.source ?? null, designId: p.designId ?? null, quoteId: p.quoteId ?? null, projectId: p.projectId ?? null },
    });
    ids.events.push(e.id);
  }

  it('summer window: exact counts, Toronto midnight boundary, no PII selected', async () => {
    const { loadFunnelReport } = await import('@/lib/funnel-report');
    // 2024-07-15T16:00Z = 12:00 Toronto (EDT). 7-day window starts Toronto 2024-07-09 00:00 = 04:00Z.
    const now = new Date('2024-07-15T16:00:00Z');
    const D = (n: number) => did(n);

    const q0 = await quote(new Date('2024-07-09T03:59:59Z')); // Toronto 8 Jul 23:59:59 -> OUT
    const q1 = await quote(new Date('2024-07-09T04:00:00Z')); // Toronto 9 Jul 00:00:00 -> IN
    const q2 = await quote(new Date('2024-07-10T15:00:00Z'));
    const q3 = await quote(new Date('2024-07-11T15:00:00Z'));
    const q4 = await quote(new Date('2024-07-12T15:00:00Z'), D(4));

    // Appointments: two in window, one just before it.
    for (const [qid, at] of [[q1, '2024-07-09T04:00:00Z'], [q2, '2024-07-10T15:05:00Z'], [q0, '2024-07-09T03:59:59Z']] as const) {
      const a = await client.appointment.create({
        data: { quoteRequestId: qid, startsAt: new Date('2024-08-01T15:00:00Z'), customerName: 'Pat Pii-Name', customerEmail: 'pii@example.test', createdAt: new Date(at) },
      });
      void a;
    }

    // Ledger.
    const project = randomUUID();
    await ev('LEAD_CAPTURED', '2024-07-09T03:59:59Z', { source: 'pricing', quoteId: q0 }); // OUT
    await ev('LEAD_CAPTURED', '2024-07-09T04:00:00Z', { source: 'pricing', quoteId: q1 });
    await ev('LEAD_CAPTURED', '2024-07-10T15:00:00Z', { source: 'assistant', quoteId: q2 });
    await ev('LEAD_CAPTURED', '2024-07-11T15:00:00Z', { source: 'assistant', quoteId: q3 });
    await ev('LEAD_CAPTURED', '2024-07-12T15:00:00Z', { source: 'estimate-form', designId: D(4), quoteId: q4 });
    await ev('APPOINTMENT_BOOKED', '2024-07-09T04:00:00Z', { source: 'booking', quoteId: q1 });
    await ev('APPOINTMENT_BOOKED', '2024-07-10T15:05:00Z', { source: 'assistant', quoteId: q2 });
    await ev('QUOTE_ISSUED', '2024-07-13T15:00:00Z', { quoteId: q1 });
    await ev('QUOTE_ACCEPTED', '2024-07-14T15:00:00Z', { quoteId: q1, projectId: project });
    await ev('DEPOSIT_PAID', '2024-07-15T15:00:00Z', { projectId: project });
    await ev('DEPOSIT_PAID', '2024-07-15T16:00:01Z', { projectId: randomUUID() }); // after `now` -> OUT

    // Quote recovery (createdAt cohort): 3 requested in window, 2 confirmed, 1 sent, 1 converted; 1 before window.
    const rec = async (createdAt: string, p: Record<string, Date> = {}) => {
      const r = await client.quoteRecovery.create({
        data: { email: `rec-${tag}-${ids.recs.length}@example.test`, consentedAt: new Date(createdAt), createdAt: new Date(createdAt), ...p },
      });
      ids.recs.push(r.id);
    };
    const t = (s: string) => new Date(s);
    await rec('2024-07-09T03:59:59Z', { confirmedAt: t('2024-07-10T00:00:00Z') }); // OUT
    await rec('2024-07-09T04:00:00Z', { confirmedAt: t('2024-07-09T05:00:00Z'), sentAt: t('2024-07-09T08:00:00Z'), convertedAt: t('2024-07-09T09:00:00Z') });
    await rec('2024-07-11T10:00:00Z', { confirmedAt: t('2024-07-11T10:30:00Z') });
    await rec('2024-07-12T10:00:00Z');

    // Assistant: handoff = a lead on the same design id captured at/after the conversation.
    const conv = async (designId: string, createdAt: string) => {
      const c = await client.assistantConversation.create({ data: { designId, createdAt: new Date(createdAt) } });
      ids.convs.push(c.id);
    };
    await conv(D(4), '2024-07-11T00:00:00Z'); // q4 (design D4) created Jul 12 -> handoff
    await conv(D(5), '2024-07-11T00:00:00Z'); // no lead
    await conv(D(6), '2024-07-12T00:00:00Z'); // lead on D6 is older than the conversation -> no handoff
    await quote(new Date('2024-07-11T00:00:00Z'), D(6));
    await conv(D(7), '2024-07-09T03:59:59Z'); // OUT of window

    queries.length = 0;
    const out = await loadFunnelReport(7, now, client as never);

    expect(out.from).toBe('2024-07-09T04:00:00.000Z');
    expect(out.timezone).toBe('America/Toronto');
    const r = out.report;

    expect(r.period.firstTouch).toEqual({ count: null, note: 'not recorded' });
    expect(r.period.stages.map((s) => [s.stage, s.count])).toEqual([
      ['LEAD_CAPTURED', 4], ['APPOINTMENT_BOOKED', 2], ['QUOTE_ISSUED', 1], ['QUOTE_ACCEPTED', 1], ['DEPOSIT_PAID', 1], ['JOB_COMPLETED', 0],
    ]);

    const all = r.cohort.rows.find((x) => x.channel === 'ALL')!;
    expect(all.counts).toEqual({ LEAD_CAPTURED: 4, APPOINTMENT_BOOKED: 2, QUOTE_ISSUED: 1, QUOTE_ACCEPTED: 1, DEPOSIT_PAID: 1, JOB_COMPLETED: 0 });
    expect(all.stepRates).toMatchObject({ APPOINTMENT_BOOKED: 50, QUOTE_ISSUED: 50, QUOTE_ACCEPTED: 100, DEPOSIT_PAID: 100, JOB_COMPLETED: 0 });
    const byCh = Object.fromEntries(r.cohort.rows.map((x) => [x.channel, x.counts.LEAD_CAPTURED]));
    expect(byCh).toMatchObject({ ALL: 4, ESTIMATE_FORM: 1, ASSISTANT: 2, FLOOR_STUDIO: 1 });
    expect(r.cohort.rows.find((x) => x.channel === 'ASSISTANT')!.counts.APPOINTMENT_BOOKED).toBe(1);

    // q1..q4 plus the D6 quote are in the window (q0 is not); 2 appointments in window.
    expect(r.reconciliation.quoteRequests).toEqual({ databaseRows: 5, ledgerLeads: 4 });
    expect(r.reconciliation.appointments).toEqual({ databaseRows: 2, ledgerAppointments: 2 });

    expect(r.quoteRecovery).toMatchObject({ requested: 3, confirmed: 2, sent: 1, converted: 1 });
    expect(r.quoteRecovery.rates).toEqual({ confirmed: 66.7, sent: 50, converted: 100 });

    expect(r.assistant).toEqual({ conversationsCreated: 3, withLeadHandoff: 1, handoffRate: 33.3 });

    // No PII column is read by any statement the report issues.
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q).not.toMatch(/"(email|name|phone|address|city|notes|adminNotes|customerName|customerEmail|customerPhone|sendLastError|reviewEmailLastError|title)"/);
    }
    // And nothing identifying leaks into the serialised report.
    expect(JSON.stringify(out)).not.toMatch(/Pii|example\.test|416-555|Secret St/);
  });

  it('winter window uses the EST offset: Toronto midnight is 05:00Z', async () => {
    const { loadFunnelReport } = await import('@/lib/funnel-report');
    const now = new Date('2024-01-15T16:00:00Z');
    await ev('LEAD_CAPTURED', '2024-01-09T04:59:59Z', { source: 'pricing' }); // Toronto 8 Jan 23:59:59 -> OUT
    await ev('LEAD_CAPTURED', '2024-01-09T05:00:00Z', { source: 'pricing' }); // Toronto 9 Jan 00:00:00 -> IN
    const out = await loadFunnelReport(7, now, client as never);
    expect(out.from).toBe('2024-01-09T05:00:00.000Z');
    expect(out.report.period.stages[0]).toMatchObject({ stage: 'LEAD_CAPTURED', count: 1 });
    expect(out.report.cohort.rows[0]!.unlinkedLeads).toBe(1);
  });

  it('counts messages that could not be sent (aggregates only; the stored error text is never read)', async () => {
    const { loadFunnelReport } = await import('@/lib/funnel-report');
    const now = new Date('2024-03-20T16:00:00Z'); // a window no other test seeds
    const t = (v: string) => new Date(v);
    const base = { consentedAt: t('2024-03-18T00:00:00Z'), createdAt: t('2024-03-18T10:00:00Z'), confirmedAt: t('2024-03-18T11:00:00Z') };
    // The error text contains an address on purpose: it must never be read by the report.
    const failed = { sendAttempts: 5, sendLastError: `Resend error: not allowed for pii-${tag}@example.test` };
    const mk = async (n: string, extra: Record<string, unknown>) => {
      const r = await client.quoteRecovery.create({ data: { email: `rec-${tag}-${n}@example.test`, ...base, ...extra } });
      ids.recs.push(r.id);
    };
    await mk('x1', failed); // exhausted: counts
    await mk('x2', { sendAttempts: 4 }); // still retrying: does not count
    await mk('x3', { ...failed, convertedAt: t('2024-03-18T12:00:00Z') }); // converted anyway: does not count
    await mk('x4', { ...failed, sentAt: t('2024-03-18T13:00:00Z') }); // delivered: does not count
    await mk('x5', { ...failed, createdAt: t('2024-03-01T10:00:00Z') }); // before the window: does not count

    const user = await client.user.create({ data: { email: `fr-${tag}@example.test`, name: 'Pat Pii-Name' } });
    ids.users.push(user.id);
    const mkProject = async (extra: Record<string, unknown>) => {
      const p = await client.project.create({ data: { userId: user.id, title: `FR-${tag}`, status: 'COMPLETED', ...extra } });
      await client.$executeRaw`UPDATE "ecowoods"."Project" SET "updatedAt" = ${t('2024-03-19T10:00:00Z')} WHERE "id" = ${p.id}::uuid`;
      ids.projects.push(p.id);
    };
    await mkProject({ reviewEmailAttempts: 5, reviewEmailLastError: `boom for pii-${tag}@example.test` }); // counts
    await mkProject({ reviewEmailAttempts: 4 }); // does not
    await mkProject({ reviewEmailAttempts: 5, reviewRequestedAt: t('2024-03-19T11:00:00Z') }); // sent: does not

    queries.length = 0;
    const out = await loadFunnelReport(7, now, client as never);
    expect(out.report.quoteRecovery).toMatchObject({ requested: 4, couldNotBeSent: 1, reviewRequestsCouldNotBeSent: 1 });
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q).not.toMatch(/"(email|name|phone|address|city|notes|adminNotes|customerName|customerEmail|customerPhone|sendLastError|reviewEmailLastError|title)"/);
    }
    expect(JSON.stringify(out)).not.toMatch(/Pii|example\.test|not allowed|boom/);
  });
});
