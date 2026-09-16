/**
 * content/constants/listing-floor-report-product.ts — the Pre-List Floor
 * Condition Report (EW-0003), a NEW paid product and NOT yet a confirmed
 * commercial term of this business.
 *
 * Same Class C posture as content/constants/paid-review-product.ts (EW-0001):
 * the $349/$799 figures are the ecowoods-product agent's researched
 * recommendation, not an owner-confirmed price. Per
 * ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md §7/§23, a new public price claim
 * is Class C — this file, and the PR it ships in, is the prepared patch
 * waiting on that confirmation, not a live commercial term.
 *
 * This product prints the EXISTING published service bands
 * (content/constants/pricing.ts — SCREEN_RECOAT, FULL_SAND_FINISH) via
 * formatBand(); it never invents a new $/sq ft figure. The $349/$799 here are
 * the fee for the REPORT itself, a different thing from the installed-work
 * bands it references.
 */

export type ListingReportSku = 'photo' | 'onsite';

export type ListingReportSkuConfig = {
  id: ListingReportSku;
  name: string;
  priceCad: number;
  sla: string;
};

export const LISTING_FLOOR_REPORT_PRODUCT = {
  slug: 'listing-floor-report',
  name: 'Pre-List Floor Condition Report',
  deliverable:
    'A dated, written condition read of your hardwood before the listing photos: what the finish shows, what the wood shows, and — when a photo can support the call — whether a recoat before photography is realistic on your timeline.',
  refuses: [
    'not a home inspection, an expert-witness letter, or a sale-price appraisal',
    'not a claim that any work will raise the sale price, shorten days on market, or beat another offer by a dollar figure',
    'not a COI or WSIB number that is not already on file',
    'not a ranking of contractors',
    'not a fixed price — published bands are ranges; the fixed price is written after an in-home measure',
  ],
} as const;

export const LISTING_REPORT_SKUS: readonly ListingReportSkuConfig[] = [
  { id: 'photo', name: 'Photo report', priceCad: 349, sla: 'Written report within 48 hours of complete photos' },
  { id: 'onsite', name: 'Onsite letter', priceCad: 799, sla: 'Letter after the in-home measure, booked around your listing date' },
] as const;

export function listingReportSkuConfig(sku: string | undefined | null): ListingReportSkuConfig | undefined {
  return LISTING_REPORT_SKUS.find((s) => s.id === sku);
}
