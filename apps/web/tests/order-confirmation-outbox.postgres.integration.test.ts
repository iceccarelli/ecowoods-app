/**
 * Durable, lease-based delivery of the order-confirmation email against REAL
 * PostgreSQL: crash recovery, concurrent webhook + sweep, provider timeout
 * (unknown outcome), bounded retries, and no retroactive / repeat sends. The
 * mailer is faked (no network, no email); the database is real. Runs only with
 * RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const mail = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  /** Calls the provider ACCEPTED (what a customer would receive, after de-duplication by key). */
  delivered: new Set<string>(),
  mode: 'ok' as 'ok' | 'fail' | 'hang' | 'accept-then-hang',
}));

vi.mock('@/lib/email', () => ({
  sendEmail: async (m: Record<string, unknown>) => {
    mail.calls.push(m);
    if (mail.mode === 'fail') throw new Error('smtp down');
    if (mail.mode === 'hang') return new Promise(() => undefined);
    // Resend de-duplicates by Idempotency-Key: a second accepted call with the same key is the same email.
    mail.delivered.add(String(m.idempotencyKey));
    if (mail.mode === 'accept-then-hang') return new Promise(() => undefined);
  },
}));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: { list: () => ({ async *[Symbol.asyncIterator]() {} }) } } },
}));

