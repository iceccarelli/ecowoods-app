/**
 * Refund / dispute correlation for DUPLICATE payments against REAL PostgreSQL.
 *
 * An order has no Payment table, so a second payment intent for an already-paid
 * order is recorded only as a DUPLICATE_PAYMENT PaymentCase keyed by that
 * intent. A later Stripe refund or dispute for THAT intent must land on that
 * case (and its order link), never become an unlinked case, and never touch the
 * original order's state. Stripe is faked; the database is real. Runs only with
 * RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));
vi.mock('@/lib/email', () => ({ sendEmail: async () => undefined }));
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { list: () => ({ async *[Symbol.asyncIterator]() {} }) } } },
}));

describe.skipIf(!enabled)('refund and dispute correlation for duplicate payments (real PostgreSQL)', () => {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const intents: string[] = [];

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.paymentCase.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { stripePaymentIntentId: { in: intents } }] } }).catch(() => undefined);
    await db.stripeWebhookEvent.deleteMany({ where: { stripeEventId: { startsWith: `evt_${tag}` } } }).catch(() => undefined);
    for (const id of userIds) {
      await db.order.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  const pi = () => {
    const id = `pi_${randomUUID()}`;
    intents.push(id);
    return id;
  };

  /** A PAID plain order (original intent) plus a helper that makes a second Checkout Session for it. */
  async function paidOrder(total = 100) {
    const { db } = await import('@/lib/db');
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const user = await db.user.create({ data: { email: `rc-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    const firstSession = `cs_test_${randomUUID()}`;
    const order = await db.order.create({
      data: { userId: user.id, subtotal: total, total, notes: 'Well-Installed Quote Review (Standard)', stripeCheckoutSessionId: firstSession },
    });
    const originalPi = pi();
    const mk = (id: string, intent: string) =>
      ({
        id,
        object: 'checkout.session',
        payment_status: 'paid',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: intent,
        metadata: { orderId: order.id, userId: user.id },
      }) as unknown as Stripe.Checkout.Session;
    await fulfilCheckoutSession(mk(firstSession, originalPi));
    const duplicate = async () => {
      const dupPi = pi();
      const out = await fulfilCheckoutSession(mk(`cs_test_${randomUUID()}`, dupPi));
      return { dupPi, out };
    };
    return { db, user, order, originalPi, duplicate, total };
  }

  const evt = (type: string, object: unknown, id = `evt_${tag}_${randomUUID()}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;
  const refunded = (intent: string, chargeCents: number, refundedCents: number, id?: string) =>
    evt('charge.refunded', { id: `ch_${intent}`, object: 'charge', payment_intent: intent, amount: chargeCents, amount_refunded: refundedCents, currency: 'cad' }, id);

  async function snapshotOrder(db: Awaited<ReturnType<typeof paidOrder>>['db'], id: string) {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    return { status: o.status, refundedAmount: Number(o.refundedAmount), paidAt: o.paidAt?.toISOString(), pi: o.stripePaymentIntentId };
  }

  it('a full refund of the duplicate lands on its DUPLICATE_PAYMENT case, stays open, and never touches the original order', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, duplicate } = await paidOrder(100);
    const before = await snapshotOrder(db, order.id);
    const { dupPi, out } = await duplicate();
    expect(out).toMatchObject({ status: 'flagged', reason: 'duplicate_payment_order' });

    const ev = refunded(dupPi, 10000, 10000);
    expect(await handleChargeRefunded(ev)).toBe('recorded');

    expect(await snapshotOrder(db, order.id)).toEqual(before);
    expect(before).toMatchObject({ status: 'PAID', refundedAmount: 0 });
    const cases = await db.paymentCase.findMany({ where: { stripePaymentIntentId: dupPi } });
    // exactly one case for this intent: the duplicate case, now carrying the refund; no unlinked orphan
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'DUPLICATE_PAYMENT', status: 'OPEN', orderId: order.id });
    expect(Number(cases[0]!.refundedAmount)).toBe(100);
    expect(cases[0]!.refundedAt).not.toBeNull();
    expect(await db.paymentCase.count({ where: { orderId: null, stripePaymentIntentId: dupPi } })).toBe(0);
  });

  it('charge.refunded replay and concurrent copies are no-ops; a smaller cumulative amount never lowers the recorded refund', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    const partial = refunded(dupPi, 10000, 4000);
    const results = await Promise.all(Array.from({ length: 5 }, () => handleChargeRefunded(partial)));
    expect(results.filter((r) => r === 'recorded')).toHaveLength(1);
    expect(await handleChargeRefunded(partial)).toBe('duplicate');
    let c = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(Number(c.refundedAmount)).toBe(40);
    expect(c.status).toBe('OPEN');

    await handleChargeRefunded(refunded(dupPi, 10000, 10000));
    c = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(Number(c.refundedAmount)).toBe(100);

    // a late, reordered older event with a smaller cumulative amount
    await handleChargeRefunded(refunded(dupPi, 10000, 2500));
    c = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(Number(c.refundedAmount)).toBe(100);
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: dupPi } })).toBe(1);
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
  });

  it('a dispute on the duplicate intent is linked to the order and recorded on the duplicate case; the order is untouched', async () => {
    const { handleDisputeCreated } = await import('@/lib/payment-reconciliation');
    const { db, order, user, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    const dispute = evt('charge.dispute.created', { id: `dp_${randomUUID()}`, object: 'dispute', payment_intent: dupPi, charge: `ch_${dupPi}`, amount: 10000, currency: 'cad', reason: 'fraudulent', status: 'needs_response' });
    expect(await handleDisputeCreated(dispute)).toBe('recorded');
    expect(await handleDisputeCreated(dispute)).toBe('duplicate');

    const disputeCase = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DISPUTE_OPENED' } });
    expect(disputeCase).toMatchObject({ orderId: order.id, userId: user.id, status: 'OPEN' });
    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(dup.status).toBe('OPEN');
    expect(dup.disputeId).toBe((dispute.data.object as { id: string }).id);
    expect(dup.disputedAt).not.toBeNull();
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
  });

  it('a FAILED refund for the duplicate is linked to the order and recorded on the duplicate case', async () => {
    const { handleRefundUpdated } = await import('@/lib/payment-reconciliation');
    const { db, order, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    const failed = evt('refund.updated', { id: `re_${randomUUID()}`, object: 'refund', payment_intent: dupPi, charge: `ch_${dupPi}`, amount: 10000, currency: 'cad', status: 'failed', failure_reason: 'expired_or_canceled_card' });
    expect(await handleRefundUpdated(failed)).toBe('recorded');
    const review = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'REFUND_NEEDS_REVIEW' } });
    expect(review.orderId).toBe(order.id);
    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(dup.refundFailedAt).not.toBeNull();
    expect(dup.status).toBe('OPEN');
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
  });

  it('a refund and a dispute that arrive BEFORE the duplicate case exists are adopted when it is created', async () => {
    const { handleChargeRefunded, handleDisputeCreated } = await import('@/lib/payment-reconciliation');
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, user } = await paidOrder(100);
    const dupPi = pi();
    expect(await handleChargeRefunded(refunded(dupPi, 10000, 6000))).toBe('recorded');
    const disputeId = `dp_${randomUUID()}`;
    await handleDisputeCreated(evt('charge.dispute.created', { id: disputeId, object: 'dispute', payment_intent: dupPi, charge: `ch_${dupPi}`, amount: 10000, currency: 'cad', reason: 'general', status: 'needs_response' }));
    // nothing to correlate with yet: the events are held as unlinked review cases
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: dupPi, orderId: null } })).toBe(2);

    const out = await fulfilCheckoutSession({
      id: `cs_test_${randomUUID()}`,
      object: 'checkout.session',
      payment_status: 'paid',
      currency: 'cad',
      amount_total: 10000,
      payment_intent: dupPi,
      metadata: { orderId: order.id, userId: user.id },
    } as unknown as Stripe.Checkout.Session);
    expect(out).toMatchObject({ status: 'flagged', reason: 'duplicate_payment_order' });

    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(dup.status).toBe('OPEN');
    expect(Number(dup.refundedAmount)).toBe(60);
    expect(dup.disputeId).toBe(disputeId);
    // the held cases are now linked to the order for the administrator
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: dupPi, orderId: null } })).toBe(0);
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
  });

  it('a refund racing the creation of the duplicate case ends up correlated whichever commits first', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    for (let i = 0; i < 4; i++) {
      const { db, order, user } = await paidOrder(100);
      const dupPi = pi();
      await Promise.all([
        handleChargeRefunded(refunded(dupPi, 10000, 10000)),
        fulfilCheckoutSession({
          id: `cs_test_${randomUUID()}`,
          object: 'checkout.session',
          payment_status: 'paid',
          currency: 'cad',
          amount_total: 10000,
          payment_intent: dupPi,
          metadata: { orderId: order.id, userId: user.id },
        } as unknown as Stripe.Checkout.Session),
      ]);
      const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
      expect(Number(dup.refundedAmount)).toBe(100);
      expect(await db.paymentCase.count({ where: { stripePaymentIntentId: dupPi, orderId: null } })).toBe(0);
      expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
    }
  });

  it('a refund on the ORIGINAL intent still marks the order REFUNDED and is not mixed up with the duplicate (regression)', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, originalPi, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    await handleChargeRefunded(refunded(originalPi, 10000, 10000));
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'REFUNDED', refundedAmount: 100 });
    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    expect(dup.refundedAmount).toBeNull();
    expect(dup.status).toBe('OPEN');
  });

  it('a refund for an UNAPPLIED payment is recorded on that case as well', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, user } = await paidOrder(100);
    const other = await db.order.create({ data: { userId: user.id, subtotal: 50, total: 50, notes: 'x' } });
    const intent = pi();
    const out = await fulfilCheckoutSession({
      id: `cs_test_${randomUUID()}`,
      object: 'checkout.session',
      payment_status: 'paid',
      currency: 'cad',
      amount_total: 999,
      payment_intent: intent,
      metadata: { orderId: other.id, userId: user.id },
    } as unknown as Stripe.Checkout.Session);
    expect(out).toMatchObject({ status: 'rejected', reason: 'amount_mismatch' });
    await handleChargeRefunded(refunded(intent, 999, 999));
    const c = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: intent, kind: 'UNAPPLIED_PAYMENT' } });
    expect(Number(c.refundedAmount)).toBe(9.99);
    expect(c.status).toBe('OPEN');
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: intent } })).toBe(1);
    expect(await snapshotOrder(db, order.id)).toMatchObject({ status: 'PAID' });
    expect((await db.order.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('PENDING');
  });

  it('the open-case count (admin nav / dashboard) includes a duplicate with a refund until an administrator resolves it with a note', async () => {
    const { handleChargeRefunded, countOpenPaymentCases, recordCaseResolution } = await import('@/lib/payment-reconciliation');
    const { db, user, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    const before = (await countOpenPaymentCases())!;
    await handleChargeRefunded(refunded(dupPi, 10000, 10000));
    expect(await countOpenPaymentCases()).toBe(before); // a refund does not close it
    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    await expect(recordCaseResolution({ caseId: dup.id, adminId: user.id, resolution: 'REFUNDED_MANUALLY', note: '  ' })).rejects.toThrow('note');
    await recordCaseResolution({ caseId: dup.id, adminId: user.id, resolution: 'REFUNDED_MANUALLY', note: 'refund re_123 issued in Stripe' });
    expect(await countOpenPaymentCases()).toBe(before - 1);
  });

  it('a refund arriving after the administrator resolved the duplicate case is recorded on it without reopening it', async () => {
    const { handleChargeRefunded, recordCaseResolution } = await import('@/lib/payment-reconciliation');
    const { db, user, duplicate } = await paidOrder(100);
    const { dupPi } = await duplicate();
    const dup = await db.paymentCase.findFirstOrThrow({ where: { stripePaymentIntentId: dupPi, kind: 'DUPLICATE_PAYMENT' } });
    await recordCaseResolution({ caseId: dup.id, adminId: user.id, resolution: 'REFUNDED_MANUALLY', note: 'refunded in the Stripe dashboard' });
    await handleChargeRefunded(refunded(dupPi, 10000, 10000));
    const after = await db.paymentCase.findUniqueOrThrow({ where: { id: dup.id } });
    expect(after.status).toBe('RESOLVED');
    expect(Number(after.refundedAmount)).toBe(100);
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: dupPi } })).toBe(1);
  });
});
