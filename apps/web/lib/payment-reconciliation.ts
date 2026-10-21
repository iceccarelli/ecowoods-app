/**
 * lib/payment-reconciliation.ts — what the system does when Stripe says money
 * moved in a way the application's own state does not already explain.
 *
 * THE RULES (each one exists because the alternative loses or invents money)
 *
 *   · A refund, a failed refund or a dispute is a FACT about real money. It is
 *     recorded durably (StripeWebhookEvent + PaymentCase) before anything else.
 *   · Application state is changed only when the change is unambiguous: a
 *     plain (non credit-pack) order whose charge equals its total, fully
 *     refunded, becomes REFUNDED; a partial refund only records the cumulative
 *     amount. An invoice Payment fully refunded becomes REFUNDED, and a case is
 *     still opened because whether the invoice is still owed is a human decision.
 *   · Renovation Credits are NEVER touched here. A credit-pack refund opens a
 *     case: CREDIT_REVERSAL_RECOMMENDED only when the pack was fully refunded
 *     and provably nothing happened on the wallet since the grant; anything
 *     else (spent credits, later activity, partial refund, no grant, ambiguous
 *     match) is REFUND_NEEDS_REVIEW. No balance is changed, no negative balance
 *     is possible, no spent credit is restored.
 *   · Nothing here calls Stripe, refunds, or reverses anything. A case
 *     resolution is a recorded decision; it does not itself move money.
 *   · Idempotent and replay-safe: the event row is written in the same
 *     transaction as its effects (rollback leaves nothing, so a redelivery
 *     re-runs); a committed event row makes any replay a no-op; cases are
 *     unique on a natural key.
 */
import type Stripe from 'stripe';
import { Prisma, type PaymentCaseKind, type PaymentCaseResolution } from '@prisma/client';
import { db } from '@/lib/db';

type Tx = Prisma.TransactionClient;

export const REFUND_CASE_KINDS: PaymentCaseKind[] = ['REFUND_NEEDS_REVIEW', 'CREDIT_REVERSAL_RECOMMENDED'];

const CREDITS_NOTES_PREFIX = 'Renovation Credits (';

export const PAYMENT_CASE_RESOLUTIONS: PaymentCaseResolution[] = [
  'REFUNDED_MANUALLY',
  'INVOICE_REISSUED',
  'APPLIED_AS_CREDIT',
  'CREDITS_ADJUSTED_SEPARATELY',
  'DISPUTE_RESPONDED',
  'NO_ACTION_REQUIRED',
  'OTHER',
];

const toCents = (amount: unknown): number => Math.round(Number(amount) * 100);
const idOf = (x: string | { id: string } | null | undefined): string | null => (typeof x === 'string' ? x : (x?.id ?? null));

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

export interface OpenCaseInput {
  kind: PaymentCaseKind;
  idempotencyKey: string;
  amountCents: number;
  currency?: string | null;
  summary: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeEventId?: string | null;
  invoiceId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  userId?: string | null;
  details?: Record<string, unknown>;
}

/** Open a case once per natural key. ON CONFLICT DO NOTHING, so it is safe inside a transaction and under concurrency. */
export async function openPaymentCase(tx: Tx, input: OpenCaseInput): Promise<boolean> {
  const created = await tx.paymentCase.createMany({
    data: [
      {
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        amount: input.amountCents / 100,
        currency: (input.currency ?? 'cad').toLowerCase().slice(0, 3),
        summary: input.summary,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripeChargeId: input.stripeChargeId ?? null,
        stripeEventId: input.stripeEventId ?? null,
        invoiceId: input.invoiceId ?? null,
        orderId: input.orderId ?? null,
        paymentId: input.paymentId ?? null,
        userId: input.userId ?? null,
        details: (input.details ?? {}) as Prisma.InputJsonValue,
      },
    ],
    skipDuplicates: true,
  });
  if (created.count === 1) {
    console.error(
      JSON.stringify({ event: 'payment_case.opened', kind: input.kind, key: input.idempotencyKey, amountCents: input.amountCents, orderId: input.orderId ?? null, invoiceId: input.invoiceId ?? null }),
    );
  }
  return created.count === 1;
}

