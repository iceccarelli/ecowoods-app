import { NextResponse } from 'next/server';
import { isAuthorizedBearer } from '@/lib/cron-auth';
import { QuoteRecoveryQueryError, runQuoteRecoveryCron } from '@/lib/quote-recovery-delivery';

/**
 * GET /api/cron/quote-recovery — send the one reminder, once.
 *
 * Run by Vercel Cron (see the `crons` block in vercel.json). Every row it
 * touches carries a consent timestamp put there by a person ticking a box; the
 * check is repeated here rather than trusted from upstream, because the cost of
 * being wrong is a CASL violation rather than a bad metric.
 *
 * THE RULES, IN THE ORDER THEY ARE ENFORCED
 *
 *   · The caller presents CRON_SECRET, or gets a 401. An unauthenticated route
 *     that emails addresses out of your database is a spam cannon with your
 *     domain's reputation attached to it.
 *   · consentedAt is set        — no consent, no send. Ever.
 *   · confirmedAt is set        — the mailbox owner clicked the double opt-in link.
 *   · no QuoteRequest for the address (case-insensitive) was created after the
 *     recovery row — covers leads, bookings and photo triage even if the row
 *     was never marked converted.
 *   · sentAt is null            — exactly one email per person, forever. It is
 *     written ONLY after the provider accepted the message.
 *   · convertedAt is null       — somebody who finished is never asked to.
 *   · The row is at least 2h old and at most 7 days old. A reminder about a
 *     form somebody abandoned last month is not a reminder, it is a cold email.
 *   · The claim is a ~3 minute LEASE taken in one atomic UPDATE that re-checks
 *     all of the above (consent included); the send carries a stable
 *     Idempotency-Key so a retry or a crashed holder cannot email twice. A failed
 *     send backs off (1h, 3h, 6h, 12h), keeps a sanitised error, and after 5
 *     attempts the row is exhausted: never retried, counted in the response and
 *     on /admin/funnel. See lib/quote-recovery-delivery.ts.
 *   · The response is counts only: {due, sent, failed, exhausted}.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAuthorizedBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runQuoteRecoveryCron();
    console.log(JSON.stringify({ event: 'quote_recovery.cron_run', ...result }));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'quote_recovery.cron_query_failed',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    if (err instanceof QuoteRecoveryQueryError) return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
    return NextResponse.json({ ok: false, error: 'run_failed' }, { status: 500 });
  }
}
