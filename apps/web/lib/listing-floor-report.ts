/**
 * lib/listing-floor-report.ts — pure helpers for the Pre-List Floor Condition
 * Report (EW-0003). Same shape as lib/well-installed-review.ts (EW-0001): a
 * NEW module, not an extension of it — a different buyer, a different SKU,
 * and this spec was explicit that EW-0001/EW-0002 files are not to be
 * touched.
 */

import { LISTING_REPORT_SKUS, listingReportSkuConfig, type ListingReportSkuConfig } from '@/content/constants/listing-floor-report-product';

export type OrderLineItem = {
  productName: string;
  unit: 'EACH';
  quantity: number;
  unitPrice: number;
  selectedOptions: Array<{ name: string; choice: string; priceDelta: number }>;
  lineTotal: number;
};

/** Falls back to the photo SKU — never trust the client's price or SKU choice past this point. */
export function resolveListingReportSku(requested: string | undefined | null): ListingReportSkuConfig {
  return listingReportSkuConfig(requested) ?? LISTING_REPORT_SKUS[0];
}

export function buildListingReportOrderItem(sku: ListingReportSkuConfig): OrderLineItem {
  return {
    productName: `Pre-List Floor Condition Report — ${sku.name}`,
    unit: 'EACH',
    quantity: 1,
    unitPrice: sku.priceCad,
    selectedOptions: [{ name: 'SKU', choice: sku.name, priceDelta: 0 }],
    lineTotal: sku.priceCad,
  };
}

export type SubmissionEligibility =
  | { ok: true }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unpaid' }
  | { ok: false; reason: 'already_submitted' }
  | { ok: false; reason: 'email_mismatch' };

/**
 * Unlike EW-0001, `FULFILLED` here is reserved for "the report was published"
 * (see lib/listing-floor-report/notes.ts's INTAKE_MARKER comment), so
 * "already submitted" is passed in explicitly rather than inferred from
 * `status` alone — a PAID order that already has an LFR_INTAKE marker must
 * still reject a second intake even though its status hasn't moved to
 * FULFILLED yet.
 */
export function checkListingReportSubmissionEligibility(
  order: { status: string; userEmail: string; alreadySubmitted: boolean } | null,
  submittedEmail: string,
): SubmissionEligibility {
  if (!order) return { ok: false, reason: 'not_found' };
  if (order.status === 'PENDING' || order.status === 'CANCELLED') return { ok: false, reason: 'unpaid' };
  if (order.alreadySubmitted || order.status === 'FULFILLED') return { ok: false, reason: 'already_submitted' };
  if (order.status !== 'PAID') return { ok: false, reason: 'unpaid' };
  if (order.userEmail.trim().toLowerCase() !== submittedEmail.trim().toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' };
  }
  return { ok: true };
}
