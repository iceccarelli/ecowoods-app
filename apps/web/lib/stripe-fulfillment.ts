/**
 * lib/stripe-fulfillment.ts — what a paid Stripe Checkout Session means for
 * the application, as an idempotent, re-entrant state machine.
 *
 * WHY THIS IS NOT INLINE IN THE WEBHOOK
 *
 * The webhook used to mark an Order PAID, then grant Renovation Credits in a
 * try/catch that logged and returned 200, behind an "already paid — skipping"
 * guard. A grant failure therefore left a paying customer with no credits and
 * no way back: Stripe was told "received", and the only redelivery path (the
 * manual resend) hit the guard and skipped. The invoice path had the same
 * shape (invoice PAID, then Payment insert outside any transaction), and a
 * database failure before anything was written was also answered with 200.
 *
 * THE CONTRACT NOW
 *
 *   · Every step is idempotent and every delivery re-runs every step, so a
 *     redelivery (or the reconcile cron) completes whatever a previous
 *     attempt did not. There is no "already paid, skip" short-circuit in front
 *     of fulfilment.
 *   · A PERMANENT problem (unknown order, amount/currency/session mismatch,
 *     unpaid session) is logged loudly as `stripe_fulfillment.rejected` and
 *     acknowledged: redelivery cannot change the answer, and nothing is
 *     marked paid or granted.
 *   · A TRANSIENT problem (database, ledger) THROWS. The webhook answers 5xx
 *     and Stripe redelivers — safe, because redelivery cannot double-apply:
 *     the Order claim is a conditional update, the credit grant is guarded by
 *     `CreditTransaction.idempotencyKey @unique`, and the Payment row is
 *     looked up under the invoice row lock before it is created.
 *   · "Paid but not yet fulfilled" is durable state, not a log line: a
 *     credits Order stays PAID until its grant exists and only then becomes
 *     FULFILLED, so `reconcilePendingFulfillments()` can find and finish it
 *     without depending on Stripe retrying.
 */
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { grantCreditsForOrder } from '@/lib/credit-ledger';
import { recordFunnelEvent } from '@/lib/funnel-ledger';
import { CREDIT_PACK } from '@/lib/assistant-workspace/credits-config';

/** Order.notes prefix written by /api/assistant/analysis/checkout. */
const CREDITS_NOTES_PREFIX = 'Renovation Credits (';

export type FulfillmentOutcome =
  | { status: 'fulfilled'; kind: 'order' | 'invoice' | 'renovation-credits' }
  | { status: 'rejected'; reason: string }
  | { status: 'ignored'; reason: string };

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

function reject(reason: string, fields: Record<string, unknown>): FulfillmentOutcome {
  // Permanent: acknowledged to Stripe, never marked paid. Loud, because a
  // genuine charge may sit behind it and a person has to look.
  console.error(JSON.stringify({ event: 'stripe_fulfillment.rejected', reason, ...fields }));
  return { status: 'rejected', reason };
}

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
}

const toCents = (amount: unknown): number => Math.round(Number(amount) * 100);

/** Currency and amount must equal what the server recorded when it created the session. */
function chargeMatches(session: Stripe.Checkout.Session, expectedTotal: unknown): string | null {
  if ((session.currency ?? '').toLowerCase() !== 'cad') return 'currency_mismatch';
  if (session.amount_total !== toCents(expectedTotal)) return 'amount_mismatch';
  return null;
}

export function isRenovationCreditsOrder(notes: string | null | undefined): boolean {
  return typeof notes === 'string' && notes.startsWith(CREDITS_NOTES_PREFIX);
}

/**
 * Grant the credits an Order paid for. Amount comes from the server-side pack
 * (named by the order itself), never from Stripe metadata. Idempotent.
 * Throws on a ledger failure so the caller can retry; returns 'rejected' only
 * for an order that cannot ever be granted.
 */
async function fulfilCreditsOrder(order: { id: string; userId: string; notes: string | null }): Promise<FulfillmentOutcome> {
  if (order.notes !== `${CREDITS_NOTES_PREFIX}${CREDIT_PACK.id})`) {
    return reject('unknown_credit_pack', { orderId: order.id });
  }
  const grant = await grantCreditsForOrder({
    userId: order.userId,
    orderId: order.id,
    credits: CREDIT_PACK.credits,
    reason: `Renovation Credits purchase (${CREDIT_PACK.id})`,
  });
  // Only now is the purchase complete; until this write the order stays PAID
  // and is visible to the reconcile sweep.
  await db.order.updateMany({ where: { id: order.id, status: 'PAID' }, data: { status: 'FULFILLED' } });
  log('renovation_credits.grant', { orderId: order.id, userId: order.userId, credits: CREDIT_PACK.credits, outcome: grant.reason });
  return { status: 'fulfilled', kind: 'renovation-credits' };
}

async function handleOrderSession(session: Stripe.Checkout.Session, orderId: string): Promise<FulfillmentOutcome> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return reject('order_not_found', { orderId, sessionId: session.id });

  const mismatch = chargeMatches(session, order.total);
  if (mismatch) return reject(mismatch, { orderId, sessionId: session.id });
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    return reject('session_mismatch', { orderId, sessionId: session.id });
  }
  if (session.metadata?.userId && session.metadata.userId !== order.userId) {
    return reject('user_mismatch', { orderId, sessionId: session.id });
  }

  // Atomic claim: of any number of concurrent deliveries exactly one flips
  // the row; the rest see count 0 and carry on to the (idempotent) fulfilment.
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: { in: ['PENDING', 'CANCELLED'] } },
    data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: paymentIntentId(session) },
  });
  if (claimed.count === 1) log('stripe_fulfillment.order_paid', { orderId });

  if (isRenovationCreditsOrder(order.notes)) return fulfilCreditsOrder(order);
  return { status: 'fulfilled', kind: 'order' };
}

