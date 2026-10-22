/**
 * A webhook that never arrives (bad endpoint, secret mismatch, outage past
 * Stripe's retry window) must not leave a paid customer unfulfilled. The
 * reconcile sweep asks Stripe (read-only) for recent paid sessions and runs
 * the still-unpaid ones through the real fulfilment. Prisma and the Stripe
 * list call are faked; fulfilment code is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

type Order = { id: string; userId: string; status: string; total: number; notes: string | null; stripeCheckoutSessionId: string | null };
const s = vi.hoisted(() => ({
  orders: new Map<string, Order>(),
  invoices: new Map<string, { id: string; status: string; total: number; projectId: string | null; stage: string }>(),
  sessions: [] as unknown[],
  listFails: false,
  listCalls: 0,
}));

vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: () => undefined }));
vi.mock('@/lib/credit-ledger', () => ({ grantCreditsForOrder: async () => ({ reason: 'x' }) }));
vi.mock('@/lib/email/order-confirmation', () => ({ sendOrderConfirmationOnce: async () => 'sent' }));
vi.mock('@/lib/floor-plan/deliver', () => ({ deliverFloorPlanOrder: async () => ({ status: 'delivered' }) }));
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        list: () => {
          s.listCalls += 1;
          if (s.listFails) throw new Error('stripe down');
          return (async function* () { for (const x of s.sessions) yield x; })();
        },
      },
    },
  },
}));
vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: async ({ where }: { where: { id?: { in: string[] }; status?: { in: string[] } | string; notes?: unknown } }) =>
        where.id ? [...s.orders.values()].filter((o) => where.id!.in.includes(o.id)).map((o) => ({ ...o, stripePaymentIntentId: null })) : [],
      findUnique: async ({ where }: { where: { id: string } }) => (s.orders.get(where.id) ? { ...s.orders.get(where.id)! } : null),
      updateMany: async ({ where, data }: { where: { id: string; status: { in: string[] } | string }; data: Partial<Order> }) => {
        const o = s.orders.get(where.id);
        const allowed = typeof where.status === 'string' ? [where.status] : where.status.in;
        if (!o || !allowed.includes(o.status)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
    invoice: { findMany: async () => [] },
    paymentCase: { createMany: async ({ data }: { data: unknown[] }) => ({ count: data.length }) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ paymentCase: { createMany: async ({ data }: { data: unknown[] }) => ({ count: data.length }) } }),
  },
}));

const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');

const NOW = Date.now();
const sess = (over: Record<string, unknown> = {}) => ({
  id: 'cs_1', payment_status: 'paid', currency: 'cad', amount_total: 11187, payment_intent: 'pi_1', created: Math.floor((NOW - 30 * 60_000) / 1000),
  metadata: { orderId: 'o1', userId: 'u1' }, ...over,
}) as unknown as Stripe.Checkout.Session;
const order = (over: Partial<Order> = {}) => s.orders.set('o1', { id: 'o1', userId: 'u1', status: 'PENDING', total: 111.87, notes: 'Well-Installed Quote Review (Standard)', stripeCheckoutSessionId: 'cs_1', ...over });

beforeEach(() => {
  s.orders.clear(); s.sessions = []; s.listFails = false; s.listCalls = 0;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('reconcile: lost Stripe webhooks', () => {
  it('marks a paid-in-Stripe but PENDING order PAID, once, even across repeated sweeps', async () => {
    order(); s.sessions = [sess()];
    expect(await reconcilePendingFulfillments()).toMatchObject({ fulfilled: 1, failed: 0 });
    expect(s.orders.get('o1')!.status).toBe('PAID');
    const again = await reconcilePendingFulfillments(); // now PAID: not a candidate any more
    expect(again.examined).toBe(0);
  });
  it('leaves very recent sessions to the webhook that is probably still coming', async () => {
    order(); s.sessions = [sess({ created: Math.floor((NOW - 60_000) / 1000) })];
    expect(await reconcilePendingFulfillments()).toMatchObject({ examined: 0 });
    expect(s.orders.get('o1')!.status).toBe('PENDING');
  });
  it('never fulfils an unpaid session', async () => {
    order(); s.sessions = [sess({ payment_status: 'unpaid' })];
    await reconcilePendingFulfillments();
    expect(s.orders.get('o1')!.status).toBe('PENDING');
  });
  it('still refuses an amount mismatch (counts as unresolved, nothing marked paid)', async () => {
    order(); s.sessions = [sess({ amount_total: 100 })];
    expect(await reconcilePendingFulfillments()).toMatchObject({ fulfilled: 0, failed: 1 });
    expect(s.orders.get('o1')!.status).toBe('PENDING');
  });
  it('ignores sessions for orders that are already paid or unknown', async () => {
    order({ status: 'PAID' }); s.sessions = [sess(), sess({ id: 'cs_2', metadata: { orderId: 'ghost' } }), sess({ id: 'cs_3', metadata: {} })];
    expect(await reconcilePendingFulfillments()).toMatchObject({ examined: 0, failed: 0 });
  });
  it('a Stripe outage is reported as failed, never thrown, and does not stop the other sweeps', async () => {
    s.listFails = true;
    const summary = await reconcilePendingFulfillments();
    expect(summary.failed).toBe(1);
    expect(s.listCalls).toBe(1);
  });
  it('recovers a late-paid order the checkout had marked CANCELLED', async () => {
    order({ status: 'CANCELLED' }); s.sessions = [sess()];
    await reconcilePendingFulfillments();
    expect(s.orders.get('o1')!.status).toBe('PAID');
  });
});
