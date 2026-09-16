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
export const QUOTE_RETENTION_NOTE =
  'The quote you sent is read once and is not kept on file — only this written report is. ' +
  'The report is yours; the document you sent remains yours too.';
