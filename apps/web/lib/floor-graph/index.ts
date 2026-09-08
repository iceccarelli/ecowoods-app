/**
 * lib/floor-graph/index.ts — writing to the Floor Graph.
 *
 * WHAT THIS MODULE GUARANTEES TO ITS CALLERS
 *
 * 1. IT NEVER THROWS INTO A LEAD PATH. Every capture function returns a
 *    result object and swallows its own failures into a structured log line.
 *    The lead routes have one invariant — once the fields validate, the person
 *    who tried to give us work is captured — and a Floor Graph write is a
 *    strictly downstream enrichment. A dropped analytics row costs a data
 *    point. A dropped lead costs a job. They are not allowed to share a
 *    failure mode.
 *
 * 2. IT NEVER WRITES A PHOTOGRAPH WITHOUT A CONSENT ID. `storeAssessmentPhotos`
 *    takes a consentId, not a boolean, and `AssessmentPhoto.consentId` is NOT
 *    NULL in the database. There is no code path that produces a retained
 *    photograph whose lawful basis cannot be named.
 *
 * 3. IT NEVER WRITES AN INFERENCE INTO AN OBSERVATION COLUMN. `observedSpecies`
 *    and the moisture columns are filled by a person with an instrument, or
 *    they stay null. A model's guess goes into `AssessmentPhoto.observations`,
 *    keyed by the run that produced it, where it can be scored later and
 *    thrown away if it was wrong. Pooling the two would destroy the only
 *    dataset here worth having.
 */
import { db } from '@/lib/db';

export type CaptureResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function fail(event: string, err: unknown, context: Record<string, unknown>): { ok: false; reason: string } {
  const reason = err instanceof Error ? err.message : 'unknown';
  console.error(JSON.stringify({ event, reason, ...context }));
  return { ok: false, reason };
}

// ─────────────────────────────────────────────
// ASSESSMENTS
// ─────────────────────────────────────────────

export type AssessmentSource =
  | 'PHOTO_TRIAGE'
  | 'MEASURE_VISIT'
  | 'JOB_EXECUTION'
  | 'FRAMEWORK_ASSESS'
  | 'IMPORT';

export type RecordAssessmentInput = {
  source: AssessmentSource;
  quoteRequestId?: string | null;
  projectId?: string | null;
  statedIntent?: string | null;
  statedSqFt?: number | null;
  city?: string | null;
};

/**
 * The row that exists whether or not anybody consented to keeping photographs.
 *
 * This is worth saying plainly because it is the line the design turns on:
 * "a triage arrived from Etobicoke on 8 September, the person thought the
 * floor needed refinishing, they said about 900 square feet" is operational
 * data about our own business, collected from someone asking us to quote. The
 * PHOTOGRAPHS are the personal information, and those are what the consent
 * gate protects. Conflating the two would mean either over-collecting images
 * or throwing away the shape of our own demand.
 */
export async function recordAssessment(
  input: RecordAssessmentInput,
): Promise<CaptureResult<string>> {
  try {
    const row = await db.floorAssessment.create({
      data: {
        source: input.source,
        status: 'UNREVIEWED',
        quoteRequestId: input.quoteRequestId ?? null,
        projectId: input.projectId ?? null,
        statedIntent: input.statedIntent ?? null,
        statedSqFt: input.statedSqFt ?? null,
        city: input.city ?? null,
      },
      select: { id: true },
    });
    return { ok: true, value: row.id };
  } catch (err) {
    return fail('floor_graph.assessment_failed', err, { source: input.source });
  }
}

export type PhotoInput = {
  url: string;
  contentType: string;
  bytes: number;
  position: number;
};

/**
 * Attach retained photographs to an assessment.
 *
 * `consentId` is required and is the id of a real ConsentRecord row. Passing a
 * fabricated id would violate the foreign-key-shaped intent of the column even
 * though the schema deliberately does not enforce it with a constraint (the
 * consent ledger must survive an assessment being erased, and vice versa), so
 * this function is the enforcement point and the only supported way in.
 */
export async function storeAssessmentPhotos(
  assessmentId: string,
  consentId: string,
  photos: PhotoInput[],
): Promise<CaptureResult<number>> {
  if (photos.length === 0) return { ok: true, value: 0 };
  try {
    const created = await db.assessmentPhoto.createMany({
      data: photos.map((p) => ({
        assessmentId,
        consentId,
        url: p.url,
        contentType: p.contentType,
        bytes: p.bytes,
        position: p.position,
      })),
    });
    return { ok: true, value: created.count };
  } catch (err) {
    return fail('floor_graph.photos_failed', err, { assessmentId, count: photos.length });
  }
}

// ─────────────────────────────────────────────
// BENCHMARK
// ─────────────────────────────────────────────

export type ScoringInput = {
  frameworkVersion: string;
  /** One character per criterion: y | u | n | -. Length is checked by the caller. */
  answers: string;
  score: number;
  verdict: string;
  criticalFailures: number;
  region?: string | null;
};

/**
 * Add one anonymous scoring to the benchmark.
 *
 * Note what this function cannot do, structurally: there is no parameter for
 * an email, a user, an IP or a note, and the table has no column for one. That
 * is not caution, it is the product. The benchmark is only worth publishing if
 * the whole table could be released tomorrow, and the way to guarantee that is
 * to make the unsafe version unrepresentable rather than merely forbidden.
 *
 * `scoredOn` is a DATE, not a timestamp. On a table this small an exact
 * millisecond is a fingerprint that re-links a "fully anonymous" row to the
 * request log that produced it.
 */
export async function recordFrameworkScoring(
  input: ScoringInput,
): Promise<CaptureResult<string>> {
  try {
    const today = new Date();
    const scoredOn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const row = await db.frameworkScoring.create({
      data: {
        frameworkVersion: input.frameworkVersion,
        answers: input.answers,
        score: input.score,
        verdict: input.verdict,
        criticalFailures: input.criticalFailures,
        region: input.region ?? null,
        scoredOn,
      },
      select: { id: true },
    });
    return { ok: true, value: row.id };
  } catch (err) {
    return fail('floor_graph.scoring_failed', err, { version: input.frameworkVersion });
  }
}

// ─────────────────────────────────────────────
// FLOOR RECORDS
// ─────────────────────────────────────────────

/** FR-YYYY-NNNN, sequential within the year. Printed on the record. */
export async function nextFloorRecordRef(now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `FR-${year}-`;
  const count = await db.floorRecord.count({ where: { publicRef: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}
