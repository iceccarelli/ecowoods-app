'use server';

/**
 * Invoice server actions.
 * 인보이스 서버 액션
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { InvoiceStage, InvoiceStatus, Settings } from '@prisma/client';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import { invoiceAmounts, isValidAmount, splitContract } from '@/lib/money';
import { siteOrigin } from '@/lib/site-origin';
import { recordFunnelEventOnce } from '@/lib/funnel-ledger';

const DEFAULT_SETTINGS = {
  id: '00000000-0000-0000-0000-000000000001',
  companyName: 'Ecowoods Hardwood Flooring Inc.' as string | null,
  companyAddress: BUSINESS_ADDRESS_LINE as string | null,
  companyPhone: BUSINESS_NAP.phoneDisplay as string | null,
  companyEmail: BUSINESS_NAP.email as string | null,
  companyNumberHst: null as string | null,
  companyLogoUrl: null as string | null,
  defaultDepositPct: 30,
  defaultMidpointPct: 40,
  defaultFinalPct: 30,
  defaultTaxRate: 13,
  aiEnabled: true,
  aiBankTransferInstructions: null as string | null,
  updatedAt: new Date(),
} as unknown as Settings;

/** Compute invoice total from subtotal + discount + surcharge + tax (cent-exact; see lib/money.ts). */
function computeTotal(subtotal: number, discountPct: number, surchargePct: number, taxRate: number) {
  return invoiceAmounts(subtotal, discountPct, surchargePct, taxRate).total;
}

/** Statuses an invoice can still be issued, edited or paid from. PAID and VOID are terminal. */
const OPEN_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'OVERDUE'];
/** Statuses a customer may pay or report a payment against (a DRAFT is not yet theirs). */
const CUSTOMER_PAYABLE: InvoiceStatus[] = ['SENT', 'OVERDUE'];

function assertAdmin(role: string | undefined): void {
  if (role !== 'ADMIN') throw new Error('Unauthorized');
}

function assertInvoiceInputs(input: { subtotal: number; discountPct: number; surchargePct: number; taxRate: number }): void {
  if (!isValidAmount(input.subtotal) || input.subtotal <= 0) throw new Error('Subtotal must be greater than 0.');
  for (const pct of [input.discountPct, input.surchargePct, input.taxRate]) {
    if (!isValidAmount(pct, 100)) throw new Error('Percentages must be between 0 and 100.');
  }
}

const isUniqueViolation = (err: unknown): boolean => (err as { code?: string } | null)?.code === 'P2002';

/** The invoice number is @unique; two admins issuing at once can race on count()+1, so retry on collision. */
async function createInvoiceWithNumber(
  data: Omit<import('@prisma/client').Prisma.InvoiceUncheckedCreateInput, 'number'>,
) {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  for (let attempt = 0; attempt < 8; attempt++) {
    const number = `INV-${year}-${String(count + 1 + attempt).padStart(3, '0')}`;
    try {
      return await db.invoice.create({ data: { ...data, number } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Could not allocate an invoice number. Please try again.');
}

/** Render + store the invoice PDF and record its URL. Null (and logged) on any failure; callers carry on without it. */
async function renderInvoicePdf(
  invoice: import('@prisma/client').Invoice & { project: import('@prisma/client').Project & { user: import('@prisma/client').User } },
  label: string,
): Promise<string | null> {
  try {
    const [{ renderToBuffer }, { InvoiceDocument }, { storePdf }, { createElement }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/lib/pdf/invoice-document'),
      import('@/lib/pdf/storage'),
      import('react'),
    ]);
    const settings = (await db.settings.findFirst()) ?? DEFAULT_SETTINGS;
    const element = createElement(InvoiceDocument, { invoice, settings });
    const buffer = await renderToBuffer(element as never);
    const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
    const url = await storePdf(Buffer.from(buffer), filename);
    await db.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: url } });
    return url;
  } catch (err: unknown) {
    console.error(`[${label}] PDF generation failed:`, err);
    return null;
  }
}

