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

export function isWellInstalledReviewOrder(notes: string | null): boolean {
  return !!notes && notes.includes('Well-Installed Quote Review');
}
