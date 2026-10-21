import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

/** Recovery emails are stored and matched lowercased; legacy rows may not be. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export function hashConfirmToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newConfirmToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashConfirmToken(token) };
}

/**
 * Somebody who booked, requested an estimate or sent photos has finished:
 * cancel any pending reminder for that address (case-insensitive, so legacy
 * mixed-case rows are caught too). Best-effort and never throws.
 */
export async function markRecoveryConverted(email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    await db.quoteRecovery.updateMany({
      where: { email: { equals: normaliseEmail(email), mode: 'insensitive' }, sentAt: null, convertedAt: null },
      data: { convertedAt: new Date() },
    });
  } catch (err) {
    console.error(
      JSON.stringify({ event: 'quote_recovery.convert_failed', error: err instanceof Error ? err.message : 'unknown' }),
    );
  }
}
