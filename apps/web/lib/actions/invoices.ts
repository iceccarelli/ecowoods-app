'use server';

/**
 * Invoice server actions.
 * 인보이스 서버 액션
 */

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { InvoiceStage, InvoiceStatus } from '@prisma/client';

const DEFAULT_SETTINGS = {
  id: 'global',
  companyName: 'Ecowoods Hardwood Flooring Inc.',
  companyAddress: '32 Norfield Crsnt., Toronto, ON M3J 3A1',
  companyPhone: '(416) 249-1276',
  companyEmail: 'hello@ecowoods.ca',
  companyHstNumber: '',
  companyLogoUrl: null as string | null,
  defaultDepositPct: 30,
  defaultMidpointPct: 40,
  defaultFinalPct: 30,
  defaultTaxRate: 13,
  aiEnabled: false,
  bankTransferInstructions: '',
  updatedAt: new Date(),
};

/** Compute invoice total from subtotal + discount + surcharge + tax */
function computeTotal(subtotal: number, discountPct: number, surchargePct: number, taxRate: number) {
  const afterDiscount = subtotal * (1 - discountPct / 100);
  const afterSurcharge = afterDiscount * (1 + surchargePct / 100);
  const total = afterSurcharge * (1 + taxRate / 100);
  return Math.round(total * 100) / 100;
}

/** Generate the next invoice number (INV-YYYY-NNN) */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({
    where: { number: { startsWith: `INV-${year}-` } },
  });
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`;
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
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const project = await db.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { user: true },
  });

  const settings = await db.settings.findUnique({ where: { id: 'global' } });

  const discountPct = input.discountPct ?? 0;
  const surchargePct = input.surchargePct ?? 0;
  const taxRate = input.taxRate ?? project.taxRate ?? settings?.defaultTaxRate ?? 13;

  const invoice = await db.invoice.create({
    data: {
      number: await generateInvoiceNumber(),
      projectId: input.projectId,
      stage: input.stage,
      status: 'DRAFT',
      subtotal: input.subtotal,
      discountPct,
      surchargePct,
      taxRate,
      total: computeTotal(input.subtotal, discountPct, surchargePct, taxRate),
      description: input.description,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      lineItems: (input.lineItems ?? []) as never,
    },
  });

  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/projects/${input.projectId}`);

  return { success: true, invoiceId: invoice.id };
}

// ─── Issue invoice (auto-generates PDF, then emails customer) ────────────────
export async function issueInvoice(invoiceId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const invoice = await db.invoice.update({
    where: { id: invoiceId },
    data: { status: 'SENT', issuedAt: new Date() },
    include: { project: { include: { user: true } } },
  });

  // Auto-generate PDF if not yet created (or only had a legacy data-URL)
  let pdfUrl: string | null = invoice.pdfUrl;
  if (!pdfUrl || pdfUrl.startsWith('data:')) {
    try {
      const [{ renderToBuffer }, { InvoiceDocument }, { storePdf }, { createElement }] =
        await Promise.all([
          import('@react-pdf/renderer'),
          import('@/lib/pdf/invoice-document'),
          import('@/lib/pdf/storage'),
          import('react'),
        ]);
      const settings = (await db.settings.findUnique({ where: { id: 'global' } })) ?? DEFAULT_SETTINGS;
      const element = createElement(InvoiceDocument, { invoice, settings });
      const buffer = await renderToBuffer(element as never);
      const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
      pdfUrl = await storePdf(Buffer.from(buffer), filename);
      await db.invoice.update({ where: { id: invoiceId }, data: { pdfUrl } });
    } catch (err: unknown) {
      console.error('[issueInvoice] PDF generation failed:', err);
      // Continue — invoice is still issued, just without PDF
    }
  }

  // Build absolute PDF URL for email
  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const absolutePdfUrl = pdfUrl
    ? pdfUrl.startsWith('http') ? pdfUrl : `${baseUrl}${pdfUrl}`
    : null;

  // Email customer (non-blocking, lazy import)
  import('@/lib/email').then(({ sendInvoiceEmail }) =>
    sendInvoiceEmail({
      to: invoice.project.user.email,
      name: invoice.project.user.name ?? 'Valued Customer',
      invoiceNumber: invoice.number,
      invoiceId: invoice.id,
      total: invoice.total,
      dueDate: invoice.dueDate ?? undefined,
      projectTitle: invoice.project.title,
      pdfUrl: absolutePdfUrl ?? undefined,
    })
  ).catch((err: unknown) => console.error('[email] invoice send failed:', err));

  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');

  return { success: true };
}

// ─── Admin: manually mark invoice as paid ───────────────────────────────────
export async function markInvoicePaid(
  invoiceId: string,
  method: 'BANK_TRANSFER' | 'CASH',
  reference?: string,
  notes?: string
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const invoice = await db.invoice.update({
    where: { id: invoiceId },
    data: { status: 'PAID', paidAt: new Date() },
    include: { project: { include: { user: true } } },
  });

  await db.payment.create({
    data: {
      invoiceId,
      userId: invoice.project.userId,
      amount: invoice.total,
      method,
      status: 'CONFIRMED',
      bankReference: reference,
      bankConfirmedAt: new Date(),
      bankConfirmedByNote: notes,
    },
  });

  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');

  return { success: true };
}

