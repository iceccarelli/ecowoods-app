/**
 * Payment reconciliation against REAL PostgreSQL: late payments on VOID
 * invoices, the refund / dispute lifecycle, credit-pack safety, rollback and
 * the admin resolution workflow. Stripe is faked (no network, no charges, no
 * refunds); the database is real. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const state = vi.hoisted(() => ({ role: 'ADMIN' as 'ADMIN' | 'USER', userId: '' }));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { id: state.userId, role: state.role, email: 'admin@example.test' } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            /* no lost-webhook candidates */
          },
        }),
      },
    },
  },
}));

describe.skipIf(!enabled)('payment reconciliation against real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const intents: string[] = [];

  beforeEach(() => {
    state.role = 'ADMIN';
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.paymentCase.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { stripePaymentIntentId: { in: intents } }] } }).catch(() => undefined);
    await db.stripeWebhookEvent.deleteMany({ where: { stripeEventId: { startsWith: `evt_${tag}` } } }).catch(() => undefined);
    const projects = await db.project.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const ids = projects.map((p) => p.id);
    await db.payment.deleteMany({ where: { invoice: { projectId: { in: ids } } } }).catch(() => undefined);
    await db.invoice.deleteMany({ where: { projectId: { in: ids } } }).catch(() => undefined);
    await db.project.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
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

  async function newUser() {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `rec-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    return { db, user };
  }

  async function invoiceFixture(status: 'SENT' | 'VOID', total = 500) {
    const { db, user } = await newUser();
    const project = await db.project.create({ data: { userId: user.id, title: `P-${tag}` } });
    const invoice = await db.invoice.create({
      data: { projectId: project.id, stage: 'DEPOSIT', status, subtotal: total, total, number: `T-${randomUUID().slice(0, 12)}` },
    });
    const intent = pi();
    const session = (patch: Partial<Stripe.Checkout.Session> = {}) =>
      ({
        id: `cs_test_${randomUUID()}`,
        object: 'checkout.session',
        payment_status: 'paid',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: intent,
        metadata: { invoiceId: invoice.id, projectId: project.id, userId: user.id },
        ...patch,
      }) as unknown as Stripe.Checkout.Session;
    return { db, user, project, invoice, intent, session };
  }

  async function orderFixture(opts: { credits?: boolean; total?: number } = {}) {
    const { db, user } = await newUser();
    const { CREDIT_PACK } = await import('@/lib/assistant-workspace/credits-config');
    const total = opts.credits ? CREDIT_PACK.priceCad : (opts.total ?? 100);
    const intent = pi();
    const order = await db.order.create({
      data: {
        userId: user.id,
        subtotal: total,
        total,
        notes: opts.credits ? `Renovation Credits (${CREDIT_PACK.id})` : 'Well-Installed Quote Review (Standard)',
        stripeCheckoutSessionId: `cs_test_${randomUUID()}`,
      },
    });
    const session = {
      id: order.stripeCheckoutSessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      currency: 'cad',
      amount_total: Math.round(total * 100),
      payment_intent: intent,
      metadata: { orderId: order.id, userId: user.id },
    } as unknown as Stripe.Checkout.Session;
    return { db, user, order, intent, session, total, CREDIT_PACK };
  }

  const evt = (type: string, object: unknown, id = `evt_${tag}_${randomUUID()}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;
  const chargeRefunded = (intent: string, amountCents: number, refundedCents: number, id?: string) =>
    evt('charge.refunded', { id: `ch_${intent}`, object: 'charge', payment_intent: intent, amount: amountCents, amount_refunded: refundedCents, currency: 'cad' }, id);

  // ───────────────────────── Task 1: stale session vs VOID invoice ─────────────────────────

  it('a valid late payment on a VOID invoice never reopens it: recorded as a Payment and flagged, replays are idempotent', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, intent, session, user } = await invoiceFixture('VOID');
    const ev = session();
    for (let i = 0; i < 3; i++) {
      expect(await fulfilCheckoutSession(ev)).toEqual({ status: 'flagged', reason: 'late_payment_void_invoice', caseOpened: i === 0 });
    }
    const row = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.status).toBe('VOID');
    expect(row.paidAt).toBeNull();
    const payments = await db.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'COMPLETED', method: 'STRIPE', stripeCharged: true, stripePaymentIntentId: intent, userId: user.id });
    expect(Number(payments[0]!.amount)).toBe(500);
    const cases = await db.paymentCase.findMany({ where: { invoiceId: invoice.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'LATE_PAYMENT_VOID_INVOICE', status: 'OPEN', stripePaymentIntentId: intent, idempotencyKey: `late-void:${intent}`, paymentId: payments[0]!.id });
    expect(Number(cases[0]!.amount)).toBe(500);
  });

  it('concurrent deliveries of a late VOID-invoice payment record exactly one Payment and one case', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('VOID');
    const ev = session();
    const settled = await Promise.allSettled(Array.from({ length: 10 }, () => fulfilCheckoutSession(ev)));
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(await db.paymentCase.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('VOID');
  });

  it('a normal SENT invoice is still paid exactly once (regression)', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('SENT');
    const ev = session();
    await Promise.all(Array.from({ length: 6 }, () => fulfilCheckoutSession(ev)));
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('PAID');
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(await db.paymentCase.count({ where: { invoiceId: invoice.id } })).toBe(0);
  });

  it('a failure mid-transaction rolls everything back (VOID path and normal path), then a redelivery succeeds', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    for (const status of ['VOID', 'SENT'] as const) {
      const { db, invoice, session } = await invoiceFixture(status);
      // A non-UUID userId makes the Payment insert fail AFTER the invoice update and claim ran.
      const bad = session({ metadata: { invoiceId: invoice.id, userId: 'not-a-uuid' } as never });
      await expect(fulfilCheckoutSession(bad)).rejects.toThrow();
      expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe(status);
      expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(0);
      expect(await db.paymentCase.count({ where: { invoiceId: invoice.id } })).toBe(0);
      expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).stripePaymentIntentId).toBeNull();
      await fulfilCheckoutSession(session());
      expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    }
  });

  // ───────────────────────── Task 3: refunds ─────────────────────────

  it('a full refund of a plain paid order marks it REFUNDED once; replays and concurrent copies are no-ops', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, intent, session } = await orderFixture({ total: 100 });
    await fulfilCheckoutSession(session);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    const ev = chargeRefunded(intent, 10000, 10000);
    const results = await Promise.all(Array.from({ length: 6 }, () => handleChargeRefunded(ev)));
    expect(results.filter((r) => r === 'recorded')).toHaveLength(1);
    expect(results.filter((r) => r === 'duplicate')).toHaveLength(5);
    expect(await handleChargeRefunded(ev)).toBe('duplicate');
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('REFUNDED');
    expect(Number(row.refundedAmount)).toBe(100);
    expect(await db.stripeWebhookEvent.count({ where: { stripeEventId: ev.id } })).toBe(1);
    expect(await db.paymentCase.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('a partial refund only records the cumulative amount and never lowers it on an out-of-order older event', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, intent, session } = await orderFixture({ total: 100 });
    await fulfilCheckoutSession(session);
    await handleChargeRefunded(chargeRefunded(intent, 10000, 4000));
    await handleChargeRefunded(chargeRefunded(intent, 10000, 2500)); // older, smaller, arrives late
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PAID');
    expect(Number(row.refundedAmount)).toBe(40);
  });

  it('a refund event that fails mid-way leaves no event row, no state change; redelivery then applies it', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, intent, session } = await orderFixture({ total: 100 });
    await fulfilCheckoutSession(session);
    // Order total is 100 CAD; a nonsense refund beyond NUMERIC(12,2) fails inside the transaction.
    const real = chargeRefunded(intent, 10000, 10000, `evt_${tag}_ok`);
    const poisoned = { ...real, id: `evt_${tag}_poison`, data: { object: { ...(real.data.object as object), amount_refunded: 1e15 } } } as unknown as Stripe.Event;
    await expect(handleChargeRefunded(poisoned)).rejects.toThrow();
    expect(await db.stripeWebhookEvent.count({ where: { stripeEventId: poisoned.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    expect(await handleChargeRefunded(real)).toBe('recorded');
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('REFUNDED');
  });

  it('credit pack refund WITH SPENT credits opens REFUND_NEEDS_REVIEW and changes no balance or ledger row', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { chargeForAnalysis } = await import('@/lib/credit-ledger');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, user, order, intent, session, total, CREDIT_PACK } = await orderFixture({ credits: true });
    await fulfilCheckoutSession(session);
    const spend = await chargeForAnalysis({ userId: user.id, credits: 5, requestIdempotencyKey: randomUUID(), contextSnapshot: {}, compute: () => ({ ok: true }) });
    expect(spend.ok).toBe(true);
    const before = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    const ledgerBefore = await db.creditTransaction.count({ where: { userId: user.id } });

    const cents = Math.round(total * 100);
    const ev = chargeRefunded(intent, cents, cents);
    expect(await handleChargeRefunded(ev)).toBe('recorded');
    expect(await handleChargeRefunded(ev)).toBe('duplicate');

    const cases = await db.paymentCase.findMany({ where: { orderId: order.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'REFUND_NEEDS_REVIEW', status: 'OPEN', userId: user.id });
    const after = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.balance).toBe(before.balance);
    expect(after.balance).toBe(CREDIT_PACK.credits - 5);
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(ledgerBefore);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
  });

  it('credit pack fully refunded with provably unspent credits recommends a reversal but still changes nothing', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, user, order, intent, session, total, CREDIT_PACK } = await orderFixture({ credits: true });
    await fulfilCheckoutSession(session);
    const cents = Math.round(total * 100);
    await handleChargeRefunded(chargeRefunded(intent, cents, cents));
    const cases = await db.paymentCase.findMany({ where: { orderId: order.id } });
    expect(cases.map((c) => c.kind)).toEqual(['CREDIT_REVERSAL_RECOMMENDED']);
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(1);
  });

  it('a PARTIAL refund of an unspent credit pack is still REFUND_NEEDS_REVIEW', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, order, intent, session, total } = await orderFixture({ credits: true });
    await fulfilCheckoutSession(session);
    await handleChargeRefunded(chargeRefunded(intent, Math.round(total * 100), 100));
    expect((await db.paymentCase.findMany({ where: { orderId: order.id } })).map((c) => c.kind)).toEqual(['REFUND_NEEDS_REVIEW']);
  });

  it('credits are not granted for a refunded pack whose grant never happened (the reconcile sweep respects the open case)', async () => {
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, user, order, intent, total } = await orderFixture({ credits: true });
    await db.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(Date.now() - 3_600_000), stripePaymentIntentId: intent } });
    const cents = Math.round(total * 100);
    await handleChargeRefunded(chargeRefunded(intent, cents, cents));
    await reconcilePendingFulfillments({ olderThanMs: 60_000 });
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('an invoice payment refunded in full marks the Payment REFUNDED and opens a review case; the invoice is untouched', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db, invoice, intent, session } = await invoiceFixture('SENT');
    await fulfilCheckoutSession(session());
    const ev = chargeRefunded(intent, 50000, 50000);
    await handleChargeRefunded(ev);
    await handleChargeRefunded(ev);
    expect((await db.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } })).status).toBe('REFUNDED');
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('PAID');
    expect((await db.paymentCase.findMany({ where: { invoiceId: invoice.id } })).map((c) => c.kind)).toEqual(['REFUND_NEEDS_REVIEW']);
  });

  it('a refund for an unknown payment intent opens a review case instead of being dropped', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { db } = await import('@/lib/db');
    const intent = pi();
    await handleChargeRefunded(chargeRefunded(intent, 5000, 5000));
    const cases = await db.paymentCase.findMany({ where: { stripePaymentIntentId: intent } });
    expect(cases).toHaveLength(1);
    expect(cases[0]!.kind).toBe('REFUND_NEEDS_REVIEW');
  });

  it('a dispute opens one DISPUTE_OPENED case, changes no state, and is idempotent', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { handleDisputeCreated } = await import('@/lib/payment-reconciliation');
    const { db, order, intent, session } = await orderFixture({ total: 100 });
    await fulfilCheckoutSession(session);
    const dispute = { id: `dp_${randomUUID()}`, object: 'dispute', charge: `ch_${intent}`, payment_intent: intent, amount: 10000, currency: 'cad', reason: 'fraudulent', status: 'needs_response' };
    const results = await Promise.all([handleDisputeCreated(evt('charge.dispute.created', dispute)), handleDisputeCreated(evt('charge.dispute.created', dispute))]);
    expect(results).toContain('recorded');
    // A different event id for the same dispute is absorbed by the case's natural key.
    await handleDisputeCreated(evt('charge.dispute.created', dispute));
    const cases = await db.paymentCase.findMany({ where: { orderId: order.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'DISPUTE_OPENED', idempotencyKey: `dispute:${dispute.id}` });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('refund.updated: a failed refund opens a case; a succeeded one is recorded and ignored', async () => {
    const { handleRefundUpdated } = await import('@/lib/payment-reconciliation');
    const { db } = await import('@/lib/db');
    const intent = pi();
    const refund = { id: `re_${randomUUID()}`, object: 'refund', charge: `ch_${intent}`, payment_intent: intent, amount: 1000, currency: 'cad', status: 'failed' };
    expect(await handleRefundUpdated(evt('refund.updated', refund))).toBe('recorded');
    expect(await handleRefundUpdated(evt('refund.updated', { ...refund, id: `re_${randomUUID()}`, status: 'succeeded' }))).toBe('ignored');
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: intent } })).toBe(1);
  });

  it('the webhook route answers 200 for an unknown event type and logs it; refund events route to the handlers', async () => {
    const Stripe = (await import('stripe')).default;
    vi.doMock('@/lib/stripe', () => ({ stripe: { webhooks: Stripe.webhooks, checkout: { sessions: { list: () => (async function* () {})() } } } }));
    vi.doMock('next/headers', () => ({ headers: async () => ({ get: () => sig.value }) }));
    vi.resetModules();
    const sig = { value: '' };
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_reconciliation';
    const post = async (event: unknown) => {
      const body = JSON.stringify(event);
      sig.value = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_test_reconciliation' });
      const { POST } = await import('@/app/api/webhooks/stripe/route');
      return POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body }));
    };
    const warn = vi.mocked(console.warn);
    expect((await post({ id: `evt_${tag}_unknown`, object: 'event', type: 'customer.created', data: { object: {} } })).status).toBe(200);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('stripe_webhook.unhandled_event'));
    const intent = pi();
    const refundEvent = { id: `evt_${tag}_route`, object: 'event', type: 'charge.refunded', data: { object: { id: `ch_${intent}`, object: 'charge', payment_intent: intent, amount: 100, amount_refunded: 100, currency: 'cad' } } };
    expect((await post(refundEvent)).status).toBe(200);
    expect((await post(refundEvent)).status).toBe(200);
    const { db } = await import('@/lib/db');
    expect(await db.paymentCase.count({ where: { stripePaymentIntentId: intent } })).toBe(1);
    vi.doUnmock('@/lib/stripe');
    vi.doUnmock('next/headers');
  });

  // ───────────────────────── Task 2: resolution workflow ─────────────────────────

  async function openCase() {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const f = await invoiceFixture('VOID');
    await fulfilCheckoutSession(f.session());
    const c = await f.db.paymentCase.findFirstOrThrow({ where: { invoiceId: f.invoice.id } });
    return { ...f, caseId: c.id };
  }

  it('resolving a case is admin-only, records who/what/why, and moves no money or invoice state', async () => {
    const { resolvePaymentCase } = await import('@/lib/actions/payment-cases');
    const { db, caseId, invoice, user } = await openCase();
    state.userId = user.id;

    state.role = 'USER';
    await expect(resolvePaymentCase(caseId, 'REFUNDED_MANUALLY', 'Refunded in Stripe re_123')).rejects.toThrow('Unauthorized');
    expect((await db.paymentCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe('OPEN');

    state.role = 'ADMIN';
    state.userId = (await newUser()).user.id;
    expect(await resolvePaymentCase(caseId, 'REFUNDED_MANUALLY', 'Refunded in Stripe re_123')).toEqual({ success: true, alreadyResolved: false });
    const row = await db.paymentCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(row).toMatchObject({ status: 'RESOLVED', resolution: 'REFUNDED_MANUALLY', resolutionNote: 'Refunded in Stripe re_123', resolvedById: state.userId });
    expect(row.resolvedAt).not.toBeNull();
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('VOID');
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it('resolving is idempotent: the same decision repeats harmlessly, concurrent resolves record once, a different decision is refused', async () => {
    const { resolvePaymentCase } = await import('@/lib/actions/payment-cases');
    const { db, caseId } = await openCase();
    state.userId = (await newUser()).user.id;
    const results = await Promise.all(Array.from({ length: 5 }, () => resolvePaymentCase(caseId, 'INVOICE_REISSUED', 'Re-issued as INV-9')));
    expect(results.filter((r) => !r.alreadyResolved)).toHaveLength(1);
    const first = await db.paymentCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(await resolvePaymentCase(caseId, 'INVOICE_REISSUED', 'Re-issued as INV-9')).toEqual({ success: true, alreadyResolved: true });
    await expect(resolvePaymentCase(caseId, 'NO_ACTION_REQUIRED', 'Changed my mind')).rejects.toThrow('different decision');
    const after = await db.paymentCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(after.resolution).toBe('INVOICE_REISSUED');
    expect(after.resolvedAt?.getTime()).toBe(first.resolvedAt?.getTime());
    await expect(resolvePaymentCase(caseId, 'OTHER', '')).rejects.toThrow('note');
    await expect(resolvePaymentCase(randomUUID(), 'OTHER', 'does not exist')).rejects.toThrow('not found');
  });
});
