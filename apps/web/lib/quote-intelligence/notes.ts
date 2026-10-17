/**
 * lib/quote-intelligence/notes.ts — reading and writing the QI_REPORT marker
 * inside Order.notes.
 *
 * No schema change was available for "has this order's report been
 * published, and where". Order.notes is a free-text field the checkout route
 * already writes a tier line into (`Well-Installed Quote Review (Standard)`),
 * so publishing APPENDS a well-marked line rather than overwriting it — the
 * tier line is still there for the desk to read after a report ships.
 */

import { REVIEW_TIERS } from '@/content/constants/paid-review-product';

const MARKER = 'QI_REPORT:';

export function appendReportMarker(existingNotes: string | null, pdfUrl: string): string {
  const base = existingNotes ?? '';
  return `${base}\n${MARKER}${pdfUrl}`.trim();
}

export function extractReportUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${MARKER}(\\S+)`));
  return match ? match[1] : null;
}

/**
 * Reads the tier checkout wrote, e.g. "Well-Installed Quote Review (Rush)" ->
 * "rush". Returns the tier ID (matching content/constants/paid-review-product.ts),
 * not the display name, so callers can feed it straight to reviewTierConfig()/slaCopy().
 */
export function extractTierId(notes: string | null): 'standard' | 'rush' {
  if (!notes) return 'standard';
  const match = notes.match(/Well-Installed Quote Review \(([^)]+)\)/);
  return match?.[1]?.trim().toLowerCase() === 'rush' ? 'rush' : 'standard';
}

/**
 * True only when the FIRST line of the notes is the exact tier line checkout
 * writes (`Well-Installed Quote Review (<a REVIEW_TIERS name>)`). A substring
 * test would accept any order whose notes merely mention the product — the
 * notes of other products carry customer-influenced text — and an unknown
 * tier is not an order this product ever created.
 */
export function isWellInstalledReviewOrder(notes: string | null): boolean {
  if (!notes) return false;
  const firstLine = notes.split('\n', 1)[0]!.trim();
  return REVIEW_TIERS.some((t) => firstLine === `Well-Installed Quote Review (${t.name})`);
}

/* ── Intake claim ─────────────────────────────────────────────────────────
   The submit route must not let two requests send the same paid order's
   documents at once. No schema field exists for "an intake is in flight", so
   it is a lease line in Order.notes, written with a compare-and-swap on the
   notes text (see claimIntake). The lease expires, so a request that dies
   mid-send cannot lock the customer out. */

const CLAIM_MARKER = 'QI_INTAKE_CLAIM:';
const CLAIM_RE = /(?:^|\n)QI_INTAKE_CLAIM:([0-9a-f-]{36}):(\d+)(?=\n|$)/;

/** Longer than the email send can take, shorter than a customer would wait to retry. */
export const INTAKE_LEASE_MS = 2 * 60 * 1000;

export type IntakeClaim = { token: string; at: number };

export function readIntakeClaim(notes: string | null): IntakeClaim | null {
  const m = notes?.match(CLAIM_RE);
  return m ? { token: m[1]!, at: Number(m[2]) } : null;
}

export function isIntakeClaimLive(notes: string | null, now: number): boolean {
  const claim = readIntakeClaim(notes);
  return claim !== null && now - claim.at < INTAKE_LEASE_MS;
}

export function stripIntakeClaim(notes: string | null): string | null {
  if (!notes) return notes;
  return notes.replace(CLAIM_RE, '').trim();
}

/** Replaces any (expired) claim line; the tier line and other markers are untouched. */
export function withIntakeClaim(notes: string | null, token: string, now: number): string {
  return `${stripIntakeClaim(notes) ?? ''}\n${CLAIM_MARKER}${token}:${now}`.trim();
}
