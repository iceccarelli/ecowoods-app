/**
 * Commercial-flow guards that need no database: cent arithmetic, who may pay an
 * invoice, what an abandoned shop checkout leaves behind, and what the paid
 * success pages show (and refuse to show) before the payment webhook lands.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { estimateAmounts, invoiceAmounts, roundCents, splitContract } from '@/lib/money';

const s = vi.hoisted(() => ({
  userId: 'u1',
  invoice: null as null | Record<string, unknown>,
  order: null as null | Record<string, unknown>,
  stripeCreates: [] as Array<Record<string, unknown>>,
  stripeFails: false,
  orderUpdates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  ensure: { ok: false, reason: 'not_paid' } as { ok: boolean; reason?: string; url?: string },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => (s.userId ? { user: { id: s.userId, email: 'a@example.test', role: 'USER' } } : null) }));
vi.mock('@/lib/rate-limit-durable', async (orig) => ({
  ...(await orig<typeof import('@/lib/rate-limit-durable')>()),
  enforceRateLimit: async () => ({ allowed: true, remaining: 9, retryAfterSeconds: 0, degraded: false, unavailable: false }),
}));
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: async (p: Record<string, unknown>) => {
          s.stripeCreates.push(p);
          if (s.stripeFails) throw new Error('stripe down');
          return { id: 'cs_1', url: 'https://stripe.test/cs_1' };
        },
      },
    },
  },
}));
vi.mock('@/lib/floor-plan/generate', () => ({ ensureFloorPlanReport: async () => s.ensure }));
vi.mock('@/lib/db', () => ({
  db: {
    invoice: { findUnique: async () => s.invoice },
    product: { findMany: async () => [{ id: 'p1', name: 'Oak', unit: 'SQFT', basePrice: 5, minQuantity: 10, options: null }] },
    settings: { findFirst: async () => ({ defaultTaxRate: 13 }) },
    order: {
      create: async () => ({ id: 'order-1' }),
      update: async () => ({}),
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        s.orderUpdates.push(a);
        return { count: 1 };
      },
      findUnique: async () => s.order,
    },
  },
}));

beforeEach(() => {
  s.userId = 'u1';
  s.invoice = null;
  s.order = null;
  s.stripeCreates = [];
  s.stripeFails = false;
  s.orderUpdates = [];
  s.ensure = { ok: false, reason: 'not_paid' };
});

describe('money: cent arithmetic', () => {
  it('rounds half-up to cents where binary floats round down', () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(2.675)).toBe(2.68);
    expect(roundCents(10.125)).toBe(10.13);
  });

  it('the printed lines of an invoice always add up to the total', () => {
    for (const [sub, d, su, t] of [
      [100.01, 10, 5, 13],
      [3333.33, 7.5, 2.5, 13],
      [0.07, 0, 0, 13],
      [999.99, 12.5, 0, 5],
      [1234.56, 0, 15, 13],
    ] as const) {
      const a = invoiceAmounts(sub, d, su, t);
      const rebuilt = Math.round((a.subtotal - a.discount + a.surcharge + a.tax) * 100);
      expect(rebuilt).toBe(Math.round(a.total * 100));
    }
  });

  it('known values: 13% HST on 200.00 is 26.00; on 0.05 it rounds to 0.01', () => {
    expect(invoiceAmounts(200, 0, 0, 13)).toMatchObject({ tax: 26, total: 226 });
    expect(estimateAmounts(0.05, 13)).toMatchObject({ tax: 0.01, total: 0.06 });
  });

  it('staged invoices sum to the contract value to the cent', () => {
    for (const value of [10000.01, 7777.77, 12345.67, 99.99]) {
      const parts = splitContract(value, [30, 40, 30]);
      expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(value * 100));
    }
    // Percentages that do not make 100 are left exactly as the owner set them.
    expect(splitContract(1000, [30, 40])).toEqual([300, 400]);
  });
});

describe('invoice checkout: only an issued, unpaid invoice of the signed-in owner', () => {
  const call = async () => {
    const { POST } = await import('@/app/api/invoices/[id]/checkout/route');
    return POST(new Request('http://localhost/api/invoices/i1/checkout', { method: 'POST', headers: { origin: 'http://localhost' } }), {
      params: Promise.resolve({ id: 'i1' }),
    });
  };
  const invoice = (status: string, userId = 'u1') => ({
    id: 'i1', number: 'INV-1', status, total: 226, stage: 'DEPOSIT', description: null, projectId: 'p1',
    project: { title: 'T', userId, user: { email: 'c@example.test' } },
  });

  it.each([['DRAFT', 409], ['VOID', 409], ['PAID', 400]])('%s -> %i and no Stripe session', async (status, code) => {
    s.invoice = invoice(status);
    const res = await call();
    expect(res.status).toBe(code);
    expect(s.stripeCreates).toHaveLength(0);
  });

  it('someone else\'s invoice -> 403', async () => {
    s.invoice = invoice('SENT', 'other');
    expect((await call()).status).toBe(403);
    expect(s.stripeCreates).toHaveLength(0);
  });

  it.each(['SENT', 'OVERDUE'])('%s creates a session for exactly the stored total', async (status) => {
    s.invoice = invoice(status);
    const res = await call();
    expect(res.status).toBe(200);
    const item = (s.stripeCreates[0]!.line_items as Array<{ price_data: { unit_amount: number; currency: string } }>)[0]!;
    expect(item.price_data).toMatchObject({ unit_amount: 22600, currency: 'cad' });
  });
});

describe('shop checkout', () => {
  const call = async () => {
    const { POST } = await import('@/app/api/shop/checkout/route');
    return POST(
      new Request('http://localhost/api/shop/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ items: [{ productId: 'p1', quantity: 20 }] }),
      }),
    );
  };

  it('returns to the orders page with the order id, so a pending payment has somewhere to say so', async () => {
    await call();
    expect(String(s.stripeCreates[0]!.success_url)).toBe('http://localhost:3000/mypage/orders?checkout=success&order=order-1');
  });

  it('a Stripe failure closes the unpaid order instead of stranding it as PENDING', async () => {
    s.stripeFails = true;
    const res = await call();
    expect(res.status).toBe(500);
    expect(s.orderUpdates).toEqual([
      { where: { id: 'order-1', status: 'PENDING', stripeCheckoutSessionId: null }, data: { status: 'CANCELLED' } },
    ]);
  });
});

/** Flatten a rendered React element tree to its text and attribute values. */
function flatten(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatten).join(' ');
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  if (typeof el.type === 'function') {
    try {
      return flatten((el.type as (p: unknown) => unknown)(el.props));
    } catch {
      return '';
    }
  }
  const props = el.props ?? {};
  const attrs = Object.entries(props)
    .filter(([k, v]) => k !== 'children' && (typeof v === 'string' || typeof v === 'number'))
    .map(([, v]) => String(v));
  return [...attrs, flatten(props.children)].join(' ');
}

