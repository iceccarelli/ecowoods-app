import { NextResponse } from 'next/server';
import { cleanupIdleRateLimitBuckets } from '@/lib/rate-limit-durable';

/**
 * GET /api/cron/rate-limit-cleanup — keeps RateLimitBucket from growing
 * forever (see the `crons` block in vercel.json for the schedule, same
 * pattern as /api/cron/review-requests and /api/cron/quote-recovery).
 *
 * A bucket idle for RETENTION_MS has long since refilled to full capacity —
 * deleting it changes nothing about the next request against that key, it
 * just re-creates the row. Retention is generously longer than any
 * `windowMs` this app actually uses, so a live bucket is never touched.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const deleted = await cleanupIdleRateLimitBuckets(RETENTION_MS);
    console.log(JSON.stringify({ event: 'rate_limit.cleanup', deleted }));
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'rate_limit.cleanup_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return NextResponse.json({ ok: false, error: 'cleanup_failed' }, { status: 500 });
  }
}
