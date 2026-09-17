/**
 * lib/floor-plan/notes.ts — reading and writing Order.notes for EW-0004.
 *
 * Two markers, both this product's own — never QI_REPORT (EW-0002) or
 * LFR_REPORT (EW-0003):
 *   FP_DESIGN:<code>  the share code paid for, written at checkout
 *   FP_REPORT:<url>   the generated PDF, appended once, by the [id] page
 *                      itself the first time it runs (this product needs no
 *                      admin step — see docs/floor-plan.md).
 */

const PRODUCT_MARKER = 'Personal Floor Plan';
const DESIGN_MARKER = 'FP_DESIGN:';
const REPORT_MARKER = 'FP_REPORT:';

export function buildCheckoutNotes(designCode: string): string {
  return `${PRODUCT_MARKER}\n${DESIGN_MARKER}${designCode}`;
}

export function isFloorPlanOrder(notes: string | null): boolean {
  return !!notes && notes.includes(PRODUCT_MARKER);
}

export function extractDesignCode(notes: string | null): string | null {
  if (!notes) return null;
  const line = notes.split('\n').find((l) => l.startsWith(DESIGN_MARKER));
  return line ? line.slice(DESIGN_MARKER.length) : null;
}

export function appendReportMarker(existingNotes: string | null, pdfUrl: string): string {
  const base = existingNotes ?? '';
  if (base.includes(REPORT_MARKER)) return base;
  return `${base}\n${REPORT_MARKER}${pdfUrl}`.trim();
}

export function extractReportUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${REPORT_MARKER}(\\S+)`));
  return match ? match[1] : null;
}