// ─── Auto-generate staged invoices for a project ────────────────────────────
export async function generateStagedInvoices(projectId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!project.contractValue) throw new Error('Project has no contract value set');

  const stages: Array<{ stage: InvoiceStage; pct: number; label: string }> = [
    { stage: 'DEPOSIT', pct: project.depositPct ?? 30, label: 'Deposit' },
    { stage: 'MIDPOINT', pct: project.midpointPct ?? 40, label: 'Progress payment' },
    { stage: 'FINAL', pct: project.finalPct ?? 30, label: 'Final balance' },
  ].filter((s) => s.pct > 0);

  const created: string[] = [];
  for (const s of stages) {
    const subtotal = project.contractValue * (s.pct / 100);
    const inv = await db.invoice.create({
      data: {
        number: await generateInvoiceNumber(),
        projectId,
        stage: s.stage,
        status: 'DRAFT',
        subtotal,
        discountPct: 0,
        surchargePct: 0,
        taxRate: project.taxRate ?? 13,
        total: computeTotal(subtotal, 0, 0, project.taxRate ?? 13),
        description: `${s.label} — ${s.pct}% of contract value`,
        lineItems: [
          { description: `${s.label} (${s.pct}% of $${project.contractValue.toFixed(2)})`, qty: 1, unitPrice: subtotal, amount: subtotal },
        ] as never,
      },
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

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: true },
  });

  // Verify this invoice belongs to the logged-in user
  if (invoice.project.userId !== session.user.id) {
    throw new Error('Unauthorized');
  }

  await db.payment.create({
    data: {
      invoiceId,
      userId: session.user.id,
      amount: invoice.total,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      bankReference,
    },
  });

  revalidatePath('/mypage/invoices');

  return { success: true };
}

// ─── Admin: update invoice status ────────────────────────────────────────────
export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  revalidatePath('/admin/invoices');
  revalidatePath('/mypage/invoices');
}

// ─── Admin: resend existing invoice email (no changes) ───────────────────────
export async function resendInvoice(invoiceId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });

  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const absolutePdfUrl = invoice.pdfUrl
    ? (invoice.pdfUrl.startsWith('http') ? invoice.pdfUrl : `${baseUrl}${invoice.pdfUrl}`)
    : null;

  const { sendInvoiceEmail } = await import('@/lib/email');
  await sendInvoiceEmail({
    to: invoice.project.user.email,
    name: invoice.project.user.name ?? 'Valued Customer',
    invoiceNumber: invoice.number,
    invoiceId: invoice.id,
    total: invoice.total,
    dueDate: invoice.dueDate ?? undefined,
    projectTitle: invoice.project.title,
    pdfUrl: absolutePdfUrl ?? undefined,
  });

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
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const existing = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { project: { include: { user: true } } },
  });

  const subtotal = changes.subtotal ?? existing.subtotal;
  const discountPct = changes.discountPct ?? existing.discountPct;
  const surchargePct = changes.surchargePct ?? existing.surchargePct;
  const taxRate = changes.taxRate ?? existing.taxRate;

  const invoice = await db.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal,
      discountPct,
      surchargePct,
      taxRate,
      total: computeTotal(subtotal, discountPct, surchargePct, taxRate),
      description: changes.description !== undefined ? changes.description : existing.description,
      dueDate: changes.dueDate === null ? null : changes.dueDate ? new Date(changes.dueDate) : existing.dueDate,
      status: 'SENT',
      issuedAt: existing.issuedAt ?? new Date(),
      pdfUrl: null, // force regeneration
    },
    include: { project: { include: { user: true } } },
  });

  // Regenerate PDF
  let pdfUrl: string | null = null;
  try {
    const [{ renderToBuffer }, { InvoiceDocument }, { storePdf }, { createElement }] =
      await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/pdf/invoice-document'),
        import('@/lib/pdf/storage'),
        import('react'),
      ]);
    const settings = (await db.settings.findUnique({ where: { id: 'global' } })) ?? DEFAULT_SETTINGS;
    const element = createElement(InvoiceDocument, { invoice, settings });
    const buffer = await renderToBuffer(element as never);
    const filename = `invoice-${invoice.number}-${Date.now()}.pdf`;
    pdfUrl = await storePdf(Buffer.from(buffer), filename);
    await db.invoice.update({ where: { id: invoiceId }, data: { pdfUrl } });
  } catch (err: unknown) {
    console.error('[reissueInvoice] PDF generation failed:', err);
  }

  // Re-send email (non-blocking)
  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const absolutePdfUrl = pdfUrl
    ? (pdfUrl.startsWith('http') ? pdfUrl : `${baseUrl}${pdfUrl}`)
    : null;

  import('@/lib/email').then(({ sendInvoiceEmail }) =>
    sendInvoiceEmail({
      to: invoice.project.user.email,
      name: invoice.project.user.name ?? 'Valued Customer',
      invoiceNumber: invoice.number,
      invoiceId: invoice.id,
      total: invoice.total,
      dueDate: invoice.dueDate ?? undefined,
      projectTitle: invoice.project.title,
      pdfUrl: absolutePdfUrl ?? undefined,
    })
  ).catch((err: unknown) => console.error('[email] reissue send failed:', err));

  revalidatePath('/admin/invoices');
  revalidatePath(`/admin/projects/${invoice.projectId}`);
  revalidatePath('/mypage/invoices');

  return { success: true };
}
