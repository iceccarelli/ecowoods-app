/**
 * Payment follow-ups against REAL PostgreSQL: a customer who pays twice, a paid
 * session that cannot be applied, and the once-only payment confirmation email.
 * Stripe and the mailer are faked (no network, no charges, no refunds, no
 * email); the database is real. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const mail = vi.hoisted(() => ({ sent: [] as Array<Record<string, unknown>>, failNext: 0 }));

vi.mock('@/lib/email', () => ({
  sendEmail: async (m: Record<string, unknown>) => {
    if (mail.failNext > 0) {
      mail.failNext -= 1;
      throw new Error('smtp down');
    }
    mail.sent.push(m);
  },
}));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { list: () => ({ async *[Symbol.asyncIterator]() {} }) } } },
}));

describe.skipIf(!enabled)('payment follow-ups against real PostgreSQL', () => {
  const userIds: string[] = [];
  const intents: string[] = [];

  beforeEach(() => {
    mail.sent.length = 0;
    mail.failNext = 0;
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.paymentCase.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { stripePaymentIntentId: { in: intents } }] } }).catch(() => undefined);
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

  async function invoiceFixture(status: 'SENT' | 'PAID' = 'SENT', total = 500) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `fu-${randomUUID()}@example.test`, name: 'Pat <b>Smith</b>' } });
    userIds.push(user.id);
    const project = await db.project.create({ data: { userId: user.id, title: 'P' } });
    const invoice = await db.invoice.create({
      data: { projectId: project.id, stage: 'DEPOSIT', status, subtotal: total, total, number: `T-${randomUUID().slice(0, 12)}` },
    });
    const session = (patch: Partial<Stripe.Checkout.Session> = {}) =>
      ({
        id: `cs_test_${randomUUID()}`,
        object: 'checkout.session',
        payment_status: 'paid',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: pi(),
        metadata: { invoiceId: invoice.id, projectId: project.id, userId: user.id },
        ...patch,
      }) as unknown as Stripe.Checkout.Session;
    return { db, user, project, invoice, session };
  }

  async function orderFixture(opts: { notes?: string | null; total?: number; recordSession?: boolean; items?: boolean } = {}) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `fu-${randomUUID()}@example.test`, name: 'Pat <b>Smith</b>' } });
    userIds.push(user.id);
    const total = opts.total ?? 113;
    const sessionId = `cs_test_${randomUUID()}`;
    const order = await db.order.create({
      data: {
        userId: user.id,
        subtotal: total,
        total,
        notes: opts.notes === undefined ? 'Well-Installed Quote Review (Standard)' : opts.notes,
        stripeCheckoutSessionId: opts.recordSession === false ? null : sessionId,
        ...(opts.items === false
          ? {}
          : { items: { create: [{ productName: 'Well-Installed Quote Review <Standard>', unit: 'EACH', quantity: 1, unitPrice: 100, lineTotal: 100 }] } }),
      },
    });
    const session = (patch: Partial<Stripe.Checkout.Session> = {}) =>
      ({
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: pi(),
        metadata: { orderId: order.id, userId: user.id },
        ...patch,
      }) as unknown as Stripe.Checkout.Session;
    return { db, user, order, session, sessionId };
  }

  // ───────────── Task 1: paid twice ─────────────

  it('a second payment intent on a PAID invoice is recorded and flagged once; the invoice is never altered; replays and concurrency record once', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('SENT');
    const first = session();
    await fulfilCheckoutSession(first);
    const paid = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe('PAID');

    const second = session({ payment_intent: pi() });
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => fulfilCheckoutSession(second)));
    await fulfilCheckoutSession(second);
    await fulfilCheckoutSession(first); // the original's own replay is a plain no-op

    expect(outcomes.filter((o) => o.status === 'flagged' && o.caseOpened)).toHaveLength(1);
    expect(await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toEqual(paid); // status, paidAt, stripePaymentIntentId, updatedAt all identical
    const payments = await db.payment.findMany({ where: { invoiceId: invoice.id }, orderBy: { createdAt: 'asc' } });
    expect(payments).toHaveLength(2);
    expect(payments.map((p) => p.stripePaymentIntentId)).toEqual([first.payment_intent, second.payment_intent]);
    expect(payments.every((p) => p.status === 'COMPLETED' && Number(p.amount) === 500)).toBe(true);
    const cases = await db.paymentCase.findMany({ where: { invoiceId: invoice.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({
      kind: 'DUPLICATE_PAYMENT',
      status: 'OPEN',
      idempotencyKey: `duplicate-payment:${second.payment_intent}`,
      stripePaymentIntentId: second.payment_intent,
      paymentId: payments[1]!.id,
    });
    expect(Number(cases[0]!.amount)).toBe(500);
  });

  it('two different payment intents racing on an unpaid invoice: exactly one pays it, the other becomes the duplicate case', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('SENT');
    const a = session();
    const b = session();
    await Promise.all([fulfilCheckoutSession(a), fulfilCheckoutSession(b), fulfilCheckoutSession(a), fulfilCheckoutSession(b)]);
    const row = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.status).toBe('PAID');
    expect([a.payment_intent, b.payment_intent]).toContain(row.stripePaymentIntentId);
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(2);
    const cases = await db.paymentCase.findMany({ where: { invoiceId: invoice.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]!.kind).toBe('DUPLICATE_PAYMENT');
    expect(cases[0]!.stripePaymentIntentId).not.toBe(row.stripePaymentIntentId);
  });

  it('Stripe paying an invoice an admin already marked PAID (bank transfer) opens a duplicate case', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('PAID');
    await db.payment.create({ data: { invoiceId: invoice.id, amount: 500, method: 'BANK_TRANSFER', status: 'COMPLETED' } });
    const s = session();
    expect(await fulfilCheckoutSession(s)).toMatchObject({ status: 'flagged', reason: 'duplicate_payment_invoice', caseOpened: true });
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(2);
    expect(await db.paymentCase.count({ where: { invoiceId: invoice.id, kind: 'DUPLICATE_PAYMENT' } })).toBe(1);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).stripePaymentIntentId).toBeNull();
  });

  it('regression: an invoice an older version left PAID with no Payment is still repaired without a case', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, invoice, session } = await invoiceFixture('SENT');
    const s = session();
    await db.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: s.payment_intent as string } });
    expect(await fulfilCheckoutSession(s)).toEqual({ status: 'fulfilled', kind: 'invoice' });
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect(await db.paymentCase.count({ where: { invoiceId: invoice.id } })).toBe(0);
  });

  it('an order paid twice (a second session, different payment intent) is flagged; the order is unchanged and replays record once', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, session } = await orderFixture();
    const first = session();
    await fulfilCheckoutSession(first);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe('PAID');

    const second = session({ id: `cs_test_${randomUUID()}`, payment_intent: pi() });
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => fulfilCheckoutSession(second)));
    expect(outcomes.filter((o) => o.status === 'flagged' && o.caseOpened)).toHaveLength(1);
    expect(outcomes.every((o) => o.status === 'flagged' && o.reason === 'duplicate_payment_order')).toBe(true);
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(paid);
    const cases = await db.paymentCase.findMany({ where: { orderId: order.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ kind: 'DUPLICATE_PAYMENT', stripePaymentIntentId: second.payment_intent, idempotencyKey: `duplicate-payment:${second.payment_intent}` });
    expect(Number(cases[0]!.amount)).toBe(113);
    // The original payment's replay is still an ordinary fulfilment.
    expect(await fulfilCheckoutSession(first)).toEqual({ status: 'fulfilled', kind: 'order' });
    expect(await db.paymentCase.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('an order with no recorded session id paid by two intents concurrently: one wins, the other is a duplicate case', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, session } = await orderFixture({ recordSession: false });
    const a = session({ id: 'cs_test_a_' + randomUUID() });
    const b = session({ id: 'cs_test_b_' + randomUUID() });
    await Promise.all([fulfilCheckoutSession(a), fulfilCheckoutSession(b), fulfilCheckoutSession(a), fulfilCheckoutSession(b)]);
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PAID');
    const cases = await db.paymentCase.findMany({ where: { orderId: order.id } });
    expect(cases).toHaveLength(1);
    expect(cases[0]!.kind).toBe('DUPLICATE_PAYMENT');
    expect(cases[0]!.stripePaymentIntentId).not.toBe(row.stripePaymentIntentId);
  });

  // ───────────── Task 3: paid but not applied ─────────────

  it('a paid session that is rejected (amount, currency, session, user, unknown order/invoice) opens an UNAPPLIED_PAYMENT case once instead of only logging', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, session } = await orderFixture();
    const cases: Array<[Partial<Stripe.Checkout.Session>, string]> = [
      [{ amount_total: 100 }, 'amount_mismatch'],
      [{ currency: 'usd' }, 'currency_mismatch'],
      [{ id: 'cs_test_other' }, 'session_mismatch'],
      [{ metadata: { orderId: order.id, userId: randomUUID() } }, 'user_mismatch'],
    ];
    for (const [patch, reason] of cases) {
      const s = session(patch);
      expect(await fulfilCheckoutSession(s)).toEqual({ status: 'rejected', reason });
      await fulfilCheckoutSession(s);
      const rows = await db.paymentCase.findMany({ where: { idempotencyKey: `unapplied:${reason}:${s.payment_intent}` } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'UNAPPLIED_PAYMENT', orderId: order.id, status: 'OPEN' });
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');

    const ghost = session({ metadata: { orderId: randomUUID() } });
    expect(await fulfilCheckoutSession(ghost)).toEqual({ status: 'rejected', reason: 'order_not_found' });
    expect(await db.paymentCase.count({ where: { idempotencyKey: `unapplied:order_not_found:${ghost.payment_intent}` } })).toBe(1);

    const inv = await invoiceFixture('SENT');
    const wrong = inv.session({ amount_total: 1 });
    expect(await fulfilCheckoutSession(wrong)).toEqual({ status: 'rejected', reason: 'amount_mismatch' });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.invoice.id } })).status).toBe('SENT');
    expect(await db.paymentCase.count({ where: { invoiceId: inv.invoice.id, kind: 'UNAPPLIED_PAYMENT' } })).toBe(1);
    const missing = inv.session({ metadata: { invoiceId: randomUUID() } });
    expect(await fulfilCheckoutSession(missing)).toEqual({ status: 'rejected', reason: 'invoice_not_found' });
    expect(await db.paymentCase.count({ where: { idempotencyKey: `unapplied:invoice_not_found:${missing.payment_intent}` } })).toBe(1);
  });

  it('an order the checkout had marked CANCELLED and the customer then paid becomes PAID (already safe: the charge is honoured)', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, session } = await orderFixture();
    await db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    expect(await fulfilCheckoutSession(session())).toEqual({ status: 'fulfilled', kind: 'order' });
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PAID');
    expect(row.paidAt).not.toBeNull();
    expect(await db.paymentCase.count({ where: { orderId: order.id } })).toBe(0);
  });

  // ───────────── Task 2: payment confirmation email ─────────────

  it('a paid plain order sends one factual confirmation; replays and concurrent deliveries send exactly once', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, user, session } = await orderFixture();
    const s = session();
    await Promise.all(Array.from({ length: 8 }, () => fulfilCheckoutSession(s)));
    await fulfilCheckoutSession(s);
    expect(mail.sent).toHaveLength(1);
    const m = mail.sent[0]!;
    expect(m.to).toBe(user.email);
    expect(m.idempotencyKey).toBe(`order-confirmation/${order.id}/v1`);
    const ref = `#${order.id.slice(0, 8).toUpperCase()}`;
    expect(m.subject).toContain(ref);
    expect(String(m.text)).toContain('Well-Installed Quote Review <Standard>');
    expect(String(m.text)).toContain(new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(113));
    expect(String(m.text)).toContain('/mypage/orders');
    expect(String(m.html)).toContain('Well-Installed Quote Review &lt;Standard&gt;');
    expect(String(m.html)).not.toContain('<Standard>');
    expect(String(m.html)).toContain('Thank you, Pat &lt;b&gt;Smith&lt;/b&gt;');
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).confirmationEmailSentAt).not.toBeNull();
  });

  it('a send failure never fails the webhook path or the PAID state; the claim is released and a redelivery sends it once', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, session } = await orderFixture({ notes: null });
    const s = session();
    mail.failNext = 1;
    expect(await fulfilCheckoutSession(s)).toEqual({ status: 'fulfilled', kind: 'order' });
    let row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PAID');
    expect(row.confirmationEmailSentAt).toBeNull();
    expect(mail.sent).toHaveLength(0);
    await fulfilCheckoutSession(s);
    await fulfilCheckoutSession(s);
    expect(mail.sent).toHaveLength(1);
    row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.confirmationEmailSentAt).not.toBeNull();
  });

  it('the reconcile sweep retries an unconfirmed recent paid order (NULL notes included) and skips credit packs, floor plans and old orders', async () => {
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const recent = new Date(Date.now() - 20 * 60_000);
    const mk = async (notes: string | null, paidAt: Date) => {
      const f = await orderFixture({ notes });
      await f.db.order.update({ where: { id: f.order.id }, data: { status: 'PAID', paidAt } });
      return f.order.id;
    };
    const shop = await mk(null, recent);
    const review = await mk('Well-Installed Quote Review (Rush)', recent);
    const credits = await mk('Renovation Credits (starter-40)', recent);
    const plan = await mk('Personal Floor Plan\nFP_DESIGN:abc\nFP_NOTIFIED:1', recent);
    const old = await mk(null, new Date(Date.now() - 3 * 86_400_000));
    await reconcilePendingFulfillments({ batch: 100 });
    const { db } = await import('@/lib/db');
    const sentTo = new Set(mail.sent.map((m) => m.idempotencyKey));
    expect(sentTo.has(`order-confirmation/${shop}/v1`)).toBe(true);
    expect(sentTo.has(`order-confirmation/${review}/v1`)).toBe(true);
    for (const id of [credits, plan, old]) expect(sentTo.has(`order-confirmation/${id}/v1`)).toBe(false);
    expect((await db.order.findUniqueOrThrow({ where: { id: credits } })).confirmationEmailSentAt).toBeNull();
    expect(await sendOrderConfirmationOnce(credits)).toBe('skipped');
    expect(await sendOrderConfirmationOnce(plan)).toBe('skipped');
    const n = mail.sent.length;
    await reconcilePendingFulfillments({ batch: 100 });
    expect(mail.sent.length).toBe(n);
  });
});