async function handleInvoiceSession(session: Stripe.Checkout.Session, invoiceId: string): Promise<FulfillmentOutcome> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return reject('invoice_not_found', { invoiceId, sessionId: session.id });

  const mismatch = chargeMatches(session, invoice.total);
  if (mismatch) return reject(mismatch, { invoiceId, sessionId: session.id });
  if (session.metadata?.projectId && session.metadata.projectId !== invoice.projectId) {
    return reject('project_mismatch', { invoiceId, sessionId: session.id });
  }

  const pi = paymentIntentId(session);
  const amountCad = (session.amount_total ?? 0) / 100;

  /* One transaction: the invoice state and its Payment row commit together or
     not at all. The unconditional update takes the row lock first, so two
     concurrent deliveries serialize here and the second one's lookup sees the
     first one's Payment. Re-running it against an invoice that an older
     version of this handler left PAID-without-a-Payment creates the missing
     row — that is the repair path. */
  const claimedNow = await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { stripePaymentIntentId: pi } });
    const claim = await tx.invoice.updateMany({
      where: { id: invoiceId, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    const existing = pi
      ? await tx.payment.findFirst({ where: { invoiceId, stripePaymentIntentId: pi } })
      : await tx.payment.findFirst({ where: { invoiceId, method: 'STRIPE', status: 'COMPLETED' } });
    if (!existing) {
      await tx.payment.create({
        data: {
          invoiceId,
          userId: session.metadata?.userId ?? null,
          amount: amountCad,
          method: 'STRIPE',
          status: 'COMPLETED',
          stripeCharged: true,
          stripePaymentIntentId: pi,
        },
      });
    }
    return claim.count === 1;
  });

  /* MEAS-02 — the brief's `deposit` event. Only the DEPOSIT stage counts: a
     progress or final invoice is real revenue but not the moment a customer
     committed, and counting all three reports a conversion rate above 100%
     for jobs invoiced in thirds. Only the delivery that actually flipped the
     invoice records it, so a redelivery cannot add a second row. A
     measurement, so never awaited and never able to fail the payment. */
  if (claimedNow && invoice.stage === 'DEPOSIT') {
    const project = invoice.projectId
      ? await db.project.findUnique({ where: { id: invoice.projectId }, select: { designId: true } }).catch(() => null)
      : null;
    void recordFunnelEvent({
      stage: 'DEPOSIT_PAID',
      designId: project?.designId ?? null,
      projectId: invoice.projectId ?? null,
      amountCad,
    });
  }
  if (claimedNow) log('stripe_fulfillment.invoice_paid', { invoiceId });
  return { status: 'fulfilled', kind: 'invoice' };
}

/**
 * Entry point for `checkout.session.completed`. Throws on any transient
 * failure (caller answers 5xx so Stripe redelivers); returns an outcome for
 * everything else.
 */
export async function fulfilCheckoutSession(session: Stripe.Checkout.Session): Promise<FulfillmentOutcome> {
  // A completed session is not necessarily a paid one (delayed payment
  // methods); an unpaid session must never unlock a deliverable.
  if (session.payment_status !== 'paid') {
    log('stripe_fulfillment.not_paid', { sessionId: session.id, paymentStatus: session.payment_status });
    return { status: 'ignored', reason: 'not_paid' };
  }
  const orderId = session.metadata?.orderId;
  if (orderId) return handleOrderSession(session, orderId);
  const invoiceId = session.metadata?.invoiceId;
  if (invoiceId) return handleInvoiceSession(session, invoiceId);
  return reject('no_reference', { sessionId: session.id });
}

export interface ReconcileSummary {
  examined: number;
  fulfilled: number;
  failed: number;
}

/**
 * Finish credit grants that a webhook delivery started and did not complete:
 * every credits Order still PAID after the grace period is re-run through the
 * same idempotent fulfilment. Independent of Stripe's own retry schedule.
 */
export async function reconcilePendingFulfillments(options: { olderThanMs?: number; batch?: number } = {}): Promise<ReconcileSummary> {
  const cutoff = new Date(Date.now() - (options.olderThanMs ?? 5 * 60 * 1000));
  const pending = await db.order.findMany({
    where: { status: 'PAID', notes: { startsWith: CREDITS_NOTES_PREFIX }, paidAt: { lte: cutoff } },
    select: { id: true, userId: true, notes: true },
    orderBy: { paidAt: 'asc' },
    take: options.batch ?? 25,
  });
  const summary: ReconcileSummary = { examined: pending.length, fulfilled: 0, failed: 0 };
  for (const order of pending) {
    try {
      const outcome = await fulfilCreditsOrder(order);
      if (outcome.status === 'fulfilled') summary.fulfilled += 1;
      else summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(
        JSON.stringify({
          event: 'stripe_fulfillment.unresolved',
          orderId: order.id,
          error: err instanceof Error ? err.message : 'unknown',
        }),
      );
    }
  }
  return summary;
}
