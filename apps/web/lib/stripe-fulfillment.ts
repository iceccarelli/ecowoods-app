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
 * MONEY IS NEVER JUST A LOG LINE
 *
 *   A session Stripe reports as PAID that cannot be applied opens a durable
 *   PaymentCase instead of only logging: UNAPPLIED_PAYMENT (unknown order or
 *   invoice, amount/currency/session/user/project mismatch) and
 *   DUPLICATE_PAYMENT (a second payment intent for an order or invoice that is
 *   already PAID). Cases are keyed by payment intent, so replays and concurrent
 *   deliveries open exactly one. A PAID order/invoice is never altered by a
 *   second payment, and nothing is refunded automatically.
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
import { stripe } from '@/lib/stripe';
import { grantCreditsForOrder } from '@/lib/credit-ledger';
import { recordFunnelEvent } from '@/lib/funnel-ledger';
import { CREDIT_PACK } from '@/lib/assistant-workspace/credits-config';
import { deliverFloorPlanOrder } from '@/lib/floor-plan/deliver';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';
import { openPaymentCase, orderHasRefundCase } from '@/lib/payment-reconciliation';
import { sendOrderConfirmationOnce } from '@/lib/email/order-confirmation';

/** Order.notes prefix written by /api/assistant/analysis/checkout. */
const CREDITS_NOTES_PREFIX = 'Renovation Credits (';

export type FulfillmentOutcome =
  | { status: 'fulfilled'; kind: 'order' | 'invoice' | 'renovation-credits' }
  /**
   * A real charge was recorded but deliberately NOT applied: it needs a person
   * (a PaymentCase is open). Currently: a late payment against a VOID invoice.
   */
  | { status: 'flagged'; reason: 'late_payment_void_invoice' | 'duplicate_payment_invoice' | 'duplicate_payment_order'; caseOpened: boolean }
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

/**
 * A rejection of a session that Stripe says is PAID. The charge is real money
 * that the application did not apply, so a log line is not enough: open a
 * durable PaymentCase (idempotent per payment intent + reason) and then answer
 * `rejected` exactly as before. Nothing is marked paid or granted. Throws on a
 * database failure so the webhook answers 5xx and the case is retried.
 */
async function rejectPaid(
  reason: string,
  session: Stripe.Checkout.Session,
  links: { orderId?: string | null; invoiceId?: string | null; userId?: string | null; expectedCents?: number | null },
): Promise<FulfillmentOutcome> {
  const outcome = reject(reason, { sessionId: session.id, orderId: links.orderId ?? null, invoiceId: links.invoiceId ?? null });
  const pi = paymentIntentId(session);
  await db.$transaction((tx) =>
    openPaymentCase(tx, {
      kind: 'UNAPPLIED_PAYMENT',
      idempotencyKey: `unapplied:${reason}:${pi ?? session.id}`,
      amountCents: session.amount_total ?? 0,
      currency: session.currency,
      summary: `A successful Stripe payment could not be applied (${reason.replaceAll('_', ' ')}). Nothing was marked paid or granted; the charge needs an administrative decision.`,
      stripePaymentIntentId: pi,
      orderId: links.orderId ?? null,
      invoiceId: links.invoiceId ?? null,
      userId: links.userId ?? null,
      details: { reason, checkoutSessionId: session.id, expectedCents: links.expectedCents ?? null, metadata: session.metadata ?? {} },
    }),
  );
  return outcome;
}

const SETTLED_ORDER_STATUSES = ['PAID', 'FULFILLED', 'REFUNDED'];

/**
 * A second, different payment intent for an order that is already paid. The
 * order is never touched; the charge is recorded as a case (there is no Payment
 * table row for orders, so the case IS the durable record of the money).
 */
