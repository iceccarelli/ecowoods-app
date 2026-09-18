/**
 * lib/well-installed-review.ts — pure helpers for the paid quote-review
 * product (EW-0001). Kept side-effect-free and separate from the API routes
 * so the pricing/eligibility logic is unit-testable without a database or a
 * Stripe key, matching the lib/shop.ts + shop.test.ts pattern already used
 * for the (authenticated) shop checkout.
 */

import { REVIEW_TIERS, reviewTierConfig, type ReviewTierConfig } from '@/content/constants/paid-review-product';

export type OrderLineItem = {
  productName: string;
  unit: 'EACH';
  quantity: number;
  unitPrice: number;
  selectedOptions: Array<{ name: string; choice: string; priceDelta: number }>;
  lineTotal: number;
};

/** Falls back to the standard tier — the same "never trust the client's price" rule as lib/shop.ts. */
export function resolveReviewTier(requested: string | undefined | null): ReviewTierConfig {
  return reviewTierConfig(requested) ?? REVIEW_TIERS[0];
}

export function buildReviewOrderItem(tier: ReviewTierConfig): OrderLineItem {
  return {
    productName: `Well-Installed Quote Review — ${tier.name}`,
    unit: 'EACH',
    quantity: 1,
    unitPrice: tier.priceCad,
    selectedOptions: [{ name: 'Tier', choice: tier.name, priceDelta: 0 }],
    lineTotal: tier.priceCad,
  };
}

export type SubmissionEligibility =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unpaid' }
  | { ok: false; reason: 'already_submitted' }
  | { ok: false; reason: 'email_mismatch' };

/**
 * Whether a paid order may accept the customer's quote document(s).
 *
 * Reuses the existing OrderStatus enum instead of adding a schema field:
 * PAID -> eligible once; the submit route moves it to FULFILLED, which then
 * reads as "already submitted" rather than a second, silent overwrite of
 * whatever the estimating desk already received.
 */
export function checkSubmissionEligibility(
  /** `status` is typed as `string` rather than Prisma's OrderStatus enum so this
   *  file stays free of a @prisma/client import — it is unit-tested without a
   *  database, the same way lib/shop.ts is. */
  order: { status: string; userEmail: string } | null,
  submittedEmail: string,
): SubmissionEligibility {
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'FULFILLED') return { ok: false, reason: 'already_submitted' };
  if (order.status !== 'PAID') return { ok: false, reason: 'unpaid' };
  if (order.userEmail.trim().toLowerCase() !== submittedEmail.trim().toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' };
  }
  return { ok: true };
}
