/**
 * lib/assistant-workspace/credit-ledger.ts — the Renovation Credits ledger
 * engine. Server-authoritative, transactional, idempotent by construction —
 * see ASSISTANT_CREDIT_LEDGER_SPEC.md for the full design.
 *
 * Every mutating function here:
 *  1. Runs inside one `db.$transaction` — the balance read, the ledger row
 *     insert, and the wallet update commit together or not at all.
 *  2. Takes row locks on the wallet (`SELECT ... FOR UPDATE`) before reading
 *     balance/reserved, so two concurrent requests for the same wallet
 *     (double-click, a browser retry racing a slow first request) serialize
 *     instead of both reading a stale balance and both succeeding.
 *  3. Requires an `idempotencyKey`, unique at the database level
 *     (`CreditTransaction.idempotencyKey`) — a retried call with the same key
 *     is detected via the unique-constraint violation and returns the
 *     ALREADY-COMMITTED result rather than mutating the balance twice. This
 *     is the actual double-charge prevention mechanism (a DB constraint),
 *     not an application-level "have I seen this before" check that a race
 *     could still slip past.
 *
 * Never trust a client-sent amount here — every caller (chat route, webhook,
 * analysis route) resolves `amount`/`creditCost` from server-side config
 * before calling into this module. This module itself doesn't know or care
 * where the number came from; it just makes the bookkeeping correct once one
 * is decided.
 */
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type LedgerError = 'not_found' | 'insufficient_balance' | 'reservation_not_found' | 'reservation_already_resolved';

export type LedgerResult<T> = { ok: true; value: T; duplicate: boolean } | { ok: false; error: LedgerError };

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

interface WalletRow {
  id: string;
  balance: number;
  reserved: number;
}

/** Row-locks and returns the wallet, creating it if this is the user's first ledger interaction. Must be called inside an existing `tx`. */
async function lockOrCreateWallet(tx: Prisma.TransactionClient, userId: string): Promise<WalletRow> {
  const existing = await tx.$queryRaw<WalletRow[]>`
    SELECT id, balance, reserved FROM "ecowoods"."CreditWallet" WHERE "userId" = ${userId}::uuid FOR UPDATE
  `;
  if (existing[0]) return existing[0];
  const created = await tx.creditWallet.create({ data: { userId } });
  return { id: created.id, balance: created.balance, reserved: created.reserved };
}

export async function getWalletSummary(userId: string): Promise<{ balance: number; reserved: number } | null> {
  const wallet = await db.creditWallet.findUnique({ where: { userId } });
  if (!wallet) return null;
  return { balance: wallet.balance, reserved: wallet.reserved };
}

/**
 * Add credits (a Stripe-paid purchase, or a promotional grant). Called from
 * the Stripe webhook (purchase, `orderId` set) or an admin/marketing path
 * (promotional grant, no `orderId`) — never from a client-facing route
 * without a corresponding paid Order or an explicit admin action.
 */
export async function grantCredits(params: {
  userId: string;
  amount: number;
  type: 'PURCHASE' | 'PROMOTIONAL_GRANT';
  reason: string;
  orderId?: string;
  idempotencyKey: string;
}): Promise<LedgerResult<{ balance: number }>> {
  if (params.amount <= 0) throw new Error('grantCredits: amount must be positive');
  /*
   * The idempotency-violation recovery read happens OUTSIDE this
   * transaction, deliberately. Postgres aborts an entire transaction the
   * moment one statement inside it violates a constraint (error 25P02,
   * "current transaction is aborted") — every later statement in that same
   * transaction fails too, including a read meant to recover from the first
   * failure. This was caught by the real-Postgres integration test
   * (`credit-ledger.integration.test.ts`), not by inspection: a mocked
   * Prisma client would have let a post-catch query inside the same
   * transaction silently "succeed." See ASSISTANT_PHASE3_COMMERCIAL_AUDIT.md.
   */
  try {
    return await db.$transaction(async (tx) => {
      const wallet = await lockOrCreateWallet(tx, params.userId);
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: params.type,
          amount: params.amount,
          reason: params.reason,
          orderId: params.orderId,
          idempotencyKey: params.idempotencyKey,
        },
      });
      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: params.amount } },
      });
      return { ok: true as const, value: { balance: updated.balance }, duplicate: false };
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      const current = await db.creditWallet.findFirst({ where: { userId: params.userId } });
      return { ok: true, value: { balance: current?.balance ?? 0 }, duplicate: true };
    }
    throw err;
  }
}

/**
 * Hold credits against a specific analysis BEFORE running it — rule 14/31's
 * reserve step. Fails with `insufficient_balance` rather than allowing a
 * negative balance; fails with `not_found` if the user has never had a
 * wallet interaction (grantCredits/ensureWallet not yet called for them).
 */
