/**
 * Independent audit probes for the payment reconciliation / confirmation
 * outbox work (#218, #220), against REAL PostgreSQL. Stripe and the mailer are
 * faked. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const mail = vi.hoisted(() => ({ sent: [] as Array<{ to: string; idempotencyKey?: string; html: string }> }));

vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; idempotencyKey?: string; html: string }) => {
    mail.sent.push(m);
  },
}));
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { list: () => ({ async *[Symbol.asyncIterator]() {} }) } } },
}));

describe.skipIf(!enabled)('payment audit probes (real PostgreSQL)', () => {
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const intents: string[] = [];

  beforeEach(() => {
    mail.sent.length = 0;
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
      await db.creditTransaction.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.creditWallet.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.order.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  const pi = () => {
    const id = `pi_${randomUUID()}`;
    intents.push(id);
    return id;
  };
  const evt = (type: string, object: unknown) => ({ id: `evt_${tag}_${randomUUID()}`, type, data: { object } }) as unknown as Stripe.Event;
  const chargeRefunded = (intent: string, amountCents: number, refundedCents: number) =>
    evt('charge.refunded', { id: `ch_${intent}`, object: 'charge', payment_intent: intent, amount: amountCents, amount_refunded: refundedCents, currency: 'cad' });

  async function creditsOrder() {
    const { db } = await import('@/lib/db');
    const { CREDIT_PACK } = await import('@/lib/assistant-workspace/credits-config');
    const user = await db.user.create({ data: { email: `audit-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    const order = await db.order.create({
      data: { userId: user.id, subtotal: CREDIT_PACK.priceCad, total: CREDIT_PACK.priceCad, notes: `Renovation Credits (${CREDIT_PACK.id})`, stripeCheckoutSessionId: `cs_test_${randomUUID()}` },
    });
    const intent = pi();
    const session = {
      id: order.stripeCheckoutSessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      currency: 'cad',
      amount_total: Math.round(CREDIT_PACK.priceCad * 100),
      payment_intent: intent,
      metadata: { orderId: order.id, userId: user.id },
    } as unknown as Stripe.Checkout.Session;
    return { db, user, order, intent, session, CREDIT_PACK };
  }

  it('AUDIT-1: a credit-pack refund delivered BEFORE its checkout.session.completed must still block the credit grant', async () => {
    const { handleChargeRefunded } = await import('@/lib/payment-reconciliation');
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, order, intent, session, user, CREDIT_PACK } = await creditsOrder();
    // Stripe does not guarantee ordering: the refund arrives first and matches no order yet.
    await handleChargeRefunded(chargeRefunded(intent, Math.round(CREDIT_PACK.priceCad * 100), Math.round(CREDIT_PACK.priceCad * 100)));
    const outcome = await fulfilCheckoutSession(session);
    expect(outcome.status).toBe('rejected');
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('AUDIT-2: partial then full then a late older partial never lowers or exceeds the charge on a duplicate case', async () => {
    const { handleChargeRefunded, openPaymentCase } = await import('@/lib/payment-reconciliation');
    const { db } = await import('@/lib/db');
    const intent = pi();
    await db.$transaction((tx) =>
      openPaymentCase(tx, { kind: 'DUPLICATE_PAYMENT', idempotencyKey: `duplicate-payment:${intent}`, amountCents: 10000, currency: 'cad', summary: 's', stripePaymentIntentId: intent }),
    );
    await handleChargeRefunded(chargeRefunded(intent, 10000, 3000));
    await handleChargeRefunded(chargeRefunded(intent, 10000, 10000));
    await handleChargeRefunded(chargeRefunded(intent, 10000, 3000));
    const row = await db.paymentCase.findUniqueOrThrow({ where: { idempotencyKey: `duplicate-payment:${intent}` } });
    expect(Number(row.refundedAmount)).toBe(100);
  });

  it('AUDIT-3: a dispute and a refund that arrive before the duplicate case are folded into it', async () => {
    const { handleChargeRefunded, handleDisputeCreated, openPaymentCase } = await import('@/lib/payment-reconciliation');
    const { db } = await import('@/lib/db');
    const intent = pi();
    await handleDisputeCreated(evt('charge.dispute.created', { id: `dp_${randomUUID()}`, object: 'dispute', payment_intent: intent, charge: `ch_${intent}`, amount: 5000, currency: 'cad', reason: 'fraudulent', status: 'needs_response' }));
    await handleChargeRefunded(chargeRefunded(intent, 5000, 2000));
    await db.$transaction((tx) =>
      openPaymentCase(tx, { kind: 'DUPLICATE_PAYMENT', idempotencyKey: `duplicate-payment:${intent}`, amountCents: 5000, currency: 'cad', summary: 's', stripePaymentIntentId: intent }),
    );
    const row = await db.paymentCase.findUniqueOrThrow({ where: { idempotencyKey: `duplicate-payment:${intent}` } });
    expect(Number(row.refundedAmount)).toBe(20);
    expect(row.disputeId).toMatch(/^dp_/);
  });

  async function paidPlainOrder(notes: string | null, name: string | null = 'Pat') {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `audit-${randomUUID()}@example.test`, name } });
    userIds.push(user.id);
    const order = await db.order.create({ data: { userId: user.id, subtotal: 100, total: 100, notes, status: 'PAID', paidAt: new Date() } });
    return { db, user, order };
  }

  it('AUDIT-4: two workers racing on an expired lease send exactly once; NULL-notes orders are eligible', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { db, order } = await paidPlainOrder(null);
    await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailLeaseUntil" = now() - interval '1 second', "confirmationEmailAttempts" = 1 WHERE id = ${order.id}::uuid`;
    const results = await Promise.all([1, 2, 3, 4].map(() => sendOrderConfirmationOnce(order.id)));
    expect(results.filter((r) => r === 'sent')).toHaveLength(1);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.idempotencyKey).toBe(`order-confirmation/${order.id}/v1`);
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.confirmationEmailSentAt).not.toBeNull();
    expect(row.confirmationEmailAttempts).toBe(2);
  });

  it('AUDIT-5: customer name is HTML-escaped in the confirmation email', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { order } = await paidPlainOrder(null, '<img src=x onerror=alert(1)>');
    expect(await sendOrderConfirmationOnce(order.id)).toBe('sent');
    expect(mail.sent[0]!.html).not.toContain('<img');
    expect(mail.sent[0]!.html).toContain('&lt;img');
  });
});
