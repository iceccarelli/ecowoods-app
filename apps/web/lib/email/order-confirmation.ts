/**
 * lib/email/order-confirmation.ts — the plain, factual "we received your
 * payment" email for a paid Order, delivered once, durably and retryably.
 *
 * Covers shop orders, Listing Floor Reports and Well-Installed Quote Reviews.
 * NOT sent for Personal Floor Plans (lib/floor-plan/deliver.ts already emails
 * the buyer their report) or Renovation Credits (no confirmation email exists
 * for them today and none is added here).
 *
 * DELIVERY STATE (columns on Order; an email is never "claimed" by pretending it was sent)
 *
 *   confirmationEmailSentAt         set ONLY after the provider accepted the
 *                                   message. Rows written by the earlier
 *                                   claim-first code carry it too and mean
 *                                   "sent": nothing is re-sent after deploy.
 *   confirmationEmailLeaseUntil     a short lease taken before the provider
 *                                   call. A holder that dies leaves a lease
 *                                   that simply expires; the next webhook
 *                                   redelivery or reconcile sweep re-claims it.
 *   confirmationEmailAttempts       attempts started (bounded).
 *   confirmationEmailNextAttemptAt  backoff after a failed attempt.
 *   confirmationEmailLastError      the last failure, trimmed, for operators.
 *
 *   1. CLAIM: one conditional UPDATE takes the lease where the email is unsent,
 *      the lease is free or expired, the backoff is due and attempts remain.
 *      Of any number of concurrent webhook / sweep runs exactly one gets a row.
 *   2. SEND with the same Idempotency-Key (order-confirmation/<orderId>/v1) on
 *      every attempt, under a timeout. A timeout is an UNKNOWN outcome: the
 *      provider may have accepted it, so it is retried with the same key and
 *      Resend de-duplicates it.
 *   3. MARK SENT after success. On failure the lease is dropped and the next
 *      attempt is scheduled with backoff. The failure is logged and swallowed:
 *      it never fails the webhook or touches the PAID state.
 *
 * A process killed between claim and provider call loses nothing (the lease
 * expires and the sweep retries). A process killed after the provider accepted
 * but before the sent-mark is retried with the same key: Resend de-duplicates
 * within its window (24h, the same horizon as the sweep); over SMTP, which has
 * no idempotency header, that one narrow window can produce a second copy. That
 * is the accepted trade for never silently losing a payment confirmation.
 *
 * AGE RULE: an order paid more than 24h ago is never emailed (no retroactive
 * messages, and the idempotency key would no longer protect a retry).
 */
