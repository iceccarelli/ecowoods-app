/**
 * The Renovation Credits commercial loop, end to end through the real route
 * handlers: checkout -> Stripe webhook (REAL signature verification, REAL
 * Prisma unique-constraint semantics simulated in the fake db) -> credits
 * granted -> analysis run (real deterministic engine) -> saved result ->
 * owner-only fetch.
 *
 * Only the edges are faked: Prisma (an in-memory Order/User/CreditWallet/
 * CreditTransaction/RenovationAnalysis table with real unique-constraint
 * enforcement, so lib/credit-ledger.ts's idempotency logic runs for real
 * against it), auth(). Stripe's `checkout.sessions.create` is faked (no
 * network), but `stripe.webhooks.constructEvent` — the actual signature
 * verification — is NOT faked: this file signs a real Stripe test event with
 * the real `stripe` SDK and the webhook route verifies it for real. See
 * "signed webhook" describe block below.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

type User = { id: string; email: string; name: string | null };
type Order = { id: string; userId: string; status: string; subtotal: number; taxRate: number; total: number; notes: string | null; stripeCheckoutSessionId?: string };
type Wallet = { id: string; userId: string; balance: number };
type CreditTxn = { id: string; walletId: string; userId: string; type: string; credits: number; reason: string; orderId: string | null; analysisId: string | null; idempotencyKey: string };
type Analysis = { id: string; userId: string; walletId: string; status: string; creditsCharged: number; contextSnapshot: unknown; result: unknown; failureReason: string | null; requestIdempotencyKey: string; createdAt: Date; completedAt: Date | null };

const state = vi.hoisted(() => ({
  users: new Map<string, User>(),
  orders: new Map<string, Order>(),
  wallets: new Map<string, Wallet>(), // keyed by userId
  txns: new Map<string, CreditTxn>(), // keyed by idempotencyKey
  analyses: new Map<string, Analysis>(), // keyed by id
  analysesByKey: new Map<string, string>(), // requestIdempotencyKey -> id
  session: null as null | { user: { id: string; email: string; role: string } },
  stripeCalls: [] as Array<Record<string, unknown>>,
  currentSignature: null as string | null,
}));

function uniqueViolation(): never {
  throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
}

vi.mock('@/lib/db', () => {
  const walletOps = {
    upsert: async ({ where, create }: { where: { userId: string }; create: { userId: string; balance: number } }) => {
      const existing = state.wallets.get(where.userId);
      if (existing) return { ...existing };
      const w = { id: `wallet-${state.wallets.size + 1}`, userId: create.userId, balance: create.balance };
      state.wallets.set(where.userId, w);
      return { ...w };
    },
    update: async ({ where, data }: { where: { id: string }; data: { balance?: { increment?: number; decrement?: number } } }) => {
      const w = [...state.wallets.values()].find((x) => x.id === where.id)!;
      if (data.balance?.increment) w.balance += data.balance.increment;
      if (data.balance?.decrement) w.balance -= data.balance.decrement;
      return { ...w };
    },
    findUnique: async ({ where }: { where: { userId: string } }) => {
      const w = state.wallets.get(where.userId);
      return w ? { ...w } : null;
    },
  };
  const creditTransactionOps = {
    create: async ({ data }: { data: Omit<CreditTxn, 'id'> }) => {
      if (state.txns.has(data.idempotencyKey)) uniqueViolation();
      const t = { id: `txn-${state.txns.size + 1}`, ...data };
      state.txns.set(data.idempotencyKey, t);
      return { ...t };
    },
  };
  const renovationAnalysisOps = {
    findUnique: async ({ where }: { where: { id?: string; requestIdempotencyKey?: string } }) => {
      if (where.id) return state.analyses.get(where.id) ? { ...state.analyses.get(where.id)! } : null;
      if (where.requestIdempotencyKey) {
        const id = state.analysesByKey.get(where.requestIdempotencyKey);
        return id ? { ...state.analyses.get(id)! } : null;
      }
      return null;
    },
    create: async ({ data }: { data: Omit<Analysis, 'id' | 'createdAt' | 'completedAt'> & { completedAt?: Date } }) => {
      if (state.analysesByKey.has(data.requestIdempotencyKey)) uniqueViolation();
      const id = crypto.randomUUID();
      const a: Analysis = { id, createdAt: new Date(), completedAt: data.completedAt ?? null, ...data };
      state.analyses.set(id, a);
      state.analysesByKey.set(data.requestIdempotencyKey, id);
      return { ...a };
    },
  };

  return {
    db: {
      settings: { findFirst: async () => ({ defaultTaxRate: 13 }) },
      order: {
        create: async ({ data }: { data: Omit<Order, 'id'> & { items?: unknown } }) => {
          const { items: _items, id: _ignoredId, ...rest } = data as Order & { items?: unknown };
          const id = crypto.randomUUID();
          const o = { id, ...rest } as Order;
          state.orders.set(id, o);
          return { ...o };
        },
        findUnique: async ({ where }: { where: { id: string } }) => (state.orders.get(where.id) ? { ...state.orders.get(where.id)! } : null),
        update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
          const o = state.orders.get(where.id)!;
          Object.assign(o, data);
          return { ...o };
        },
      },
      creditWallet: walletOps,
      creditTransaction: creditTransactionOps,
      renovationAnalysis: renovationAnalysisOps,
      $transaction: async (fn: (tx: unknown) => unknown) =>
        fn({ creditWallet: walletOps, creditTransaction: creditTransactionOps, renovationAnalysis: renovationAnalysisOps }),
    },
  };
});

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          state.stripeCalls.push(args);
          return { id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' };
        },
      },
    },
    // REAL signature verification — Stripe.webhooks.constructEvent is pure
    // local HMAC/crypto, no network call and no dependency on the (fake)
    // secret key used elsewhere in this mock. Only checkout session
    // creation is faked; the webhook's signature check is genuine.
    webhooks: Stripe.webhooks,
  },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => state.session }));

/*
 * next/headers' headers() needs Next's async-request-store context, which
 * does not exist when a route handler is invoked directly in vitest (no
 * real Next server). Every other route here takes signature-independent
 * headers via the Request object itself; only the Stripe webhook reads
 * 'stripe-signature' through headers() (required by Next's route contract
 * for raw-body routes), so this mock stands in for that ONE lookup —
 * nothing about signature verification itself is faked, only how the
 * signature value reaches the handler in this test environment.
 */
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (key: string) => (key === 'stripe-signature' ? state.currentSignature : null) }),
}));

