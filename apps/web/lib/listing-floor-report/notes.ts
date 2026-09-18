/**
 * lib/listing-floor-report/notes.ts — reading and writing Order.notes for
 * EW-0003. Uses its own `LFR_REPORT:` marker — deliberately NOT `QI_REPORT:`,
 * which belongs to EW-0002's lib/quote-intelligence/notes.ts. The two
 * products share the Order/OrderItem tables but must never share a marker,
 * or an order could be misread as the wrong product's report.
 */

const MARKER = 'LFR_REPORT:';

export function appendListingReportMarker(existingNotes: string | null, pdfUrl: string): string {
  const base = existingNotes ?? '';
  return `${base}\n${MARKER}${pdfUrl}`.trim();
}

export function extractListingReportUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${MARKER}(\\S+)`));
  return match ? match[1] : null;
}

/** Reads the SKU checkout wrote, e.g. "Listing Floor Report (onsite)" -> "onsite". */
export function extractListingReportSku(notes: string | null): 'photo' | 'onsite' {
  if (!notes) return 'photo';
  const match = notes.match(/Listing Floor Report \(([^)]+)\)/);
  return match?.[1]?.trim().toLowerCase() === 'onsite' ? 'onsite' : 'photo';
}

export function isListingFloorReportOrder(notes: string | null): boolean {
  return !!notes && notes.includes('Listing Floor Report');
}

/**
 * A submitted-but-not-yet-published marker, distinct from `Order.status`.
 * This product deliberately keeps `FULFILLED` reserved for "the report was
 * generated and sent" (per the spec: "documents-received-without-report is
 * not fulfillment"), so a second signal is needed to reject a second intake
 * submission while the order still just sits at PAID.
 */
const INTAKE_MARKER = 'LFR_INTAKE:received';

export function appendIntakeMarker(existingNotes: string | null): string {
  const base = existingNotes ?? '';
  if (base.includes(INTAKE_MARKER)) return base;
  return `${base}\n${INTAKE_MARKER}`.trim();
}

export function hasIntakeMarker(notes: string | null): boolean {
  return !!notes && notes.includes(INTAKE_MARKER);
}

/**
 * The listing details the estimator workbench needs (photography date above
 * all — it drives the schedule) are captured once at intake and read back
 * here, rather than re-typed a second time by an estimator who wasn't there
 * for the original submission.
 */
export type ListingMeta = {
  role: 'agent' | 'seller';
  brokerage?: string;
  phone?: string;
  address: string;
  city: string;
  photographyDate: string;
  listingGoLiveDate?: string;
  message?: string;
};

const META_MARKER = 'LFR_META:';

export function appendMetaMarker(existingNotes: string | null, meta: ListingMeta): string {
  const base = existingNotes ?? '';
  return `${base}\n${META_MARKER}${JSON.stringify(meta)}`.trim();
}

export function extractMeta(notes: string | null): ListingMeta | null {
  if (!notes) return null;
  const line = notes.split('\n').find((l) => l.startsWith(META_MARKER));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(META_MARKER.length)) as ListingMeta;
  } catch {
    return null;
  }
}
