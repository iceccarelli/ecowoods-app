/**
 * Funnel ledger completeness against a real PostgreSQL (RUN_POSTGRES_INTEGRATION=1).
 *
 * The REAL admin actions and the REAL funnel ledger run; only auth, cache
 * revalidation, PDF storage and email are faked. Pins three gaps in
 * /admin/funnel's counts:
 *   - a deposit confirmed by bank transfer or cash left no DEPOSIT_PAID row
 *     (only the Stripe path recorded one);
 *   - re-sending an estimate recorded QUOTE_ISSUED again;
 *   - saving a project as COMPLETED again recorded JOB_COMPLETED again.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const state = vi.hoisted(() => ({ userId: '' }));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { id: state.userId, role: 'ADMIN', email: 'x@example.test' } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/pdf/storage', () => ({ storePdf: async (_b: Buffer, name: string) => `https://blob.example.test/${name}` }));
vi.mock('@/lib/email', () => ({
  sendInvoiceEmail: async () => undefined,
  sendEmail: async () => undefined,
  sendReviewRequestEmail: async () => undefined,
}));

describe.skipIf(!enabled)('funnel ledger completeness against real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  const users: string[] = [];
  const quotes: string[] = [];
  const projectIds: string[] = [];

  async function setup() {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `fn-${randomUUID()}@example.test`, name: 'Funnel' } });
    users.push(user.id);
    state.userId = user.id;
    return { db, user };
  }

  async function rows(stage: 'DEPOSIT_PAID' | 'QUOTE_ISSUED' | 'JOB_COMPLETED', where: { projectId?: string; quoteId?: string }) {
    const { db } = await import('@/lib/db');
    // The ledger write is deliberately fire-and-forget; give it a moment to land.
    await new Promise((r) => setTimeout(r, 400));
    return db.funnelEvent.findMany({ where: { stage, ...where } });
  }

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.funnelEvent.deleteMany({ where: { OR: [{ projectId: { in: projectIds } }, { quoteId: { in: quotes } }] } }).catch(() => undefined);
    await db.payment.deleteMany({ where: { invoice: { projectId: { in: projectIds } } } }).catch(() => undefined);
    await db.invoice.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => undefined);
    await db.quoteRequest.deleteMany({ where: { id: { in: quotes } } }).catch(() => undefined);
    await db.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: users } } }).catch(() => undefined);
    await db.$disconnect();
  });

  it('a deposit confirmed by bank transfer is recorded once, with its design and amount; other stages are not', async () => {
    const { db, user } = await setup();
    const project = await db.project.create({
      data: { userId: user.id, title: `P-${tag}`, contractValue: 10000, depositPct: 30, midpointPct: 40, finalPct: 30, taxRate: 13, designId: 'abcdefghjkmn' },
    });
    projectIds.push(project.id);
    const actions = await import('@/lib/actions/invoices');
    const staged = await actions.generateStagedInvoices(project.id);
    const invoices = await db.invoice.findMany({ where: { id: { in: staged.invoiceIds } } });
    const deposit = invoices.find((i) => i.stage === 'DEPOSIT')!;
    const midpoint = invoices.find((i) => i.stage === 'MIDPOINT')!;
    await actions.issueInvoice(deposit.id);
    await actions.issueInvoice(midpoint.id);

    await actions.markInvoicePaid(deposit.id, 'BANK_TRANSFER', 'REF-1');
    await expect(actions.markInvoicePaid(deposit.id, 'BANK_TRANSFER', 'REF-1')).rejects.toThrow(/already paid/);
    await actions.markInvoicePaid(midpoint.id, 'CASH');

    const found = await rows('DEPOSIT_PAID', { projectId: project.id });
    expect(found).toHaveLength(1);
    expect(found[0]!.designId).toBe('abcdefghjkmn');
    expect(Number(found[0]!.amountCad)).toBe(Number(deposit.total));
  });

  it('re-sending an estimate records one QUOTE_ISSUED', async () => {
    const { db } = await setup();
    const quote = await db.quoteRequest.create({
      data: {
        name: 'Q', email: `q-${tag}@example.test`, city: 'Toronto', province: 'ON',
        quotedAmount: 5000, quotePdfUrl: 'https://blob.example.test/q.pdf',
      },
    });
    quotes.push(quote.id);
    const { sendEstimateEmail } = await import('@/lib/actions/quotes');
    await sendEstimateEmail(quote.id);
    await sendEstimateEmail(quote.id);
    expect(await rows('QUOTE_ISSUED', { quoteId: quote.id })).toHaveLength(1);
  });

  it('saving a project as COMPLETED twice records one JOB_COMPLETED', async () => {
    const { db, user } = await setup();
    const project = await db.project.create({ data: { userId: user.id, title: `PC-${tag}`, contractValue: 8000 } });
    projectIds.push(project.id);
    const { updateProjectStatus } = await import('@/lib/actions/projects');
    await updateProjectStatus(project.id, 'COMPLETED');
    await updateProjectStatus(project.id, 'COMPLETED');
    expect(await rows('JOB_COMPLETED', { projectId: project.id })).toHaveLength(1);
  });
  it('acquisition: a captured first touch is stored once, reported by channel, and an unknown value is never stored', async () => {
    const { db } = await setup();
    const { recordFunnelEvent } = await import('@/lib/funnel-ledger');
    const { recordLeadAcquisition, acquisitionForQuote } = await import('@/lib/lead-acquisition');
    const { parseAcquisition } = await import('@/lib/acquisition');
    const { loadFunnelReport } = await import('@/lib/funnel-report');

    const q = await db.quoteRequest.create({ data: { name: 'Acq One', email: `acq-${randomUUID()}@example.test` } });
    const legacy = await db.quoteRequest.create({ data: { name: 'Acq Legacy', email: `acq-${randomUUID()}@example.test` } });
    quotes.push(q.id, legacy.id);

    await recordLeadAcquisition(q.id, parseAcquisition('chatgpt', '/service-areas/oakville'));
    await recordLeadAcquisition(q.id, parseAcquisition('google_search', '/estimate')); // a repeat never rewrites the first touch
    await recordLeadAcquisition(legacy.id, parseAcquisition('not a channel; drop table', '/x')); // dropped, not stored
    expect(await acquisitionForQuote(q.id)).toEqual({ channel: 'chatgpt', landing: '/service-areas/oakville' });
    expect(await acquisitionForQuote(legacy.id)).toBeNull(); // not captured is NULL, which is not 'no_referrer'

    await recordFunnelEvent({ stage: 'LEAD_CAPTURED', quoteId: q.id, source: 'acq-test' });
    await recordFunnelEvent({ stage: 'LEAD_CAPTURED', quoteId: legacy.id, source: 'acq-test' });
    await new Promise((r) => setTimeout(r, 400));

    const out = await loadFunnelReport(7);
    expect(out.report.acquisition.rows.find((r) => r.key === 'chatgpt')!.counts.LEAD_CAPTURED).toBeGreaterThanOrEqual(1);
    expect(out.report.acquisition.rows.find((r) => r.key === 'NOT_CAPTURED')!.counts.LEAD_CAPTURED).toBeGreaterThanOrEqual(1);
    await db.leadAcquisition.deleteMany({ where: { quoteId: { in: [q.id, legacy.id] } } });
  });
});
