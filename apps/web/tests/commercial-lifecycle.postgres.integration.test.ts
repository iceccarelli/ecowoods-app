/**
 * Quote -> project -> invoice -> payment lifecycle against REAL PostgreSQL.
 *
 * The properties here are the ones a mocked database cannot prove: that a
 * conditional write really is atomic under concurrency (double-click on "Mark
 * as paid", double conversion of one quote, two admins issuing invoices at the
 * same moment). Runs only with RUN_POSTGRES_INTEGRATION=1 against a disposable
 * database (same gate as the other *.postgres.integration tests); skips
 * cleanly otherwise.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

const state = vi.hoisted(() => ({
  role: 'ADMIN' as 'ADMIN' | 'USER',
  userId: '',
  emails: [] as Array<{ to: string; invoiceId: string }>,
  failStore: false,
  failEmail: false,
}));

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { id: state.userId, role: state.role, email: 'x@example.test' } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/pdf/storage', () => ({
  storePdf: async (_b: Buffer, name: string) => {
    if (state.failStore) throw new Error('storage down');
    return `https://blob.example.test/${name}`;
  },
}));
vi.mock('@/lib/email', () => ({
  sendInvoiceEmail: async (m: { to: string; invoiceId: string }) => {
    if (state.failEmail) throw new Error('mailer down');
    state.emails.push({ to: m.to, invoiceId: m.invoiceId });
  },
  sendEmail: async () => undefined,
}));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: async () => undefined }));

describe.skipIf(!enabled)('quote / invoice / payment lifecycle against real PostgreSQL', () => {
  const tag = randomUUID().slice(0, 8);
  const createdUsers: string[] = [];

  async function fixtures() {
    const { db } = await import('@/lib/db');
    const user = await db.user.create({ data: { email: `cust-${randomUUID()}@example.test`, name: 'Cust' } });
    const other = await db.user.create({ data: { email: `other-${randomUUID()}@example.test`, name: 'Other' } });
    createdUsers.push(user.id, other.id);
    state.userId = user.id;
    const project = await db.project.create({
      data: { userId: user.id, title: `P-${tag}`, contractValue: 10000.01, depositPct: 30, midpointPct: 40, finalPct: 30, taxRate: 13 },
    });
    return { db, user, other, project };
  }

  beforeEach(() => {
    state.role = 'ADMIN';
    state.emails = [];
    state.failStore = false;
    state.failEmail = false;
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    const projects = await db.project.findMany({ where: { userId: { in: createdUsers } }, select: { id: true } });
    const ids = projects.map((p) => p.id);
    await db.payment.deleteMany({ where: { invoice: { projectId: { in: ids } } } }).catch(() => undefined);
    await db.invoice.deleteMany({ where: { projectId: { in: ids } } }).catch(() => undefined);
    await db.quoteRequest.deleteMany({ where: { email: { endsWith: `${tag}@example.test` } } }).catch(() => undefined);
    await db.project.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: createdUsers } } }).catch(() => undefined);
  });

  it('staged invoices sum exactly to the contract value, and a retry creates no second set', async () => {
    const { project, db } = await fixtures();
    const { generateStagedInvoices } = await import('@/lib/actions/invoices');
    const first = await generateStagedInvoices(project.id);
    expect(first.invoiceIds).toHaveLength(3);
    const invoices = await db.invoice.findMany({ where: { projectId: project.id } });
    const sum = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
    expect(Math.round(sum * 100)).toBe(1000001);
    for (const inv of invoices) {
      // total = subtotal + HST, each rounded to cents
      const expected = Math.round(Number(inv.subtotal) * 113) / 100;
      expect(Math.abs(Number(inv.total) - expected)).toBeLessThanOrEqual(0.01);
    }
    expect(new Set(invoices.map((i) => i.number)).size).toBe(3);

    const second = await generateStagedInvoices(project.id);
    expect(second.invoiceIds).toHaveLength(0);
    expect(await db.invoice.count({ where: { projectId: project.id } })).toBe(3);
  });

  it('concurrent invoice creation never reuses an invoice number', async () => {
    const { project, db } = await fixtures();
    const { createInvoice } = await import('@/lib/actions/invoices');
    const results = await Promise.all(
      Array.from({ length: 4 }, () => createInvoice({ projectId: project.id, stage: 'DEPOSIT', subtotal: 100 })),
    );
    expect(results.every((r) => r.success)).toBe(true);
    const rows = await db.invoice.findMany({ where: { projectId: project.id } });
    expect(new Set(rows.map((r) => r.number)).size).toBe(4);
  });

  it('a double "Mark as paid" writes exactly one Payment; PAID cannot be re-issued, edited or voided', async () => {
    const { project, db } = await fixtures();
    const actions = await import('@/lib/actions/invoices');
    const { invoiceId } = await actions.createInvoice({ projectId: project.id, stage: 'DEPOSIT', subtotal: 200 });
    await actions.issueInvoice(invoiceId);

    const settled = await Promise.allSettled([
      actions.markInvoicePaid(invoiceId, 'BANK_TRANSFER', 'REF-1'),
      actions.markInvoicePaid(invoiceId, 'BANK_TRANSFER', 'REF-1'),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((s) => s.status === 'rejected')).toHaveLength(1);
    expect(await db.payment.count({ where: { invoiceId } })).toBe(1);
    const paid = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(paid.status).toBe('PAID');
    expect(paid.paidAt).not.toBeNull();

    await expect(actions.issueInvoice(invoiceId)).rejects.toThrow(/paid, void or missing/);
    await expect(actions.reissueInvoice(invoiceId, { subtotal: 1 })).rejects.toThrow(/cannot be edited/);
    await expect(actions.updateInvoiceStatus(invoiceId, 'VOID')).rejects.toThrow(/paid invoice cannot change/);
    await expect(actions.updateInvoiceStatus(invoiceId, 'PAID')).rejects.toThrow(/Mark as paid/);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PAID');
    expect(Number((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).total)).toBe(226);
  });

  it('a VOID invoice cannot be paid or re-sent; a customer-reported transfer is confirmed, not duplicated', async () => {
    const { project, db, user } = await fixtures();
    const actions = await import('@/lib/actions/invoices');

    const voided = await actions.createInvoice({ projectId: project.id, stage: 'DEPOSIT', subtotal: 50 });
    await actions.issueInvoice(voided.invoiceId);
    await actions.updateInvoiceStatus(voided.invoiceId, 'VOID');
    await expect(actions.markInvoicePaid(voided.invoiceId, 'CASH')).rejects.toThrow(/already paid, void or missing/);
    await expect(actions.resendInvoice(voided.invoiceId)).rejects.toThrow(/issued, unpaid/);
    expect(await db.payment.count({ where: { invoiceId: voided.invoiceId } })).toBe(0);

    const open = await actions.createInvoice({ projectId: project.id, stage: 'FINAL', subtotal: 100 });
    // A DRAFT is not yet the customer's: they cannot report a payment against it.
    state.role = 'USER';
    state.userId = user.id;
    await expect(actions.reportBankPayment(open.invoiceId, 'ETR-1')).rejects.toThrow(/not awaiting payment/);
    state.role = 'ADMIN';
    await actions.issueInvoice(open.invoiceId);
    state.role = 'USER';
    await actions.reportBankPayment(open.invoiceId, 'ETR-1');
    await expect(actions.reportBankPayment(open.invoiceId, 'ETR-2')).rejects.toThrow(/already been reported/);
    state.role = 'ADMIN';
    await actions.markInvoicePaid(open.invoiceId, 'BANK_TRANSFER', undefined, 'received');
    const payments = await db.payment.findMany({ where: { invoiceId: open.invoiceId } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'COMPLETED', bankReference: 'ETR-1', method: 'BANK_TRANSFER' });
  });

  it("another customer cannot report a payment on someone else's invoice", async () => {
    const { project, other } = await fixtures();
    const actions = await import('@/lib/actions/invoices');
    const { invoiceId } = await actions.createInvoice({ projectId: project.id, stage: 'DEPOSIT', subtotal: 10 });
    await actions.issueInvoice(invoiceId);
    state.role = 'USER';
    state.userId = other.id;
    await expect(actions.reportBankPayment(invoiceId, 'X')).rejects.toThrow('Unauthorized');
  });

  it('PDF or email failure does not lose the issue: the invoice is SENT and the caller is told', async () => {
    const { project, db } = await fixtures();
    const actions = await import('@/lib/actions/invoices');
    const { invoiceId } = await actions.createInvoice({ projectId: project.id, stage: 'DEPOSIT', subtotal: 75 });

    state.failStore = true;
    state.failEmail = true;
    const result = await actions.issueInvoice(invoiceId);
    expect(result).toMatchObject({ success: true, pdfGenerated: false, emailed: false });
    const row = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(row.status).toBe('SENT');
    expect(row.issuedAt).not.toBeNull();
    expect(row.pdfUrl).toBeNull();

    state.failStore = false;
    state.failEmail = false;
    const retry = await actions.reissueInvoice(invoiceId, {});
    expect(retry).toMatchObject({ pdfGenerated: true, emailed: true });
    expect(state.emails).toHaveLength(1);
  });

  it('converting one quote twice (even concurrently) creates exactly one project', async () => {
    const { db, user } = await fixtures();
    const { convertQuoteToProject, saveEstimate } = await import('@/lib/actions/quotes');
    const quote = await db.quoteRequest.create({
      data: { name: 'Q', email: `q-${tag}@example.test`, city: 'Toronto', province: 'ON' },
    });
    await saveEstimate(quote.id, {
      quotedAmount: 5000,
      quoteTaxRate: 13,
      quoteLineItems: [{ description: 'Install', qty: 1, unit: 'job', unitPrice: 5000, amount: 5000 }],
    });
    const before = await db.project.count({ where: { userId: user.id } });

    const settled = await Promise.allSettled([
      convertQuoteToProject(quote.id, { userId: user.id, title: 'A', contractValue: 5000 }),
      convertQuoteToProject(quote.id, { userId: user.id, title: 'B', contractValue: 5000 }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
    expect(await db.project.count({ where: { userId: user.id } })).toBe(before + 1);

    const after = await db.quoteRequest.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.status).toBe('ACCEPTED');
    expect(after.projectId).not.toBeNull();
    // An accepted, converted quote's price cannot be silently rewritten or rewound.
    await expect(
      saveEstimate(quote.id, {
        quotedAmount: 1,
        quoteTaxRate: 13,
        quoteLineItems: [{ description: 'x', qty: 1, unit: 'job', unitPrice: 1, amount: 1 }],
      }),
    ).rejects.toThrow(/accepted or already converted/);
    expect(Number((await db.quoteRequest.findUniqueOrThrow({ where: { id: quote.id } })).quotedAmount)).toBe(5000);
  });
});