export type StripeMoneyEventOutcome = 'duplicate' | 'recorded' | 'ignored';

/** Claim the event inside the caller's transaction. False = already applied by a committed earlier delivery. */
async function claimEvent(tx: Tx, event: Stripe.Event, objectId: string | null): Promise<boolean> {
  const claimed = await tx.stripeWebhookEvent.createMany({
    data: [{ stripeEventId: event.id, type: event.type, objectId, outcome: 'processing' }],
    skipDuplicates: true,
  });
  return claimed.count === 1;
}

async function setOutcome(tx: Tx, eventId: string, outcome: string): Promise<void> {
  await tx.stripeWebhookEvent.update({ where: { stripeEventId: eventId }, data: { outcome } });
}

/** What the payment intent maps to in our own tables. */
async function locate(tx: Tx, pi: string | null) {
  if (!pi) return { orders: [], payments: [] };
  const [orders, payments] = await Promise.all([
    tx.order.findMany({ where: { stripePaymentIntentId: pi } }),
    tx.payment.findMany({ where: { stripePaymentIntentId: pi, method: 'STRIPE' } }),
  ]);
  return { orders, payments };
}

interface MoneySignal {
  chargeId: string | null;
  pi: string | null;
  currency: string | null;
}

async function linksFor(tx: Tx, pi: string | null) {
  const found = await locate(tx, pi);
  const total = found.orders.length + found.payments.length;
  return {
    ...found,
    unique: total === 1,
    links: {
      orderId: found.orders.length === 1 && total === 1 ? found.orders[0]!.id : null,
      userId: total === 1 ? (found.orders[0]?.userId ?? found.payments[0]?.userId ?? null) : null,
      invoiceId: total === 1 ? (found.payments[0]?.invoiceId ?? null) : null,
      paymentId: total === 1 ? (found.payments[0]?.id ?? null) : null,
    },
  };
}

/**
 * charge.refunded — Stripe reports the CUMULATIVE amount refunded on a charge.
 */
