/**
 * Real PostgreSQL checks for lib/credit-ledger.ts beyond the two-way race in
 * credits-concurrency.postgres.integration.test.ts: N-way parallel debit with
 * distinct keys, idempotent replay, cross-user key conflict, failed compute,
 * and the grant idempotency key. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('credit ledger against real PostgreSQL', () => {
  const userIds: string[] = [];

  async function newUser(balance?: number) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `ledger-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    if (balance !== undefined) await db.creditWallet.create({ data: { userId: user.id, balance } });
    return user;
  }

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    for (const id of userIds) {
      await db.renovationAnalysis.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  const charge = async (userId: string, credits: number, key: string, extra: Record<string, unknown> = {}) => {
    const { chargeForAnalysis } = await import('@/lib/credit-ledger');
    return chargeForAnalysis({ userId, credits, requestIdempotencyKey: key, contextSnapshot: {}, compute: () => ({ ok: true }), ...extra });
  };

  it('12 parallel charges with different keys against a balance for one: exactly one succeeds, balance never negative', async () => {
    const { db } = await import('@/lib/db');
    const user = await newUser(5);
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => charge(user.id, 5, `par-${randomUUID()}`)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const failed = outcomes.filter((o) => !o.ok);
    expect(failed).toHaveLength(11);
    expect(failed.every((o) => !o.ok && o.error === 'insufficient_credits')).toBe(true);
    const wallet = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(0);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: 'SETTLE' } })).toBe(1);
    expect(await db.renovationAnalysis.count({ where: { userId: user.id } })).toBe(1);
  });

  it('with balance for exactly 3 of 8 parallel charges: exactly 3 succeed and the ledger sums to the balance', async () => {
    const { db } = await import('@/lib/db');
    const user = await newUser(15);
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => charge(user.id, 5, `par3-${randomUUID()}`)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(3);
    const wallet = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(0);
    const sum = await db.creditTransaction.aggregate({ where: { userId: user.id }, _sum: { credits: true } });
    expect(sum._sum.credits).toBe(-15);
  });

  it('a user with no wallet row gets one created and is denied, never charged', async () => {
    const { db } = await import('@/lib/db');
    const user = await newUser();
    const out = await charge(user.id, 5, `nowallet-${randomUUID()}`);
    expect(out).toMatchObject({ ok: false, error: 'insufficient_credits', balance: 0, required: 5 });
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(0);
  });

  it('concurrent FIRST charges by a user with no wallet row never throw (wallet get-or-create is race-safe)', async () => {
    for (let i = 0; i < 10; i++) {
      const user = await newUser();
      const settled = await Promise.allSettled(Array.from({ length: 6 }, () => charge(user.id, 5, `first-${randomUUID()}`)));
      expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
      expect(settled.every((s) => s.status === 'fulfilled' && !s.value.ok && s.value.error === 'insufficient_credits')).toBe(true);
    }
  });

  it('replaying the same key (sequential and concurrent) charges once and returns the stored result', async () => {
    const { db } = await import('@/lib/db');
    const user = await newUser(20);
    const key = `replay-${randomUUID()}`;
    const first = await charge(user.id, 5, key);
    expect(first).toMatchObject({ ok: true, replay: false, balance: 15 });
    const second = await charge(user.id, 5, key);
    expect(second).toMatchObject({ ok: true, replay: true, balance: 15 });
    if (first.ok && second.ok) expect(second.analysisId).toBe(first.analysisId);

    const racing = `replay-race-${randomUUID()}`;
    const raced = await Promise.all(Array.from({ length: 6 }, () => charge(user.id, 5, racing)));
    expect(raced.every((o) => o.ok)).toBe(true);
    expect(raced.filter((o) => o.ok && !o.replay)).toHaveLength(1);
    expect(new Set(raced.map((o) => (o.ok ? o.analysisId : ''))).size).toBe(1);
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(10);
  });

  it('a key already used by another user is a conflict and moves no credits for either', async () => {
    const { db } = await import('@/lib/db');
    const owner = await newUser(10);
    const other = await newUser(10);
    const key = `shared-${randomUUID()}`;
    expect((await charge(owner.id, 5, key)).ok).toBe(true);
    expect(await charge(other.id, 5, key)).toEqual({ ok: false, error: 'idempotency_key_conflict' });
    const racing = `shared-race-${randomUUID()}`;
    const both = await Promise.all([charge(owner.id, 5, racing), charge(other.id, 5, racing)]);
    expect(both.filter((o) => o.ok)).toHaveLength(1);
    expect(both.filter((o) => !o.ok && o.error === 'idempotency_key_conflict')).toHaveLength(1);
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: owner.id } })).balance + (await db.creditWallet.findUniqueOrThrow({ where: { userId: other.id } })).balance).toBe(10);
  });

  it('a throwing compute charges nothing, records a FAILED row, and replays as compute_failed', async () => {
    const { db } = await import('@/lib/db');
    const { chargeForAnalysis } = await import('@/lib/credit-ledger');
    const user = await newUser(5);
    const key = `boom-${randomUUID()}`;
    const run = () =>
      chargeForAnalysis({ userId: user.id, credits: 5, requestIdempotencyKey: key, contextSnapshot: {}, compute: () => { throw new Error('engine exploded'); } });
    expect(await run()).toMatchObject({ ok: false, error: 'compute_failed', message: 'engine exploded' });
    expect(await run()).toMatchObject({ ok: false, error: 'compute_failed' });
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(5);
    const row = await db.renovationAnalysis.findUniqueOrThrow({ where: { requestIdempotencyKey: key } });
    expect(row).toMatchObject({ status: 'FAILED', creditsCharged: 0 });
  });

  it('grantCreditsForOrder: parallel duplicate grants credit once; the idempotencyKey is unique in the schema', async () => {
    const { db } = await import('@/lib/db');
    const { grantCreditsForOrder } = await import('@/lib/credit-ledger');
    const user = await newUser(); // no wallet yet: also races the first-time wallet upsert
    const orderId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => grantCreditsForOrder({ userId: user.id, orderId, credits: 40, reason: 'it' })),
    );
    expect(results.filter((r) => r.granted)).toHaveLength(1);
    expect(results.filter((r) => r.reason === 'already_granted')).toHaveLength(5);
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(40);
    expect(await db.creditTransaction.count({ where: { idempotencyKey: `order-grant:${orderId}` } })).toBe(1);

    const wallet = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    await expect(
      db.creditTransaction.create({
        data: { walletId: wallet.id, userId: user.id, type: 'GRANT', credits: 1, reason: 'dup', idempotencyKey: `order-grant:${orderId}` },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
