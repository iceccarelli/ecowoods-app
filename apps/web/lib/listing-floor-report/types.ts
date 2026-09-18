/**
 * lib/listing-floor-report/types.ts — the Pre-List Floor Condition Report
 * shape (EW-0003).
 */

export type Certainty = 'verified' | 'not_specified' | 'unclear' | 'cannot_determine' | 'inspection_needed';

export type Recommendation = 'recoat_ok' | 'sand_required' | 'leave_it' | 'cannot_determine_from_photos';

export type ComposeInput = {
  orderId: string;
  sku: 'photo' | 'onsite';
  /** ISO date the listing photos are being taken. */
  photographyDate: string;
  /** Injectable "now" for the schedule feasibility check. Defaults to `new Date()` — see schedule.ts, which takes the same parameter for the same reason: deterministic tests. */
  asOf?: Date;
  recommendation: Recommendation;
  findings: {
    finishWear: Certainty;
    woodDamage: Certainty;
    /** Physical fact a photo cannot establish. Forced to inspection_needed for the photo SKU — see compose.ts. */
    moisture: Certainty;
  };
  /** What the photos/visit show, in the estimator's own words. */
  present: string;
  /** What can't be determined from what was submitted, and why. */
  missing: string;
  askInWriting?: string;
};

export type ScheduleOutcome =
  | { feasible: true; day1: string; day2: string; day3: string }
  | { feasible: false; reason: 'window_closed'; nextWindowStart: string }
  | { feasible: false; reason: Exclude<Recommendation, 'recoat_ok'> };

export type ListingFloorReport = {
  orderId: string;
  sku: 'photo' | 'onsite';
  scoredOn: string; // date only
  recommendation: Recommendation;
  findings: ComposeInput['findings'];
  /** "$2.50–$4.00 per sq ft" from formatBand() — never a literal typed here. */
  band?: string;
  bandCaption?: string;
  schedule: ScheduleOutcome;
  present: string;
  missing: string;
  askInWriting: string[];
  estimatorDesk: string;
  refuses: readonly string[];
};

export type ComposeResult =
  | { ok: true; report: ListingFloorReport }
  | { ok: false; errors: string[] };