describe.skipIf(!enabled)('order-confirmation outbox against real PostgreSQL', () => {
  const userIds: string[] = [];

  beforeEach(() => {
    mail.calls.length = 0;
    mail.delivered.clear();
    mail.mode = 'ok';
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    for (const id of userIds) {
      await db.order.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
  });

  async function paidOrder(opts: { paidAgoMs?: number; notes?: string | null } = {}) {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `ob-${randomUUID()}@example.test`, name: 'Pat' } });
    userIds.push(user.id);
    const order = await db.order.create({
      data: {
        userId: user.id,
        subtotal: 113,
        total: 113,
        status: 'PAID',
        paidAt: new Date(Date.now() - (opts.paidAgoMs ?? 20 * 60_000)),
        notes: opts.notes === undefined ? 'Well-Installed Quote Review (Standard)' : opts.notes,
        stripeCheckoutSessionId: `cs_test_${randomUUID()}`,
        stripePaymentIntentId: `pi_${randomUUID()}`,
      },
    });
    const row = () => db.order.findUniqueOrThrow({ where: { id: order.id } });
    return { db, order, user, row, key: `order-confirmation/${order.id}/v1` };
  }

  it('claim-then-crash loses nothing: the lease blocks others while live, then a stale lease is re-claimed and the email goes out once with the stable key', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { db, order, row, key } = await paidOrder();

    // A process claimed the lease and died before calling the provider.
    await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailLeaseUntil" = now() + interval '3 minutes', "confirmationEmailAttempts" = 1 WHERE id = ${order.id}::uuid`;
    expect(await sendOrderConfirmationOnce(order.id)).toBe('busy');
    await reconcilePendingFulfillments({ batch: 100 });
    expect(mail.calls).toHaveLength(0);
    expect((await row()).confirmationEmailSentAt).toBeNull();

    // The lease expires.
    await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailLeaseUntil" = now() - interval '1 second' WHERE id = ${order.id}::uuid`;
    await reconcilePendingFulfillments({ batch: 100 });
    const sentToThisOrder = mail.calls.filter((c) => c.idempotencyKey === key);
    expect(sentToThisOrder).toHaveLength(1);
    const after = await row();
    expect(after.confirmationEmailSentAt).not.toBeNull();
    expect(after.confirmationEmailAttempts).toBe(2);
    expect(after.confirmationEmailLeaseUntil).toBeNull();
    expect(await sendOrderConfirmationOnce(order.id)).toBe('already_sent');
    expect(mail.calls.filter((c) => c.idempotencyKey === key)).toHaveLength(1);
  });

  it('the sent timestamp is recorded only after the provider accepts: while the call is in flight the order is leased but unsent', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { order, row } = await paidOrder();
    mail.mode = 'hang';
    const inFlight = sendOrderConfirmationOnce(order.id, { sendTimeoutMs: 400 });
    await vi.waitFor(() => expect(mail.calls).toHaveLength(1));
    const mid = await row();
    expect(mid.confirmationEmailSentAt).toBeNull();
    expect(mid.confirmationEmailLeaseUntil).not.toBeNull();
    expect(mid.confirmationEmailAttempts).toBe(1);
    expect(await inFlight).toBe('failed');
  });

  it('a provider timeout is an unknown outcome: not marked sent, backed off, retried with the SAME idempotency key, delivered once', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { db, order, row, key } = await paidOrder();
    mail.mode = 'accept-then-hang'; // provider accepted, but the response never came back
    expect(await sendOrderConfirmationOnce(order.id, { sendTimeoutMs: 50 })).toBe('failed');
    let r = await row();
    expect(r.confirmationEmailSentAt).toBeNull();
    expect(r.confirmationEmailLeaseUntil).toBeNull();
    expect(r.confirmationEmailLastError).toContain('provider_timeout');
    expect(r.confirmationEmailNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    // within the backoff nothing is retried
    expect(await sendOrderConfirmationOnce(order.id)).toBe('busy');
    expect(mail.calls).toHaveLength(1);

    await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailNextAttemptAt" = now() - interval '1 second' WHERE id = ${order.id}::uuid`;
    mail.mode = 'ok';
    expect(await sendOrderConfirmationOnce(order.id)).toBe('sent');
    expect(mail.calls).toHaveLength(2);
    expect(new Set(mail.calls.map((c) => c.idempotencyKey))).toEqual(new Set([key]));
    expect(mail.delivered.size).toBe(1); // the provider de-duplicates by key: one email reaches the customer
    r = await row();
    expect(r.confirmationEmailSentAt).not.toBeNull();
    expect(r.confirmationEmailLastError).toBeNull();
    expect(r.confirmationEmailNextAttemptAt).toBeNull();
  });

  it('a failed send is logged and swallowed, backs off, and the sweep retries it once the backoff has passed', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { db, order, row, key } = await paidOrder();
    mail.mode = 'fail';
    expect(await sendOrderConfirmationOnce(order.id)).toBe('failed');
    expect((await row()).confirmationEmailSentAt).toBeNull();
    mail.mode = 'ok';
    await reconcilePendingFulfillments({ batch: 100 }); // still inside the backoff
    expect(mail.calls.filter((c) => c.idempotencyKey === key)).toHaveLength(1);
    await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailNextAttemptAt" = now() - interval '1 second' WHERE id = ${order.id}::uuid`;
    await reconcilePendingFulfillments({ batch: 100 });
    expect(mail.calls.filter((c) => c.idempotencyKey === key)).toHaveLength(2);
    expect((await row()).confirmationEmailSentAt).not.toBeNull();
    expect(mail.delivered.has(key)).toBe(true);
  });

  it('retries are bounded: after the maximum attempts the order is left alone', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { CONFIRMATION_MAX_ATTEMPTS } = await import('@/lib/email/order-confirmation-policy');
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { db, order, row } = await paidOrder();
    mail.mode = 'fail';
    for (let i = 0; i < CONFIRMATION_MAX_ATTEMPTS; i++) {
      expect(await sendOrderConfirmationOnce(order.id)).toBe('failed');
      await db.$executeRaw`UPDATE "ecowoods"."Order" SET "confirmationEmailNextAttemptAt" = now() - interval '1 second' WHERE id = ${order.id}::uuid`;
    }
    expect((await row()).confirmationEmailAttempts).toBe(CONFIRMATION_MAX_ATTEMPTS);
    expect(await sendOrderConfirmationOnce(order.id)).toBe('skipped');
    await reconcilePendingFulfillments({ batch: 100 });
    expect(mail.calls).toHaveLength(CONFIRMATION_MAX_ATTEMPTS);
    expect((await row()).confirmationEmailSentAt).toBeNull();
  });

  it('concurrent webhook deliveries and reconcile sweeps send exactly one email', async () => {
    const { fulfilCheckoutSession, reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { db, order, user, row, key } = await paidOrder();
    await db.order.update({ where: { id: order.id }, data: { status: 'PENDING', paidAt: null, stripePaymentIntentId: null } });
    const session = {
      id: order.stripeCheckoutSessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      currency: 'cad',
      amount_total: 11300,
      payment_intent: `pi_${randomUUID()}`,
      metadata: { orderId: order.id, userId: user.id },
    } as unknown as Stripe.Checkout.Session;
    // The sweep only looks at orders paid more than 5 minutes ago; make the webhook's paidAt old enough by
    // running the sweep with a zero grace period.
    const results = await Promise.allSettled([
      ...Array.from({ length: 6 }, () => fulfilCheckoutSession(session)),
      ...Array.from({ length: 3 }, () => reconcilePendingFulfillments({ olderThanMs: 0, batch: 100 })),
      ...Array.from({ length: 3 }, () => sendOrderConfirmationOnce(order.id)),
    ]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);
    expect(mail.calls.filter((c) => c.idempotencyKey === key)).toHaveLength(1);
    expect((await row()).confirmationEmailSentAt).not.toBeNull();
    expect((await row()).status).toBe('PAID');
  });

  it('never re-sends rows already marked sent (including those written by the earlier claim-first code) and never emails old orders', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const legacy = await paidOrder();
    await legacy.db.order.update({ where: { id: legacy.order.id }, data: { confirmationEmailSentAt: new Date(Date.now() - 60_000) } });
    const old = await paidOrder({ paidAgoMs: 3 * 86_400_000 });
    const justOver = await paidOrder({ paidAgoMs: 25 * 3600_000 });
    await reconcilePendingFulfillments({ batch: 100 });
    for (const f of [legacy, old, justOver]) {
      expect(await sendOrderConfirmationOnce(f.order.id)).not.toBe('sent');
      expect(mail.calls.filter((c) => c.idempotencyKey === f.key)).toHaveLength(0);
      expect((await f.row()).confirmationEmailAttempts).toBeNull();
    }
    expect(await sendOrderConfirmationOnce(legacy.order.id)).toBe('already_sent');
  });

  it('floor-plan and credit-pack orders still get no confirmation and no delivery state', async () => {
    const { sendOrderConfirmationOnce } = await import('@/lib/email/order-confirmation');
    const plan = await paidOrder({ notes: 'Personal Floor Plan\nFP_DESIGN:abc' });
    const credits = await paidOrder({ notes: 'Renovation Credits (starter-40)' });
    expect(await sendOrderConfirmationOnce(plan.order.id)).toBe('skipped');
    expect(await sendOrderConfirmationOnce(credits.order.id)).toBe('skipped');
    expect(mail.calls).toHaveLength(0);
    expect((await plan.row()).confirmationEmailAttempts).toBeNull();
    expect((await credits.row()).confirmationEmailAttempts).toBeNull();
  });
});
