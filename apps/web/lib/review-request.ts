import { db } from '@/lib/db';
import { sendReviewRequestEmail } from '@/lib/email';
import {
  CRON_EMAIL_MAX_ATTEMPTS,
  CRON_EMAIL_SEND_TIMEOUT_MS,
  SendTimeoutError,
  cronEmailBackoffSeconds,
  sanitizeProviderError,
  withTimeout,
} from '@/lib/email/cron-email-policy';
import { LIVE_REVIEW_DESTINATIONS } from '@ecowoods/shared/constants';

/**
 * Post-job review request — the only lever that moves the review counts.
 *
 * THE RULES, IN THE ORDER THEY ARE ENFORCED
 *
 *   · The project is COMPLETED. Nothing is asked of a customer mid-job.
 *   · reviewRequestedAt is null — exactly one request per project, forever.
 *   · reviewRequestedAt is the CLAIM: it is stamped BEFORE the send in one atomic
 *     UPDATE ... RETURNING that re-checks the conditions, so two concurrent
 *     triggers cannot both send.
 *   · The email is the same for everyone (lib/email reviewRequestEmail): every
 *     verified destination, no sentiment step, no incentive.
 *   · The send carries a stable Idempotency-Key (review-request/<projectId>/v1)
 *     under a 20s timeout; a timeout is an UNKNOWN outcome, retried with the same key.
 *   · A send failure RELEASES the stamp and records the attempt:
 *       reviewEmailAttempts      failed attempts so far,
 *       reviewEmailNextAttemptAt backoff of 1h, 3h, 6h, 12h (the retries span 22h,
 *                                inside Resend's 24h idempotency window),
 *       reviewEmailLastError     sanitised (email addresses redacted), max 300 chars.
 *     The hourly sweep (/api/cron/review-requests) retries only projects whose
 *     backoff has passed. After 5 failed attempts the project is EXHAUSTED: never
 *     retried, counted in the cron response and on /admin/funnel.
 *
 * LIMITATION: the stamp is both claim and sent-mark (as it always was), so a
 * process killed between the stamp and the provider call loses that one request.
 * There is no lease for it to expire; that trade is kept deliberately.
 *
 * Triggered from updateProjectStatus() the moment an admin marks a project
 * COMPLETED, and swept hourly for any COMPLETED project the trigger missed. Both
 * go through requestReviewForProject(), so their failures count identically.
 */
export type ReviewRequestResult =
  | { sent: true; to: string }
  | {
      sent: false;
      reason:
        | 'not_completed'
        | 'already_requested'
        | 'no_email'
        | 'no_destinations'
        | 'send_failed'
        | 'backoff'
        | 'exhausted';
    };

