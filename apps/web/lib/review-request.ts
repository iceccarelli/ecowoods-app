import { db } from '@/lib/db';
import { sendReviewRequestEmail } from '@/lib/email';
import { LIVE_REVIEW_DESTINATIONS } from '@ecowoods/shared/constants';

/**
 * Post-job review request — the only lever that moves the review counts.
 *
 * THE RULES, IN THE ORDER THEY ARE ENFORCED
 *
 *   · The project is COMPLETED. Nothing is asked of a customer mid-job.
 *   · reviewRequestedAt is null — exactly one request per project, forever.
 *   · reviewRequestedAt is stamped BEFORE the send, atomically (updateMany with
 *     the null condition), so two concurrent triggers cannot both send.
 *   · The email is the same for everyone (lib/email reviewRequestEmail): every
 *     verified destination, no sentiment step, no incentive.
 *   · A send failure is logged and the stamp is released, so the hourly sweep
 *     (/api/cron/review-requests) retries it.
 *
 * Triggered from updateProjectStatus() the moment an admin marks a project
 * COMPLETED, and swept hourly for any COMPLETED project the trigger missed.
 */
export type ReviewRequestResult =
  | { sent: true; to: string }
  | { sent: false; reason: 'not_completed' | 'already_requested' | 'no_email' | 'no_destinations' | 'send_failed' };

export async function requestReviewForProject(projectId: string): Promise<ReviewRequestResult> {
  if (LIVE_REVIEW_DESTINATIONS.length === 0) return { sent: false, reason: 'no_destinations' };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      reviewRequestedAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!project || project.status !== 'COMPLETED') return { sent: false, reason: 'not_completed' };
  if (project.reviewRequestedAt) return { sent: false, reason: 'already_requested' };
  if (!project.user?.email) return { sent: false, reason: 'no_email' };

  /* Stamp first. `count === 0` means another run stamped it a moment ago. */
  const stamped = await db.project.updateMany({
    where: { id: project.id, reviewRequestedAt: null },
    data: { reviewRequestedAt: new Date() },
  });
  if (stamped.count === 0) return { sent: false, reason: 'already_requested' };

  try {
    await sendReviewRequestEmail({
      to: project.user.email,
      name: project.user.name ?? '',
      projectTitle: project.title,
    });
    console.log(JSON.stringify({ event: 'review_request.sent', projectId: project.id }));
    return { sent: true, to: project.user.email };
  } catch (err) {
    /* Release the stamp so the sweep retries; log why. */
    await db.project.updateMany({
      where: { id: project.id, reviewRequestedAt: { not: null } },
      data: { reviewRequestedAt: null },
    });
    console.error(
      JSON.stringify({
        event: 'review_request.send_failed',
        projectId: project.id,
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return { sent: false, reason: 'send_failed' };
  }
}