// ─── Create invoice (admin) ──────────────────────────────────────────────────
export async function createInvoice(input: {
  projectId: string;
  stage: InvoiceStage;
  subtotal: number;
  discountPct?: number;
  surchargePct?: number;
  taxRate?: number;
  description?: string;
  dueDate?: string;
  lineItems?: Array<{ description: string; qty: number; unitPrice: number; amount: number }>;
}) {
  const session = await auth();
  assertAdmin(session?.user?.role);

  const project = await db.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { user: true },
  });

  const settings = await db.settings.findFirst();

  const discountPct = input.discountPct ?? 0;
  const surchargePct = input.surchargePct ?? 0;
  const taxRate = input.taxRate ?? Number(project.taxRate ?? settings?.defaultTaxRate ?? 13);
  assertInvoiceInputs({ subtotal: input.subtotal, discountPct, surchargePct, taxRate });

  const amounts = invoiceAmounts(input.subtotal, discountPct, surchargePct, taxRate);
  const invoice = await createInvoiceWithNumber({
    projectId: input.projectId,
    stage: input.stage,
    status: 'DRAFT',
    subtotal: amounts.subtotal,
    discountPct,
    surchargePct,
    taxRate,
    total: amounts.total,
    description: input.description,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    lineItems: (input.lineItems ?? []) as never,
  });

  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/projects/${input.projectId}`);

  return { success: true, invoiceId: invoice.id };
}

type InvoiceWithParties = import('@prisma/client').Invoice & {
  project: import('@prisma/client').Project & { user: import('@prisma/client').User };
};

/** Email the invoice. Awaited: a serverless function can be frozen once it responds, so a floating promise may never send. */
async function emailInvoice(invoice: InvoiceWithParties, pdfUrl: string | null, label: string): Promise<boolean> {
  try {
    const { sendInvoiceEmail } = await import('@/lib/email');
    await sendInvoiceEmail({
      to: invoice.project.user.email,
      name: invoice.project.user.name ?? 'Valued Customer',
      invoiceNumber: invoice.number ?? '',
      invoiceId: invoice.id,
      total: Number(invoice.total),
      dueDate: invoice.dueDate ?? undefined,
      projectTitle: invoice.project.title,
      // Proxy URL (private Blob is server-only; the proxy handles auth).
      pdfUrl: pdfUrl ? `${siteOrigin()}/api/docs/invoice/${invoice.id}?dl=1` : undefined,
    });
    return true;
  } catch (err: unknown) {
    console.error(`[email] ${label} invoice send failed:`, err);
    return false;
  }
}

// ─── Issue invoice (auto-generates PDF, then emails customer) ────────────────
export async function issueInvoice(invoiceId: string) {
  const session = await auth();
  assertAdmin(session?.user?.role);

  /* Conditional: a PAID or VOID invoice must never be pulled back to SENT. */
  const claimed = await db.invoice.updateMany({
    where: { id: invoiceId, status: { in: OPEN_STATUSES } },
    data: { status: 'SENT' },
  });
  if (claimed.count !== 1) throw new Error('This invoice is paid, void or missing and cannot be issued.');
  let invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });
  if (!invoice.issuedAt) {
    invoice = await db.invoice.update({
      where: { id: invoiceId },
      data: { issuedAt: new Date() },
      include: { project: { include: { user: true } } },
    });
  }

  // Auto-generate PDF if not yet created (or only had a legacy data-URL)
  let pdfUrl: string | null = invoice.pdfUrl;
  if (!pdfUrl || pdfUrl.startsWith('data:')) {
    // On failure the invoice is still issued, just without a PDF; the caller is told.
    pdfUrl = await renderInvoicePdf(invoice, 'issueInvoice');
  }

  const emailed = await emailInvoice(invoice, pdfUrl, 'issue');

  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');

  return { success: true, pdfGenerated: !!pdfUrl, emailed };
}

// ─── Admin: manually mark invoice as paid ───────────────────────────────────
export async function markInvoicePaid(
  invoiceId: string,
  method: 'BANK_TRANSFER' | 'CASH',
  reference?: string,
  notes?: string
) {
  const session = await auth();
  assertAdmin(session?.user?.role);
  if (method !== 'BANK_TRANSFER' && method !== 'CASH') throw new Error('Unsupported payment method.');

  /* One transaction: the status flip and the Payment row commit together or
     not at all. The conditional update is the claim, so a second click, a
     concurrent Stripe webhook, or an already-PAID/VOID invoice yields count 0
     and nothing is written (no duplicate Payment). A customer's earlier
     "I have paid" report for the same method is CONFIRMED rather than left
     PENDING next to a second COMPLETED row. */
  const paid = await db.$transaction(async (tx) => {
    const claim = await tx.invoice.updateMany({
      where: { id: invoiceId, status: { in: OPEN_STATUSES } },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (claim.count !== 1) throw new Error('This invoice is already paid, void or missing.');
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { total: true, stage: true, projectId: true, project: { select: { userId: true, designId: true } } },
    });
    const pending = await tx.payment.findFirst({
      where: { invoiceId, method, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    const confirmation = {
      amount: invoice.total,
      status: 'COMPLETED' as const,
      bankReference: reference || pending?.bankReference || undefined,
      bankConfirmedAt: new Date(),
      bankConfirmedByNote: notes,
    };
    if (pending) {
      await tx.payment.update({ where: { id: pending.id }, data: confirmation });
    } else {
      await tx.payment.create({
        data: { invoiceId, userId: invoice.project.userId, method, ...confirmation },
      });
    }
    return invoice;
  });

  /* MEAS-02 — the brief's `deposit` event for a deposit that did NOT arrive
     through Stripe. lib/stripe-fulfillment.ts records DEPOSIT_PAID when a card
     payment clears; a deposit confirmed here (bank transfer, cash) took the
     same commercial step and left no ledger row, so /admin/funnel undercounted
     deposits by every e-transfer. Only the DEPOSIT stage counts, for the reason
     given there. The claim above lets exactly one caller reach this line per
     invoice. Best-effort and never awaited. */
  if (paid.stage === 'DEPOSIT') {
    void recordFunnelEventOnce({
      stage: 'DEPOSIT_PAID',
      designId: paid.project.designId,
      projectId: paid.projectId ?? null,
      amountCad: Number(paid.total),
    });
  }

  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');

  return { success: true };
}

// ─── Auto-generate staged invoices for a project ────────────────────────────
export async function generateStagedInvoices(projectId: string) {
  const session = await auth();
  assertAdmin(session?.user?.role);

  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!project.contractValue) throw new Error('Project has no contract value set');

  const stages = [
    { stage: 'DEPOSIT' as const, pct: project.depositPct ?? 30, label: 'Deposit' },
    { stage: 'MIDPOINT' as const, pct: project.midpointPct ?? 40, label: 'Progress payment' },
    { stage: 'FINAL' as const, pct: project.finalPct ?? 30, label: 'Final balance' },
  ].filter((s) => Number(s.pct) > 0);

  /* Never create a second set: stages that already exist (and are not VOID)
     for this project are skipped, so a double click or a retry cannot bill the
     same stage twice. */
  const existing = await db.invoice.findMany({
    where: { projectId, status: { not: 'VOID' }, stage: { in: stages.map((s) => s.stage) } },
    select: { stage: true },
  });
  const have = new Set(existing.map((e) => e.stage));

  const contractVal = Number(project.contractValue);
  const taxRate = Number(project.taxRate ?? 13);
  const subtotals = splitContract(contractVal, stages.map((s) => Number(s.pct)));

  const created: string[] = [];
  for (const [i, s] of stages.entries()) {
    if (have.has(s.stage)) continue;
    const pct = Number(s.pct);
    const subtotal = subtotals[i]!;
    const inv = await createInvoiceWithNumber({
      projectId,
      stage: s.stage,
      status: 'DRAFT',
      subtotal,
      discountPct: 0,
      surchargePct: 0,
      taxRate,
      total: computeTotal(subtotal, 0, 0, taxRate),
      description: `${s.label} — ${pct}% of contract value`,
      lineItems: [
        { description: `${s.label} (${pct}% of $${contractVal.toFixed(2)})`, qty: 1, unitPrice: subtotal, amount: subtotal },
      ] as never,
    });
    created.push(inv.id);
  }

  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/projects/${projectId}`);

  return { success: true, invoiceIds: created };
}

