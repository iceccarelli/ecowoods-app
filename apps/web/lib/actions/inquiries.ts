'use server';

/**
 * Inquiry server actions.
 * 문의 서버 액션
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { sendAdminNewInquiryEmail, sendInquiryReplyEmail } from '@/lib/email';

// ─── Submit general inquiry (public) ────────────────────────────────────────
const inquirySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(3000),
});

export type InquiryFormData = z.infer<typeof inquirySchema>;

export async function submitInquiry(data: InquiryFormData) {
  const parsed = inquirySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Please check the form and try again.' };
  }

  const session = await auth();

  const inquiry = await db.inquiry.create({
    data: {
      ...parsed.data,
      userId: session?.user?.id ?? null,
    },
  });

  sendAdminNewInquiryEmail({
    inquiryId: inquiry.id,
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
  }).catch((err) => console.error('[email] admin inquiry notify failed:', err));

  revalidatePath('/admin/inquiries');

  return { success: true, inquiryId: inquiry.id };
}

// ─── Admin: reply to inquiry ─────────────────────────────────────────────────
export async function replyToInquiry(inquiryId: string, content: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const inquiry = await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } });

  await db.inquiryReply.create({
    data: { inquiryId, fromAdmin: true, content },
  });

  await db.inquiry.update({
    where: { id: inquiryId },
    data: { status: 'IN_PROGRESS', updatedAt: new Date() },
  });

  // Email customer (non-blocking)
  sendInquiryReplyEmail({
    to: inquiry.email,
    name: inquiry.name,
    subject: inquiry.subject ?? '',
    replyContent: content,
    inquiryId,
  }).catch((err) => console.error('[email] inquiry reply send failed:', err));

  revalidatePath('/admin/inquiries');
  revalidatePath('/mypage/inquiries');

  return { success: true };
}

// ─── Admin: close inquiry ────────────────────────────────────────────────────
export async function closeInquiry(inquiryId: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.inquiry.update({ where: { id: inquiryId }, data: { status: 'RESOLVED' } });
  revalidatePath('/admin/inquiries');
}

// ─── Admin: update inquiry status ────────────────────────────────────────────
export async function updateInquiryStatus(inquiryId: string, status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await db.inquiry.update({ where: { id: inquiryId }, data: { status } });
  revalidatePath('/admin/inquiries');
}

// ─── Admin: update settings ───────────────────────────────────────────────────
export async function updateSettings(data: {
  defaultDepositPct?: number;
  defaultMidpointPct?: number;
  defaultFinalPct?: number;
  defaultTaxRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyNumberHst?: string;
  aiBankTransferInstructions?: string;
  aiEnabled?: boolean;
}) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const existing = await db.settings.findFirst();
  if (existing) {
    await db.settings.update({ where: { id: existing.id }, data });
  } else {
    await db.settings.create({ data });
  }

  revalidatePath('/admin/settings');
}
