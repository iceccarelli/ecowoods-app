/**
 * credit-ledger.integration.test.ts — REAL Postgres integration tests, not
 * mocks. Runs the actual Prisma migration's tables (CreditWallet,
 * CreditTransaction) against a real transaction, real unique constraints,
 * real row locks.
 *
 * Skipped automatically when DATABASE_URL isn't set (CI/sandboxes without a
 * database) — see ASSISTANT_PHASE3_COMMERCIAL_AUDIT.md for how this was run
 * against a real local Postgres 16 instance and what that verified.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('credit-ledger (real Postgres)', () => {
  // Dynamic imports so `db` (which reads DATABASE_URL at module load) is only
  // constructed when a database is actually configured.
  let db: typeof import('@/lib/db').db;
  let ledger: typeof import('./credit-ledger');
  let userId: string;

  beforeAll(async () => {
    db = (await import('@/lib/db')).db;
    ledger = await import('./credit-ledger');
    const user = await db.user.create({
      data: { email: `ledger-test-${randomUUID()}@example.com`, name: 'Ledger Test' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.creditTransaction.deleteMany({ where: { wallet: { userId } } });
    await db.creditWallet.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it('grants credits and creates the wallet on first interaction', async () => {
    const out = await ledger.grantCredits({
      userId,
      amount: 50,
      type: 'PURCHASE',
      reason: 'credit_pack_purchase',
      idempotencyKey: `grant-${randomUUID()}`,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.balance).toBe(50);
    const summary = await ledger.getWalletSummary(userId);
    expect(summary).toEqual({ balance: 50, reserved: 0 });
  });

  it('a repeated grant with the SAME idempotency key does not double-credit', async () => {
    const key = `grant-dup-${randomUUID()}`;
    const first = await ledger.grantCredits({ userId, amount: 20, type: 'PROMOTIONAL_GRANT', reason: 'promo', idempotencyKey: key });
    const second = await ledger.grantCredits({ userId, amount: 20, type: 'PROMOTIONAL_GRANT', reason: 'promo', idempotencyKey: key });
    expect(first.ok && !first.duplicate).toBe(true);
    expect(second.ok && second.duplicate).toBe(true);
    // balance moved by 20 exactly once, not 40
    if (first.ok && second.ok) expect(first.value.balance).toBe(second.value.balance);
  });

  it('two grants fired concurrently with the same key settle to exactly one credit', async () => {
    const key = `grant-race-${randomUUID()}`;
    const before = (await ledger.getWalletSummary(userId))!.balance;
    const [a, b] = await Promise.all([
      ledger.grantCredits({ userId, amount: 7, type: 'PROMOTIONAL_GRANT', reason: 'race', idempotencyKey: key }),
      ledger.grantCredits({ userId, amount: 7, type: 'PROMOTIONAL_GRANT', reason: 'race', idempotencyKey: key }),
    ]);
    const after = (await ledger.getWalletSummary(userId))!.balance;
    expect(after - before).toBe(7);
    expect([a.ok && a.duplicate, b.ok && b.duplicate].filter(Boolean)).toHaveLength(1);
  });

  it('reserve moves balance into reserved, settle consumes it, and balance never goes negative', async () => {
    const analysisId = randomUUID();
    const before = await ledger.getWalletSummary(userId);
    const reserve = await ledger.reserveCredits({
      userId,
      amount: 15,
      analysisId,
      idempotencyKey: `reserve-${analysisId}`,
    });
    expect(reserve.ok).toBe(true);
    const afterReserve = await ledger.getWalletSummary(userId);
    expect(afterReserve!.balance).toBe(before!.balance - 15);
    expect(afterReserve!.reserved).toBe(before!.reserved + 15);

    const settle = await ledger.settleReservation({ analysisId, idempotencyKey: `settle-${analysisId}` });
    expect(settle.ok).toBe(true);
    const afterSettle = await ledger.getWalletSummary(userId);
    expect(afterSettle!.balance).toBe(before!.balance - 15); // spent, not returned
    expect(afterSettle!.reserved).toBe(before!.reserved); // reservation cleared
  });

  it('reserve then release returns the credits to spendable balance', async () => {
    const analysisId = randomUUID();
    const before = await ledger.getWalletSummary(userId);
    await ledger.reserveCredits({ userId, amount: 10, analysisId, idempotencyKey: `reserve-${analysisId}` });
    const release = await ledger.releaseReservation({ analysisId, idempotencyKey: `release-${analysisId}` });
    expect(release.ok).toBe(true);
    const after = await ledger.getWalletSummary(userId);
    expect(after).toEqual(before); // fully reversed — no net charge
  });

  it('rejects a reservation larger than the available balance', async () => {
    const summary = await ledger.getWalletSummary(userId);
    const tooMany = summary!.balance + 1000;
    const analysisId = randomUUID();
    const out = await ledger.reserveCredits({ userId, amount: tooMany, analysisId, idempotencyKey: `reserve-${analysisId}` });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('insufficient_balance');
  });

  it('settling twice (duplicate webhook / retry) never double-spends', async () => {
    const analysisId = randomUUID();
    await ledger.reserveCredits({ userId, amount: 5, analysisId, idempotencyKey: `reserve-${analysisId}` });
    const before = await ledger.getWalletSummary(userId);
    const first = await ledger.settleReservation({ analysisId, idempotencyKey: `settle-${analysisId}` });
    const second = await ledger.settleReservation({ analysisId, idempotencyKey: `settle-${analysisId}` });
    const after = await ledger.getWalletSummary(userId);
    expect(first.ok && !first.duplicate).toBe(true);
    expect(second.ok && second.duplicate).toBe(true);
    expect(after!.reserved).toBe(before!.reserved - 5); // moved once, not twice
  });

  it('cannot settle AND release the same reservation — the second call finds nothing open', async () => {
    const analysisId = randomUUID();
    await ledger.reserveCredits({ userId, amount: 5, analysisId, idempotencyKey: `reserve-${analysisId}` });
    const settle = await ledger.settleReservation({ analysisId, idempotencyKey: `settle-${analysisId}` });
    expect(settle.ok).toBe(true);
    const release = await ledger.releaseReservation({ analysisId, idempotencyKey: `release-${analysisId}` });
    // Already resolved by SETTLE — releasing now must not hand the credits back a second time.
    expect(release.ok).toBe(false);
  });

  it('refunding a settled analysis returns credits to spendable balance', async () => {
    const analysisId = randomUUID();
    await ledger.reserveCredits({ userId, amount: 8, analysisId, idempotencyKey: `reserve-${analysisId}` });
    await ledger.settleReservation({ analysisId, idempotencyKey: `settle-${analysisId}` });
    const beforeRefund = await ledger.getWalletSummary(userId);
    const refund = await ledger.refundSettledAnalysis({ analysisId, idempotencyKey: `refund-${analysisId}`, reason: 'support decision' });
    expect(refund.ok).toBe(true);
    const afterRefund = await ledger.getWalletSummary(userId);
    expect(afterRefund!.balance).toBe(beforeRefund!.balance + 8);
  });
});