// ─── Customer: "I have paid" via bank transfer ───────────────────────────────
export async function reportBankPayment(
  invoiceId: string,
  bankReference: string
) {
  const session = await auth();
  if (!session?.user) throw new Error('Must be logged in');

  const reference = String(bankReference ?? '').trim();
  if (reference.length < 1 || reference.length > 200) throw new Error('Enter your e-transfer reference.');

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: true },
  });

  // Verify this invoice belongs to the logged-in user
  if (invoice.project.userId !== session.user.id) {
    throw new Error('Unauthorized');
  }
  // Only an issued, unpaid invoice can have a payment reported against it.
  if (!CUSTOMER_PAYABLE.includes(invoice.status)) {
    throw new Error('This invoice is not awaiting payment.');
  }
  const alreadyReported = await db.payment.findFirst({
    where: { invoiceId, method: 'BANK_TRANSFER', status: 'PENDING' },
    select: { id: true },
  });
  if (alreadyReported) throw new Error('A payment has already been reported for this invoice; we will confirm it shortly.');

  await db.payment.create({
    data: {
      invoiceId,
      userId: session.user.id,
      amount: invoice.total,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      bankReference: reference,
    },
  });

  revalidatePath('/mypage/invoices');

  return { success: true };
}

// ─── Admin: update invoice status ────────────────────────────────────────────
export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  const session = await auth();
  assertAdmin(session?.user?.role);
  if (!['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'].includes(status)) throw new Error('Unknown invoice status.');
  /* PAID is only reachable through markInvoicePaid or the Stripe webhook, which
     also write the Payment row; a bare status flip would leave a "paid"
     invoice with no payment (or un-pay one that has). */
  if (status === 'PAID') throw new Error('Use "Mark as paid" to record a payment.');

  const moved = await db.invoice.updateMany({
    where: { id: invoiceId, status: { in: OPEN_STATUSES } },
    data: { status },
  });
  if (moved.count !== 1) throw new Error('A paid invoice cannot change status, and the invoice must exist.');
  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');
}

