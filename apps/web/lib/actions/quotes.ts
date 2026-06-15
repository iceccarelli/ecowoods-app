'use server';

/**
 * Quote Request server actions.
 * 견적 요청 서버 액션
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ─── Zod schema for the full quote form ─────────────────────────────────────
const quoteFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  province: z.string().length(2, 'Select a province'),
  address: z.string().optional(),
  species: z.array(z.string()).min(1, 'Select at least one species'),
  squareFeet: z.coerce.number().positive().optional(),
  projectType: z.enum(['new_build', 'renovation']),
  timeline: z.enum(['asap', '1-2_weeks', '1_month', 'flexible']),
  budgetRange: z.string().optional(),
  service: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

// ─── Submit a new quote (public — no auth required) ──────────────────────────
export async function submitQuoteRequest(data: QuoteFormData) {
  const session = await auth();

  const quote = await db.quoteRequest.create({
    data: {
      ...data,
      userId: session?.user?.id ?? null,
    },
  });

  // Notify admin immediately (non-blocking, lazy import to avoid init-time side effects)
  import('@/lib/email').then(({ sendAdminNewQuoteEmail }) =>
    sendAdminNewQuoteEmail({
      quoteId: quote.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      province: data.province,
      species: data.species,
      squareFeet: data.squareFeet,
      service: data.service,
      notes: data.notes,
    })
  ).catch((err: unknown) => console.error('[email] admin quote notify failed:', err));

  revalidatePath('/admin/quotes');

  return {
    success: true,
    quoteId: quote.id,
    message: session?.user
      ? 'Your quote request has been submitted and is visible in your MyPage.'
      : 'Quote request received! Create an account with this email to track it in your portal.',
  };
}

// ─── Admin: save estimate (견적서) data ─────────────────────────────────────
export type EstimateLineItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

export async function saveEstimate(
  quoteId: string,
  data: {
    quotedAmount: number;
    quoteTaxRate: number;
    quoteLineItems: EstimateLineItem[];
    quoteNotes?: string;
    validDays?: number;
  }
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (data.validDays ?? 30));

  // Serialize through JSON to strip non-plain types before passing to Prisma Json field
  const lineItemsJson = JSON.parse(JSON.stringify(data.quoteLineItems));

  try {
    await db.quoteRequest.update({
      where: { id: quoteId },
      data: {
        quotedAmount:    data.quotedAmount,
        quoteTaxRate:    data.quoteTaxRate,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quoteLineItems:  lineItemsJson as any,
        quoteNotes:      data.quoteNotes ?? null,
        quoteValidUntil: validUntil,
        status:          'PENDING' as const,
      },
    });
  } catch (err: unknown) {
    console.error('[saveEstimate] DB update failed:', err);
    throw err;
  }

  revalidatePath(`/admin/quotes/${quoteId}`);
  return { success: true };
}

// ─── Admin: send estimate email to customer ──────────────────────────────────
export async function sendEstimateEmail(quoteId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const quote = await db.quoteRequest.findUniqueOrThrow({ where: { id: quoteId } });
  if (!quote.quotePdfUrl) throw new Error('Generate the PDF first before sending.');
  // data: URLs cannot be linked in emails — require regeneration with real storage
  if (quote.quotePdfUrl.startsWith('data:')) {
    throw new Error('Please click "Generate PDF" again to create a shareable link before sending.');
  }

  const { sendEmail } = await import('@/lib/email');
  const settings = await db.settings.findFirst();

  // Build absolute URL (required for email links)
  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const pdfUrl = quote.quotePdfUrl.startsWith('http')
    ? quote.quotePdfUrl
    : `${baseUrl}${quote.quotePdfUrl}`;
  const viewUrl = `${baseUrl}/docs/quote/${quoteId}`;

  const totalFormatted = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })
    .format(Number(quote.quotedAmount ?? 0) * (1 + Number(quote.quoteTaxRate ?? 13) / 100));

  await sendEmail({
    to: quote.email,
    subject: `Your Ecowoods Estimate — ${totalFormatted} CAD`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;color:#1a0f08;">
        <div style="background:#1a0f08;padding:20px 32px;text-align:center;">
          <h1 style="color:#fdfbf6;margin:0;font-size:18px;font-weight:300;letter-spacing:2px;">ECOWOODS</h1>
        </div>
        <div style="padding:32px;">
          <h2>Hi ${quote.name},</h2>
          <p>Thank you for reaching out. Please find your personalized estimate via the link below.</p>
          <div style="background:#faf6ef;padding:16px;border-radius:8px;margin:20px 0;text-align:center;">
            <div style="font-size:13px;color:#6b5d52;margin-bottom:4px;">Estimated Total (incl. HST)</div>
            <div style="font-size:26px;font-weight:700;color:#c87e4f;">${totalFormatted} CAD</div>
            ${quote.quoteValidUntil ? `<div style="font-size:12px;color:#9a8a7a;margin-top:4px;">Valid until ${new Date(quote.quoteValidUntil).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${viewUrl}" style="display:inline-block;background:#c87e4f;color:#fdfbf6;padding:13px 28px;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
              View Estimate Online
            </a>
          </div>
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${pdfUrl}" style="color:#6b5d52;font-size:13px;font-weight:600;text-decoration:underline;">
              📄 Download PDF directly
            </a>
          </div>
          <p style="color:#6b5d52;font-size:13px;">
            To accept this estimate and proceed, simply reply to this email or call us at
            <strong>${settings?.companyPhone ?? '(416) 249-1276'}</strong>.
            We will then prepare a formal contract for your review.
          </p>
        </div>
        <div style="background:#f5efe6;padding:14px 32px;text-align:center;font-size:12px;color:#6b5d52;">
          ${settings?.companyName ?? 'Ecowoods Hardwood Flooring Inc.'} · ${settings?.companyAddress ?? ''}
        </div>
      </div>
    `,
    text: `Hi ${quote.name},\n\nYour Ecowoods estimate is ready.\nTotal: ${totalFormatted} CAD\n\nView online: ${viewUrl}\nDownload PDF: ${pdfUrl}\n\nTo proceed, reply to this email or call ${settings?.companyPhone ?? '(416) 249-1276'}.`,
  });

  await db.quoteRequest.update({
    where: { id: quoteId },
    data: { quoteIssuedAt: new Date(), status: 'QUOTED' },
  });

  revalidatePath(`/admin/quotes/${quoteId}`);
  return { success: true };
}

// ─── Admin: update quote status ──────────────────────────────────────────────
export async function updateQuoteStatus(quoteId: string, status: string, adminNotes?: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.quoteRequest.update({
    where: { id: quoteId },
    data: { status: status as never, adminNotes },
  });

  revalidatePath('/admin/quotes');
  revalidatePath(`/admin/quotes/${quoteId}`);
}

// ─── Admin: convert quote to project ────────────────────────────────────────
export async function convertQuoteToProject(
  quoteId: string,
  projectData: {
    userId: string;
    title: string;
    description?: string;
    contractValue: number;
    depositPct?: number;
    midpointPct?: number;
    finalPct?: number;
    taxRate?: number;
    startDate?: string;
  }
) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const [quote, settings] = await Promise.all([
    db.quoteRequest.findUniqueOrThrow({ where: { id: quoteId } }),
    db.settings.findFirst(),
  ]);

  const project = await db.project.create({
    data: {
      userId: projectData.userId,
      title: projectData.title,
      description: projectData.description,
      address: quote.address,
      city: quote.city,
      province: quote.province,
      species: quote.species as import('@prisma/client').Prisma.InputJsonValue | undefined ?? undefined,
      squareFeet: quote.squareFeet,
      contractValue: projectData.contractValue,
      depositPct: projectData.depositPct ?? settings?.defaultDepositPct ?? 30,
      midpointPct: projectData.midpointPct ?? settings?.defaultMidpointPct ?? 40,
      finalPct: projectData.finalPct ?? settings?.defaultFinalPct ?? 30,
      taxRate: projectData.taxRate ?? settings?.defaultTaxRate ?? 13,
      startDate: projectData.startDate ? new Date(projectData.startDate) : null,
    },
  });

  // Link quote to project and mark as converted
  await db.quoteRequest.update({
    where: { id: quoteId },
    data: { projectId: project.id, status: 'ACCEPTED' },
  });

  revalidatePath('/admin/quotes');
  revalidatePath('/admin/projects');

  return { success: true, projectId: project.id };
}
