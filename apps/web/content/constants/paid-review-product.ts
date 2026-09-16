/**
 * content/constants/paid-review-product.ts — the Well-Installed Quote Review,
 * a NEW paid product declared for EW-0001 and NOT yet a confirmed commercial
 * term of this business.
 *
 * WHY THIS FIGURE IS WRITTEN HERE INSTEAD OF LEFT NULL
 *
 * `studio-products.ts` sets `priceCad: null` on its unpublished rungs because
 * publishing a dollar figure to the public is a decision nobody but the owner
 * gets to make in a patch. This file makes the same call for the same reason,
 * but ships the number anyway, for one difference: the figure below did not
 * come from an engineer picking a round one. It is the ecowoods-opportunity
 * agent's researched recommendation — $179 CAD standard / $249 CAD rush,
 * benchmarked against an independent virtual inspection at ~$295 CAD and
 * interior consults at $500–$900 CAD — attached to
 * `/Users/grimaldi/ecowoods-factory/results/opportunity.md`.
 *
 * That is a prepared patch, not a confirmed price. Per
 * ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md §7 and §23, "new public price
 * claims" and "changes to commercial terms" are Class C — human business
 * confirmation required before the claim goes live to a real customer. This
 * PR ships on a factory branch behind a pull request precisely so that gate
 * exists: nothing here reaches a paying customer until the business owner
 * reviews this figure, changes it or confirms it, and merges and deploys with
 * live Stripe keys. Do not treat this constant as owner-confirmed pricing —
 * treat it as the number the PR is asking the owner to confirm.
 *
 * WHAT THIS PRODUCT IS AND IS NOT
 *
 * It is a written read of a document the customer already has — the same
 * service /api/quote-review already performs for $0, now with priority and a
 * committed turnaround attached. It is explicitly NOT a ranking or naming of
 * any competitor's quote: see content/quote-check/scope-items.ts for why that
 * line is not crossed anywhere on this site (Competition Act s.74.01(1)(b),
 * Bill C-59 exposure, Energizer Brands v Gillette 2023 FC 804).
 */

export type ReviewTier = 'standard' | 'rush';

export type ReviewTierConfig = {
  id: ReviewTier;
  name: string;
  priceCad: number;
  turnaround: string;
};

export const WELL_INSTALLED_REVIEW_PRODUCT = {
  slug: 'well-installed-review',
  name: 'Well-Installed Quote Review',
  deliverable:
    'A written, 1–2 page read of the quote(s) you already have, scored against the Ecowoods Well-Installed Framework and the published scope items: what is present, what is missing, and the exact questions to send back in writing.',
  refuses: [
    'not a ranking or comparison of named companies',
    'not a second price for the same job — no dollar figure is put on anything a quote leaves out',
    'not a substitute for an in-home measure',
  ],
} as const;

export const REVIEW_TIERS: readonly ReviewTierConfig[] = [
  { id: 'standard', name: 'Standard', priceCad: 179, turnaround: 'Written reply within 1 business day' },
  { id: 'rush', name: 'Rush', priceCad: 249, turnaround: 'Written reply same business day' },
] as const;

export function reviewTierConfig(tier: string | undefined | null): ReviewTierConfig | undefined {
  return REVIEW_TIERS.find((t) => t.id === tier);
}