import { db } from '@/lib/db';
import { siteOrigin } from '@/lib/site-origin';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';
import { isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { escapeHtml } from './html';
import { sendEmail } from './index';
import {
  CONFIRMATION_LEASE_MS,
  CONFIRMATION_MAX_AGE_MS,
  CONFIRMATION_MAX_ATTEMPTS,
  CONFIRMATION_SEND_TIMEOUT_MS,
  confirmationBackoffSeconds,
} from './order-confirmation-policy';

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

export type OrderConfirmationResult = 'sent' | 'already_sent' | 'busy' | 'skipped' | 'failed';

class SendTimeoutError extends Error {
  constructor() {
    super('provider_timeout: outcome unknown');
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SendTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ConfirmationOptions {
  /** Test seam; production uses CONFIRMATION_SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
}

/** Take the lease. Returns the attempt number we now hold, or null if someone else holds it / it is not due. */
async function claimLease(orderId: string): Promise<number | null> {
  const rows = await db.$queryRaw<Array<{ attempts: number }>>`
    UPDATE "ecowoods"."Order"
       SET "confirmationEmailLeaseUntil" = now() + make_interval(secs => ${CONFIRMATION_LEASE_MS / 1000}),
           "confirmationEmailAttempts" = COALESCE("confirmationEmailAttempts", 0) + 1
     WHERE "id" = ${orderId}::uuid
       AND "confirmationEmailSentAt" IS NULL
       AND "status"::text IN ('PAID', 'FULFILLED')
       AND ("confirmationEmailLeaseUntil" IS NULL OR "confirmationEmailLeaseUntil" < now())
       AND ("confirmationEmailNextAttemptAt" IS NULL OR "confirmationEmailNextAttemptAt" <= now())
       AND COALESCE("confirmationEmailAttempts", 0) < ${CONFIRMATION_MAX_ATTEMPTS}
    RETURNING "confirmationEmailAttempts" AS "attempts"`;
  return rows[0]?.attempts ?? null;
}

/** Record a failed attempt: drop our lease, schedule the next try. Fenced on our attempt number. */
async function recordFailure(orderId: string, attempt: number, message: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "ecowoods"."Order"
       SET "confirmationEmailLeaseUntil" = NULL,
           "confirmationEmailNextAttemptAt" = now() + make_interval(secs => ${confirmationBackoffSeconds(attempt)}),
           "confirmationEmailLastError" = ${message.slice(0, 300)}
     WHERE "id" = ${orderId}::uuid AND "confirmationEmailSentAt" IS NULL AND "confirmationEmailAttempts" = ${attempt}`;
}

/** Sent for plain paid orders only; never throws. */
export async function sendOrderConfirmationOnce(orderId: string, options: ConfirmationOptions = {}): Promise<OrderConfirmationResult> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
    if (!order || (order.status !== 'PAID' && order.status !== 'FULFILLED')) return 'skipped';
    if (isFloorPlanOrder(order.notes) || order.notes?.startsWith(CREDITS_NOTES_PREFIX)) return 'skipped';
    if (order.confirmationEmailSentAt) return 'already_sent';
    if (!order.user.email) return 'skipped';
    if (order.paidAt && Date.now() - order.paidAt.getTime() > CONFIRMATION_MAX_AGE_MS) return 'skipped';
    if ((order.confirmationEmailAttempts ?? 0) >= CONFIRMATION_MAX_ATTEMPTS) return 'skipped';

    const attempt = await claimLease(orderId);
    if (attempt === null) {
      const fresh = await db.order.findUnique({ where: { id: orderId }, select: { confirmationEmailSentAt: true } });
      return fresh?.confirmationEmailSentAt ? 'already_sent' : 'busy';
    }

    try {
      const mail = renderOrderConfirmation({
        orderId: order.id,
        notes: order.notes,
        items: order.items,
        total: order.total,
        paidAt: order.paidAt,
        customerName: order.user.name,
      });
      await withTimeout(
        sendEmail({ to: order.user.email, ...mail, idempotencyKey: orderConfirmationKey(order.id) }),
        options.sendTimeoutMs ?? CONFIRMATION_SEND_TIMEOUT_MS,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await recordFailure(orderId, attempt, message).catch(() => undefined);
      console.error(
        JSON.stringify({
          event: 'order_confirmation.email_failed',
          orderId,
          attempt,
          unknownOutcome: err instanceof SendTimeoutError,
          willRetry: attempt < CONFIRMATION_MAX_ATTEMPTS,
          error: message,
        }),
      );
      return 'failed';
    }
    // The provider accepted it: only now is it "sent". If this write fails the lease expires and a
    // retry re-sends with the same idempotency key (see header).
    await db.order.updateMany({
      where: { id: orderId, confirmationEmailSentAt: null },
      data: { confirmationEmailSentAt: new Date(), confirmationEmailLeaseUntil: null, confirmationEmailNextAttemptAt: null, confirmationEmailLastError: null },
    });
    console.log(JSON.stringify({ event: 'order_confirmation.sent', orderId, attempt }));
    return 'sent';
  } catch (err) {
    console.error(JSON.stringify({ event: 'order_confirmation.failed', orderId, error: err instanceof Error ? err.message : 'unknown' }));
    return 'failed';
  }
}
