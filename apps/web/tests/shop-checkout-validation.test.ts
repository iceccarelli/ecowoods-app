/**
 * /api/shop/checkout input validation, rate limiting and server-side pricing.
 * Prisma, Stripe and auth are faked at the edge.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  allowed: true,
  orderCreates: [] as Array<{ data: { items: { create: Array<{ quantity: number; unitPrice: number }> } } }>,
  stripeCalls: 0,
}));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'u1', email: 'a@example.com' } }) }));
vi.mock('@/lib/rate-limit-durable', () => ({
  enforceRateLimit: async () => ({ allowed: state.allowed, remaining: 0, retryAfterSeconds: 30, degraded: false }),
}));
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: async () => {
          state.stripeCalls += 1;
          return { id: 'cs_1', url: 'https://stripe.test/cs_1' };
        },
      },
    },
  },
}));
vi.mock('@/lib/db', () => ({
  db: {
    product: { findMany: async () => [{ id: 'p1', name: 'Oak', unit: 'SQFT', basePrice: 5, minQuantity: 10, options: null }] },
    settings: { findFirst: async () => ({ defaultTaxRate: 13 }) },
    order: {
      create: async (a: (typeof state.orderCreates)[number]) => {
        state.orderCreates.push(a);
        return { id: 'o1' };
      },
      update: async () => ({}),
    },
  },
}));

const route = await import('@/app/api/shop/checkout/route');

function post(body: string): Request {
  return new Request('http://localhost/api/shop/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' },
    body,
  });
}

beforeEach(() => {
  state.allowed = true;
  state.orderCreates.length = 0;
  state.stripeCalls = 0;
});

describe('POST /api/shop/checkout', () => {
  it.each([
    ['bad JSON', '{nope'],
    ['non-array items', JSON.stringify({ items: 'x' })],
    ['empty cart', JSON.stringify({ items: [] })],
    ['negative quantity', JSON.stringify({ items: [{ productId: 'p1', quantity: -3 }] })],
    ['zero quantity', JSON.stringify({ items: [{ productId: 'p1', quantity: 0 }] })],
    ['huge quantity', JSON.stringify({ items: [{ productId: 'p1', quantity: 1e12 }] })],
    ['string quantity', JSON.stringify({ items: [{ productId: 'p1', quantity: 'abc' }] })],
    ['too many lines', JSON.stringify({ items: Array.from({ length: 51 }, () => ({ productId: 'p1', quantity: 1 })) })],
  ])('400s on %s without creating an order', async (_n, body) => {
    const res = await route.POST(post(body));
    expect(res.status).toBe(400);
    expect(state.orderCreates).toHaveLength(0);
    expect(state.stripeCalls).toBe(0);
  });

  it('400s for an unknown product', async () => {
    const res = await route.POST(post(JSON.stringify({ items: [{ productId: 'nope', quantity: 1 }] })));
    expect(res.status).toBe(400);
    expect(state.orderCreates).toHaveLength(0);
  });

  it('429s when the durable limiter denies, before any order', async () => {
    state.allowed = false;
    const res = await route.POST(post(JSON.stringify({ items: [{ productId: 'p1', quantity: 20 }] })));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(state.orderCreates).toHaveLength(0);
  });

  it('prices server-side and applies the product minimum quantity', async () => {
    const res = await route.POST(post(JSON.stringify({ items: [{ productId: 'p1', quantity: 2 }] })));
    expect(res.status).toBe(200);
    const line = state.orderCreates[0]!.data.items.create[0]!;
    expect(line.quantity).toBe(10);
    expect(line.unitPrice).toBe(5);
  });
});
