/**
 * lib/quote-intelligence/wording.ts — the PIPEDA line for the delivered
 * report, kept in one place rather than typed at each of the desk UI, the
 * publish email and the customer report page.
 *
 * The competitor's quote itself is never retained (same rule as
 * /api/quote-review — email-only, no blob, no disk). The REPORT is different:
 * it is Ecowoods' own written work product about the customer's document, not
 * the document itself, so it is the one thing here that is stored and linked
 * back to the customer.
 */
import type { FindingStatus } from './types';

export const QUOTE_RETENTION_NOTE =
  'The quote you sent is read once and is not kept on file — only this written report is. ' +
  'The report is yours; the document you sent remains yours too.';

/**
 * The customer-facing name of each status. `verified` is deliberately NOT
 * rendered as "verified": the only thing checked is that the document says
 * it. Nothing in this report verifies the work, the product, the subfloor or
 * the price.
 */
export const STATUS_LABEL: Record<FindingStatus, string> = {
  verified: 'Stated in the quote',
  not_specified: 'Not specified',
  unclear: 'Unclear',
  cannot_determine: 'Cannot determine',
  inspection_needed: 'Inspection needed',
};

export const STATUS_MEANING: Record<FindingStatus, string> = {
  verified:
    'The document states it, and we show where. This confirms the wording only — not that the work will be done, or done correctly.',
  not_specified: 'The document is silent on it. Whether it is included is not established.',
  unclear: 'The document mentions it, but the wording does not settle what is included. We show where.',
  cannot_determine: 'We could not read it from what was sent — for example an unreadable photo or a missing page.',
  inspection_needed: 'No document can settle this. It needs someone to look at the floor or the subfloor on site.',
};

export const REPORT_LIMITS_NOTE =
  'This is a written read of documents, not an inspection, a measurement, a structural or moisture assessment, or a price. ' +
  'Nothing in it has been checked on site, and nothing in it is a professional certification of the work.';