// ─── Admin: resend existing invoice email (no changes) ───────────────────────
export async function resendInvoice(invoiceId: string) {
  const session = await auth();
  assertAdmin(session?.user?.role);

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });
  if (!CUSTOMER_PAYABLE.includes(invoice.status)) throw new Error('Only an issued, unpaid invoice can be re-sent.');

  if (!(await emailInvoice(invoice, invoice.pdfUrl, 'resend'))) throw new Error('The email could not be sent.');
  return { success: true };
}

// ─── Admin: edit invoice fields, regenerate PDF, re-send email ───────────────
export async function reissueInvoice(
  invoiceId: string,
  changes: {
    subtotal?: number;
    discountPct?: number;
    surchargePct?: number;
    taxRate?: number;
    description?: string;
    dueDate?: string | null;
  }
) {
  const session = await auth();
  assertAdmin(session?.user?.role);

  const existing = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });
  if (!OPEN_STATUSES.includes(existing.status)) {
    throw new Error('A paid or void invoice cannot be edited or re-issued.');
  }

  const subtotal = changes.subtotal ?? Number(existing.subtotal);
  const discountPct = changes.discountPct ?? Number(existing.discountPct);
  const surchargePct = changes.surchargePct ?? Number(existing.surchargePct);
  const taxRate = changes.taxRate ?? Number(existing.taxRate);
  assertInvoiceInputs({ subtotal, discountPct, surchargePct, taxRate });
  const amounts = invoiceAmounts(subtotal, discountPct, surchargePct, taxRate);

  /* Conditional on still being open: a Stripe payment that lands between the
     read above and this write must not be overwritten back to SENT. */
  const updated = await db.invoice.updateMany({
    where: { id: invoiceId, status: { in: OPEN_STATUSES } },
    data: {
      subtotal: amounts.subtotal,
      discountPct,
      surchargePct,
      taxRate,
      total: amounts.total,
      description: changes.description !== undefined ? changes.description : existing.description,
      dueDate: changes.dueDate === null ? null : changes.dueDate ? new Date(changes.dueDate) : existing.dueDate,
      status: 'SENT',
      issuedAt: existing.issuedAt ?? new Date(),
      pdfUrl: null, // force regeneration
    },
  });
  if (updated.count !== 1) throw new Error('The invoice was paid or voided while you were editing it.');
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });

  // Regenerate PDF (failure is reported, not fatal)
  const pdfUrl = await renderInvoicePdf(invoice, 'reissueInvoice');
  const emailed = await emailInvoice(invoice, pdfUrl, 'reissue');

  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/projects/${invoice.projectId}`);
  revalidatePath('/mypage/invoices');

  return { success: true, pdfGenerated: !!pdfUrl, emailed };
}
