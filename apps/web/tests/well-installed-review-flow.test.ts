/**
 * The paid Well-Installed Quote Review, end to end through its real route
 * handlers: checkout -> (Stripe webhook marks PAID) -> submit -> compose
 * preview -> publish -> customer report lookup.
 *
 * Only the edges are faked: Prisma (an in-memory Order/User table), Stripe,
 * the email sender, auth() and the PDF storage backend. compose(), the risk
 * rules, the comparison, the PDF render and the Order.notes markers all run
 * for real — the PDF buffer that storage receives is checked to be a PDF.
 *
 * The existing Stripe webhook is NOT exercised here and not re-implemented:
 * the test sets status PAID the way that unmodified handler does from
 * `metadata.orderId`, and asserts checkout put the order id there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCriteria } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import type { Finding, QuoteEntry } from '@/lib/quote-intelligence/types';

type User = { id: string; email: string; name: string | null };
type Order = {
  id: string;
  userId: string;
  status: string;
  subtotal: number;
  taxRate: number;
  total: number;
  notes: string | null;
  stripeCheckoutSessionId?: string;
};

const state = vi.hoisted(() => ({
  users: new Map<string, User>(),
  orders: new Map<string, Order>(),
  session: null as null | { user: { role: string } },
  stripeCalls: [] as Array<Record<string, unknown>>,
  emails: [] as Array<{ to: string; subject: string; html: string; attachments?: unknown[]; idempotencyKey?: string }>,
  stored: [] as Array<{ filename: string; buffer: Buffer }>,
  failNextEmail: false,
  emailGate: null as null | Promise<void>,
  failFulfilWrites: 0,
  failNotifiedWrites: 0,
  failReportWrites: 0,
}));

vi.mock('@/lib/db', () => {
  const withUser = (o: Order | undefined, include?: { user?: boolean }) =>
    o ? (include?.user ? { ...o, user: [...state.users.values()].find((u) => u.id === o.userId)! } : { ...o }) : null;
  return {
    db: {
      settings: { findFirst: async () => ({ defaultTaxRate: 13 }) },
      user: {
        upsert: async ({ where, create }: { where: { email: string }; create: { email: string; name: string } }) => {
          const existing = state.users.get(where.email);
          if (existing) return existing;
          const u = { id: `user-${state.users.size + 1}`, ...create };
          state.users.set(where.email, u);
          return u;
        },
      },
      order: {
        create: async ({ data }: { data: Omit<Order, 'id'> & { items: unknown } }) => {
          const { items: _items, ...rest } = data;
          const id = crypto.randomUUID();
          const o = { id, ...rest } as Order;
          state.orders.set(id, o);
          return { ...o };
        },
        findUnique: async ({ where, include }: { where: { id: string }; include?: { user?: boolean } }) =>
          withUser(state.orders.get(where.id), include),
        updateMany: async ({ where, data }: { where: { id: string; status?: string; notes?: string | null }; data: Partial<Order> }) => {
          const o = state.orders.get(where.id);
          // Check-and-set with no await between, like a single-statement UPDATE.
          if (!o || (where.status !== undefined && o.status !== where.status) || (where.notes !== undefined && o.notes !== where.notes)) {
            return { count: 0 };
          }
          if (data.status === 'FULFILLED' && state.failFulfilWrites > 0) {
            state.failFulfilWrites--;
            throw new Error('db down');
          }
          if (typeof data.notes === 'string' && data.notes.includes('REPORT_NOTIFIED:') && state.failNotifiedWrites > 0) {
            state.failNotifiedWrites--;
            throw new Error('db down');
          }
          if (typeof data.notes === 'string' && data.notes.includes('QI_REPORT:') && state.failReportWrites > 0) {
            state.failReportWrites--;
            throw new Error('db down');
          }
          Object.assign(o, data);
          return { count: 1 };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Order> }) => {
          const o = state.orders.get(where.id)!;
          Object.assign(o, data);
          return { ...o };
        },
      },
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
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmail: async (msg: { to: string; subject: string; html: string; attachments?: unknown[]; idempotencyKey?: string }) => {
    if (state.emailGate) await state.emailGate;
    if (state.failNextEmail) {
      state.failNextEmail = false;
      throw new Error('smtp down');
    }
    state.emails.push(msg);
  },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => state.session }));

vi.mock('@/content/constants/paid-review-product', async () => {
  const actual = await vi.importActual<typeof import('@/content/constants/paid-review-product')>('@/content/constants/paid-review-product');
  return {
    ...actual,
    WELL_INSTALLED_REVIEW_PRODUCT: { ...actual.WELL_INSTALLED_REVIEW_PRODUCT, priceConfirmed: true },
  };
});


vi.mock('@/lib/pdf/storage', () => ({
  storePdf: async (buffer: Buffer, filename: string) => {
    state.stored.push({ filename, buffer });
    return `https://blob.test/${filename}`;
  },
}));

const checkout = await import('@/app/api/well-installed-review/checkout/route');
const submit = await import('@/app/api/well-installed-review/submit/route');
const composeRoute = await import('@/app/api/quote-intelligence/compose/route');
const publish = await import('@/app/api/quote-intelligence/publish/route');
const reportApi = await import('@/app/api/quote-intelligence/report/route');

let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    body: JSON.stringify(body),
  });
}

const stated = (excerpt: string, page = 1): Finding => ({ status: 'verified', evidence: { page, excerpt } });

function quote(label: string, silentScope: string[] = []): QuoteEntry {
  return {
    label,
    statedTotal: 9000,
    statedAreaSqFt: 750,
    criteria: Object.fromEntries(allCriteria().map((c) => [c.id, stated('Stated on the quote.', 2)])),
    scope: Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, silentScope.includes(s.id) ? { status: 'not_specified' } : stated('Listed in the scope.', 1)])),
  };
}

const removal = SCOPE_ITEMS.find((s) => s.changesScope)!.id;

async function paidOrder(tier: 'standard' | 'rush' = 'rush') {
  const res = await checkout.POST(jsonPost('http://localhost/api/well-installed-review/checkout', { name: 'Jane Homeowner', email: 'Jane@Example.com', tier }));
  expect(res.status).toBe(200);
  const orderId = state.stripeCalls.at(-1)!.metadata as { orderId: string };
  // What the existing, unmodified /api/webhooks/stripe does on checkout.session.completed.
  state.orders.get(orderId.orderId)!.status = 'PAID';
  return orderId.orderId;
}

async function submitDocs(orderId: string, email = 'jane@example.com') {
  const form = new FormData();
  form.set('orderId', orderId);
  form.set('email', email);
  form.append('documents', new File([new TextEncoder().encode('%PDF-1.7\n%quote')], 'quote-a.pdf', { type: 'application/pdf' }));
  form.append('documents', new File([new TextEncoder().encode('%PDF-1.7\n%quote')], 'quote-b.pdf', { type: 'application/pdf' }));
  return submit.POST(new Request('http://localhost/api/well-installed-review/submit', { method: 'POST', body: form, headers: { 'x-forwarded-for': nextIp() } }));
}

const workbenchBody = (orderId: string) => ({
  orderId,
  quotes: [quote('Quote A'), quote('Quote B', [removal])],
  present: 'Both name the species, grade and width, and the area.',
  missing: 'Quote B does not say whether removal is included.',
  askInWriting: 'Please confirm the start date in writing.',
});

let logs: string[] = [];

beforeEach(() => {
  state.users.clear();
  state.orders.clear();
  state.stripeCalls.length = 0;
  state.emails.length = 0;
  state.stored.length = 0;
  state.session = null;
  state.failNextEmail = false;
  state.emailGate = null;
  state.failFulfilWrites = 0;
  state.failNotifiedWrites = 0;
  state.failReportWrites = 0;
  logs = [];
  vi.spyOn(console, 'info').mockImplementation((line: unknown) => {
    logs.push(String(line));
  });
});

afterEach(() => vi.restoreAllMocks());

const events = () => logs.map((l) => JSON.parse(l) as Record<string, unknown>);

describe('checkout', () => {
  it('prices from REVIEW_TIERS server-side, tags metadata.orderId for the existing webhook, and logs the event', async () => {
    const res = await checkout.POST(jsonPost('http://localhost/api/well-installed-review/checkout', { name: 'Jane', email: 'jane@example.com', tier: 'rush', priceCad: 1 }));
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/cs_test_1' });

    const call = state.stripeCalls[0] as { line_items: Array<{ price_data: { unit_amount: number } }>; metadata: Record<string, string> };
    expect(call.line_items[0].price_data.unit_amount).toBe(24900);
    expect(call.line_items[1].price_data.unit_amount).toBe(3237); // 13% HST on 249.00
    const order = state.orders.get(call.metadata.orderId)!;
    expect(order).toMatchObject({ status: 'PENDING', total: 281.37, notes: 'Well-Installed Quote Review (Rush)', stripeCheckoutSessionId: 'cs_test_1' });
    expect(call.metadata.kind).toBe('well-installed-review');

    expect(events()).toEqual([expect.objectContaining({ event: 'well_installed_review.checkout_created', orderId: order.id, tier: 'rush', subtotalCad: 249 })]);
    expect(logs.join()).not.toMatch(/jane/i);
  });

  it('rejects a foreign origin', async () => {
    const req = new Request('http://localhost/api/well-installed-review/checkout', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Jane', email: 'jane@example.com' }),
    });
    expect((await checkout.POST(req)).status).toBe(403);
    expect(state.orders.size).toBe(0);
  });
});

describe('submit', () => {
  it('refuses an unpaid order', async () => {
    await checkout.POST(jsonPost('http://localhost/api/well-installed-review/checkout', { name: 'Jane', email: 'jane@example.com' }));
    const orderId = (state.stripeCalls[0].metadata as { orderId: string }).orderId;
    expect((await submitDocs(orderId)).status).toBe(409);
    expect(state.emails).toHaveLength(0);
  });

  it('refuses the wrong email, then accepts the paying one once', async () => {
    const orderId = await paidOrder();
    expect((await submitDocs(orderId, 'someone@else.com')).status).toBe(409);

    const ok = await submitDocs(orderId);
    expect(ok.status).toBe(201);
    expect(state.emails).toHaveLength(1);
    expect(state.emails[0].attachments).toHaveLength(2);
    expect(state.orders.get(orderId)!.status).toBe('FULFILLED');
    expect(events().at(-1)).toMatchObject({ event: 'well_installed_review.documents_received', orderId, tier: 'rush', documentCount: 2 });

    expect((await submitDocs(orderId)).status).toBe(409);
    expect(state.emails).toHaveLength(1);
  });
});

describe('submit — product binding', () => {
  it.each([
    ['listing floor report', 'Listing Floor Report (photo)'],
    ['personal floor plan', 'Personal Floor Plan\nFP_DESIGN:abc'],
    ['renovation credits', 'Renovation Credits (starter-40)'],
    ['unknown tier', 'Well-Installed Quote Review (Platinum)'],
  ])('a PAID %s order with the right id and email is rejected: no email, order untouched', async (_n, notes) => {
    const orderId = await paidOrder();
    state.orders.get(orderId)!.notes = notes;
    const before = { ...state.orders.get(orderId)! };

    const res = await submitDocs(orderId);
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('We could not find that order.');
    expect(state.emails).toHaveLength(0);
    expect(state.orders.get(orderId)).toEqual(before);
    expect(events().filter((e) => e.event === 'well_installed_review.documents_received')).toHaveLength(0);
  });

  it('a missing order is rejected with the same answer as a wrong product', async () => {
    const res = await submitDocs(crypto.randomUUID());
    expect(res.status).toBe(404);
    expect(state.emails).toHaveLength(0);
  });

  it('a genuine Standard order still submits and is fulfilled', async () => {
    const orderId = await paidOrder('standard');
    expect((await submitDocs(orderId)).status).toBe(201);
    expect(state.emails).toHaveLength(1);
    expect(state.orders.get(orderId)!.status).toBe('FULFILLED');
    expect(events().at(-1)).toMatchObject({ tier: 'standard' });
  });

  it('an email-send failure leaves a genuine order PAID so the customer can retry', async () => {
    const orderId = await paidOrder();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failNextEmail = true;
    expect((await submitDocs(orderId)).status).toBe(500);
    expect(state.orders.get(orderId)!.status).toBe('PAID');
    expect((await submitDocs(orderId)).status).toBe(201);
    expect(state.emails).toHaveLength(1);
  });
});

describe('submit — concurrency and recovery', () => {
  it('two simultaneous valid submissions send exactly one email', async () => {
    const orderId = await paidOrder();
    let open!: () => void;
    state.emailGate = new Promise<void>((r) => (open = r));
    const first = submitDocs(orderId);
    const second = submitDocs(orderId);
    await new Promise((r) => setTimeout(r, 20));
    open();
    const statuses = (await Promise.all([first, second])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(state.emails).toHaveLength(1);
    expect(state.orders.get(orderId)!.status).toBe('FULFILLED');
  });

  it('many simultaneous submissions still send one', async () => {
    const orderId = await paidOrder();
    const results = await Promise.all(Array.from({ length: 8 }, () => submitDocs(orderId)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(state.emails).toHaveLength(1);
  });

  it('a request that is in flight is answered "in progress", not "already received"', async () => {
    const orderId = await paidOrder();
    let open!: () => void;
    state.emailGate = new Promise<void>((r) => (open = r));
    const first = submitDocs(orderId);
    await new Promise((r) => setTimeout(r, 20));
    const second = await submitDocs(orderId);
    expect(second.status).toBe(409);
    expect((await second.json()).message).toMatch(/already processing/);
    open();
    expect((await first).status).toBe(201);
  });

  it('a failed email releases the claim and the notes keep only the tier line', async () => {
    const orderId = await paidOrder();
    const tierLine = state.orders.get(orderId)!.notes;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failNextEmail = true;
    expect((await submitDocs(orderId)).status).toBe(500);
    expect(state.orders.get(orderId)!.notes).toBe(tierLine);
    expect((await submitDocs(orderId)).status).toBe(201);
    expect(state.emails).toHaveLength(1);
  });

  it('a request that died mid-send is recoverable once its lease expires, and not before', async () => {
    const orderId = await paidOrder();
    const order = state.orders.get(orderId)!;
    const { withIntakeClaim, INTAKE_LEASE_MS } = await import('@/lib/quote-intelligence/notes');
    order.notes = withIntakeClaim(order.notes, crypto.randomUUID(), Date.now()); // crashed holder, fresh lease
    expect((await submitDocs(orderId)).status).toBe(409);
    expect(state.emails).toHaveLength(0);

    order.notes = withIntakeClaim(order.notes, crypto.randomUUID(), Date.now() - INTAKE_LEASE_MS - 1);
    expect((await submitDocs(orderId)).status).toBe(201);
    expect(state.emails).toHaveLength(1);
    expect(order.notes).not.toMatch(/QI_INTAKE_CLAIM/);
  });

  it('email sent but the FULFILLED write fails: customer is told received, no second email on the next click while the lease holds', async () => {
    const orderId = await paidOrder();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failFulfilWrites = 3;
    const res = await submitDocs(orderId);
    expect(res.status).toBe(201);
    expect(state.emails).toHaveLength(1);
    expect(state.orders.get(orderId)!.status).toBe('PAID');
    expect(err.mock.calls.some((c) => String(c[0]).includes('fulfil_write_failed'))).toBe(true);
    expect((await submitDocs(orderId)).status).toBe(409);
    expect(state.emails).toHaveLength(1);
  });

  it('a transient FULFILLED-write failure is retried and the order completes', async () => {
    const orderId = await paidOrder();
    state.failFulfilWrites = 1;
    expect((await submitDocs(orderId)).status).toBe(201);
    expect(state.orders.get(orderId)!.status).toBe('FULFILLED');
    expect(state.orders.get(orderId)!.notes).not.toMatch(/QI_INTAKE_CLAIM/);
  });

  it('every email carries a submission id so a duplicate is recognisable', async () => {
    const orderId = await paidOrder();
    await submitDocs(orderId);
    expect(state.emails[0].html).toMatch(/Submission<\/td><td[^>]*><strong>[0-9a-f-]{36}</);
  });
});

describe('compose (preview) and publish — ADMIN only', () => {
  it('refuses a non-admin without touching the order', async () => {
    const orderId = await paidOrder();
    state.session = { user: { role: 'CUSTOMER' } };
    expect((await composeRoute.POST(jsonPost('http://localhost/api/quote-intelligence/compose', workbenchBody(orderId)))).status).toBe(401);
    expect((await publish.POST(jsonPost('http://localhost/api/quote-intelligence/publish', workbenchBody(orderId)))).status).toBe(401);
    expect(state.stored).toHaveLength(0);
  });

  it('returns 400 with a message for a malformed body, 404 for an order that is not this product', async () => {
    state.session = { user: { role: 'ADMIN' } };
    const bad = await composeRoute.POST(jsonPost('http://localhost/api/quote-intelligence/compose', { orderId: crypto.randomUUID(), quotes: [{ label: 7 }] }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/Malformed request/);

    const orderId = await paidOrder();
    state.orders.get(orderId)!.notes = 'Shop order';
    expect((await composeRoute.POST(jsonPost('http://localhost/api/quote-intelligence/compose', workbenchBody(orderId)))).status).toBe(404);
  });

  it('previews a two-quote read: comparison, flags and questions, without writing anything', async () => {
    const orderId = await paidOrder();
    state.session = { user: { role: 'ADMIN' } };
    const res = await composeRoute.POST(jsonPost('http://localhost/api/quote-intelligence/compose', workbenchBody(orderId)));
    expect(res.status).toBe(200);
    const { report } = await res.json();
    expect(report.tier).toBe('Rush');
    expect(report.quotes).toHaveLength(2);
    expect(report.comparison.verdict).toBe('not-comparable');
    expect(report.generalRiskFlags[0]).toMatchObject({ level: 'high' });
    expect(report.quotes[1].questionsToAsk.some((q: { source: string }) => q.source === 'comparison')).toBe(true);
    expect(state.orders.get(orderId)!.notes).toBe('Well-Installed Quote Review (Rush)');
    expect(state.stored).toHaveLength(0);
  });

  it('returns the estimator-readable errors from compose(), e.g. a price typed into free text', async () => {
    const orderId = await paidOrder();
    state.session = { user: { role: 'ADMIN' } };
    const res = await composeRoute.POST(jsonPost('http://localhost/api/quote-intelligence/compose', { ...workbenchBody(orderId), missing: 'Removal typically costs $2 per sq ft.' }));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.join(' ')).toMatch(/dollar figure/);
  });

  it('publishes once: real PDF stored, tier line preserved, customer emailed, event logged; a second publish is a no-op', async () => {
    const orderId = await paidOrder();
    await submitDocs(orderId);
    state.session = { user: { role: 'ADMIN' } };

    const res = await publish.POST(jsonPost('http://localhost/api/quote-intelligence/publish', workbenchBody(orderId)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyPublished).toBe(false);

    expect(state.stored).toHaveLength(1);
    expect(state.stored[0].buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const notes = state.orders.get(orderId)!.notes!;
    expect(notes.startsWith('Well-Installed Quote Review (Rush)\nQI_REPORT:https://blob.test/')).toBe(true);

    const customerEmail = state.emails.at(-1)!;
    expect(customerEmail.to).toBe('jane@example.com');
    expect(customerEmail.html).toContain(`/well-installed-review/report?order=${orderId}`);

    const published = events().filter((e) => e.event === 'well_installed_review.report_published');
    expect(published).toEqual([expect.objectContaining({ orderId, tier: 'rush', quoteCount: 2, comparisonVerdict: 'not-comparable', alreadyPublished: false })]);
    expect(Number(published[0].highRiskFlags)).toBeGreaterThanOrEqual(1);

    const again = await publish.POST(jsonPost('http://localhost/api/quote-intelligence/publish', workbenchBody(orderId)));
    expect(await again.json()).toEqual({ url: body.url, alreadyPublished: true, notified: true });
    expect(state.stored).toHaveLength(1);
    expect(state.emails.filter((e) => e.to === 'jane@example.com')).toHaveLength(1);
  });
});

describe('publish — recovery, concurrency and eligibility', () => {
  const publishPost = (body: unknown) => publish.POST(jsonPost('http://localhost/api/quote-intelligence/publish', body));
  const customerEmails = () => state.emails.filter((e) => e.to === 'jane@example.com');

  async function submitted() {
    const orderId = await paidOrder();
    await submitDocs(orderId);
    state.session = { user: { role: 'ADMIN' } };
    return orderId;
  }

  it('refuses an order whose customer has not submitted documents, and an unpaid one: nothing stored or sent', async () => {
    const orderId = await paidOrder();
    state.session = { user: { role: 'ADMIN' } };
    const res = await publishPost(workbenchBody(orderId));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/not submitted/);

    state.orders.get(orderId)!.status = 'PENDING';
    expect((await publishPost(workbenchBody(orderId))).status).toBe(409);
    expect(state.stored).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
  });

  it('two simultaneous publishes store one PDF and send one email', async () => {
    const orderId = await submitted();
    let open!: () => void;
    state.emailGate = new Promise<void>((r) => (open = r));
    const a = publishPost(workbenchBody(orderId));
    const b = publishPost(workbenchBody(orderId));
    await new Promise((r) => setTimeout(r, 30));
    open();
    const statuses = (await Promise.all([a, b])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(state.stored).toHaveLength(1);
    expect(customerEmails()).toHaveLength(1);
  });

  it('a failed customer email keeps the report, shows notified:false, and a retry sends only the email with the same key', async () => {
    const orderId = await submitted();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failNextEmail = true;
    const first = await publishPost(workbenchBody(orderId));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody).toMatchObject({ alreadyPublished: false, notified: false });
    expect(firstBody.notificationError).toMatch(/did not send/);
    expect(state.orders.get(orderId)!.notes).toMatch(/QI_REPORT:/);
    expect(state.orders.get(orderId)!.notes).not.toMatch(/REPORT_NOTIFIED|PUBLISH_CLAIM/);

    const retry = await publishPost({ orderId }); // no form body needed once the report is stored
    expect(await retry.json()).toEqual({ url: firstBody.url, alreadyPublished: true, notified: true });
    expect(state.stored).toHaveLength(1);
    expect(customerEmails()).toHaveLength(1);
    expect(customerEmails()[0].idempotencyKey).toBe(`report-delivery/${orderId}/v1`);
    expect(state.orders.get(orderId)!.notes).toMatch(/REPORT_NOTIFIED:/);

    await publishPost({ orderId });
    expect(customerEmails()).toHaveLength(1);
  });

  it('provider accepted but the NOTIFIED write failed: a retry re-sends with the identical key and payload, then settles', async () => {
    const orderId = await submitted();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failNotifiedWrites = 3;
    const first = await publishPost(workbenchBody(orderId));
    expect((await first.json()).notified).toBe(true);
    expect(customerEmails()).toHaveLength(1);
    expect(state.orders.get(orderId)!.notes).not.toMatch(/REPORT_NOTIFIED|PUBLISH_CLAIM/);

    await publishPost({ orderId });
    expect(customerEmails()).toHaveLength(2);
    expect(customerEmails()[1].idempotencyKey).toBe(customerEmails()[0].idempotencyKey);
    expect(customerEmails()[1].html).toBe(customerEmails()[0].html);
    expect(state.stored).toHaveLength(1);

    await publishPost({ orderId });
    expect(customerEmails()).toHaveLength(2);
  });

  it('a crashed publisher (live claim, no URL) blocks others until the lease expires, then recovers', async () => {
    const orderId = await submitted();
    const order = state.orders.get(orderId)!;
    const { withPublishClaim, PUBLISH_LEASE_MS } = await import('@/lib/report-delivery');
    order.notes = withPublishClaim(order.notes, crypto.randomUUID(), Date.now());
    expect((await publishPost(workbenchBody(orderId))).status).toBe(409);
    expect(state.stored).toHaveLength(0);

    order.notes = withPublishClaim(order.notes, crypto.randomUUID(), Date.now() - PUBLISH_LEASE_MS - 1);
    expect((await publishPost(workbenchBody(orderId))).status).toBe(200);
    expect(state.stored).toHaveLength(1);
    expect(order.notes).not.toMatch(/PUBLISH_CLAIM/);
  });

  it('a failed URL write after the PDF was stored releases the claim so the admin can retry', async () => {
    const orderId = await submitted();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.failReportWrites = 1;
    expect((await publishPost(workbenchBody(orderId))).status).toBe(500);
    expect(state.orders.get(orderId)!.notes).not.toMatch(/QI_REPORT|PUBLISH_CLAIM/);
    expect(customerEmails()).toHaveLength(0);
    expect((await publishPost(workbenchBody(orderId))).status).toBe(200);
    expect(customerEmails()).toHaveLength(1);
  });
});

describe('customer report lookup', () => {
  it('needs the paying email, says "not yet" before publish, and returns the URL after', async () => {
    const orderId = await paidOrder('standard');
    await submitDocs(orderId);
    const get = (email: string) => reportApi.GET(new Request(`http://localhost/api/quote-intelligence/report?order=${orderId}&email=${encodeURIComponent(email)}`));

    expect((await get('someone@else.com')).status).toBe(403);
    expect(await (await get('JANE@example.com')).json()).toEqual({ published: false, sla: 'Written reply within 1 business day' });

    state.session = { user: { role: 'ADMIN' } };
    const { url } = await (await publish.POST(jsonPost('http://localhost/api/quote-intelligence/publish', workbenchBody(orderId)))).json();
    expect(await (await get('jane@example.com')).json()).toEqual({ published: true, url });
  });
});
