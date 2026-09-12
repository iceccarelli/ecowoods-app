/**
 * lib/funnel-ledger.ts — MEAS-02. The commercial end of the funnel, recorded
 * where the money actually is.
 *
 * See the block comment above `model FunnelEvent` in prisma/schema.prisma for
 * why this is a table rather than more GA4. In short: the last five canonical
 * events are server writes, `track()` returns early on the server, and GA4's
 * Measurement Protocol would have required inventing a device id for every
 * deposit — inflating user counts with people who do not exist.
 *
 * THE RULE THIS FILE LIVES BY
 *
 * Recording must never be able to break the thing it is recording. A deposit
 * that cleared is a deposit that cleared whether or not the ledger row was
 * written, and a Stripe webhook that throws because an analytics insert failed
 * is a webhook Stripe retries, against a handler that has already marked the
 * invoice PAID. So every function here:
 *
 *   - swallows its own errors and logs them as structured JSON,
 *   - is never awaited by a caller that has commercial work left to do,
 *   - and takes only data the caller already has in hand, so it can never add
 *     a query to a hot path.
 *
 * This mirrors the discipline already in /api/leads, where the durable log
 * line is the capture and the database write is best-effort after it.
 */
import { db } from '@/lib/db';
import { designIdOf } from '@/lib/floor-studio/design-id';

/** The six commercial moments. Mirrors the FunnelStage enum in the schema. */
export type FunnelStage =
  | 'LEAD_CAPTURED'
  | 'APPOINTMENT_BOOKED'
  | 'QUOTE_ISSUED'
  | 'QUOTE_ACCEPTED'
  | 'DEPOSIT_PAID'
  | 'JOB_COMPLETED';

/**
 * The order they happen in. Exported because a funnel drawn in the wrong order
 * is a funnel that reports a negative conversion rate, and the ordering should
 * have exactly one definition.
 */
export const FUNNEL_ORDER: FunnelStage[] = [
  'LEAD_CAPTURED',
  'APPOINTMENT_BOOKED',
  'QUOTE_ISSUED',
  'QUOTE_ACCEPTED',
  'DEPOSIT_PAID',
  'JOB_COMPLETED',
];

export type FunnelEventInput = {
  stage: FunnelStage;
  designId?: string | null;
  source?: string | null;
  quoteId?: string | null;
  projectId?: string | null;
  amountCad?: number | null;
};

/** `source` is a label from a form field. Bound it before it reaches a column. */
export const sanitiseSource = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 120);
  return trimmed.length ? trimmed : null;
};

/**
 * An amount, or null.
 *
 * Rejects NaN and Infinity explicitly. `Number(undefined)` is NaN and Prisma
 * will happily carry NaN into a Decimal column, where it becomes a row that
 * poisons every SUM run over it afterwards — and the poisoning is silent,
 * which is how a revenue figure goes wrong for a quarter before anyone checks.
 */
export const sanitiseAmount = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/**
 * Write one stage. Fire and forget.
 *
 * DELIBERATELY NOT AWAITED at the call sites. It returns a promise so a test
 * can await it, and so a caller that genuinely wants to wait may — but no
 * production path does, because none of them should hold a customer's request
 * open for a row that only a report will ever read.
 */
export function recordFunnelEvent(input: FunnelEventInput): Promise<void> {
  return db.funnelEvent
    .create({
      data: {
        stage: input.stage,
        /* Validated rather than trusted, for the same reason MEAS-01 validates
           on the way in: a designId we did not mint joins to nothing, and a
           ledger row that joins to nothing is worse than an absent one —
           it looks like data. */
        designId: designIdOf(input.designId) ?? null,
        source: sanitiseSource(input.source),
        quoteId: input.quoteId ?? null,
        projectId: input.projectId ?? null,
        amountCad: sanitiseAmount(input.amountCad),
      },
    })
    .then(() => undefined)
    .catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: 'funnel.record_failed',
          stage: input.stage,
          quoteId: input.quoteId ?? null,
          projectId: input.projectId ?? null,
          error: err instanceof Error ? err.message : 'unknown',
          hint:
            'The commercial action itself succeeded. This is the measurement row only. ' +
            'If these appear in bulk, check that migration 20260912010000_add_funnel_ledger ran.',
        }),
      );
    });
}

/* ── reading it back ──────────────────────────────────────────────────────── */

export type StageCount = {
  stage: FunnelStage;
  total: number;
  /** How many of them carried a design id — i.e. began in the studio. */
  attributed: number;
  /** Summed `amountCad` where there is any. */
  valueCad: number;
};

export type AttributionSummary = {
  since: Date;
  stages: StageCount[];
  /** The success test from PG0, answered. */
  depositsFromDesign: number;
  depositsTotal: number;
};

/**
 * The report PG0 said this business could not run at any price.
 *
 * > Of the last 100 deposits, how many began in Floor Studio, and what was the
 * > gross margin on those versus the ones that did not?
 *
 * This answers the first half. The margin half needs JobOutcome's actual costs
 * and is ECON-01's job — deliberately not faked here, because a margin number
 * assembled from quoted figures rather than actual ones is the exact shape of
 * "a green score bought with a lie".
 *
 * A LEDGER NOBODY READS IS THE FAILURE PG0 NAMED. FloorAssessment is written
 * on every photo triage and no code has ever read a row back. This function,
 * and the admin surface that calls it, exist so that this table does not
 * become the seventh entry on that list.
 */
export async function attributionSummary(sinceDays = 90): Promise<AttributionSummary> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await db.funnelEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { stage: true, designId: true, amountCad: true },
  });

  const stages: StageCount[] = FUNNEL_ORDER.map((stage) => {
    const mine = rows.filter((r) => r.stage === stage);
    return {
      stage,
      total: mine.length,
      attributed: mine.filter((r) => r.designId !== null).length,
      valueCad: mine.reduce((sum, r) => sum + Number(r.amountCad ?? 0), 0),
    };
  });

  const deposits = stages.find((s) => s.stage === 'DEPOSIT_PAID');
  return {
    since,
    stages,
    depositsFromDesign: deposits?.attributed ?? 0,
    depositsTotal: deposits?.total ?? 0,
  };
}

/**
 * Conversion between two adjacent stages, as a percentage.
 *
 * Returns null rather than 0 when the earlier stage is empty. A funnel with no
 * leads has no conversion rate; printing "0%" for it would read as a business
 * that is failing rather than one that has not started, and somebody would act
 * on it.
 */
export function conversionRate(from: StageCount, to: StageCount): number | null {
  if (from.total === 0) return null;
  return Math.round((to.total / from.total) * 1000) / 10;
}