export async function handleChargeRefunded(event: Stripe.Event): Promise<StripeMoneyEventOutcome> {
  const charge = event.data.object as Stripe.Charge;
  const pi = idOf(charge.payment_intent);
  const chargeCents = charge.amount;
  const refundedCents = charge.amount_refunded;
  const full = refundedCents >= chargeCents;
  const signal: MoneySignal = { chargeId: charge.id, pi, currency: charge.currency };

  return db.$transaction(async (tx) => {
    if (!(await claimEvent(tx, event, charge.id))) return 'duplicate' as const;
    const m = await linksFor(tx, pi);
    const base = {
      amountCents: refundedCents,
      currency: signal.currency,
      stripePaymentIntentId: pi,
      stripeChargeId: charge.id,
      stripeEventId: event.id,
      ...m.links,
    };
    const key = `refund:${charge.id}:${refundedCents}`;
    const review = (summary: string, extra: Record<string, unknown> = {}) =>
      openPaymentCase(tx, {
        ...base,
        kind: 'REFUND_NEEDS_REVIEW',
        idempotencyKey: key,
        summary,
        details: { chargeCents, refundedCents, full, ...extra },
      });

    if (!m.unique) {
      await review(
        m.orders.length + m.payments.length === 0
          ? 'A Stripe charge was refunded but matches no order or invoice payment here.'
          : 'A Stripe charge was refunded and matches more than one order/payment; not applied automatically.',
        { matched: m.orders.length + m.payments.length },
      );
      await setOutcome(tx, event.id, 'case_opened');
      return 'recorded' as const;
    }

    const order = m.orders[0];
    if (order) {
      if (order.notes?.startsWith(CREDITS_NOTES_PREFIX)) {
        const grant = await tx.creditTransaction.findUnique({ where: { idempotencyKey: `order-grant:${order.id}` } });
        const wallet = grant ? await tx.creditWallet.findUnique({ where: { userId: order.userId } }) : null;
        const later = grant ? await tx.creditTransaction.count({ where: { userId: order.userId, createdAt: { gt: grant.createdAt }, id: { not: grant.id } } }) : 0;
        const priceMatches = chargeCents === toCents(order.total);
        const unspent = !!grant && !!wallet && later === 0 && wallet.balance >= grant.credits;
        const details = { orderStatus: order.status, grantCredits: grant?.credits ?? null, walletBalance: wallet?.balance ?? null, laterLedgerRows: later, priceMatches };
        if (full && priceMatches && unspent) {
          await openPaymentCase(tx, {
            ...base,
            kind: 'CREDIT_REVERSAL_RECOMMENDED',
            idempotencyKey: key,
            summary: 'Credit pack fully refunded and its credits are unspent. A reversal is recommended; nothing was changed.',
            details: { chargeCents, refundedCents, full, ...details },
          });
        } else {
          await review('Credit pack refund involves spent, partial or unverifiable credits. No balance was changed.', details);
        }
        await setOutcome(tx, event.id, 'credit_pack_case_opened');
        return 'recorded' as const;
      }
      const eligible = chargeCents === toCents(order.total) && ['PAID', 'FULFILLED', 'REFUNDED'].includes(order.status);
      if (!eligible) {
        await review('Refund on an order whose status or total does not match the charge; not applied automatically.', { orderStatus: order.status, orderTotalCents: toCents(order.total) });
        await setOutcome(tx, event.id, 'case_opened');
        return 'recorded' as const;
      }
      // Monotonic: a replay or reordering of an older (smaller) cumulative amount never lowers it.
      await tx.order.updateMany({ where: { id: order.id, refundedAmount: { lt: refundedCents / 100 } }, data: { refundedAmount: refundedCents / 100 } });
      if (full) await tx.order.updateMany({ where: { id: order.id, status: { in: ['PAID', 'FULFILLED'] } }, data: { status: 'REFUNDED' } });
      await setOutcome(tx, event.id, full ? 'order_refunded' : 'order_partially_refunded');
      log('stripe_refund.order', { orderId: order.id, refundedCents, full });
      return 'recorded' as const;
    }

    const payment = m.payments[0]!;
    const matches = toCents(payment.amount) === chargeCents;
    if (matches && full) await tx.payment.updateMany({ where: { id: payment.id, status: 'COMPLETED' }, data: { status: 'REFUNDED' } });
    await review(
      full && matches
        ? 'Invoice payment fully refunded in Stripe. The Payment is marked REFUNDED; decide whether the invoice is still owed.'
        : 'Invoice payment refunded in Stripe (partial or amount mismatch). Payment state unchanged; review needed.',
      { paymentCents: toCents(payment.amount), matches },
    );
    await setOutcome(tx, event.id, full && matches ? 'payment_refunded_case_opened' : 'case_opened');
    return 'recorded' as const;
  });
}

/** charge.dispute.created — a chargeback is opened. Records it; moves nothing. */
export async function handleDisputeCreated(event: Stripe.Event): Promise<StripeMoneyEventOutcome> {
  const dispute = event.data.object as Stripe.Dispute;
  const pi = idOf(dispute.payment_intent as string | { id: string } | null);
  return db.$transaction(async (tx) => {
    if (!(await claimEvent(tx, event, dispute.id))) return 'duplicate' as const;
    const m = await linksFor(tx, pi);
    await openPaymentCase(tx, {
      ...m.links,
      kind: 'DISPUTE_OPENED',
      idempotencyKey: `dispute:${dispute.id}`,
      amountCents: dispute.amount,
      currency: dispute.currency,
      summary: `Stripe dispute opened (${dispute.reason}). Respond in the Stripe dashboard; nothing was changed here.`,
      stripePaymentIntentId: pi,
      stripeChargeId: idOf(dispute.charge as string | { id: string } | null),
      stripeEventId: event.id,
      details: { reason: dispute.reason, status: dispute.status, matched: m.orders.length + m.payments.length },
    });
    await setOutcome(tx, event.id, 'dispute_case_opened');
    return 'recorded' as const;
  });
}

