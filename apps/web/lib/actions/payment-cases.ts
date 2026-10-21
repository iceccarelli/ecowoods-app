'use server';

/**
 * Payment reconciliation server actions (admin only).
 *
 * Resolving a case RECORDS a decision (who, what, why, when). It never calls
 * Stripe and never moves money or credits: a refund is issued in the Stripe
 * dashboard, an invoice re-issued through the invoice tools, and only then is
 * the decision logged here.
 */

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { PaymentCaseResolution } from '@prisma/client';
import { recordCaseResolution } from '@/lib/payment-reconciliation';

export async function resolvePaymentCase(caseId: string, resolution: PaymentCaseResolution, note: string) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN' || !session.user.id) throw new Error('Unauthorized');

  const outcome = await recordCaseResolution({ caseId, adminId: session.user.id, resolution, note });

  revalidatePath('/admin/payment-cases');
  return { success: true, alreadyResolved: outcome.status === 'already_resolved' };
}
