/**
 * lib/paid-work-overdue.ts — which paid orders need the desk: a customer who
 * paid and never sent their intake, or intake received and still no published
 * report, past the point the desk should have acted.
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
import { hasReportNotified } from '@/lib/report-delivery';

export type OverdueOrderRow = { id: string; status: string; notes: string | null; updatedAt: Date };
export type OverdueItem = { orderId: string; product: 'Well-Installed Quote Review' | 'Pre-List Floor Condition Report'; detail: string; hoursWaiting: number };

const HOURS = { quoteRush: 8, quoteStandard: 24, listingPhoto: 48, notificationPending: 4, intakeMissing: 48 } as const;
/** Older than this is a different problem (abandoned, or handled outside the system) and is not nagged about daily. */
export const MAX_AGE_DAYS = 30;

export function findOverdueOrders(rows: OverdueOrderRow[], now: Date): OverdueItem[] {
  const out: OverdueItem[] = [];
  for (const o of rows) {
    const hours = Math.floor((now.getTime() - o.updatedAt.getTime()) / 3_600_000);
    if (hours < 0 || hours > MAX_AGE_DAYS * 24) continue;

    // A PAID order with no intake is a customer who paid and never sent what the work needs
    // (Well-Installed intake moves PAID → FULFILLED; Pre-List records the intake marker).
    // Nothing else notices: no report is waiting, so no later check can fire.
    if (o.status === 'PAID' && hours >= HOURS.intakeMissing) {
      if (isWellInstalledReviewOrder(o.notes)) {
        out.push({ orderId: o.id, product: 'Well-Installed Quote Review', detail: 'paid, no documents received; contact the customer', hoursWaiting: hours });
      } else if (isListingFloorReportOrder(o.notes) && !hasIntakeMarker(o.notes)) {
        out.push({ orderId: o.id, product: 'Pre-List Floor Condition Report', detail: 'paid, intake not received; contact the customer', hoursWaiting: hours });
      }
    }

    // Alert for unpublished work or a stored report whose customer notification is unconfirmed.
    if (isWellInstalledReviewOrder(o.notes) && o.status === 'FULFILLED') {
      const reportUrl = extractReportUrl(o.notes);
      if (reportUrl) {
        if (!hasReportNotified(o.notes) && hours >= HOURS.notificationPending) {
          out.push({ orderId: o.id, product: 'Well-Installed Quote Review', detail: 'report is stored, customer notification not confirmed; retry customer email', hoursWaiting: hours });
        }
      } else {
        const tier = extractTierId(o.notes);
        if (hours >= (tier === 'rush' ? HOURS.quoteRush : HOURS.quoteStandard)) {
          out.push({ orderId: o.id, product: 'Well-Installed Quote Review', detail: `${tier} tier, documents received, no report published`, hoursWaiting: hours });
        }
      }
    }

    // Alert for both unpublished photo work and a stored report whose customer notification is unconfirmed.
    if (isListingFloorReportOrder(o.notes)) {
      const reportUrl = extractListingReportUrl(o.notes);
      if (reportUrl) {
        if (o.status === 'FULFILLED' && !hasReportNotified(o.notes) && hours >= HOURS.notificationPending) {
          out.push({ orderId: o.id, product: 'Pre-List Floor Condition Report', detail: 'report is stored, customer notification not confirmed; retry customer email', hoursWaiting: hours });
        }
      } else if (
        o.status === 'PAID' &&
        hasIntakeMarker(o.notes) &&
        extractListingReportSku(o.notes) === 'photo' &&
        hours >= HOURS.listingPhoto
      ) {
        out.push({ orderId: o.id, product: 'Pre-List Floor Condition Report', detail: 'photo report, intake received, no report published', hoursWaiting: hours });
      }
    }
  }
  return out.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
}
