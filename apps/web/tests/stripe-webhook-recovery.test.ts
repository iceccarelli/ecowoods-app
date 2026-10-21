/**
 * Stripe webhook correctness and recoverable fulfilment, through the real
 * route handler, the real lib/stripe-fulfillment.ts and the real
 * lib/credit-ledger.ts. Signatures are produced and verified by the real
 * Stripe SDK (generateTestHeaderString / constructEvent) — no network, no live
 * credentials. Only Prisma is faked, with real unique-constraint semantics,
 * conditional-update semantics, a row-lock stand-in for $transaction, and
 * fault injection to prove each failure mode is recoverable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

type Row = Record<string, unknown> & { id: string };

const s = vi.hoisted(() => ({
  orders: new Map<string, Row>(),
  invoices: new Map<string, Row>(),
  payments: [] as Row[],
  cases: [] as Row[],
  wallets: new Map<string, Row>(),
  txns: new Map<string, Row>(),
  signature: null as string | null,
  fail: { orderClaim: 0, grant: 0, invoiceTx: 0, paymentCreate: 0 },
  funnel: [] as unknown[],
  lock: Promise.resolve() as Promise<unknown>,
}));

function uniq(): never {
  throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
}
function maybeFail(key: keyof typeof s.fail, msg: string) {
  if (s.fail[key] > 0) {
    s.fail[key] -= 1;
    throw new Error(msg);
  }
}

vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: (e: unknown) => void s.funnel.push(e) }));

vi.mock('@/lib/db', () => {
  const wallet = {
    upsert: async ({ where, create }: { where: { userId: string }; create: { userId: string; balance: number } }) => {
      const w = s.wallets.get(where.userId) ?? { id: `w-${s.wallets.size + 1}`, ...create };
      s.wallets.set(where.userId, w);
      return { ...w };
    },
    createMany: async ({ data }: { data: Array<{ userId: string; balance: number }> }) => {
      for (const d of data) {
        if (!s.wallets.has(d.userId)) s.wallets.set(d.userId, { id: `w-${s.wallets.size + 1}`, ...d });
      }
      return { count: 0 };
    },
    findUniqueOrThrow: async ({ where }: { where: { userId: string } }) => {
      const w = s.wallets.get(where.userId);
      if (!w) throw new Error('not found');
      return { ...w };
    },
    update: async ({ where, data }: { where: { id: string }; data: { balance: { increment: number } } }) => {
      const w = [...s.wallets.values()].find((x) => x.id === where.id)!;
      w.balance = (w.balance as number) + data.balance.increment;
      return { ...w };
    },
    findUnique: async ({ where }: { where: { userId: string } }) => (s.wallets.get(where.userId) ? { ...s.wallets.get(where.userId)! } : null),
  };
  const credit = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) => (s.txns.get(where.idempotencyKey) ? { ...s.txns.get(where.idempotencyKey)! } : null),
    create: async ({ data }: { data: { idempotencyKey: string } }) => {
      maybeFail('grant', 'ledger down');
      if (s.txns.has(data.idempotencyKey)) uniq();
      s.txns.set(data.idempotencyKey, { id: `t-${s.txns.size + 1}`, ...data });
      return {};
    },
  };
  const order = {
    findUnique: async ({ where }: { where: { id: string } }) => (s.orders.get(where.id) ? { ...s.orders.get(where.id)! } : null),
    findMany: async ({ where }: { where: { status: string } }) => [...s.orders.values()].filter((o) => o.status === where.status && String(o.notes).startsWith('Renovation Credits (')).map((o) => ({ ...o })),
    updateMany: async ({ where, data }: { where: { id: string; status: string | { in: string[] } }; data: Row }) => {
      if (typeof where.status !== 'string') maybeFail('orderClaim', 'db down');
      const o = s.orders.get(where.id);
      const allowed = typeof where.status === 'string' ? [where.status] : where.status.in;
      if (!o || !allowed.includes(o.status as string)) return { count: 0 };
      Object.assign(o, data);
      return { count: 1 };
    },
  };
  const makeTx = () => ({
    creditWallet: wallet,
    creditTransaction: credit,
    invoice: {
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(s.invoices.get(where.id)!, data),
      updateMany: async ({ where, data }: { where: { id: string; status: { notIn?: string[]; not?: string } }; data: Row }) => {
        const inv = s.invoices.get(where.id);
        if (!inv || (where.status.notIn ?? [where.status.not]).includes(inv.status as string)) return { count: 0 };
        Object.assign(inv, data);
        return { count: 1 };
      },
    },
    paymentCase: {
      createMany: async ({ data }: { data: Row[] }) => {
        let count = 0;
        for (const d of data) {
          if (s.cases.some((c) => c.idempotencyKey === d.idempotencyKey)) continue;
          s.cases.push({ ...d, id: `c-${s.cases.length + 1}` });
          count += 1;
        }
        return { count };
      },
    },
    payment: {
      findFirst: async ({ where }: { where: { invoiceId: string; stripePaymentIntentId?: string } }) =>
        s.payments.find((p) => p.invoiceId === where.invoiceId && (!where.stripePaymentIntentId || p.stripePaymentIntentId === where.stripePaymentIntentId)) ?? null,
      create: async ({ data }: { data: Row }) => {
        maybeFail('paymentCreate', 'payment insert failed');
        const row = { ...data, id: `p-${s.payments.length + 1}` };
        s.payments.push(row);
        return row;
      },
    },
  });
  return {
    db: {
      order,
      invoice: { findUnique: async ({ where }: { where: { id: string } }) => (s.invoices.get(where.id) ? { ...s.invoices.get(where.id)! } : null) },
      project: { findUnique: async () => ({ designId: 'design-1' }) },
      creditWallet: wallet,
      creditTransaction: credit,
      paymentCase: { count: async () => 0 },
      // Serialises transactions (the row lock) and rolls back on throw.
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const run = s.lock.then(async () => {
          const snapshot = { inv: structuredClone([...s.invoices]), pay: structuredClone(s.payments), w: structuredClone([...s.wallets]), t: structuredClone([...s.txns]) };
          try {
            maybeFail('invoiceTx', 'tx failed');
            return await fn(makeTx());
          } catch (err) {
            s.invoices = undefined as never;
            s.invoices = new Map(snapshot.inv) as never;
            s.payments.splice(0, s.payments.length, ...snapshot.pay);
            s.wallets = new Map(snapshot.w) as never;
            s.txns = new Map(snapshot.t) as never;
            throw err;
          }
        });
        s.lock = run.catch(() => undefined);
        return run;
      },
    },
  };
});

vi.mock('@/lib/stripe', () => ({ stripe: { webhooks: Stripe.webhooks, checkout: { sessions: { list: () => (async function* () {})() } } } }));
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => (k === 'stripe-signature' ? s.signature : null) }) }));

const webhook = await import('@/app/api/webhooks/stripe/route');
const { reconcilePendingFulfillments } = await import('@/lib/stripe-fulfillment');

const SECRET = 'whsec_test_recovery';
const CREDITS_NOTES = 'Renovation Credits (starter-40)';

function addCreditsOrder(over: Partial<Row> = {}): Row {
  const o: Row = { id: 'ord-1', userId: 'user-1', status: 'PENDING', total: 21.47, notes: CREDITS_NOTES, stripeCheckoutSessionId: 'cs_1', ...over };
  s.orders.set(o.id, o);
  return o;
}
function addInvoice(over: Partial<Row> = {}): Row {
  const i: Row = { id: 'inv-1', projectId: 'proj-1', stage: 'DEPOSIT', status: 'SENT', total: 500, ...over };
  s.invoices.set(i.id, i);
  return i;
}

function sessionEvent(session: Record<string, unknown>, id = 'evt_1'): Request {
  const body = JSON.stringify({
    id,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', object: 'checkout.session', payment_status: 'paid', currency: 'cad', payment_intent: 'pi_1', ...session } },
  });
  s.signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body });
}
const creditsEvent = (over: Record<string, unknown> = {}) =>
  sessionEvent({ amount_total: 2147, metadata: { orderId: 'ord-1', userId: 'user-1', kind: 'renovation-credits', credits: '40', pack: 'starter-40' }, ...over });
const invoiceEvent = (over: Record<string, unknown> = {}) =>
  sessionEvent({ id: 'cs_inv', amount_total: 50000, metadata: { invoiceId: 'inv-1', projectId: 'proj-1', userId: 'user-1' }, ...over });

const grants = () => [...s.txns.values()].filter((t) => t.type === 'GRANT');

beforeEach(() => {
  s.orders.clear();
  s.invoices = new Map();
  s.payments.length = 0;
  s.cases.length = 0;
  s.wallets = new Map();
  s.txns = new Map();
  s.funnel.length = 0;
  s.lock = Promise.resolve();
  s.fail = { orderClaim: 0, grant: 0, invoiceTx: 0, paymentCreate: 0 };
  s.signature = null;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('signature', () => {
  it('rejects a forged signature and changes nothing', async () => {
    addCreditsOrder();
    const req = creditsEvent();
    s.signature = 't=1,v1=deadbeef';
    expect((await webhook.POST(req)).status).toBe(400);
    expect(s.orders.get('ord-1')!.status).toBe('PENDING');
    expect(grants()).toHaveLength(0);
  });
  it('rejects a missing signature', async () => {
    s.signature = null;
    expect((await webhook.POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }))).status).toBe(400);
  });
});

describe('credits order', () => {
  it('valid event: order paid, credits granted once, order FULFILLED', async () => {
    addCreditsOrder();
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect(s.orders.get('ord-1')!.status).toBe('FULFILLED');
    expect(s.wallets.get('user-1')!.balance).toBe(40);
    expect(grants()).toHaveLength(1);
  });

  it('database failure before payment state persists: 5xx so Stripe redelivers, then completes', async () => {
    addCreditsOrder();
    s.fail.orderClaim = 1;
    expect((await webhook.POST(creditsEvent())).status).toBe(500);
    expect(s.orders.get('ord-1')!.status).toBe('PENDING');
    expect(grants()).toHaveLength(0);
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect(s.orders.get('ord-1')!.status).toBe('FULFILLED');
    expect(grants()).toHaveLength(1);
  });

  it('paid but grant fails: 5xx, order stays PAID (pending, queryable), redelivery grants exactly once', async () => {
    addCreditsOrder();
    s.fail.grant = 1;
    expect((await webhook.POST(creditsEvent())).status).toBe(500);
    expect(s.orders.get('ord-1')!.status).toBe('PAID');
    expect(grants()).toHaveLength(0);
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect(s.orders.get('ord-1')!.status).toBe('FULFILLED');
    expect(s.wallets.get('user-1')!.balance).toBe(40);
    expect(grants()).toHaveLength(1);
  });

  it('paid but grant fails: the reconcile sweep finishes it without any redelivery', async () => {
    addCreditsOrder();
    s.fail.grant = 1;
    await webhook.POST(creditsEvent());
    const summary = await reconcilePendingFulfillments({ olderThanMs: -1000 });
    expect(summary).toEqual({ examined: 1, fulfilled: 1, failed: 0 });
    expect(s.orders.get('ord-1')!.status).toBe('FULFILLED');
    expect(grants()).toHaveLength(1);
  });

  it('reconcile reports (not hides) a grant that keeps failing', async () => {
    addCreditsOrder();
    s.fail.grant = 2;
    await webhook.POST(creditsEvent());
    const summary = await reconcilePendingFulfillments({ olderThanMs: -1000 });
    expect(summary.failed).toBe(1);
    expect(s.orders.get('ord-1')!.status).toBe('PAID');
  });

  it('duplicate delivery and repeated handling after completion grant nothing more', async () => {
    addCreditsOrder();
    await webhook.POST(creditsEvent());
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect(grants()).toHaveLength(1);
    expect(s.wallets.get('user-1')!.balance).toBe(40);
  });

  it('concurrent deliveries grant exactly once', async () => {
    addCreditsOrder();
    const results = await Promise.all([webhook.POST(creditsEvent()), webhook.POST(creditsEvent()), webhook.POST(creditsEvent())]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(grants()).toHaveLength(1);
    expect(s.wallets.get('user-1')!.balance).toBe(40);
  });

  it('credits come from the server pack, not from forged metadata', async () => {
    addCreditsOrder();
    await webhook.POST(creditsEvent({ metadata: { orderId: 'ord-1', userId: 'user-1', kind: 'renovation-credits', credits: '99999' } }));
    expect(s.wallets.get('user-1')!.balance).toBe(40);
  });

  it.each([
    ['wrong amount', { amount_total: 100 }],
    ['wrong currency', { currency: 'usd' }],
    ['unpaid session', { payment_status: 'unpaid' }],
    ['different checkout session', { id: 'cs_other' }],
    ['different user', { metadata: { orderId: 'ord-1', userId: 'someone-else' } }],
  ])('%s: acknowledged but never marks paid or grants', async (_name, over) => {
    addCreditsOrder();
    expect((await webhook.POST(creditsEvent(over))).status).toBe(200);
    expect(s.orders.get('ord-1')!.status).toBe('PENDING');
    expect(grants()).toHaveLength(0);
  });

  it('unknown order is acknowledged (redelivery cannot help) and loudly logged', async () => {
    expect((await webhook.POST(creditsEvent())).status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('stripe_fulfillment.rejected'));
  });
});

describe('other paid orders', () => {
  it('a non-credit order is marked PAID (so its submit route unlocks) and not FULFILLED', async () => {
    addCreditsOrder({ notes: 'Well-Installed Quote Review (Standard)', total: 100 });
    await webhook.POST(creditsEvent({ amount_total: 10000, metadata: { orderId: 'ord-1', userId: 'user-1', kind: 'well-installed-review' } }));
    expect(s.orders.get('ord-1')!.status).toBe('PAID');
    expect(grants()).toHaveLength(0);
  });
});

describe('invoice', () => {
  it('a valid late payment on a VOID invoice never reopens it: Payment recorded, case opened once, no funnel event', async () => {
    addInvoice({ status: 'VOID' });
    expect((await webhook.POST(invoiceEvent())).status).toBe(200);
    expect((await webhook.POST(invoiceEvent())).status).toBe(200);
    expect(s.invoices.get('inv-1')!.status).toBe('VOID');
    expect(s.invoices.get('inv-1')!.paidAt).toBeUndefined();
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0]).toMatchObject({ status: 'COMPLETED', stripePaymentIntentId: 'pi_1', amount: 500 });
    expect(s.cases).toHaveLength(1);
    expect(s.cases[0]).toMatchObject({ kind: 'LATE_PAYMENT_VOID_INVOICE', idempotencyKey: 'late-void:pi_1', invoiceId: 'inv-1' });
    expect(s.funnel).toHaveLength(0);
  });

  it('valid event: invoice PAID, one Payment, one deposit funnel event', async () => {
    addInvoice();
    expect((await webhook.POST(invoiceEvent())).status).toBe(200);
    expect(s.invoices.get('inv-1')!.status).toBe('PAID');
    expect(s.payments).toHaveLength(1);
    expect(s.payments[0]!.amount).toBe(500);
    expect(s.funnel).toHaveLength(1);
  });

  it('Payment insert fails: whole transaction rolls back, 5xx, redelivery completes both', async () => {
    addInvoice();
    s.fail.paymentCreate = 1;
    expect((await webhook.POST(invoiceEvent())).status).toBe(500);
    expect(s.invoices.get('inv-1')!.status).toBe('SENT');
    expect(s.payments).toHaveLength(0);
    expect((await webhook.POST(invoiceEvent())).status).toBe(200);
    expect(s.invoices.get('inv-1')!.status).toBe('PAID');
    expect(s.payments).toHaveLength(1);
  });

  it('database failure before anything persists: 5xx, then recovers', async () => {
    addInvoice();
    s.fail.invoiceTx = 1;
    expect((await webhook.POST(invoiceEvent())).status).toBe(500);
    expect((await webhook.POST(invoiceEvent())).status).toBe(200);
    expect(s.payments).toHaveLength(1);
  });

  it('repairs an invoice a previous version left PAID with no Payment row', async () => {
    addInvoice({ status: 'PAID' });
    await webhook.POST(invoiceEvent());
    expect(s.payments).toHaveLength(1);
    expect(s.funnel).toHaveLength(0); // not the delivery that flipped it
  });

  it('duplicate and concurrent deliveries create one Payment and one funnel event', async () => {
    addInvoice();
    await Promise.all([webhook.POST(invoiceEvent()), webhook.POST(invoiceEvent()), webhook.POST(invoiceEvent())]);
    await webhook.POST(invoiceEvent());
    expect(s.payments).toHaveLength(1);
    expect(s.funnel).toHaveLength(1);
  });

  it('wrong amount is rejected without marking the invoice paid', async () => {
    addInvoice();
    expect((await webhook.POST(invoiceEvent({ amount_total: 100 }))).status).toBe(200);
    expect(s.invoices.get('inv-1')!.status).toBe('SENT');
    expect(s.payments).toHaveLength(0);
  });
});
