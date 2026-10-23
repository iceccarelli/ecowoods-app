import { NextResponse } from 'next/server';
import { isAuthorizedBearer } from '@/lib/cron-auth';
import { countExhaustedReviewRequests, requestReviewForProject, selectDueReviewProjects } from '@/lib/review-request';

/**
 * GET /api/cron/review-requests — the safety net for the post-job review ask.
 *
 * updateProjectStatus() sends the request the moment a project is marked
 * COMPLETED. This hourly sweep (see the `crons` block in vercel.json) catches
 * projects completed by any other path, and retries any send that failed.
 *
 *   · The caller presents CRON_SECRET, or gets a 401.
 *   · status COMPLETED, reviewRequestedAt null — one request per project.
 *   · A failed send is retried only after its backoff (1h, 3h, 6h, 12h) and at
 *     most 5 times; exhausted and in-backoff projects are excluded in SQL.
 *   · Completed at least 1 hour ago (grace for the immediate trigger) and at
 *     most 30 days ago — a review request about a job finished last season is
 *     a cold email, and it is not sent.
 *   · Small batches, one send per row, the stamp set before the send inside
 *     requestReviewForProject().
 *   · The response is counts only: {due, sent, failed, skipped, exhausted}.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = 25;

export async function GET(request: Request) {
  if (!isAuthorizedBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let due: Array<{ id: string }> = [];
  try {
    due = await selectDueReviewProjects(BATCH);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'review_request.cron_query_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const results = { sent: 0, failed: 0, skipped: 0 };
  for (const p of due) {
    const r = await requestReviewForProject(p.id);
    if (r.sent) results.sent += 1;
    else if (r.reason === 'send_failed') results.failed += 1;
    else results.skipped += 1;
  }

  let exhausted = 0;
  try {
    exhausted = await countExhaustedReviewRequests();
  } catch {
    /* informational; never fail the sweep over it */
  }

  const body = { due: due.length, ...results, exhausted };
  console.log(JSON.stringify({ event: 'review_request.cron', ...body }));
  return NextResponse.json({ ok: true, ...body });
}
