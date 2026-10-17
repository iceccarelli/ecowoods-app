/**
 * The Pre-List Floor Condition Report intake accepts only its own product.
 * Real route handler; only Prisma and the email sender are faked. Companion to
 * the Well-Installed binding tests in well-installed-review-flow.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  order: null as null | { id: string; status: string; notes: string | null; user: { email: string } },
  emails: [] as unknown[],
  updates: [] as unknown[],
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: async () => (state.order ? { ...state.order } : null),
      update: async (args: unknown) => void state.updates.push(args),
      updateMany: async () => ({ count: 1 }),
    },
  },
}));
vi.mock('@/lib/email', () => ({ sendEmail: async (m: unknown) => void state.emails.push(m) }));

const submit = await import('@/app/api/listing-floor-report/submit/route');

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
let ip = 0;

function post(): Promise<Response> {
  const form = new FormData();
  const fields: Record<string, string> = {
    orderId: ORDER_ID,
    email: 'jane@example.com',
    role: 'agent',
    address: '12 Example Street',
    city: 'Toronto',
    photographyDate: '2026-11-01',
  };
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return submit.POST(new Request('http://localhost/api/listing-floor-report/submit', { method: 'POST', body: form, headers: { 'x-forwarded-for': `198.51.100.${++ip}` } }));
}

beforeEach(() => {
  state.order = null;
  state.emails.length = 0;
  state.updates.length = 0;
});

describe('listing-floor-report/submit — product binding', () => {
  it.each([
    ['well-installed review', 'Well-Installed Quote Review (Standard)'],
    ['personal floor plan', 'Personal Floor Plan\nFP_DESIGN:abc'],
    ['renovation credits', 'Renovation Credits (starter-40)'],
    ['unrelated order with injected product suffix', 'Shop order\nListing Floor Report (photo)'],
    ['unknown listing SKU', 'Listing Floor Report (unknown-sku)'],
    ['no notes', null],
  ])('a PAID %s order is rejected: 404, no email, no write', async (_n, notes) => {
    state.order = { id: ORDER_ID, status: 'PAID', notes, user: { email: 'jane@example.com' } };
    expect((await post()).status).toBe(404);
    expect(state.emails).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it('an unpaid listing-report order is still refused (402)', async () => {
    state.order = { id: ORDER_ID, status: 'PENDING', notes: 'Listing Floor Report (onsite)', user: { email: 'jane@example.com' } };
    expect((await post()).status).toBe(402);
    expect(state.emails).toHaveLength(0);
  });
});
