/**
 * Real PostgreSQL audit of two journey primitives that unit mocks cannot judge:
 *
 *   - recordFunnelEventOnce must hold its promise ("at most once per quote or
 *     project") under simultaneous callers, not only for sequential ones;
 *   - findRecentDuplicate must treat two different properties as two requests.
 *
 * Enabled only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('journey primitives against real PostgreSQL', () => {
  const prefix = `jl-${randomUUID()}`;
  const quoteIds: string[] = [];
  const projectIds: string[] = [];

  afterAll(async () => {
    const { db } = await import('@/lib/db');
    try {
      await db.funnelEvent.deleteMany({ where: { OR: [{ quoteId: { in: quoteIds } }, { projectId: { in: projectIds } }] } });
      await db.quoteRequest.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  });

  it('records a stage once per quote even when the admin double-clicks (simultaneous calls)', async () => {
    const { recordFunnelEventOnce } = await import('@/lib/funnel-ledger');
    const { db } = await import('@/lib/db');
    const quoteId = randomUUID();
    quoteIds.push(quoteId);
    await Promise.all(Array.from({ length: 8 }, () => recordFunnelEventOnce({ stage: 'QUOTE_ISSUED', quoteId, amountCad: 1000 })));
    expect(await db.funnelEvent.count({ where: { stage: 'QUOTE_ISSUED', quoteId } })).toBe(1);
  });

  it('records a stage once per project under simultaneous calls, and a different stage or project is not suppressed', async () => {
    const { recordFunnelEventOnce } = await import('@/lib/funnel-ledger');
    const { db } = await import('@/lib/db');
    const a = randomUUID();
    const b = randomUUID();
    projectIds.push(a, b);
    await Promise.all([
      ...Array.from({ length: 6 }, () => recordFunnelEventOnce({ stage: 'JOB_COMPLETED', projectId: a })),
      ...Array.from({ length: 6 }, () => recordFunnelEventOnce({ stage: 'JOB_COMPLETED', projectId: b })),
      ...Array.from({ length: 6 }, () => recordFunnelEventOnce({ stage: 'DEPOSIT_PAID', projectId: a })),
    ]);
    expect(await db.funnelEvent.count({ where: { stage: 'JOB_COMPLETED', projectId: a } })).toBe(1);
    expect(await db.funnelEvent.count({ where: { stage: 'JOB_COMPLETED', projectId: b } })).toBe(1);
    expect(await db.funnelEvent.count({ where: { stage: 'DEPOSIT_PAID', projectId: a } })).toBe(1);
  });

  it('a ledger failure inside the once-guard is swallowed, never thrown', async () => {
    const { recordFunnelEventOnce } = await import('@/lib/funnel-ledger');
    const { db } = await import('@/lib/db');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tx = vi.spyOn(db, '$transaction').mockRejectedValue(new Error('boom'));
    const find = vi.spyOn(db.funnelEvent, 'findFirst').mockRejectedValue(new Error('boom'));
    try {
      await expect(recordFunnelEventOnce({ stage: 'QUOTE_ISSUED', quoteId: randomUUID() })).resolves.toBeUndefined();
    } finally {
      tx.mockRestore();
      find.mockRestore();
      spy.mockRestore();
    }
  });

  it('two different properties from one household inside the window are two requests, not one', async () => {
    const { findRecentDuplicate } = await import('@/lib/lead-dedupe');
    const { db } = await import('@/lib/db');
    const email = `${prefix}-hh@example.test`;
    const first = await db.quoteRequest.create({
      data: { name: 'Pat Owner', email, phone: '416-555-0111', address: 'M5V 2T6', service: 'refinishing' },
    });
    const lead = { email, phone: '416-555-0111', service: 'refinishing' };
    // Same property, however it is typed: the retry it always was.
    expect(await findRecentDuplicate(db, { ...lead, place: ' m5v 2t6 ' })).toBe(first.id);
    // The chat tool stores the postal in `city`; a lead without a place keeps the old rule.
    expect(await findRecentDuplicate(db, lead)).toBe(first.id);
    // A different property is a different job.
    expect(await findRecentDuplicate(db, { ...lead, place: 'L4C 9X9' })).toBeNull();
  });
});
