/**
 * content/constants/quote-intelligence.ts — report title, refusals and SLA
 * copy for the Quote Intelligence Report (EW-0002). Carries no dollar figure
 * of its own; turnaround/price copy is read from
 * content/constants/paid-review-product.ts so there is exactly one place
 * that number is allowed to change.
 */

import { REVIEW_TIERS, WELL_INSTALLED_REVIEW_PRODUCT, type ReviewTier } from './paid-review-product';

export const QUOTE_INTELLIGENCE_REPORT_TITLE = 'Quote Intelligence Report';

export const QUOTE_INTELLIGENCE_REFUSES: readonly string[] = WELL_INSTALLED_REVIEW_PRODUCT.refuses;

export const ESTIMATOR_DESK_NAME = 'Ecowoods estimating desk';

export function slaCopy(tier: ReviewTier): string {
  const config = REVIEW_TIERS.find((t) => t.id === tier);
  return config ? config.turnaround : 'a written reply per your tier';
}
