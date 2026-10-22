/**
 * lib/email/order-confirmation.ts — the plain, factual "we received your
 * payment" email for a paid Order, sent exactly once per order.
 *
 * Covers shop orders, Listing Floor Reports and Well-Installed Quote Reviews.
 * NOT sent for Personal Floor Plans (lib/floor-plan/deliver.ts already emails
 * the buyer their report) or Renovation Credits (no confirmation email exists
 * for them today and none is added here).
 *
 * ORDERING: CLAIM, THEN SEND, RELEASE ON FAILURE (chosen over send-then-mark)
 *
 *   1. A conditional update sets Order.confirmationEmailSentAt where it is
 *      still null. Of any number of concurrent or replayed webhook deliveries
 *      exactly one gets count 1 and goes on to send; the rest do nothing.
 *   2. The send happens with a stable Idempotency-Key.
 *   3. If the send throws, the claim is released (set back to null, only if it
 *      still holds OUR timestamp) so a webhook redelivery or the reconcile
 *      sweep can try again. The failure is logged and swallowed: it must never
 *      fail the webhook or touch the PAID state.
 *
 * Send-then-mark (the floor-plan pattern) would be at-least-once: two
 * concurrent deliveries both send, and over SMTP (no idempotency header) the
 * customer gets two emails. Claim-first keeps it to one. The price is a
 * narrow window — the process dying between step 1 and the provider call —
 * where the email is never sent. That is the safer trade for a courtesy
 * message: the order, its PAID state and the order page are unaffected, while a
 * duplicate "payment received" email about money reads as a second charge. If
 * the provider accepted a message and the call then timed out, the release plus
 * a retry re-sends with the same Idempotency-Key, which Resend de-duplicates.
 */
import { db } from '@/lib/db';
import { siteOrigin } from '@/lib/site-origin';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';
import { isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { escapeHtml } from './html';
import { sendEmail } from './index';

const CREDITS_NOTES_PREFIX = 'Renovation Credits (';

export const orderConfirmationKey = (orderId: string): string => `order-confirmation/${orderId}/v1`;

export const orderReference = (orderId: string): string => `#${orderId.slice(0, 8).toUpperCase()}`;

export interface OrderConfirmationInput {
  orderId: string;
  /** Order notes, used only to name a product that has no line items. */
  notes: string | null;
  items: ReadonlyArray<{ productName: string; quantity: unknown; lineTotal: unknown }>;
  total: unknown;
  paidAt: Date | null;
  customerName?: string | null;
}

export interface RenderedOrderConfirmation {
  subject: string;
  html: string;
  text: string;
}

function productLabel(notes: string | null): string {
  if (isWellInstalledReviewOrder(notes)) return 'Well-Installed Quote Review';
  if (isListingFloorReportOrder(notes)) return 'Pre-List Floor Condition Report';
  return 'Ecowoods order';
}

const cad = (n: unknown): string => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n));
const day = (d: Date): string => new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }).format(d);

/** Pure: no database, no mailer. Every interpolated value is HTML-escaped. */
export function renderOrderConfirmation(input: OrderConfirmationInput): RenderedOrderConfirmation {
  const ref = orderReference(input.orderId);
  const link = `${siteOrigin()}/mypage/orders`;
  const lines = input.items.length
    ? input.items.map((i) => ({ name: i.productName, qty: Number(i.quantity), amount: cad(i.lineTotal) }))
    : [{ name: productLabel(input.notes), qty: 1, amount: cad(input.total) }];
  const paid = input.paidAt ? day(input.paidAt) : day(new Date());
  const total = cad(input.total);

  const rowsHtml = lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 12px 4px 0;">${escapeHtml(l.name)}${l.qty !== 1 ? ` &times; ${escapeHtml(l.qty)}` : ''}</td><td style="padding:4px 0;text-align:right;">${escapeHtml(l.amount)}</td></tr>`,
    )
    .join('');
  const html =
    `<h2 style="margin:0 0 8px;">Payment received</h2>` +
    `<p style="margin:0 0 16px;">Thank you${input.customerName ? `, ${escapeHtml(input.customerName)}` : ''}. We received your payment for order ${escapeHtml(ref)}.</p>` +
    `<table style="border-collapse:collapse;margin:0 0 16px;">${rowsHtml}` +
    `<tr><td style="padding:8px 12px 4px 0;border-top:1px solid #ddd;"><strong>Total paid (CAD, includes tax)</strong></td><td style="padding:8px 0 4px;border-top:1px solid #ddd;text-align:right;"><strong>${escapeHtml(total)}</strong></td></tr></table>` +
    `<p style="margin:0 0 4px;">Order reference: ${escapeHtml(ref)}</p>` +
    `<p style="margin:0 0 16px;">Date paid: ${escapeHtml(paid)}</p>` +
    `<p style="margin:0;">You can view this order here: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`;
  const text =
    `Payment received\n\nWe received your payment for order ${ref}.\n\n` +
    lines.map((l) => `- ${l.name}${l.qty !== 1 ? ` x ${l.qty}` : ''}: ${l.amount}`).join('\n') +
    `\n\nTotal paid (CAD, includes tax): ${total}\nOrder reference: ${ref}\nDate paid: ${paid}\n\nView this order: ${link}\n`;
  return { subject: `Payment received - order ${ref}`, html, text };
}

export type OrderConfirmationResult = 'sent' | 'already_sent' | 'skipped' | 'failed';

/** Sent for plain paid orders only; never throws. */
export async function sendOrderConfirmationOnce(orderId: string): Promise<OrderConfirmationResult> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
    if (!order || (order.status !== 'PAID' && order.status !== 'FULFILLED')) return 'skipped';
    if (isFloorPlanOrder(order.notes) || order.notes?.startsWith(CREDITS_NOTES_PREFIX)) return 'skipped';
    if (order.confirmationEmailSentAt) return 'already_sent';
    if (!order.user.email) return 'skipped';

    const claimedAt = new Date();
    const claim = await db.order.updateMany({
      where: { id: orderId, confirmationEmailSentAt: null, status: { in: ['PAID', 'FULFILLED'] } },
      data: { confirmationEmailSentAt: claimedAt },
    });
    if (claim.count !== 1) return 'already_sent';

    try {
      const mail = renderOrderConfirmation({
        orderId: order.id,
        notes: order.notes,
        items: order.items,
        total: order.total,
        paidAt: order.paidAt,
        customerName: order.user.name,
      });
      await sendEmail({ to: order.user.email, ...mail, idempotencyKey: orderConfirmationKey(order.id) });
    } catch (err) {
      // Release only our own claim, so a later delivery or the sweep can retry.
      await db.order
        .updateMany({ where: { id: orderId, confirmationEmailSentAt: claimedAt }, data: { confirmationEmailSentAt: null } })
        .catch(() => undefined);
      console.error(JSON.stringify({ event: 'order_confirmation.email_failed', orderId, error: err instanceof Error ? err.message : 'unknown' }));
      return 'failed';
    }
    console.log(JSON.stringify({ event: 'order_confirmation.sent', orderId }));
    return 'sent';
  } catch (err) {
    console.error(JSON.stringify({ event: 'order_confirmation.failed', orderId, error: err instanceof Error ? err.message : 'unknown' }));
    return 'failed';
  }
}
