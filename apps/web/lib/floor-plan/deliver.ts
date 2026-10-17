/**
 * lib/floor-plan/deliver.ts — getting a PAID Personal Floor Plan to the buyer
 * without depending on them landing on the success page.
 *
 * The PDF used to be rendered only when the customer opened /floor-plan/[id]
 * (the Stripe success redirect). A buyer who paid and then closed the tab, or
 * whose redirect never completed, was charged, got no email, and nothing
 * anywhere noticed. Now the payment webhook (and the reconcile sweep) renders
 * the report and emails the link.
 *
 * Idempotent and re-entrant; each step is safe to repeat:
 *   1. ensureFloorPlanReport — compare-and-swap persist of the PDF url.
 *   2. email with a stable Idempotency-Key (Resend de-duplicates; SMTP cannot).
 *   3. FP_NOTIFIED marker, compare-and-swap on the exact notes text.
 * Transient failures THROW so the caller (webhook → 5xx, cron → failed count)
 * retries. A design that can no longer be decoded is permanent and returned as
 * `rejected` for a person to look at. Email is at-least-once: if the provider
 * accepts the message and step 3 then fails, a retry sends it again.
 */
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/email/html';
import { ensureFloorPlanReport } from './generate';
import { appendNotifiedMarker, hasNotifiedMarker, isFloorPlanOrder } from './notes';

export type FloorPlanDelivery =
  | { status: 'delivered' }
  | { status: 'already_delivered' }
  | { status: 'ignored'; reason: 'not_floor_plan' | 'not_paid' }
  | { status: 'rejected'; reason: 'bad_design' };

export const floorPlanDeliveryKey = (orderId: string): string => `floor-plan-delivery/${orderId}/v1`;

export async function deliverFloorPlanOrder(orderId: string): Promise<FloorPlanDelivery> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order || !isFloorPlanOrder(order.notes)) return { status: 'ignored', reason: 'not_floor_plan' };
  if (order.status !== 'PAID' && order.status !== 'FULFILLED') return { status: 'ignored', reason: 'not_paid' };
  if (hasNotifiedMarker(order.notes)) return { status: 'already_delivered' };

  const report = await ensureFloorPlanReport(orderId);
  if (!report.ok) {
    if (report.reason === 'bad_design') {
      console.error(JSON.stringify({ event: 'floor_plan.delivery_rejected', orderId, reason: report.reason, hint: 'Paid order whose design cannot be decoded; needs a person.' }));
      return { status: 'rejected', reason: 'bad_design' };
    }
    throw new Error(`floor plan report unavailable: ${report.reason}`);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca';
  const link = `${origin.replace(/\/$/, '')}/floor-plan/${order.id}?email=${encodeURIComponent(order.user.email)}`;
  await sendEmail({
    to: order.user.email,
    subject: 'Your Personal Floor Plan is ready',
    html:
      `<h2 style="margin:0 0 8px;">Your Personal Floor Plan is ready</h2>` +
      `<p style="margin:0 0 16px;">Open and download your specification here: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    text: `Your Personal Floor Plan is ready: ${link}`,
    idempotencyKey: floorPlanDeliveryKey(order.id),
  });

  // Record that the buyer was told. Re-read: generating the report changed the notes.
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await db.order.findUnique({ where: { id: orderId }, select: { notes: true } });
    if (!latest || hasNotifiedMarker(latest.notes)) return { status: 'delivered' };
    const done = await db.order.updateMany({ where: { id: orderId, notes: latest.notes }, data: { notes: appendNotifiedMarker(latest.notes, Date.now()) } });
    if (done.count === 1) return { status: 'delivered' };
  }
  throw new Error('floor plan notified marker not recorded'); // a retry re-sends with the same idempotency key
}
