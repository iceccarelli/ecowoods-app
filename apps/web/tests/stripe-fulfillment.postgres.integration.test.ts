/**
 * Real PostgreSQL checks for Stripe fulfilment idempotency
 * (lib/stripe-fulfillment.ts): a replayed or concurrently delivered
 * checkout.session.completed for a Renovation Credits order grants exactly
 * once, the order ends FULFILLED, and mismatched sessions grant nothing.
 * Stripe's network edge is faked; the database is real. Runs only with
 * RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            /* no lost-webhook candidates from Stripe in this test */
          },
        }),
      },
    },
  },
}));

describe.skipIf(!enabled)('Stripe fulfilment against real PostgreSQL', () => {
  const userIds: string[] = [];

  beforeEach(() => {
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

  async function setup(overrides: { notes?: string; total?: number } = {}) {
    const { db } = await import('@/lib/db');
    const { CREDIT_PACK } = await import('@/lib/assistant-workspace/credits-config');
    const user = await db.user.create({ data: { email: `stripe-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    const total = overrides.total ?? CREDIT_PACK.priceCad;
    const sessionId = `cs_test_${randomUUID()}`;
    const order = await db.order.create({
      data: {
        userId: user.id,
        subtotal: total,
        total,
        notes: overrides.notes ?? `Renovation Credits (${CREDIT_PACK.id})`,
        stripeCheckoutSessionId: sessionId,
      },
    });
    const session = (patch: Partial<Stripe.Checkout.Session> = {}) =>
      ({
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        currency: 'cad',
        amount_total: Math.round(total * 100),
        payment_intent: `pi_${randomUUID()}`,
        metadata: { orderId: order.id, userId: user.id },
        ...patch,
      }) as unknown as Stripe.Checkout.Session;
    return { db, user, order, session, CREDIT_PACK };
  }

  it('a replayed checkout.session.completed grants credits once and the order ends FULFILLED', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, user, order, session, CREDIT_PACK } = await setup();
    const ev = session();
    expect(await fulfilCheckoutSession(ev)).toEqual({ status: 'fulfilled', kind: 'renovation-credits' });
    expect(await fulfilCheckoutSession(ev)).toEqual({ status: 'fulfilled', kind: 'renovation-credits' });
    expect(await fulfilCheckoutSession(ev)).toEqual({ status: 'fulfilled', kind: 'renovation-credits' });

    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: 'GRANT' } })).toBe(1);
    const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('FULFILLED');
    expect(row.paidAt).not.toBeNull();
  });

  it('concurrent deliveries of the same event grant once and never throw', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, user, order, session, CREDIT_PACK } = await setup();
    const ev = session();
    const settled = await Promise.allSettled(Array.from({ length: 8 }, () => fulfilCheckoutSession(ev)));
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(0);
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
    expect(await db.creditTransaction.count({ where: { idempotencyKey: `order-grant:${order.id}` } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
  });

  it('rejects amount, currency, session and user mismatches without marking paid or granting', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, user, order, session } = await setup();
    for (const [patch, reason] of [
      [{ amount_total: 100 }, 'amount_mismatch'],
      [{ currency: 'usd' }, 'currency_mismatch'],
      [{ id: 'cs_test_other' }, 'session_mismatch'],
      [{ metadata: { orderId: order.id, userId: randomUUID() } }, 'user_mismatch'],
    ] as const) {
      expect(await fulfilCheckoutSession(session(patch as Partial<Stripe.Checkout.Session>))).toEqual({ status: 'rejected', reason });
    }
    expect(await fulfilCheckoutSession(session({ payment_status: 'unpaid' }))).toEqual({ status: 'ignored', reason: 'not_paid' });
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
  });

  it('an unknown credit pack on the order is rejected: PAID but never granted', async () => {
    const { fulfilCheckoutSession } = await import('@/lib/stripe-fulfillment');
    const { db, user, session } = await setup({ notes: 'Renovation Credits (not-a-pack)' });
    expect(await fulfilCheckoutSession(session())).toEqual({ status: 'rejected', reason: 'unknown_credit_pack' });
    expect(await db.creditTransaction.count({ where: { userId: user.id } })).toBe(0);
  });

  it('reconcilePendingFulfillments finishes a PAID credits order whose grant never happened, once', async () => {
    const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');
    const { db, user, order, CREDIT_PACK } = await setup();
    await db.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(Date.now() - 3_600_000) } });
    const first = await reconcilePendingFulfillments({ olderThanMs: 60_000 });
    expect(first.fulfilled).toBeGreaterThanOrEqual(1);
    await reconcilePendingFulfillments({ olderThanMs: 60_000 }); // a second sweep must not grant again
    expect((await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } })).balance).toBe(CREDIT_PACK.credits);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FULFILLED');
    expect(await db.creditTransaction.count({ where: { idempotencyKey: `order-grant:${order.id}` } })).toBe(1);
  });
});
