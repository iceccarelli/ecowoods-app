/**
 * lib/credit-ledger.ts — the ONE place Renovation Credits move.
 *
 * Mirrors lib/funnel-ledger.ts's discipline in spirit (a single owned write
 * path for a financial fact) but with the opposite failure posture: a funnel
 * row is a measurement that must never block or fail the commercial action it
 * describes, while a credit grant or charge IS the commercial action — it
 * must fail LOUD and CLOSED. Minting a credit that was never paid for, or
 * charging one twice, is the exact failure mode this file exists to make
 * structurally impossible rather than merely unlikely.
 *
 * THE TWO INVARIANTS
 *
 * 1. A Stripe webhook delivered twice must grant credits once.
 *    `grantCreditsForOrder` writes its CreditTransaction with
 *    `idempotencyKey = order-grant:<orderId>`, `@unique` in the schema. A
 *    retried webhook hits Postgres's unique-constraint error (P2002), which
 *    this function catches and treats as "already granted" — not an error.
 *
 * 2. An analysis must never be charged twice, and never charged for a run
 *    that failed. `chargeForAnalysis` takes a `compute` callback and runs it
 *    INSIDE the same database transaction as the charge: if `compute` throws,
 *    Postgres rolls back the whole transaction, including the balance
 *    decrement and the ledger row — no credits move for a failed analysis.
 *    That transaction boundary is the reservation mechanism (see the schema
 *    comment above `enum CreditTransactionType`); there is no separate
 *    reserve/settle pair to keep in sync because the engine is synchronous.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from '@/lib/db';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION;
}

type Db = PrismaClient | Prisma.TransactionClient;

async function ensureWallet(tx: Db, userId: string) {
  return tx.creditWallet.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
  });
}

export interface GrantResult {
  granted: boolean;
  balance: number;
  reason: 'granted' | 'already_granted';
}

/**
 * Grant credits for a paid Order. Called from the Stripe webhook after the
 * Order has been marked PAID inside the same transaction — see
 * app/api/webhooks/stripe/route.ts's `renovation-credits` branch.
 *
 * Idempotent per `orderId`: a duplicate call (retried webhook, or a second
 * delivery Stripe sends for the same event) returns `{ granted: false,
 * reason: 'already_granted' }` and does not touch the balance again.
 */
export async function grantCreditsForOrder(input: {
  userId: string;
  orderId: string;
  credits: number;
  reason: string;
}): Promise<GrantResult> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new RangeError('grantCreditsForOrder requires a positive integer credit amount.');
  }
  const idempotencyKey = `order-grant:${input.orderId}`;
  try {
    return await db.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx, input.userId);
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: input.userId,
          type: 'GRANT',
          credits: input.credits,
          reason: input.reason,
          orderId: input.orderId,
          idempotencyKey,
        },
      });
      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: input.credits } },
      });
      return { granted: true, balance: updated.balance, reason: 'granted' as const };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await db.creditWallet.findUnique({ where: { userId: input.userId } });
      return { granted: false, balance: existing?.balance ?? 0, reason: 'already_granted' as const };
    }
    throw err;
  }
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await db.creditWallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}

export type ChargeOutcome<T> =
  | { ok: true; result: T; balance: number; analysisId: string; replay: boolean }
  | { ok: false; error: 'insufficient_credits'; balance: number; required: number }
  | { ok: false; error: 'compute_failed'; message: string };

/**
 * Charge `credits` for one Renovation Decision Analysis and persist the
 * result of `compute()`.
 *
 * `requestIdempotencyKey` names this specific request — the client mints one
 * per analysis attempt (a fresh key on a deliberate retry, the same key on a
 * resubmitted/duplicated fetch). A repeat delivery under a key this table has
 * already seen returns the existing row (`replay: true`) instead of running
 * `compute()` or touching the wallet again — the API route never even calls
 * this function twice for one request; this is the second line of defence
 * for the race where two requests under the same key land concurrently.
 *
 * `compute()` runs BEFORE any database write. It is expected to be a pure,
 * synchronous function (lib/assistant-workspace/renovation-analysis.ts) — if
 * it throws, nothing has been charged and nothing was left half-written; a
 * FAILED row is saved afterwards, best-effort, purely for the homeowner (and
 * support) to see that an attempt was made and why it did not go through.
 * The balance check and the charge then happen together in one transaction,
 * so two concurrent requests can never both succeed against a balance that
 * only covers one of them.
 */
export async function chargeForAnalysis<T>(input: {
  userId: string;
  credits: number;
  requestIdempotencyKey: string;
  contextSnapshot: unknown;
  compute: () => T;
}): Promise<ChargeOutcome<T>> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new RangeError('chargeForAnalysis requires a positive integer credit cost.');
  }

  const existing = await db.renovationAnalysis.findUnique({ where: { requestIdempotencyKey: input.requestIdempotencyKey } });
  if (existing) {
    if (existing.status === 'FAILED') {
      return { ok: false, error: 'compute_failed', message: existing.failureReason ?? 'Analysis engine failed.' };
    }
    const balance = await getWalletBalance(input.userId);
    return { ok: true, result: existing.result as T, balance, analysisId: existing.id, replay: true };
  }

  let result: T;
  try {
    result = input.compute();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis engine failed.';
    // Best-effort audit row. Never charged (creditsCharged: 0) — nothing
    // above this line touched the wallet.
    await db.creditWallet
      .upsert({ where: { userId: input.userId }, create: { userId: input.userId, balance: 0 }, update: {} })
      .then((wallet) =>
        db.renovationAnalysis.create({
          data: {
            userId: input.userId,
            walletId: wallet.id,
            status: 'FAILED',
            creditsCharged: 0,
            contextSnapshot: input.contextSnapshot as Prisma.InputJsonValue,
            failureReason: message,
            requestIdempotencyKey: input.requestIdempotencyKey,
          },
        }),
      )
      .catch((persistErr: unknown) =>
        console.error(
          JSON.stringify({
            event: 'credit_ledger.failed_analysis_record_failed',
            userId: input.userId,
            error: persistErr instanceof Error ? persistErr.message : 'unknown',
          }),
        ),
      );
    return { ok: false, error: 'compute_failed', message };
  }

  try {
    return await db.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx, input.userId);
      if (wallet.balance < input.credits) {
        return {
          ok: false as const,
          error: 'insufficient_credits' as const,
          balance: wallet.balance,
          required: input.credits,
        };
      }

      const analysis = await tx.renovationAnalysis.create({
        data: {
          userId: input.userId,
          walletId: wallet.id,
          status: 'COMPLETED',
          creditsCharged: input.credits,
          contextSnapshot: input.contextSnapshot as Prisma.InputJsonValue,
          result: result as Prisma.InputJsonValue,
          requestIdempotencyKey: input.requestIdempotencyKey,
          completedAt: new Date(),
        },
      });
      await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: input.credits } } });
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId: input.userId,
          type: 'SETTLE',
          credits: -input.credits,
          reason: 'Renovation Decision Analysis',
          analysisId: analysis.id,
          idempotencyKey: `analysis-settle:${analysis.id}`,
        },
      });

      return {
        ok: true as const,
        result: analysis.result as T,
        balance: wallet.balance - input.credits,
        analysisId: analysis.id,
        replay: false,
      };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Concurrent request under the same idempotency key won the race.
      const race = await db.renovationAnalysis.findUnique({ where: { requestIdempotencyKey: input.requestIdempotencyKey } });
      if (race) {
        const balance = await getWalletBalance(input.userId);
        return { ok: true, result: race.result as T, balance, analysisId: race.id, replay: true };
      }
    }
    throw err;
  }
}