const checkout = await import('@/app/api/assistant/analysis/checkout/route');
const run = await import('@/app/api/assistant/analysis/run/route');
const walletRoute = await import('@/app/api/assistant/credits/wallet/route');
const getAnalysis = await import('@/app/api/assistant/analysis/[id]/route');
const webhook = await import('@/app/api/webhooks/stripe/route');

let ipCounter = 0;
const nextIp = () => `203.0.113.${(ipCounter += 1)}`;

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }, body: JSON.stringify(body) });
}

const REXDALE_WORKSPACE = {
  designId: 'design-rexdale-1',
  country: 'CA' as const,
  objective: 'refinish' as const,
  sellHorizon: 'selling-soon' as const,
  stairs: false,
  rooms: [{ label: 'Main floor', squareFeet: 900 }],
  selectedServiceSlugs: ['floor-refinishing'],
  nextAction: null,
};

const WEBHOOK_SECRET = 'whsec_test_secret';

/** Signs a real Stripe event payload with the real SDK — genuine signature verification, no network call. */
function signedWebhookRequest(payload: Record<string, unknown>): Request {
  const body = JSON.stringify(payload);
  state.currentSignature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body });
}

function checkoutCompletedEvent(overrides: { orderId: string; userId: string; credits: number }) {
  return {
    id: `evt_${crypto.randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_intent: 'pi_test_1',
        amount_total: 2148,
        metadata: { orderId: overrides.orderId, userId: overrides.userId, kind: 'renovation-credits', pack: 'starter-40', credits: String(overrides.credits) },
      },
    },
  };
}

beforeEach(() => {
  state.users.clear();
  state.orders.clear();
  state.wallets.clear();
  state.txns.clear();
  state.analyses.clear();
  state.analysesByKey.clear();
  state.stripeCalls.length = 0;
  state.session = null;
  state.currentSignature = null;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
});

afterEach(() => vi.restoreAllMocks());

async function buyAndDeliverWebhook(userId: string, deliverTwice = false) {
  state.session = { user: { id: userId, email: 'jane@example.com', role: 'USER' } };
  const res = await checkout.POST(jsonPost('http://localhost/api/assistant/analysis/checkout', {}));
  expect(res.status).toBe(200);
  const call = state.stripeCalls.at(-1)! as { metadata: Record<string, string> };
  const orderId = call.metadata.orderId;
  const credits = Number(call.metadata.credits);

  const event = checkoutCompletedEvent({ orderId, userId, credits });
  const first = await webhook.POST(signedWebhookRequest(event));
  expect(first.status).toBe(200);
  if (deliverTwice) {
    const second = await webhook.POST(signedWebhookRequest(event));
    expect(second.status).toBe(200);
  }
  return { orderId, credits };
}

describe('checkout', () => {
  it('requires auth', async () => {
    const res = await checkout.POST(jsonPost('http://localhost/api/assistant/analysis/checkout', {}));
    expect(res.status).toBe(401);
    expect(state.orders.size).toBe(0);
  });

  it('prices from CREDIT_PACK server-side, tags metadata.kind=renovation-credits, never trusts a client price', async () => {
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    const res = await checkout.POST(jsonPost('http://localhost/api/assistant/analysis/checkout', { priceCad: 1, credits: 99999 }));
    expect(res.status).toBe(200);
    const call = state.stripeCalls.at(-1)! as { line_items: Array<{ price_data: { unit_amount: number } }>; metadata: Record<string, string> };
    expect(call.line_items[0].price_data.unit_amount).toBe(1900); // CREDIT_PACK.priceCad, ignoring the client's priceCad
    expect(call.metadata.credits).toBe('40'); // CREDIT_PACK.credits, ignoring the client's credits
    expect(call.metadata.kind).toBe('renovation-credits');
  });

  it('rejects a foreign origin', async () => {
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    const req = new Request('http://localhost/api/assistant/analysis/checkout', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect((await checkout.POST(req)).status).toBe(403);
  });
});

describe('webhook — signature and idempotency', () => {
  it('rejects a forged signature and grants no credits', async () => {
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    await checkout.POST(jsonPost('http://localhost/api/assistant/analysis/checkout', {}));
    const orderId = (state.stripeCalls.at(-1)!.metadata as Record<string, string>).orderId;
    const event = checkoutCompletedEvent({ orderId, userId: 'user-1', credits: 40 });
    const body = JSON.stringify(event);
    state.currentSignature = 't=1,v1=deadbeef';
    const forged = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body });
    const res = await webhook.POST(forged);
    expect(res.status).toBe(400);
    expect(state.wallets.get('user-1')).toBeUndefined();
  });

  it('grants the exact configured credits on a genuinely signed event', async () => {
    const { orderId, credits } = await buyAndDeliverWebhook('user-1');
    expect(state.orders.get(orderId)!.status).toBe('PAID');
    expect(state.wallets.get('user-1')!.balance).toBe(credits);
    expect(credits).toBe(40);
  });

  it('a duplicate webhook delivery grants credits exactly once', async () => {
    const { credits } = await buyAndDeliverWebhook('user-2', true);
    expect(state.wallets.get('user-2')!.balance).toBe(credits);
    const grants = [...state.txns.values()].filter((t) => t.type === 'GRANT' && t.userId === 'user-2');
    expect(grants).toHaveLength(1);
  });

  it('a forged event referencing a real order id still fails signature verification before any DB write', async () => {
    state.session = { user: { id: 'user-3', email: 'jane@example.com', role: 'USER' } };
    await checkout.POST(jsonPost('http://localhost/api/assistant/analysis/checkout', {}));
    const orderId = (state.stripeCalls.at(-1)!.metadata as Record<string, string>).orderId;
    const tampered = { ...checkoutCompletedEvent({ orderId, userId: 'user-3', credits: 999999 }) };
    const body = JSON.stringify(tampered);
    // Sign a DIFFERENT payload, then present it alongside the tampered body —
    // simulates an attacker replaying a valid signature over modified content.
    state.currentSignature = Stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify({ different: true }), secret: WEBHOOK_SECRET });
    const req = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body });
    expect((await webhook.POST(req)).status).toBe(400);
    expect(state.wallets.get('user-3')).toBeUndefined();
  });
});

describe('analysis run', () => {
  it('requires auth', async () => {
    const res = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    expect(res.status).toBe(401);
  });

  it('refuses an ineligible workspace (not enough context) without charging', async () => {
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    await buyAndDeliverWebhook('user-1');
    const res = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: {}, requestIdempotencyKey: 'key-00000001' }));
    expect(res.status).toBe(422);
    expect(state.wallets.get('user-1')!.balance).toBe(40);
  });

  it('refuses to run with insufficient credits, charges nothing', async () => {
    state.session = { user: { id: 'user-broke', email: 'broke@example.com', role: 'USER' } };
    const res = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.required).toBe(15);
    expect(state.txns.size).toBe(0);
  });

  it('charges the exact configured cost once, saves a real structured result using the submitted context', async () => {
    await buyAndDeliverWebhook('user-1');
    const res = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(25); // 40 - 15
    expect(body.result.costView.some((c: { note?: string }) => c.note?.includes('900'))).toBe(true);
    expect(state.wallets.get('user-1')!.balance).toBe(25);
    const settle = [...state.txns.values()].filter((t) => t.type === 'SETTLE');
    expect(settle).toHaveLength(1);
    expect(settle[0]!.credits).toBe(-15);
  });

  it('a duplicate request under the same idempotency key returns the saved result and does not charge again', async () => {
    await buyAndDeliverWebhook('user-1');
    const first = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000002-same' }));
    const second = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000002-same' }));
    expect((await first.json()).analysisId).toBe((await second.json()).analysisId);
    expect(state.wallets.get('user-1')!.balance).toBe(25); // charged once, not twice
    expect([...state.txns.values()].filter((t) => t.type === 'SETTLE')).toHaveLength(1);
  });

  it('a tampered/oversized creditsCost cannot be requested by the client — the server constant always wins', async () => {
    await buyAndDeliverWebhook('user-1');
    // The run route's schema does not even accept a client-supplied cost —
    // assert the body shape enforces that by sending one and confirming the
    // charge still matches ANALYSIS_CREDIT_COST (15), not the injected value.
    const res = await run.POST(
      jsonPost('http://localhost/api/assistant/analysis/run', {
        workspace: REXDALE_WORKSPACE,
        requestIdempotencyKey: 'key-00000003-tamper',
        creditsCost: 1, // ignored — not part of the schema
      }),
    );
    expect(res.status).toBe(200);
    expect(state.wallets.get('user-1')!.balance).toBe(25); // still 40 - 15, not 40 - 1
  });
});

describe('saved analysis ownership', () => {
  it('the owner can fetch their saved analysis', async () => {
    await buyAndDeliverWebhook('user-1');
    const runRes = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    const { analysisId } = await runRes.json();
    const getRes = await getAnalysis.GET(new Request(`http://localhost/api/assistant/analysis/${analysisId}`), { params: Promise.resolve({ id: analysisId }) });
    expect(getRes.status).toBe(200);
  });

  it('a different signed-in user gets 404, not 403 — never confirms the id exists', async () => {
    await buyAndDeliverWebhook('user-1');
    const runRes = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    const { analysisId } = await runRes.json();

    state.session = { user: { id: 'user-2', email: 'other@example.com', role: 'USER' } };
    const res = await getAnalysis.GET(new Request(`http://localhost/api/assistant/analysis/${analysisId}`), { params: Promise.resolve({ id: analysisId }) });
    expect(res.status).toBe(404);
  });

  it('an anonymous request gets 404', async () => {
    await buyAndDeliverWebhook('user-1');
    const runRes = await run.POST(jsonPost('http://localhost/api/assistant/analysis/run', { workspace: REXDALE_WORKSPACE, requestIdempotencyKey: 'key-00000001' }));
    const { analysisId } = await runRes.json();
    state.session = null;
    const res = await getAnalysis.GET(new Request(`http://localhost/api/assistant/analysis/${analysisId}`), { params: Promise.resolve({ id: analysisId }) });
    expect(res.status).toBe(404);
  });

  it('a malformed id is 404, not a 500 or a distinguishing 400', async () => {
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    const res = await getAnalysis.GET(new Request('http://localhost/api/assistant/analysis/not-a-uuid'), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(404);
  });
});

describe('wallet', () => {
  it('requires auth', async () => {
    expect((await walletRoute.GET()).status).toBe(401);
  });

  it('reports the real balance after a purchase', async () => {
    await buyAndDeliverWebhook('user-1');
    state.session = { user: { id: 'user-1', email: 'jane@example.com', role: 'USER' } };
    const res = await walletRoute.GET();
    const body = await res.json();
    expect(body.balance).toBe(40);
    expect(body.analysisCreditCost).toBe(15);
  });
});
