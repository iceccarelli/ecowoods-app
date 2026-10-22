/**
 * Authorization of every commercial mutation: server actions and admin API routes.
 *
 * The database is a trap: any query made before the role check fails the test,
 * so "unauthorized" is proven to short-circuit BEFORE touching data, not just to
 * return an error afterwards. The action lists are exhaustive on purpose — a new
 * export from lib/actions/* that is neither listed as admin-only nor as
 * deliberately public fails the first test, so a mutation cannot be added
 * without a decision about who may call it.
 */
import { describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: string; email: string } } }));

vi.mock('@/lib/auth', () => ({ auth: async () => session.current, signOut: async () => undefined }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/email', () => ({ sendEmail: async () => undefined, sendInvoiceEmail: async () => undefined }));
vi.mock('@/lib/ai', () => ({ generateInquiryReply: async () => 'draft' }));
vi.mock('@/lib/review-request', () => ({ requestReviewForProject: async () => undefined }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined, recordFunnelEventOnce: async () => undefined, recordQuoteAccepted: async () => undefined }));
vi.mock('@/lib/floor-graph/prediction', () => ({
  recordPrediction: async () => undefined,
  closePrediction: async () => undefined,
  accuracySummary: async () => ({}),
}));
vi.mock('@/lib/db', () => {
  const trap = (path: string): unknown =>
    new Proxy(function () {}, {
      get: (_t, prop) => trap(`${path}.${String(prop)}`),
      apply: () => {
        throw new Error(`DB TOUCHED BEFORE AUTH CHECK: ${path}`);
      },
    });
  return { db: trap('db') };
});

const ADMIN_ONLY: Record<string, string[]> = {
  '@/lib/actions/invoices': [
    'createInvoice', 'issueInvoice', 'markInvoicePaid', 'generateStagedInvoices',
    'updateInvoiceStatus', 'resendInvoice', 'reissueInvoice',
  ],
  '@/lib/actions/quotes': ['saveEstimate', 'sendEstimateEmail', 'updateQuoteStatus', 'convertQuoteToProject'],
  '@/lib/actions/projects': [
    'createProject', 'updateProjectStatus', 'updateContractPdf', 'addProjectNote', 'sendContractToCustomer', 'updateProject',
  ],
  '@/lib/actions/orders': ['updateOrderStatus'],
  '@/lib/actions/payment-cases': ['resolvePaymentCase'],
  '@/lib/actions/inquiries': ['draftInquiryReply', 'replyToInquiry', 'closeInquiry', 'updateInquiryStatus', 'updateSettings'],
};

/** Deliberately callable by non-admins (each does its own check or is a public form). */
const PUBLIC_OR_OWNER: Record<string, string[]> = {
  '@/lib/actions/invoices': ['reportBankPayment'], // login + invoice-owner check
  '@/lib/actions/quotes': ['submitQuoteRequest'], // public quote form
  '@/lib/actions/projects': [],
  '@/lib/actions/orders': [],
  '@/lib/actions/payment-cases': [],
  '@/lib/actions/inquiries': ['submitInquiry'], // public contact form
};

describe('server actions: role check precedes any data access', () => {
  for (const [mod, names] of Object.entries(ADMIN_ONLY)) {
    it(`${mod}: every export is classified`, async () => {
      const exported = Object.keys(await import(/* @vite-ignore */ mod)).sort();
      const classified = [...names, ...PUBLIC_OR_OWNER[mod]!].sort();
      expect(exported).toEqual(classified);
    });

    for (const name of names) {
      for (const [label, s] of [
        ['anonymous', null],
        ['customer', { user: { id: 'u1', role: 'USER', email: 'c@example.test' } }],
      ] as const) {
        it(`${mod}.${name} rejects ${label} before touching the database`, async () => {
          session.current = s;
          const fn = (await import(/* @vite-ignore */ mod))[name] as (...a: unknown[]) => Promise<unknown>;
          await expect(fn('id', 'x', 'y', 'z')).rejects.toThrow('Unauthorized');
        });
      }
    }
  }

  it('reportBankPayment requires a login', async () => {
    session.current = null;
    const { reportBankPayment } = await import('@/lib/actions/invoices');
    await expect(reportBankPayment('inv', 'ref')).rejects.toThrow('Must be logged in');
  });
});

describe('admin API routes reject anonymous and customer callers', () => {
  const ctx = { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000000' }) };
  const post = (url: string, body: unknown = {}) =>
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  const cases: Array<[string, () => Promise<Response>]> = [
    ['GET /api/admin/projects-list', async () => (await import('@/app/api/admin/projects-list/route')).GET()],
    ['GET /api/admin/funnel', async () => (await import('@/app/api/admin/funnel/route')).GET(new Request('http://localhost/api/admin/funnel?days=7'))],
    ['GET /api/admin/floor-graph/accuracy', async () =>
      (await import('@/app/api/admin/floor-graph/accuracy/route')).GET(new Request('http://localhost/api/admin/floor-graph/accuracy'))],
    ['POST /api/admin/floor-graph/outcome', async () =>
      (await import('@/app/api/admin/floor-graph/outcome/route')).POST(post('http://localhost/api/admin/floor-graph/outcome'))],
    ['POST /api/quotes/[id]/pdf', async () => (await import('@/app/api/quotes/[id]/pdf/route')).POST(post('http://localhost/x'), ctx)],
    ['POST /api/invoices/[id]/pdf', async () => (await import('@/app/api/invoices/[id]/pdf/route')).POST(post('http://localhost/x'), ctx)],
    ['POST /api/contracts/[id]/pdf', async () => (await import('@/app/api/contracts/[id]/pdf/route')).POST(post('http://localhost/x'), ctx)],
    ['POST /api/listing-floor-report/publish', async () =>
      (await import('@/app/api/listing-floor-report/publish/route')).POST(post('http://localhost/x', { orderId: 'o' }))],
    ['POST /api/listing-floor-report/compose', async () =>
      (await import('@/app/api/listing-floor-report/compose/route')).POST(post('http://localhost/x', {}))],
    ['POST /api/quote-intelligence/publish', async () =>
      (await import('@/app/api/quote-intelligence/publish/route')).POST(post('http://localhost/x', { orderId: 'o' }))],
    ['POST /api/quote-intelligence/compose', async () =>
      (await import('@/app/api/quote-intelligence/compose/route')).POST(post('http://localhost/x', {}))],
  ];

  for (const [label, call] of cases) {
    for (const [who, s] of [
      ['anonymous', null],
      ['customer', { user: { id: 'u1', role: 'USER', email: 'c@example.test' } }],
    ] as const) {
      it(`${label} -> 401 for ${who}`, async () => {
        session.current = s;
        const res = await call();
        expect(res.status).toBe(401);
      });
    }
  }

  it('invoice checkout: anonymous gets 401', async () => {
    const { POST } = await import('@/app/api/invoices/[id]/checkout/route');
    const req = () =>
      new Request('http://localhost/api/invoices/x/checkout', { method: 'POST', headers: { origin: 'http://localhost' } });
    session.current = null;
    expect((await POST(req(), ctx)).status).toBe(401);
  });
});
