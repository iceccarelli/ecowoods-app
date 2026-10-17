import { NextResponse } from 'next/server';
import { reconcilePendingFulfillments } from '@/lib/stripe-fulfillment';

/**
 * GET /api/cron/stripe-reconcile — finish paid orders whose fulfilment a
 * webhook delivery started and did not complete (see lib/stripe-fulfillment.ts).
 *
 * Also asks Stripe (read-only) for recent paid sessions whose webhook never
 * arrived and fulfils those still PENDING here.
 *
 * Run by Vercel Cron (see the `crons` block in vercel.json), independent of
 * Stripe's own redelivery schedule. Idempotent: the credit grant is guarded
 * by CreditTransaction.idempotencyKey, so a sweep that overlaps a webhook
 * cannot grant twice.
 *
 *   · The caller presents CRON_SECRET, or gets a 401.
 *   · Answers 500 when anything stayed unresolved so the failure is visible
 *     in the cron run history as well as the `stripe_fulfillment.unresolved`
 *     log line.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await reconcilePendingFulfillments();
    console.log(JSON.stringify({ event: 'stripe_fulfillment.reconcile', ...summary }));
    return NextResponse.json({ ok: summary.failed === 0, ...summary }, { status: summary.failed === 0 ? 200 : 500 });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'stripe_fulfillment.reconcile_query_failed', error: err instanceof Error ? err.message : 'unknown' }),
    );
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }
}