async function flagDuplicateOrderPayment(
  session: Stripe.Checkout.Session,
  order: { id: string; userId: string; status: string; stripePaymentIntentId: string | null; stripeCheckoutSessionId: string | null },
): Promise<FulfillmentOutcome> {
  const pi = paymentIntentId(session);
  const caseOpened = await db.$transaction((tx) =>
    openPaymentCase(tx, {
      kind: 'DUPLICATE_PAYMENT',
      idempotencyKey: `duplicate-payment:${pi ?? session.id}`,
      amountCents: session.amount_total ?? 0,
      currency: session.currency,
      summary: 'The customer paid again for an order that is already paid (different payment intent). The order is unchanged; the second charge is recorded here and was not refunded.',
      stripePaymentIntentId: pi,
      orderId: order.id,
      userId: order.userId,
      details: {
        checkoutSessionId: session.id,
        originalPaymentIntentId: order.stripePaymentIntentId,
        originalCheckoutSessionId: order.stripeCheckoutSessionId,
        orderStatus: order.status,
      },
    }),
  );
  log('stripe_fulfillment.duplicate_payment', { orderId: order.id, sessionId: session.id, caseOpened });
  return { status: 'flagged', reason: 'duplicate_payment_order', caseOpened };
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
  // A pack that Stripe has since refunded (a case is open) must not be granted
  // by the reconcile sweep or a late redelivery. A person decides.
  if (await orderHasRefundCase(order.id)) return reject('refunded_pending_review', { orderId: order.id });
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
  // No order row to link: the metadata reference is kept in the case details only.
  if (!order) return rejectPaid('order_not_found', session, {});

  const links = { orderId: order.id, userId: order.userId, expectedCents: toCents(order.total) };
  const mismatch = chargeMatches(session, order.total);
  if (mismatch) return rejectPaid(mismatch, session, links);
  if (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
    // A different Checkout Session paid an order that is already settled by another
    // payment intent: the customer paid twice. Anything else is an unapplied charge.
    const pi = paymentIntentId(session);
    if (SETTLED_ORDER_STATUSES.includes(order.status) && pi && order.stripePaymentIntentId !== pi) {
      return flagDuplicateOrderPayment(session, order);
    }
    return rejectPaid('session_mismatch', session, links);
  }
  if (session.metadata?.userId && session.metadata.userId !== order.userId) {
    return rejectPaid('user_mismatch', session, links);
  }

  // Atomic claim: of any number of concurrent deliveries exactly one flips
  // the row; the rest see count 0 and carry on to the (idempotent) fulfilment.
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: { in: ['PENDING', 'CANCELLED'] } },
    data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: paymentIntentId(session) },
  });
  if (claimed.count === 1) log('stripe_fulfillment.order_paid', { orderId });
  else {
    // Not claimed by this delivery: either a replay of the payment that settled
    // the order (same payment intent: carry on) or a SECOND payment intent for an
    // order another delivery already settled (the order's recorded intent is the
    // winner's, re-read here so a concurrent pair is told apart). Re-read, never
    // trust the snapshot above.
    const pi = paymentIntentId(session);
    const fresh = pi ? await db.order.findUnique({ where: { id: orderId } }) : null;
    if (fresh && SETTLED_ORDER_STATUSES.includes(fresh.status) && fresh.stripePaymentIntentId && fresh.stripePaymentIntentId !== pi) {
      return flagDuplicateOrderPayment(session, fresh);
    }
  }

  if (isRenovationCreditsOrder(order.notes)) return fulfilCreditsOrder(order);
  if (isFloorPlanOrder(order.notes)) {
    // Throws on a transient failure (webhook answers 5xx and Stripe redelivers).
    const delivery = await deliverFloorPlanOrder(orderId);
    if (delivery.status === 'rejected') return reject(delivery.reason, { orderId, sessionId: session.id });
    return { status: 'fulfilled', kind: 'order' };
  }
  // Plain confirmation email for every other paid product. Once per order
  // (durable marker), never throws, never affects the PAID state.
  await sendOrderConfirmationOnce(orderId);
  return { status: 'fulfilled', kind: 'order' };
}