export async function reserveCredits(params: {
  userId: string;
  amount: number;
  analysisId: string;
  idempotencyKey: string;
}): Promise<LedgerResult<{ walletId: string }>> {
  if (params.amount <= 0) throw new Error('reserveCredits: amount must be positive');
  return db.$transaction(async (tx) => {
    const wallet = await lockOrCreateWallet(tx, params.userId);
    if (wallet.balance < params.amount) {
      return { ok: false, error: 'insufficient_balance' };
    }
    try {
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'RESERVE',
          amount: params.amount,
          reason: 'renovation_decision_analysis',
          analysisId: params.analysisId,
          idempotencyKey: params.idempotencyKey,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        return { ok: true, value: { walletId: wallet.id }, duplicate: true };
      }
      throw err;
    }
    await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: params.amount }, reserved: { increment: params.amount } },
    });
    return { ok: true, value: { walletId: wallet.id }, duplicate: false };
  });
}

/** Find the still-open RESERVE transaction for an analysis, inside an existing tx. */
async function findOpenReservation(tx: Prisma.TransactionClient, analysisId: string) {
  const reserve = await tx.creditTransaction.findFirst({ where: { analysisId, type: 'RESERVE' } });
  if (!reserve) return null;
  const resolved = await tx.creditTransaction.findFirst({
    where: { analysisId, type: { in: ['SETTLE', 'RELEASE'] } },
  });
  return resolved ? null : reserve;
}

/**
 * The analysis succeeded — the reserved credits are spent. Moves
 * wallet.reserved down by the reservation amount; balance does NOT increase
 * (the credits are gone, not returned).
 */
export async function settleReservation(params: {
  analysisId: string;
  idempotencyKey: string;
}): Promise<LedgerResult<{ settled: number }>> {
  return db.$transaction(async (tx) => {
    const reserve = await findOpenReservation(tx, params.analysisId);
    if (!reserve) {
      const alreadySettled = await tx.creditTransaction.findFirst({
        where: { analysisId: params.analysisId, type: 'SETTLE' },
      });
      if (alreadySettled) return { ok: true, value: { settled: alreadySettled.amount }, duplicate: true };
      return { ok: false, error: 'reservation_not_found' };
    }
    try {
      await tx.creditTransaction.create({
        data: {
          walletId: reserve.walletId,
          type: 'SETTLE',
          amount: reserve.amount,
          reason: 'renovation_decision_analysis',
          analysisId: params.analysisId,
          idempotencyKey: params.idempotencyKey,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        return { ok: true, value: { settled: reserve.amount }, duplicate: true };
      }
      throw err;
    }
    await tx.creditWallet.update({
      where: { id: reserve.walletId },
      data: { reserved: { decrement: reserve.amount } },
    });
    return { ok: true, value: { settled: reserve.amount }, duplicate: false };
  });
}

/**
 * The analysis failed (provider error, timeout, cancellation before
 * execution) — the reservation is released back to spendable balance. No
 * charge, per rule 32.
 */
export async function releaseReservation(params: {
  analysisId: string;
  idempotencyKey: string;
  reason?: string;
}): Promise<LedgerResult<{ released: number }>> {
  return db.$transaction(async (tx) => {
    const reserve = await findOpenReservation(tx, params.analysisId);
    if (!reserve) {
      const alreadyReleased = await tx.creditTransaction.findFirst({
        where: { analysisId: params.analysisId, type: 'RELEASE' },
      });
      if (alreadyReleased) return { ok: true, value: { released: alreadyReleased.amount }, duplicate: true };
      return { ok: false, error: 'reservation_not_found' };
    }
    try {
      await tx.creditTransaction.create({
        data: {
          walletId: reserve.walletId,
          type: 'RELEASE',
          amount: reserve.amount,
          reason: params.reason ?? 'analysis_failed',
          analysisId: params.analysisId,
          idempotencyKey: params.idempotencyKey,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        return { ok: true, value: { released: reserve.amount }, duplicate: true };
      }
      throw err;
    }
    await tx.creditWallet.update({
      where: { id: reserve.walletId },
      data: { balance: { increment: reserve.amount }, reserved: { decrement: reserve.amount } },
    });
    return { ok: true, value: { released: reserve.amount }, duplicate: false };
  });
}

/** A settled analysis refunded after the fact (support decision) — returns credits to spendable balance. Distinct from RELEASE (which un-does a reservation that never settled). */
export async function refundSettledAnalysis(params: {
  analysisId: string;
  idempotencyKey: string;
  reason: string;
}): Promise<LedgerResult<{ refunded: number }>> {
  return db.$transaction(async (tx) => {
    const settle = await tx.creditTransaction.findFirst({ where: { analysisId: params.analysisId, type: 'SETTLE' } });
    if (!settle) return { ok: false, error: 'reservation_not_found' };
    try {
      await tx.creditTransaction.create({
        data: {
          walletId: settle.walletId,
          type: 'REFUND',
          amount: settle.amount,
          reason: params.reason,
          analysisId: params.analysisId,
          idempotencyKey: params.idempotencyKey,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        return { ok: true, value: { refunded: settle.amount }, duplicate: true };
      }
      throw err;
    }
    await tx.creditWallet.update({
      where: { id: settle.walletId },
      data: { balance: { increment: settle.amount } },
    });
    return { ok: true, value: { refunded: settle.amount }, duplicate: false };
  });
}
