/**
 * lib/quote-intelligence/events.ts — the product events for the paid
 * Well-Installed Quote Review, from checkout to a report being opened.
 *
 * WHY STRUCTURED LOG LINES AND NOT lib/analytics.ts OR THE FUNNEL LEDGER
 *
 *   - lib/analytics.ts `track()` is browser-only (it returns on the server) and
 *     its AnalyticsEvent union is a closed contract in an existing file. Every
 *     moment below happens in a route handler.
 *   - lib/funnel-ledger.ts records the six contractor-job stages, mirrored by a
 *     Prisma enum. A paid document review is none of them, and the schema is
 *     not edited by this build.
 *
 * So each moment is one JSON line on stdout — the same shape the submit route
 * already logs `well_installed_review.email_failed` in — which Vercel's log
 * drain can count without a schema change. Adding these names to the GA4
 * union and the ledger is an integration request (docs/quote-intelligence.md).
 *
 * WHAT AN EVENT MAY CARRY
 *
 * An order id, the tier, and counts. Never an email, a name, a file name, an
 * excerpt or a price typed from a customer's document: the product promises
 * the quote is read once and not kept, and a log line carrying its contents
 * would make that sentence false. `buildEventLine` enforces it by only
 * accepting the fields in `EventFields`.
 */

export type QuoteReviewEvent =
  /** Stripe Checkout session created for an Order (not yet paid). */
  | 'well_installed_review.checkout_created'
  /** The customer's quote document(s) reached the desk against a PAID order. */
  | 'well_installed_review.documents_received'
  /** The estimator published the Quote Intelligence Report. */
  | 'well_installed_review.report_published'
  /** The customer opened the report page with a matching email and a published report. */
  | 'well_installed_review.report_viewed';

export type EventFields = {
  orderId: string;
  tier?: 'standard' | 'rush';
  /** Amount charged before tax, from REVIEW_TIERS — never from a customer document. */
  subtotalCad?: number;
  documentCount?: number;
  quoteCount?: number;
  highRiskFlags?: number;
  questions?: number;
  comparisonVerdict?: string;
  alreadyPublished?: boolean;
};

const ALLOWED: ReadonlyArray<keyof EventFields> = [
  'orderId',
  'tier',
  'subtotalCad',
  'documentCount',
  'quoteCount',
  'highRiskFlags',
  'questions',
  'comparisonVerdict',
  'alreadyPublished',
];

/** Pure: the line that would be logged. Unknown keys and undefined values are dropped. */
export function buildEventLine(event: QuoteReviewEvent, fields: EventFields, at: Date = new Date()): string {
  const clean: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED) {
    const v = (fields as Record<string, unknown>)[key];
    if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) {
      clean[key] = v;
    }
  }
  return JSON.stringify({ event, at: at.toISOString(), ...clean });
}

/** Fire and forget. Recording must never be able to break the thing it records. */
export function recordQuoteReviewEvent(event: QuoteReviewEvent, fields: EventFields): void {
  try {
    console.info(buildEventLine(event, fields));
  } catch {
    /* a measurement failure never surfaces to the customer or the desk */
  }
}
