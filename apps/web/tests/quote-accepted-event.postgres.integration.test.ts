/**
 * QUOTE_ACCEPTED is recorded once per quote, whichever path accepts it
 * (RUN_POSTGRES_INTEGRATION=1).
 *
 * The REAL admin actions and funnel ledger run against a real PostgreSQL; only
 * auth, cache revalidation, PDF storage and email are faked. Before the fix the
 * ordinary status control (`updateQuoteStatus(..., 'ACCEPTED')`) recorded
 * nothing, and conversion to a project recorded the event unconditionally, so
 * making the status control record it would have counted one quote twice.
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

describe.skipIf(!enabled)('QUOTE_ACCEPTED is recorded once per quote (real PostgreSQL)', () => {
  const tag = randomUUID().slice(0, 8);
  const users: string[] = [];
  const quotes: string[] = [];
  const projects: string[] = [];

  async function setup() {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `qa-${randomUUID()}@example.test`, name: 'Accept' } });
    users.push(user.id);
    state.userId = user.id;
    return { db, user };
  }

  async function newQuote(quotedAmount = 5000) {
    const { db } = await import('@/lib/db');
    const quote = await db.quoteRequest.create({
      data: { name: 'Q', email: `q-${randomUUID()}@example.test`, city: 'Toronto', province: 'ON', quotedAmount, designId: 'abcdefghjkmn' },
    });
    quotes.push(quote.id);
    return quote;
  }

  /** The ledger write is deliberately fire-and-forget; give it a moment to land. */
  async function accepted(quoteId: string) {
    const { db } = await import('@/lib/db');
    await new Promise((r) => setTimeout(r, 500));
    return db.funnelEvent.findMany({ where: { stage: 'QUOTE_ACCEPTED', quoteId } });
  }

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.funnelEvent.deleteMany({ where: { OR: [{ quoteId: { in: quotes } }, { projectId: { in: projects } }] } }).catch(() => undefined);
    await db.quoteRequest.deleteMany({ where: { id: { in: quotes } } }).catch(() => undefined);
    await db.project.deleteMany({ where: { id: { in: projects } } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: users } } }).catch(() => undefined);
    await db.$disconnect();
  });

  it('accepting through the status control records one acceptance, however often it is repeated', async () => {
    await setup();
    const quote = await newQuote();
    const { updateQuoteStatus } = await import('@/lib/actions/quotes');
    await updateQuoteStatus(quote.id, 'ACCEPTED');
    await updateQuoteStatus(quote.id, 'ACCEPTED', 'saved again');
    const rows = await accepted(quote.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBeNull();
    expect(rows[0]!.designId).toBe('abcdefghjkmn');
    expect(Number(rows[0]!.amountCad)).toBe(5000);
  });

  it('other statuses record no acceptance', async () => {
    await setup();
    const quote = await newQuote();
    const { updateQuoteStatus } = await import('@/lib/actions/quotes');
    for (const s of ['PENDING', 'QUOTED', 'REJECTED']) await updateQuoteStatus(quote.id, s);
    expect(await accepted(quote.id)).toHaveLength(0);
  });

  it('converting an already-accepted quote does not count it twice; the row learns its project and contract value', async () => {
    const { db, user } = await setup();
    const quote = await newQuote(5000);
    const { updateQuoteStatus, convertQuoteToProject } = await import('@/lib/actions/quotes');
    await updateQuoteStatus(quote.id, 'ACCEPTED');
    const { projectId } = await convertQuoteToProject(quote.id, { userId: user.id, title: `P-${tag}`, contractValue: 6200 });
    projects.push(projectId);
    const rows = await accepted(quote.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBe(projectId);
    expect(Number(rows[0]!.amountCad)).toBe(6200);
    // Accepting it again afterwards neither duplicates nor loses the project link.
    await updateQuoteStatus(quote.id, 'ACCEPTED');
    const after = await accepted(quote.id);
    expect(after).toHaveLength(1);
    expect(after[0]!.projectId).toBe(projectId);
    expect(await db.funnelEvent.count({ where: { stage: 'QUOTE_ACCEPTED', projectId } })).toBe(1);
  });

  it('converting a quote that was never accepted through the status control still records exactly one acceptance, with its project', async () => {
    const { user } = await setup();
    const quote = await newQuote(4000);
    const { convertQuoteToProject } = await import('@/lib/actions/quotes');
    const { projectId } = await convertQuoteToProject(quote.id, { userId: user.id, title: `P2-${tag}`, contractValue: 4000 });
    projects.push(projectId);
    const rows = await accepted(quote.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBe(projectId);
  });

  it('concurrent acceptances and conversion record one row', async () => {
    const { user } = await setup();
    const quote = await newQuote(7000);
    const { recordQuoteAccepted } = await import('@/lib/funnel-ledger');
    const { updateQuoteStatus, convertQuoteToProject } = await import('@/lib/actions/quotes');
    await Promise.all([
      ...Array.from({ length: 8 }, () => recordQuoteAccepted({ quoteId: quote.id, designId: 'abcdefghjkmn', amountCad: 7000 })),
      updateQuoteStatus(quote.id, 'ACCEPTED'),
      updateQuoteStatus(quote.id, 'ACCEPTED'),
    ]);
    const { projectId } = await convertQuoteToProject(quote.id, { userId: user.id, title: `P3-${tag}`, contractValue: 7000 });
    projects.push(projectId);
    const rows = await accepted(quote.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.projectId).toBe(projectId);
  });

  it('two quotes are counted separately', async () => {
    await setup();
    const a = await newQuote();
    const b = await newQuote();
    const { recordQuoteAccepted } = await import('@/lib/funnel-ledger');
    await Promise.all([recordQuoteAccepted({ quoteId: a.id }), recordQuoteAccepted({ quoteId: b.id }), recordQuoteAccepted({ quoteId: a.id })]);
    expect(await accepted(a.id)).toHaveLength(1);
    expect(await accepted(b.id)).toHaveLength(1);
  });
});
