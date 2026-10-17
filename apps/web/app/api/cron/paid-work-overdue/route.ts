import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { findOverdueOrders, MAX_AGE_DAYS } from '@/lib/paid-work-overdue';

/**
 * GET /api/cron/paid-work-overdue — tells the desk when a paid report has sat
 * unpublished. Internal only: it never emails a customer and changes no order.
 *
 * Run by Vercel Cron (see the `crons` block in vercel.json). A digest goes to
 * the published business inbox (or ADMIN_EMAIL) every run while anything is
 * overdue, so an item keeps surfacing until the report is published. It is
 * best-effort alerting, not a delivery guarantee: a run that cannot email
 * answers 500 and logs `paid_work_overdue.alert_failed`, so the failure shows
 * in the cron history.
 *
 *   · The caller presents CRON_SECRET, or gets a 401.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let rows;
  try {
    rows = await db.order.findMany({
      where: {
        OR: [{ status: 'FULFILLED' }, { status: 'PAID' }],
        AND: [{ OR: [{ notes: { contains: 'Well-Installed Quote Review' } }, { notes: { contains: 'Listing Floor Report' } }] }],
        updatedAt: { gte: new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000) },
      },
      select: { id: true, status: true, notes: true, updatedAt: true },
      take: 500,
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'paid_work_overdue.query_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const overdue = findOverdueOrders(rows, now);
  console.log(JSON.stringify({ event: 'paid_work_overdue.run', scanned: rows.length, overdue: overdue.length }));
  if (overdue.length === 0) return NextResponse.json({ ok: true, scanned: rows.length, overdue: 0 });

  const lines = overdue.map((o) => `${o.product} — order ${o.orderId} — ${o.detail} — waiting ${o.hoursWaiting}h`);
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? BUSINESS_NAP.email,
      subject: `${overdue.length} paid report(s) need desk action`,
      text: `Paid reports needing desk action:\n\n${lines.join('\n')}\n\nOpen /admin/quote-intelligence/<orderId> or /admin/listing-floor-report/<orderId> to publish the report or retry a pending customer email.`,
      html:
        `<h2 style="margin:0 0 8px;">Paid reports needing desk action</h2><ul>` +
        overdue.map((o) => `<li>${o.product} — <code>${o.orderId}</code> — ${o.detail} — waiting ${o.hoursWaiting}h</li>`).join('') +
        `</ul><p>Open the corresponding admin workbench to publish the report or retry a pending customer notification.</p>`,
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'paid_work_overdue.alert_failed', overdue: overdue.length, error: err instanceof Error ? err.message : 'unknown' }));
    return NextResponse.json({ ok: false, error: 'alert_failed', overdue: overdue.length }, { status: 500 });
  }
  return NextResponse.json({ ok: true, scanned: rows.length, overdue: overdue.length });
}