export interface ReviewRequestOptions {
  /** Test seam; production uses CRON_EMAIL_SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
}

export const reviewRequestKey = (projectId: string): string => `review-request/${projectId}/v1`;

/** The sweep's window: completed at least 1 hour ago (grace for the immediate trigger), at most 30 days ago. */
const MIN_AGE_SECONDS = 3600;
const MAX_AGE_SECONDS = 30 * 24 * 3600;

/** Due projects, oldest first. Exhausted and in-backoff projects are excluded in SQL so they cannot starve healthy ones. */
export async function selectDueReviewProjects(limit: number): Promise<Array<{ id: string }>> {
  return db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
      FROM "ecowoods"."Project"
     WHERE "status"::text = 'COMPLETED'
       AND "reviewRequestedAt" IS NULL
       AND "updatedAt" <= now() - make_interval(secs => ${MIN_AGE_SECONDS})
       AND "updatedAt" >= now() - make_interval(secs => ${MAX_AGE_SECONDS})
       AND COALESCE("reviewEmailAttempts", 0) < ${CRON_EMAIL_MAX_ATTEMPTS}
       AND ("reviewEmailNextAttemptAt" IS NULL OR "reviewEmailNextAttemptAt" <= now())
     ORDER BY "updatedAt" ASC
     LIMIT ${limit}`;
}

/** Projects whose review request ran out of attempts (aggregate only, no identities). */
export async function countExhaustedReviewRequests(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS "n"
      FROM "ecowoods"."Project"
     WHERE "status"::text = 'COMPLETED'
       AND "reviewRequestedAt" IS NULL
       AND "updatedAt" >= now() - make_interval(secs => ${MAX_AGE_SECONDS})
       AND COALESCE("reviewEmailAttempts", 0) >= ${CRON_EMAIL_MAX_ATTEMPTS}`;
  return Number(rows[0]?.n ?? 0);
}

/** Stamp (claim) the project. Returns the failed attempts so far, or null if it is not claimable. */
async function claimReview(projectId: string): Promise<number | null> {
  const rows = await db.$queryRaw<Array<{ attempts: number }>>`
    UPDATE "ecowoods"."Project"
       SET "reviewRequestedAt" = now()
     WHERE "id" = ${projectId}::uuid
       AND "status"::text = 'COMPLETED'
       AND "reviewRequestedAt" IS NULL
       AND COALESCE("reviewEmailAttempts", 0) < ${CRON_EMAIL_MAX_ATTEMPTS}
       AND ("reviewEmailNextAttemptAt" IS NULL OR "reviewEmailNextAttemptAt" <= now())
    RETURNING COALESCE("reviewEmailAttempts", 0) AS "attempts"`;
  return rows[0] ? Number(rows[0].attempts) : null;
}

/** Release the stamp and record the failed attempt. Fenced on the attempts we saw at claim time. */
async function recordReviewFailure(projectId: string, previousAttempts: number, sanitisedError: string): Promise<void> {
  const attempt = previousAttempts + 1;
  const exhausted = attempt >= CRON_EMAIL_MAX_ATTEMPTS;
  await db.$executeRaw`
    UPDATE "ecowoods"."Project"
       SET "reviewRequestedAt" = NULL,
           "reviewEmailAttempts" = ${attempt},
           "reviewEmailNextAttemptAt" = CASE WHEN ${exhausted} THEN NULL ELSE now() + make_interval(secs => ${cronEmailBackoffSeconds(attempt)}) END,
           "reviewEmailLastError" = ${sanitisedError}
     WHERE "id" = ${projectId}::uuid
       AND "reviewRequestedAt" IS NOT NULL
       AND COALESCE("reviewEmailAttempts", 0) = ${previousAttempts}`;
}

export async function requestReviewForProject(
  projectId: string,
  options: ReviewRequestOptions = {},
): Promise<ReviewRequestResult> {
  if (LIVE_REVIEW_DESTINATIONS.length === 0) return { sent: false, reason: 'no_destinations' };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      reviewRequestedAt: true,
      reviewEmailAttempts: true,
      reviewEmailNextAttemptAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!project || project.status !== 'COMPLETED') return { sent: false, reason: 'not_completed' };
  if (project.reviewRequestedAt) return { sent: false, reason: 'already_requested' };
  if (!project.user?.email) return { sent: false, reason: 'no_email' };
  if ((project.reviewEmailAttempts ?? 0) >= CRON_EMAIL_MAX_ATTEMPTS) return { sent: false, reason: 'exhausted' };
  if (project.reviewEmailNextAttemptAt && project.reviewEmailNextAttemptAt.getTime() > Date.now()) {
    return { sent: false, reason: 'backoff' };
  }

  /* Stamp first, atomically (re-checks every condition against the DB clock).
     null means another run stamped it a moment ago, or it is no longer due. */
  const previousAttempts = await claimReview(project.id);
  if (previousAttempts === null) return { sent: false, reason: 'already_requested' };

  try {
    await withTimeout(
      sendReviewRequestEmail({
        to: project.user.email,
        name: project.user.name ?? '',
        projectTitle: project.title,
        idempotencyKey: reviewRequestKey(project.id),
      }),
      options.sendTimeoutMs ?? CRON_EMAIL_SEND_TIMEOUT_MS,
    );
  } catch (err) {
    const message = sanitizeProviderError(err);
    /* Release the stamp and record the attempt so the sweep retries after the backoff; log why. */
    await recordReviewFailure(project.id, previousAttempts, message).catch(() => undefined);
    console.error(
      JSON.stringify({
        event: 'review_request.send_failed',
        projectId: project.id,
        attempt: previousAttempts + 1,
        unknownOutcome: err instanceof SendTimeoutError,
        willRetry: previousAttempts + 1 < CRON_EMAIL_MAX_ATTEMPTS,
        error: message,
      }),
    );
    return { sent: false, reason: 'send_failed' };
  }

  /* Accepted: the stamp stays. Clear any earlier failure detail (not the attempts, which are history). */
  await db
    .$executeRaw`UPDATE "ecowoods"."Project" SET "reviewEmailNextAttemptAt" = NULL, "reviewEmailLastError" = NULL WHERE "id" = ${project.id}::uuid`
    .catch(() => undefined);
  console.log(JSON.stringify({ event: 'review_request.sent', projectId: project.id }));
  return { sent: true, to: project.user.email };
}
