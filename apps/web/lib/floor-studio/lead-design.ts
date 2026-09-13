/**
 * lib/floor-studio/lead-design.ts — SALE-01. What floor did this lead want?
 *
 * THE PROCESS THIS REPLACES
 *
 * studio-config.ts describes the workflow in its own comment: "the desk pastes
 * it back into /floor-studio and sees the floor". That is literally what
 * happened. /api/leads appended the share code verbatim into the free-text
 * `notes` field, an estimator read it out of an email, and pasted it into the
 * address bar. PG0 confirmed nothing under app/admin/ has ever decoded one.
 *
 * It worked, and it is the kind of working that stops the moment somebody
 * edits a note, forwards a truncated email, or hires a second estimator.
 *
 * TWO SOURCES, ONE ANSWER
 *
 * New leads carry `designCode` as a column. Every lead written before SALE-01
 * has the code inside `notes` and nothing else, and there are real ones —
 * so the fallback reads them rather than declaring them unreadable. A backfill
 * migration would have been the alternative; it would have had to parse the
 * same prose, once, with no way to check its work afterwards.
 */
import { decodeStudioDesign, type StudioDesign } from './studio-config';

/** Exactly what /api/leads writes. Changing one means changing both. */
export const NOTES_PREFIX = 'Floor Studio design code: ';

/**
 * Pull the share code out of a lead.
 *
 * The column wins. The notes fallback takes the FIRST line beginning with the
 * prefix and stops at the newline — a note is free text an estimator may have
 * typed into, and reading to the end of the field would swallow their comments
 * into the code.
 */
export function designCodeFor(quote: {
  designCode?: string | null;
  notes?: string | null;
}): string | null {
  if (quote.designCode) return quote.designCode;
  if (!quote.notes) return null;
  for (const line of quote.notes.split('\n')) {
    const at = line.indexOf(NOTES_PREFIX);
    if (at !== -1) {
      const code = line.slice(at + NOTES_PREFIX.length).trim();
      if (code) return code;
    }
  }
  return null;
}

/**
 * The design itself, decoded against the LIVE catalogue.
 *
 * Returns null for a floor this business no longer lays, because
 * `decodeStudioDesign` validates every field against the catalogue rather than
 * trusting the string. That is the behaviour we want on an estimator's screen:
 * a retired floor must show as nothing to decode, not as a confident
 * description of something that cannot be bought.
 */
export function designFor(quote: {
  designCode?: string | null;
  notes?: string | null;
}): StudioDesign | null {
  const code = designCodeFor(quote);
  return code ? decodeStudioDesign(code) : null;
}

/**
 * The species list for `QuoteRequest.species`, derived from a design.
 *
 * That column is `Json?` holding `string[]`, and until now it was populated
 * only by an admin typing into the quote builder — the same admin who had just
 * read the species out of the note. One item, because a design names one floor;
 * the column is an array because the builder lets an estimator add more after
 * a site visit, and this seeds it rather than replacing that.
 */
export function speciesFromDesign(design: StudioDesign | null, rateKeyOf: (productId: string) => string | undefined): string[] | null {
  if (!design) return null;
  const key = rateKeyOf(design.config.productId);
  return key ? [key] : null;
}