/** refund.updated — only a refund that FAILED or was CANCELED matters: the money did not leave. */
export async function handleRefundUpdated(event: Stripe.Event): Promise<StripeMoneyEventOutcome> {
  const refund = event.data.object as Stripe.Refund;
  const pi = idOf(refund.payment_intent as string | { id: string } | null);
  return db.$transaction(async (tx) => {
    if (!(await claimEvent(tx, event, refund.id))) return 'duplicate' as const;
    if (refund.status !== 'failed' && refund.status !== 'canceled') {
      await setOutcome(tx, event.id, 'ignored');
      return 'ignored' as const;
    }
    const m = await linksFor(tx, pi);
    await openPaymentCase(tx, {
      ...m.links,
      kind: 'REFUND_NEEDS_REVIEW',
      idempotencyKey: `refund-${refund.status}:${refund.id}`,
      amountCents: refund.amount,
      currency: refund.currency,
      summary: `A refund ${refund.status} in Stripe; any earlier refund status shown here may be wrong. Review; nothing was changed.`,
      stripePaymentIntentId: pi,
      stripeChargeId: idOf(refund.charge as string | { id: string } | null),
      stripeEventId: event.id,
      details: { refundId: refund.id, status: refund.status, failureReason: refund.failure_reason ?? null },
    });
    await setOutcome(tx, event.id, 'refund_failed_case_opened');
    return 'recorded' as const;
  });
}

/** True when a refund case already exists for this order: credits must not be granted for a refunded pack. */
export async function orderHasRefundCase(orderId: string): Promise<boolean> {
  return (await db.paymentCase.count({ where: { orderId, kind: { in: REFUND_CASE_KINDS } } })) > 0;
}

export type ResolveOutcome = { status: 'resolved' | 'already_resolved'; caseId: string };

/**
 * Record an administrator's decision. Idempotent: repeating the same decision
 * succeeds without change; a DIFFERENT decision on a resolved case is refused
 * (the first recorded decision stands). Never moves money.
 */
export async function recordCaseResolution(input: {
  caseId: string;
  adminId: string;
  resolution: PaymentCaseResolution;
  note: string;
}): Promise<ResolveOutcome> {
  if (!PAYMENT_CASE_RESOLUTIONS.includes(input.resolution)) throw new Error('Unknown resolution.');
  const note = input.note.trim();
  if (note.length < 5) throw new Error('A resolution note of at least 5 characters is required.');
  if (note.length > 2000) throw new Error('Resolution note is too long.');

  const claimed = await db.paymentCase.updateMany({
    where: { id: input.caseId, status: 'OPEN' },
    data: { status: 'RESOLVED', resolution: input.resolution, resolutionNote: note, resolvedById: input.adminId, resolvedAt: new Date() },
  });
  if (claimed.count === 1) {
    console.log(JSON.stringify({ event: 'payment_case.resolved', caseId: input.caseId, resolution: input.resolution, by: input.adminId }));
    return { status: 'resolved', caseId: input.caseId };
  }
  const row = await db.paymentCase.findUnique({ where: { id: input.caseId } });
  if (!row) throw new Error('Case not found.');
  if (row.status === 'RESOLVED' && row.resolution === input.resolution) return { status: 'already_resolved', caseId: input.caseId };
  throw new Error('This case is already resolved with a different decision.');
}
