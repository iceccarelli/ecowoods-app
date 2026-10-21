/**
 * lib/order-product.ts — which product an Order is, and where the admin works on it.
 *
 * The paid report products all live in the same Order table, told apart only by
 * a marker line in Order.notes. The estimator desks for two of them
 * (/admin/quote-intelligence/[orderId], /admin/listing-floor-report/[orderId])
 * have no navigation entry of their own — they are per-order pages — so before
 * this the only way to reach one was to know the order id and type the URL. The
 * admin order screens now ask this module what an order is and link straight to
 * its desk.
 */
import { isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';
import { isFloorPlanOrder } from '@/lib/floor-plan/notes';
import { isRenovationCreditsOrder } from '@/lib/stripe-fulfillment';

export interface OrderProduct {
  label: string;
  /** Admin page where a person acts on this order, if the product has one. */
  deskHref: string | null;
  deskLabel: string | null;
}

export function describeOrderProduct(orderId: string, notes: string | null): OrderProduct {
  if (isWellInstalledReviewOrder(notes)) {
    return { label: 'Well-Installed Quote Review', deskHref: `/admin/quote-intelligence/${orderId}`, deskLabel: 'Open the review desk' };
  }
  if (isListingFloorReportOrder(notes)) {
    return { label: 'Pre-List Floor Condition Report', deskHref: `/admin/listing-floor-report/${orderId}`, deskLabel: 'Open the report desk' };
  }
  if (isFloorPlanOrder(notes)) return { label: 'Personal Floor Plan', deskHref: null, deskLabel: null };
  if (isRenovationCreditsOrder(notes)) return { label: 'Renovation Credits', deskHref: null, deskLabel: null };
  return { label: 'Shop order', deskHref: null, deskLabel: null };
}
