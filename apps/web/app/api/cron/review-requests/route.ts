import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requestReviewForProject } from '@/lib/review-request';

/**
 * GET /api/cron/review-requests — the safety net for the post-job review ask.
 *
 * updateProjectStatus() sends the request the moment a project is marked
 * COMPLETED. This hourly sweep (see the `crons` block in vercel.json) catches
 * projects completed by any other path, and retries any send that failed.
 *
 *   · The caller presents CRON_SECRET, or gets a 401.
 *   · status COMPLETED, reviewRequestedAt null — one request per project.
 *   · Completed at least 1 hour ago (grace for the immediate trigger) and at
 *     most 30 days ago — a review request about a job finished last season is
 *     a cold email, and it is not sent.
 *   · Small batches, one send per row, the stamp set before the send inside
 *     requestReviewForProject().
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_AGE_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 25;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  let due: Array<{ id: string }> = [];
  try {
    due = await db.project.findMany({
      where: {
        status: 'COMPLETED',
        reviewRequestedAt: null,
        updatedAt: { lte: new Date(now - MIN_AGE_MS), gte: new Date(now - MAX_AGE_MS) },
      },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'review_request.cron_query_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const results = { sent: 0, skipped: 0, failed: 0 };
  for (const p of due) {
    const r = await requestReviewForProject(p.id);
    if (r.sent) results.sent += 1;
    else if (r.reason === 'send_failed') results.failed += 1;
    else results.skipped += 1;
  }

  console.log(JSON.stringify({ event: 'review_request.cron', due: due.length, ...results }));
  return NextResponse.json({ ok: true, due: due.length, ...results });
}