async function handleInvoiceSession(session: Stripe.Checkout.Session, invoiceId: string): Promise<FulfillmentOutcome> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return rejectPaid('invoice_not_found', session, {});

  const links = { invoiceId: invoice.id, expectedCents: toCents(invoice.total) };
  const mismatch = chargeMatches(session, invoice.total);
  if (mismatch) return rejectPaid(mismatch, session, links);
  if (session.metadata?.projectId && session.metadata.projectId !== invoice.projectId) {
    return rejectPaid('project_mismatch', session, links);
  }

  const pi = paymentIntentId(session);
  const amountCad = (session.amount_total ?? 0) / 100;

  /* One transaction: the invoice state and its Payment row commit together or
     not at all. A SELECT ... FOR UPDATE takes the row lock first (and returns
     the CURRENT status and payment intent) without writing to the invoice, so
     two concurrent deliveries serialize here and the second one's lookup sees
     the first one's Payment. Re-running it against an invoice that an older
     version of this handler left PAID-without-a-Payment creates the missing
     row — that is the repair path.

     VOID IS TERMINAL. A valid charge that arrives for a VOID invoice (the
     customer paid from a stale Checkout Session) is real money: it is recorded
     as a COMPLETED Payment tied to the payment intent and flagged with a
     PaymentCase for an administrator, but the invoice is never reopened and
     nothing is refunded automatically.

     A PAID INVOICE IS NEVER ALTERED BY A SECOND PAYMENT. A valid charge with a
     DIFFERENT payment intent for an invoice that is already PAID (the customer
     paid twice, e.g. from two Checkout Sessions, or Stripe after a bank
     transfer) is recorded as its own COMPLETED Payment and flagged with a
     DUPLICATE_PAYMENT case keyed by payment intent. The invoice's status,
     paidAt and recorded payment intent stay exactly as they were, and nothing
     is refunded automatically. */
  const result = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string; stripePaymentIntentId: string | null }>>`
      SELECT "status"::text AS "status", "stripePaymentIntentId" FROM "ecowoods"."Invoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
    const prior = rows[0];
    if (!prior) throw new Error('invoice vanished during payment fulfilment');
    const isVoid = prior.status === 'VOID';
    const wasPaid = prior.status === 'PAID';
    if (isVoid) await tx.invoice.update({ where: { id: invoiceId }, data: { stripePaymentIntentId: pi } });
    const claim =
      isVoid || wasPaid
        ? { count: 0 }
        : await tx.invoice.updateMany({
            where: { id: invoiceId, status: { notIn: ['PAID', 'VOID'] } },
            data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: pi },
          });
    const existing = pi
      ? await tx.payment.findFirst({ where: { invoiceId, stripePaymentIntentId: pi } })
      : await tx.payment.findFirst({ where: { invoiceId, method: 'STRIPE', status: 'COMPLETED' } });
    const payment =
      existing ??
      (await tx.payment.create({
        data: {
          invoiceId,
          userId: session.metadata?.userId ?? null,
          amount: amountCad,
          method: 'STRIPE',
          status: 'COMPLETED',
          stripeCharged: true,
          stripePaymentIntentId: pi,
        },
      }));
    let caseOpened = false;
    if (isVoid) {
      caseOpened = await openPaymentCase(tx, {
        kind: 'LATE_PAYMENT_VOID_INVOICE',
        idempotencyKey: `late-void:${pi ?? session.id}`,
        amountCents: session.amount_total ?? 0,
        currency: session.currency,
        summary: 'A successful Stripe payment arrived for a VOID invoice. The invoice stays VOID; the charge is recorded and needs an administrative decision.',
        stripePaymentIntentId: pi,
        invoiceId,
        paymentId: payment.id,
        userId: session.metadata?.userId ?? null,
        details: { checkoutSessionId: session.id, invoiceNumber: invoice.number ?? null },
      });
    }
    // Already PAID by a different payment (or by none recorded here: a manual
    // bank/cash confirmation) and this intent has no Payment yet: a real second charge.
    const isDuplicate = wasPaid && !existing && prior.stripePaymentIntentId !== pi;
    if (isDuplicate) {
      caseOpened = await openPaymentCase(tx, {
        kind: 'DUPLICATE_PAYMENT',
        idempotencyKey: `duplicate-payment:${pi ?? session.id}`,
        amountCents: session.amount_total ?? 0,
        currency: session.currency,
        summary: 'The customer paid again for an invoice that is already PAID (different payment intent). The invoice is unchanged; the second charge is recorded as a Payment and was not refunded.',
        stripePaymentIntentId: pi,
        invoiceId,
        paymentId: payment.id,
        userId: session.metadata?.userId ?? null,
        details: { checkoutSessionId: session.id, invoiceNumber: invoice.number ?? null, originalPaymentIntentId: prior.stripePaymentIntentId },
      });
    }
    return { claimedNow: claim.count === 1, isVoid, isDuplicate, caseOpened };
  });
  const claimedNow = result.claimedNow;
  if (result.isVoid) {
    return { status: 'flagged', reason: 'late_payment_void_invoice', caseOpened: result.caseOpened };
  }
  if (result.isDuplicate) {
    log('stripe_fulfillment.duplicate_payment', { invoiceId, sessionId: session.id, caseOpened: result.caseOpened });
    return { status: 'flagged', reason: 'duplicate_payment_invoice', caseOpened: result.caseOpened };
  }

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

/**
 * Webhooks can be lost for good: a misconfigured endpoint, a signing-secret
 * mismatch, or an outage longer than Stripe's retry window. The customer has
 * then paid, the Order is still PENDING, and nothing else ever looks. Ask
 * Stripe (read-only) for recently completed, paid Checkout Sessions and run
 * the ones whose Order/Invoice we still hold as unpaid through the same
 * idempotent fulfilment the webhook uses. Sessions younger than `minAgeMs` are
 * left to the webhook that is probably still on its way.
 */
async function reconcileLostWebhooks(
  summary: ReconcileSummary,
  options: { minAgeMs?: number; lookbackMs?: number; maxSessions?: number },
): Promise<void> {
  const now = Date.now();
  const newest = now - (options.minAgeMs ?? 10 * 60 * 1000);
  const oldest = now - (options.lookbackMs ?? 3 * 86_400_000);
  const maxSessions = options.maxSessions ?? 200;
  try {
    const paid: Stripe.Checkout.Session[] = [];
    let seen = 0;
    for await (const session of stripe.checkout.sessions.list({ status: 'complete', created: { gte: Math.floor(oldest / 1000) }, limit: 100 })) {
      if (++seen > maxSessions) break;
      if (session.payment_status === 'paid' && session.created * 1000 <= newest) paid.push(session);
    }
    const orderIds = paid.flatMap((x) => (x.metadata?.orderId ? [x.metadata.orderId] : []));
    const invoiceIds = paid.flatMap((x) => (!x.metadata?.orderId && x.metadata?.invoiceId ? [x.metadata.invoiceId] : []));
    const [orders, invoices] = await Promise.all([
      orderIds.length
        ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, status: true, stripePaymentIntentId: true, stripeCheckoutSessionId: true } })
        : [],
      invoiceIds.length
        ? db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, status: true, payments: { select: { stripePaymentIntentId: true } } } })
        : [],
    ]);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const invoiceById = new Map(invoices.map((i) => [i.id, i]));
    /* A session needs (re-)running when its Order/Invoice is still unpaid, OR when
       it is already paid but THIS payment intent is not the one recorded: a second
       payment whose webhook was lost would otherwise sit in Stripe unnoticed. The
       run is idempotent (a replay of the recorded payment is a no-op). */
    const needsRun = (session: Stripe.Checkout.Session): boolean => {
      const pi = paymentIntentId(session);
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const o = orderById.get(orderId);
        if (!o) return false;
        if (o.status === 'PENDING' || o.status === 'CANCELLED') return true;
        return !!pi && !!o.stripePaymentIntentId && o.stripePaymentIntentId !== pi && o.stripeCheckoutSessionId !== session.id;
      }
      const invoiceId = session.metadata?.invoiceId;
      if (!invoiceId) return false;
      const i = invoiceById.get(invoiceId);
      if (!i) return false;
      if (i.status !== 'PAID') return true;
      return !i.payments.some((p) => p.stripePaymentIntentId === pi);
    };
    for (const session of paid) {
      if (!needsRun(session)) continue;
      summary.examined += 1;
      try {
        log('stripe_fulfillment.lost_webhook_recovered', { sessionId: session.id, orderId: session.metadata?.orderId ?? null, invoiceId: session.metadata?.invoiceId ?? null });
        const outcome = await fulfilCheckoutSession(session);
        if (outcome.status === 'fulfilled' || outcome.status === 'flagged') summary.fulfilled += 1;
        else summary.failed += 1;
      } catch (err) {
        summary.failed += 1;
        console.error(JSON.stringify({ event: 'stripe_fulfillment.unresolved', sessionId: session.id, error: err instanceof Error ? err.message : 'unknown' }));
      }
    }
  } catch (err) {
    summary.failed += 1;
    console.error(JSON.stringify({ event: 'stripe_fulfillment.lost_webhook_scan_failed', error: err instanceof Error ? err.message : 'unknown' }));
  }
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
export async function reconcilePendingFulfillments(options: { olderThanMs?: number; batch?: number; lostWebhook?: { minAgeMs?: number; lookbackMs?: number; maxSessions?: number } } = {}): Promise<ReconcileSummary> {
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
  // Paid Personal Floor Plans whose report/email a webhook delivery did not finish.
  const floorPlans = await db.order.findMany({
    where: {
      status: { in: ['PAID', 'FULFILLED'] },
      notes: { startsWith: 'Personal Floor Plan' },
      NOT: { notes: { contains: 'FP_NOTIFIED:' } },
      paidAt: { lte: cutoff, gte: new Date(Date.now() - 30 * 86_400_000) },
    },
    select: { id: true },
    orderBy: { paidAt: 'asc' },
    take: options.batch ?? 25,
  });
  summary.examined += floorPlans.length;
  for (const order of floorPlans) {
    try {
      const outcome = await deliverFloorPlanOrder(order.id);
      if (outcome.status === 'delivered' || outcome.status === 'already_delivered') summary.fulfilled += 1;
      else summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(JSON.stringify({ event: 'stripe_fulfillment.unresolved', orderId: order.id, error: err instanceof Error ? err.message : 'unknown' }));
    }
  }
  /* Payment confirmation emails whose send failed (the claim was released) or
     whose webhook run died before sending. Only the last 24h: an older paid
     order is never emailed retroactively. Plain orders only; the notes filter
     keeps NULL notes (shop orders), which a bare NOT/startsWith would drop. */
  const unconfirmed = await db.order.findMany({
    where: {
      status: { in: ['PAID', 'FULFILLED'] },
      confirmationEmailSentAt: null,
      paidAt: { lte: cutoff, gte: new Date(Date.now() - 86_400_000) },
      OR: [{ notes: null }, { AND: [{ NOT: { notes: { startsWith: CREDITS_NOTES_PREFIX } } }, { NOT: { notes: { startsWith: 'Personal Floor Plan' } } }] }],
    },
    select: { id: true },
    orderBy: { paidAt: 'asc' },
    take: options.batch ?? 25,
  });
  summary.examined += unconfirmed.length;
  for (const order of unconfirmed) {
    const outcome = await sendOrderConfirmationOnce(order.id);
    if (outcome === 'failed') summary.failed += 1;
    else summary.fulfilled += 1;
  }
  await reconcileLostWebhooks(summary, options.lostWebhook ?? {});
  return summary;
}
