/**
 * lib/paid-work-overdue.ts — which paid, intake-complete orders are still
 * waiting on a published report past the point the desk should have acted.
 *
 * Pure: takes order rows and "now". The cron route supplies the rows and sends
 * the alert. These thresholds are INTERNAL alert points in elapsed hours, not
 * the customer-facing commitments (those stay in the product constants and are
 * business-day wording): they exist so a paid job nobody has touched is
 * noticed, not to promise anything. `updatedAt` is the closest available
 * "intake time" (the last write to the row), so a row touched for another
 * reason is aged from that touch; the alert can only be late, never early.
 */

import { extractReportUrl, extractTierId, isWellInstalledReviewOrder } from '@/lib/quote-intelligence/notes';
import { extractListingReportSku, extractListingReportUrl, hasIntakeMarker, isListingFloorReportOrder } from '@/lib/listing-floor-report/notes';

export type OverdueOrderRow = { id: string; status: string; notes: string | null; updatedAt: Date };
export type OverdueItem = { orderId: string; product: 'Well-Installed Quote Review' | 'Pre-List Floor Condition Report'; detail: string; hoursWaiting: number };

const HOURS = { quoteRush: 8, quoteStandard: 24, listingPhoto: 48 } as const;
/** Older than this is a different problem (abandoned, or handled outside the system) and is not nagged about daily. */
export const MAX_AGE_DAYS = 30;

export function findOverdueOrders(rows: OverdueOrderRow[], now: Date): OverdueItem[] {
  const out: OverdueItem[] = [];
  for (const o of rows) {
    const hours = Math.floor((now.getTime() - o.updatedAt.getTime()) / 3_600_000);
    if (hours < 0 || hours > MAX_AGE_DAYS * 24) continue;

    // Documents received (FULFILLED at intake) and no report stored yet.
    if (isWellInstalledReviewOrder(o.notes) && o.status === 'FULFILLED' && !extractReportUrl(o.notes)) {
      const tier = extractTierId(o.notes);
      if (hours >= (tier === 'rush' ? HOURS.quoteRush : HOURS.quoteStandard)) {
        out.push({ orderId: o.id, product: 'Well-Installed Quote Review', detail: `${tier} tier, documents received, no report published`, hoursWaiting: hours });
      }
    }

    // Photo report: intake on file, still PAID, no report stored yet. (Onsite depends on a booked visit, so it is not aged here.)
    if (
      isListingFloorReportOrder(o.notes) &&
      o.status === 'PAID' &&
      hasIntakeMarker(o.notes) &&
      !extractListingReportUrl(o.notes) &&
      extractListingReportSku(o.notes) === 'photo' &&
      hours >= HOURS.listingPhoto
    ) {
      out.push({ orderId: o.id, product: 'Pre-List Floor Condition Report', detail: 'photo report, intake received, no report published', hoursWaiting: hours });
    }
  }
  return out.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
}
