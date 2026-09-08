/**
 * lib/floor-graph/prediction.ts — the ledger that decides whether any of this
 * is working.
 *
 * THE PROBLEM THIS SOLVES
 *
 * A model that is never scored against reality is a rumour with a confidence
 * interval. This business already makes predictions every week — the price
 * written after the measure, the days the schedule assumed, the material
 * ordered — and until now not one of them was recorded next to what actually
 * happened. So there is no answer, today, to the only question that matters
 * about estimating: is it getting better or worse?
 *
 * The ledger answers it with two writes and one arithmetic operation.
 *
 *   recordPrediction() at the moment the number is committed, with the inputs
 *   that were available AT THAT MOMENT. This is the honest capture point and
 *   the only one: a feature vector reconstructed after the outcome is known is
 *   contaminated by it, which is how a model that looks excellent offline
 *   turns out to be worthless in production.
 *
 *   closePrediction() when the actual is known. `error` is signed on purpose —
 *   a business that is 8% under on every job has a different and more fixable
 *   problem than one that is ±8% at random, and an absolute-error-only ledger
 *   cannot tell them apart.
 *
 * WHY THIS COMES BEFORE ANY AI FEATURE
 *
 * A prediction ledger with three hundred closed rows makes it possible to say
 * "our estimating is 6.2% high on refinishing and 11% low on stairs", which is
 * worth money immediately, with no model involved. It is also the only thing
 * that can ever justify a public accuracy claim: under Competition Act
 * s.74.01(1)(b) a performance claim needs adequate and proper testing that
 * exists BEFORE the claim is made, and this table is what that testing would
 * be built from.
 */
import { db } from '@/lib/db';

export type PredictionKind = 'PRICE_CAD' | 'LABOUR_HOURS' | 'MATERIAL_SQFT' | 'SCHEDULE_DAYS';

export type RecordPredictionInput = {
  kind: PredictionKind;
  /**
   * What produced the number. 'published-band', 'estimator', 'configurator',
   * or a model identifier once one exists. Never blank: an unattributed
   * prediction cannot be improved, because there is nothing to improve.
   */
  model: string;
  /** The inputs available at prediction time. Captured before the outcome. */
  inputs: Record<string, unknown>;
  predictedValue: number;
  predictedLow?: number | null;
  predictedHigh?: number | null;
  quoteRequestId?: string | null;
  projectId?: string | null;
};

export type LedgerResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function failed(event: string, err: unknown, context: Record<string, unknown>): { ok: false; reason: string } {
  const reason = err instanceof Error ? err.message : 'unknown';
  console.error(JSON.stringify({ event, reason, ...context }));
  return { ok: false, reason };
}

/**
 * Never throws. Every caller is inside a path that does real commercial work —
 * writing an estimate, closing a job — and a ledger failure must not be able
 * to fail that work.
 */
export async function recordPrediction(
  input: RecordPredictionInput,
): Promise<LedgerResult<string>> {
  try {
    const row = await db.prediction.create({
      data: {
        kind: input.kind,
        model: input.model,
        inputs: input.inputs as object,
        predictedValue: input.predictedValue,
        predictedLow: input.predictedLow ?? null,
        predictedHigh: input.predictedHigh ?? null,
        quoteRequestId: input.quoteRequestId ?? null,
        projectId: input.projectId ?? null,
      },
      select: { id: true },
    });
    return { ok: true, value: row.id };
  } catch (err) {
    return failed('floor_graph.prediction_failed', err, { kind: input.kind, model: input.model });
  }
}

/**
 * Close one prediction against its actual.
 *
 * `absPctError` is left NULL when the predicted value is zero rather than
 * being reported as infinity or quietly as zero — a divide-by-zero that
 * silently becomes 0% is how an accuracy dashboard starts lying.
 */
export async function closePrediction(
  predictionId: string,
  actualValue: number,
  jobOutcomeId?: string | null,
): Promise<LedgerResult<{ error: number; absPctError: number | null }>> {
  try {
    const existing = await db.prediction.findUnique({
      where: { id: predictionId },
      select: { predictedValue: true, closedAt: true },
    });
    if (!existing) return { ok: false, reason: 'no such prediction' };
    if (existing.closedAt) return { ok: false, reason: 'already closed' };

    const predicted = Number(existing.predictedValue);
    const error = actualValue - predicted;
    const absPctError = predicted === 0 ? null : Math.abs(error / predicted) * 100;

    await db.prediction.update({
      where: { id: predictionId },
      data: {
        actualValue,
        closedAt: new Date(),
        error,
        absPctError,
        jobOutcomeId: jobOutcomeId ?? undefined,
      },
    });
    return { ok: true, value: { error, absPctError } };
  } catch (err) {
    return failed('floor_graph.close_failed', err, { predictionId });
  }
}

export type AccuracyRow = {
  kind: PredictionKind;
  model: string;
  closed: number;
  /** Mean signed error. Positive means the actual came in ABOVE the estimate. */
  meanError: number | null;
  /** Mean absolute percentage error. The headline number. */
  mape: number | null;
  /** Share of closed predictions within 10% of the actual. */
  within10Pct: number | null;
};

/**
 * The whole dashboard, as one query and some arithmetic.
 *
 * `openCount` is reported alongside deliberately: a ledger where 400 rows were
 * opened and 12 were ever closed is not a 12-row dataset, it is a broken
 * process, and an accuracy figure computed off the 12 would be worse than no
 * figure at all.
 */
export async function accuracySummary(since?: Date): Promise<{
  rows: AccuracyRow[];
  openCount: number;
  closedCount: number;
}> {
  const where = since ? { predictedAt: { gte: since } } : {};

  const [closed, openCount] = await Promise.all([
    db.prediction.findMany({
      where: { ...where, closedAt: { not: null } },
      select: { kind: true, model: true, error: true, absPctError: true },
    }),
    db.prediction.count({ where: { ...where, closedAt: null } }),
  ]);

  const buckets = new Map<string, { kind: PredictionKind; model: string; errors: number[]; abs: number[] }>();
  for (const row of closed) {
    const key = `${row.kind}::${row.model}`;
    let b = buckets.get(key);
    if (!b) {
      b = { kind: row.kind as PredictionKind, model: row.model, errors: [], abs: [] };
      buckets.set(key, b);
    }
    if (row.error !== null) b.errors.push(Number(row.error));
    if (row.absPctError !== null) b.abs.push(Number(row.absPctError));
  }

  const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

  const rows: AccuracyRow[] = [...buckets.values()].map((b) => ({
    kind: b.kind,
    model: b.model,
    closed: b.errors.length,
    meanError: mean(b.errors),
    mape: mean(b.abs),
    within10Pct: b.abs.length === 0 ? null : (b.abs.filter((x) => x <= 10).length / b.abs.length) * 100,
  }));

  rows.sort((a, b) => b.closed - a.closed);
  return { rows, openCount, closedCount: closed.length };
}
