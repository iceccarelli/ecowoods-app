/**
 * A PAID Personal Floor Plan must reach the buyer without them landing on the
 * success page, and every failure must be retryable, not silent. Real
 * lib/floor-plan/deliver.ts + lib/stripe-fulfillment.ts; Prisma, the PDF
 * store and the mail transport are faked with fault injection.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

type Order = { id: string; userId: string; status: string; total: number; notes: string; paidAt: Date | null; stripeCheckoutSessionId: string | null; user: { email: string } };

const s = vi.hoisted(() => ({
  orders: new Map<string, Order>(),
  mail: [] as { to: string; html: string; idempotencyKey?: string }[],
  fail: { mail: 0, store: 0 },
  storeUrl: 'https://blob.example/fp.pdf',
  lostRace: 0,
}));

vi.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { list: () => (async function* () {})() } } } }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: () => undefined }));
vi.mock('@/lib/credit-ledger', () => ({ grantCreditsForOrder: async () => ({ reason: 'x' }) }));
vi.mock('@/lib/email', () => ({
  sendEmail: async (m: { to: string; html: string; idempotencyKey?: string }) => {
    if (s.fail.mail > 0) { s.fail.mail -= 1; throw new Error('smtp down'); }
    s.mail.push(m);
  },
}));
vi.mock('@/lib/floor-plan/generate', () => ({
  ensureFloorPlanReport: async (id: string) => {
    const o = s.orders.get(id)!;
    if (o.notes.includes('FP_DESIGN:BAD')) return { ok: false, reason: 'bad_design' };
    if (!o.notes.includes('FP_REPORT:')) {
      if (s.fail.store > 0) { s.fail.store -= 1; return { ok: false, reason: 'storage_failed' }; }
      o.notes = `${o.notes}\nFP_REPORT:${s.storeUrl}`;
    }
    return { ok: true, url: s.storeUrl };
  },
}));
vi.mock('@/lib/db', () => {
  const match = (o: Order, w: Record<string, unknown>) => {
    if (w.id && o.id !== w.id) return false;
    if (typeof w.notes === 'string' && o.notes !== w.notes) return false;
    const st = w.status as string | { in: string[] } | undefined;
    if (st && !(typeof st === 'string' ? [st] : st.in).includes(o.status)) return false;
    return true;
  };
  return {
    db: {
      order: {
        findUnique: async ({ where }: { where: { id: string } }) => { const o = s.orders.get(where.id); return o ? { ...o } : null; },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Order> }) => {
          if (s.lostRace > 0) { s.lostRace -= 1; const o = s.orders.get(where.id as string)!; o.notes += '\nTOUCHED'; return { count: 0 }; }
          const o = s.orders.get(where.id as string);
          if (!o || !match(o, where)) return { count: 0 };
          Object.assign(o, data);
          return { count: 1 };
        },
        findMany: async ({ where }: { where: { notes: { startsWith: string }; NOT?: { notes: { contains: string } } } }) =>
          [...s.orders.values()].filter((o) => ['PAID', 'FULFILLED'].includes(o.status) && o.notes.startsWith(where.notes.startsWith) && !(where.NOT && o.notes.includes(where.NOT.notes.contains))).map((o) => ({ id: o.id })),
      },
    },
  };
});

import { deliverFloorPlanOrder } from '@/lib/floor-plan/deliver';
import { fulfilCheckoutSession, reconcilePendingFulfillments } from '@/lib/stripe-fulfillment';

const seed = (over: Partial<Order> = {}): Order => {
  const o: Order = { id: 'ord-1', userId: 'u1', status: 'PAID', total: 111.87, notes: 'Personal Floor Plan\nFP_DESIGN:abc', paidAt: new Date(0), stripeCheckoutSessionId: 'cs_1', user: { email: 'buyer@example.com' }, ...over };
  s.orders.set(o.id, o);
  return o;
};
const session = (): Stripe.Checkout.Session =>
  ({ id: 'cs_1', payment_status: 'paid', currency: 'cad', amount_total: 11187, payment_intent: 'pi_1', metadata: { orderId: 'ord-1', userId: 'u1' } }) as unknown as Stripe.Checkout.Session;

beforeEach(() => {
  s.orders.clear(); s.mail.length = 0; s.fail.mail = 0; s.fail.store = 0; s.lostRace = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('deliverFloorPlanOrder', () => {
  it('stores the report, emails the link once with a stable idempotency key, records it', async () => {
    seed();
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'delivered' });
    expect(s.mail).toHaveLength(1);
    expect(s.mail[0].to).toBe('buyer@example.com');
    expect(s.mail[0].idempotencyKey).toBe('floor-plan-delivery/ord-1/v1');
    expect(s.mail[0].html).toContain('/floor-plan/ord-1?email=buyer%40example.com');
    expect(s.orders.get('ord-1')!.notes).toMatch(/FP_NOTIFIED:\d+/);
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'already_delivered' });
    expect(s.mail).toHaveLength(1);
  });
  it('does not email an unpaid order', async () => {
    seed({ status: 'PENDING' });
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'ignored', reason: 'not_paid' });
    expect(s.mail).toHaveLength(0);
  });
  it('ignores orders of other products', async () => {
    seed({ notes: 'Well-Installed Quote Review' });
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'ignored', reason: 'not_floor_plan' });
  });
  it('throws (retryable) and sends nothing when storage fails, then recovers', async () => {
    seed(); s.fail.store = 1;
    await expect(deliverFloorPlanOrder('ord-1')).rejects.toThrow(/storage_failed/);
    expect(s.mail).toHaveLength(0);
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'delivered' });
  });
  it('keeps the stored report and stays unnotified when the email fails; retry reuses the report', async () => {
    seed(); s.fail.mail = 1;
    await expect(deliverFloorPlanOrder('ord-1')).rejects.toThrow('smtp down');
    expect(s.orders.get('ord-1')!.notes).toContain('FP_REPORT:');
    expect(s.orders.get('ord-1')!.notes).not.toContain('FP_NOTIFIED');
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'delivered' });
    expect(s.mail).toHaveLength(1);
  });
  it('re-reads and retries the marker write when the row changed under it', async () => {
    seed(); s.lostRace = 1;
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'delivered' });
    expect(s.orders.get('ord-1')!.notes).toContain('FP_NOTIFIED');
  });
  it('reports a permanently undecodable design as rejected, never emailing', async () => {
    seed({ notes: 'Personal Floor Plan\nFP_DESIGN:BAD' });
    expect(await deliverFloorPlanOrder('ord-1')).toEqual({ status: 'rejected', reason: 'bad_design' });
    expect(s.mail).toHaveLength(0);
  });
  it('escapes the link it embeds in the email body', async () => {
    seed({ user: { email: 'a"><script>@example.com' } });
    await deliverFloorPlanOrder('ord-1');
    expect(s.mail[0].html).not.toMatch(/<script/i);
  });
});

describe('payment webhook → floor plan', () => {
  it('a paid session marks PAID and delivers without the buyer visiting the success page', async () => {
    seed({ status: 'PENDING', paidAt: null });
    const out = await fulfilCheckoutSession(session());
    expect(out).toMatchObject({ status: 'fulfilled' });
    expect(s.orders.get('ord-1')!.status).toBe('PAID');
    expect(s.mail).toHaveLength(1);
  });
  it('throws on a transient email failure so Stripe redelivers, and the redelivery completes it exactly once', async () => {
    seed({ status: 'PENDING', paidAt: null }); s.fail.mail = 1;
    await expect(fulfilCheckoutSession(session())).rejects.toThrow('smtp down');
    await fulfilCheckoutSession(session());
    await fulfilCheckoutSession(session()); // duplicate event after success
    expect(s.mail).toHaveLength(1);
  });
  it('acknowledges but flags a paid order whose design cannot be decoded', async () => {
    seed({ status: 'PENDING', paidAt: null, notes: 'Personal Floor Plan\nFP_DESIGN:BAD' });
    expect(await fulfilCheckoutSession(session())).toEqual({ status: 'rejected', reason: 'bad_design' });
  });
});

describe('reconcile sweep', () => {
  it('finishes a paid floor plan the webhook never delivered, and counts unresolved ones', async () => {
    seed();
    seed({ id: 'ord-2', notes: 'Personal Floor Plan\nFP_DESIGN:BAD' });
    seed({ id: 'ord-3', notes: 'Personal Floor Plan\nFP_DESIGN:abc\nFP_NOTIFIED:1' });
    const summary = await reconcilePendingFulfillments();
    expect(summary).toMatchObject({ examined: 2, fulfilled: 1, failed: 1 });
    expect(s.mail.map((m) => m.html).length).toBe(1);
  });
});