describe('paid success pages', () => {
  const user = { email: 'buyer@example.test', name: 'Buyer' };

  it('listing report success: order id alone never reveals the buyer\'s email or the report link', async () => {
    s.order = { id: 'o1', status: 'FULFILLED', notes: 'Listing Floor Report (photo)\nLFR_REPORT:https://x/r.pdf', user };
    const Page = (await import('@/app/listing-floor-report/success/page')).default;
    const bare = flatten(await Page({ searchParams: Promise.resolve({ order: 'o1' }) }));
    expect(bare).not.toContain('buyer@example.test');
    expect(bare).not.toContain('buyer%40example.test');
    expect(bare).not.toContain('/listing-floor-report/report');

    const wrong = flatten(await Page({ searchParams: Promise.resolve({ order: 'o1', email: 'guess@example.test' }) }));
    expect(wrong).not.toContain('/listing-floor-report/report');

    const right = flatten(await Page({ searchParams: Promise.resolve({ order: 'o1', email: 'Buyer@Example.test' }) }));
    expect(right).toContain('/listing-floor-report/report?order=o1&email=');
  });

  it('listing report success: a PENDING order (webhook not landed) says so', async () => {
    s.order = { id: 'o1', status: 'PENDING', notes: 'Listing Floor Report (photo)', user };
    const Page = (await import('@/app/listing-floor-report/success/page')).default;
    const text = flatten(await Page({ searchParams: Promise.resolve({ order: 'o1' }) }));
    expect(text).toContain('Confirming your payment');
    expect(text).not.toContain('Submit');
  });

  it('well-installed review success: a PENDING order says so instead of showing the upload form', async () => {
    s.order = { id: 'o1', status: 'PENDING', notes: 'Well-Installed Quote Review (Standard)', user };
    const Page = (await import('@/app/well-installed-review/success/page')).default;
    const text = flatten(await Page({ searchParams: Promise.resolve({ order: 'o1' }) }));
    expect(text).toContain('Confirming your payment');
  });

  it('floor plan page: PENDING shows a confirming note; a wrong email shows nothing about the order', async () => {
    s.order = { id: 'o1', status: 'PENDING', notes: 'Personal Floor Plan\nFP_DESIGN:abc', user };
    const Page = (await import('@/app/floor-plan/[id]/page')).default;
    const pending = flatten(
      await Page({ params: Promise.resolve({ id: 'o1' }), searchParams: Promise.resolve({ email: 'buyer@example.test' }) }),
    );
    expect(pending).toContain('Confirming your payment');

    s.ensure = { ok: true, url: 'https://x/secret.pdf' };
    const forged = flatten(
      await Page({ params: Promise.resolve({ id: 'o1' }), searchParams: Promise.resolve({ email: 'someone@else.test' }) }),
    );
    expect(forged).not.toContain('secret.pdf');
    expect(forged).toContain('could not find that order');
    const none = flatten(await Page({ params: Promise.resolve({ id: 'o1' }), searchParams: Promise.resolve({}) }));
    expect(none).not.toContain('secret.pdf');

    const ok = flatten(
      await Page({ params: Promise.resolve({ id: 'o1' }), searchParams: Promise.resolve({ email: ' BUYER@example.test ' }) }),
    );
    expect(ok).toContain('secret.pdf');
  });
});
