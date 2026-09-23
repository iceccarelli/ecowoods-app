/**
 * lib/assistant-workspace/analysis-execution.ts — the reserve -> execute ->
 * settle|release orchestrator for the Renovation Decision Analysis
 * (directive rule 14). This is the one place that sequences the credit
 * ledger (credit-ledger.ts) and the actual computation
 * (renovation-analysis.ts's buildDetailedRenovationAnalysis) — the API
 * route (app/api/assistant/analysis/run/route.ts) is a thin auth+parsing
 * wrapper around this function so the orchestration itself is testable
 * against a real database without spinning up Next's request handling.
 */
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { RENOVATION_DECISION_ANALYSIS } from '@/content/constants/renovation-analysis-product';
import { reserveCredits, releaseReservation, settleReservation } from './credit-ledger';
import {
  computeRenovationSequence,
  buildDetailedRenovationAnalysis,
  RENOVATION_ANALYSIS_ENGINE_VERSION,
} from './renovation-analysis';
import type { WorkspaceState } from './types';

/**
 * Deterministic, not random — a retry of the exact same logical request
 * (same caller-supplied idempotencyKey) must resolve to the exact same
 * `RenovationAnalysis.id`, so a retry can find and return the row the first
 * call already created/completed instead of orphaning a second reservation
 * attempt. Formatted as a valid UUID (Prisma's `@db.Uuid` column requires
 * one) from a SHA-256 hash of the key — not a security boundary, just a
 * stable identity derivation.
 */
function analysisIdFromKey(idempotencyKey: string): string {
  const hash = createHash('sha256').update(idempotencyKey).digest('hex');
  return [hash.slice(0, 8), hash.slice(8, 12), '4' + hash.slice(13, 16), '8' + hash.slice(17, 20), hash.slice(20, 32)].join('-');
}

export type RunAnalysisResult =
  | { ok: true; analysisId: string; result: ReturnType<typeof buildDetailedRenovationAnalysis> }
  | { ok: false; error: 'not_enough_context' | 'insufficient_credits' | 'wallet_not_found' | 'analysis_failed' };

/**
 * Runs one Renovation Decision Analysis for `userId`, charging exactly
 * `RENOVATION_DECISION_ANALYSIS.creditCost` credits ONLY if it completes.
 *
 * `idempotencyKey` should be stable per user action (e.g. derived from a
 * client-generated request id) — a retried call with the same key resolves
 * to the same reservation/settlement rather than reserving twice (the
 * ledger's own unique constraint is what actually enforces this; this
 * function just has to pass the same key through on a retry).
 */
export async function runRenovationAnalysis(params: {
  userId: string;
  designId: string;
  workspaceState: WorkspaceState;
  idempotencyKey: string;
}): Promise<RunAnalysisResult> {
  const sequence = computeRenovationSequence(params.workspaceState);
  if (!sequence) return { ok: false, error: 'not_enough_context' };

  const analysisId = analysisIdFromKey(params.idempotencyKey);
  const creditCost = RENOVATION_DECISION_ANALYSIS.creditCost;

  const existing = await db.renovationAnalysis.findUnique({ where: { id: analysisId } });
  if (existing?.status === 'COMPLETED' && existing.resultJson) {
    return { ok: true, analysisId, result: existing.resultJson as unknown as ReturnType<typeof buildDetailedRenovationAnalysis> };
  }

  const reservation = await reserveCredits({
    userId: params.userId,
    amount: creditCost,
    analysisId,
    idempotencyKey: `reserve:${params.idempotencyKey}`,
  });
  if (!reservation.ok) {
    return { ok: false, error: reservation.error === 'insufficient_balance' ? 'insufficient_credits' : 'wallet_not_found' };
  }

  // upsert, not create — a retry of an in-flight or previously-failed request
  // (same idempotencyKey => same analysisId) must resume the same row, not
  // collide on the primary key.
  await db.renovationAnalysis.upsert({
    where: { id: analysisId },
    create: {
      id: analysisId,
      userId: params.userId,
      walletId: reservation.value.walletId,
      designId: params.designId,
      status: 'RUNNING',
      creditCost,
      engineVersion: RENOVATION_ANALYSIS_ENGINE_VERSION,
    },
    update: { status: 'RUNNING' },
  });

  let result: ReturnType<typeof buildDetailedRenovationAnalysis>;
  try {
    result = buildDetailedRenovationAnalysis(params.workspaceState, sequence);
  } catch (err) {
    await releaseReservation({ analysisId, idempotencyKey: `release:${params.idempotencyKey}`, reason: 'compute_failed' });
    await db.renovationAnalysis.update({
      where: { id: analysisId },
      data: { status: 'FAILED', failureReason: err instanceof Error ? err.message : 'unknown error' },
    });
    return { ok: false, error: 'analysis_failed' };
  }

  const settlement = await settleReservation({ analysisId, idempotencyKey: `settle:${params.idempotencyKey}` });
  if (!settlement.ok) {
    // Reservation vanished between reserve and settle (should not happen under
    // normal operation) — release rather than leave credits stuck reserved forever.
    await releaseReservation({ analysisId, idempotencyKey: `release:${params.idempotencyKey}`, reason: 'settle_failed' });
    await db.renovationAnalysis.update({ where: { id: analysisId }, data: { status: 'FAILED', failureReason: 'settlement_failed' } });
    return { ok: false, error: 'analysis_failed' };
  }

  await db.renovationAnalysis.update({
    where: { id: analysisId },
    data: {
      status: 'COMPLETED',
      settlementTxId: null,
      resultJson: result as unknown as object,
      generatedAt: new Date(),
    },
  });

  return { ok: true, analysisId, result };
}

/** Read back a saved analysis — ownership-checked by the caller (route), not here. */
export async function getRenovationAnalysis(analysisId: string) {
  return db.renovationAnalysis.findUnique({ where: { id: analysisId } });
}

export async function listRenovationAnalyses(userId: string, designId?: string) {
  return db.renovationAnalysis.findMany({
    where: { userId, ...(designId ? { designId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
