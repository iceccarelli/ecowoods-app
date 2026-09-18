/**
 * lib/quote-intelligence/types.ts — the Quote Intelligence Report shape
 * (EW-0002, extended for multi-quote reads). The report is the paid
 * deliverable EW-0001 sold: EW-0001 gets the customer's document(s) to the
 * estimating desk, this turns the estimator's read of them into something the
 * customer actually receives.
 *
 * FIVE STATUSES, NOT YES/NO
 *
 * A quote is a document, not a floor. The estimator can only ever say what the
 * document states — never that the work will be done, or done correctly. So
 * every scope item and every framework criterion is recorded against each
 * quote as exactly one of:
 *
 *   verified          — the document states it, and the finding points to where
 *                       (page + excerpt). Rendered "Stated in the quote", never
 *                       "verified", because it verifies the wording only.
 *   not_specified     — the document is silent on it.
 *   unclear           — the document mentions it, but the wording does not
 *                       settle what is included. Also points to where.
 *   cannot_determine  — the estimator could not read it from what was sent
 *                       (illegible photo, missing page).
 *   inspection_needed — no document could settle it; it needs someone on site.
 *
 * These map to the doctrine's KNOWN / UNKNOWN / INSPECTION_REQUIRED line: only
 * `verified` is KNOWN, and only about the document.
 */

import type { Severity } from '@/lib/framework';

export type FindingStatus = 'verified' | 'not_specified' | 'unclear' | 'cannot_determine' | 'inspection_needed';

export const FINDING_STATUSES: readonly FindingStatus[] = [
  'verified',
  'not_specified',
  'unclear',
  'cannot_determine',
  'inspection_needed',
];

/** Where in the customer's document a finding was read. */
export type Evidence = {
  /** 1-based page (or photo) number, when the document has more than one. */
  page?: number;
  /** A short excerpt, as written. No dollar figures, no company names — see compose.ts. */
  excerpt: string;
};

export type Finding = {
  status: FindingStatus;
  evidence?: Evidence;
};

/** One quote as the estimator records it in the workbench. */
export type QuoteEntry = {
  /** Neutral label — "Quote A", "the March quote". Never a company name. */
  label: string;
  /** Total as written on the document, when entered. Used only for the customer's own per-sq-ft division. */
  statedTotal?: number;
  /** Area as written on the document, when entered. */
  statedAreaSqFt?: number;
  /** Keyed by framework criterion id, e.g. "1.1". */
  criteria: Record<string, Finding>;
  /** Keyed by scope item id (content/quote-check/scope-items.ts). */
  scope: Record<string, Finding>;
};

/** What the estimator submits from the workbench. */
export type ComposeInput = {
  orderId: string;
  /** e.g. "Standard" or "Rush" — read from the order, not typed by the estimator. */
  tier: string;
  /** One to three quotes. */
  quotes: QuoteEntry[];
  /** What is right across the quote(s), in the estimator's own words. */
  present: string;
  /** What is missing, in the estimator's own words. */
  missing: string;
  /** Manual questions to add beyond the derived ones, one per line. */
  askInWriting?: string;
  /** Manual risk flags beyond the derived ones, one per line. */
  riskNotes?: string;
  /** Set only when the quote is sound — the brand's stated behavior, not the default. */
  ifSoundSaySo?: string;
};

export type QuestionSource =
  | 'not-specified'
  | 'unclear'
  | 'cannot-determine'
  | 'inspection-needed'
  | 'comparison'
  | 'estimator';

export type Question = {
  source: QuestionSource;
  /** Criterion id or scope item id, when the question was derived rather than typed. */
  refId?: string;
  text: string;
};

export type RiskLevel = 'high' | 'medium' | 'low';

export type RiskFlag = {
  level: RiskLevel;
  /** Criterion or scope item id; absent for estimator-typed and comparison flags. */
  refId?: string;
  status?: FindingStatus;
  text: string;
  /** What fails when this is left unresolved — framework `risk` or scope item `why`, never a price. */
  consequence?: string;
  /** Published Ecowoods source the flag rests on, e.g. "/papers/…#section". */
  basisHref?: string;
};

export type ScopeLine = {
  id: string;
  group: string;
  label: string;
  changesScope: boolean;
  status: FindingStatus;
  evidence?: Evidence;
  basisHref?: string;
};

export type CriterionLine = {
  id: string;
  pillar: string;
  question: string;
  severity: Severity;
  status: FindingStatus;
  evidence?: Evidence;
  basisHref: string;
};

export type Verdict = 'incomplete' | 'defect' | 'weak' | 'sound' | 'strong';

export type QuoteReadout = {
  label: string;
  statedTotal?: number;
  statedAreaSqFt?: number;
  verdict: Verdict;
  /** lib/framework score() percentage, where only "stated in the quote" earns credit. */
  pct: number;
  failedCritical: Array<{ id: string; question: string }>;
  scope: ScopeLine[];
  criteria: CriterionLine[];
  riskFlags: RiskFlag[];
  questionsToAsk: Question[];
  counts: Record<FindingStatus, number>;
};

export type ComparisonReadout = {
  /** lib/quote-check compare() verdict — unchanged vocabulary from the free /quote-check tool. */
  verdict: 'comparable' | 'comparable-with-gaps' | 'not-comparable' | 'insufficient';
  statement: string;
  /** Scope-changing items stated in some quotes and not others. */
  divergent: Array<{ id: string; label: string }>;
  /** Checklist items no quote states. */
  absentEverywhere: Array<{ id: string; label: string }>;
  /** Per scope item, the status in each quote, in quote order. */
  matrix: Array<{ id: string; label: string; changesScope: boolean; statuses: FindingStatus[] }>;
};

export type QuoteIntelligenceReport = {
  orderId: string;
  tier: string;
  frameworkVersion: string;
  scoredOn: string; // date only, e.g. "2026-09-17"
  quotes: QuoteReadout[];
  /** Present only when two or more quotes were read. */
  comparison?: ComparisonReadout;
  /** Estimator-typed risk flags that apply to the read as a whole. */
  generalRiskFlags: RiskFlag[];
  /** Estimator-typed questions that apply to every quote. */
  generalQuestions: Question[];
  present: string;
  missing: string;
  statement: string;
  ifSoundSaySo?: string;
  estimatorDesk: string;
  refuses: readonly string[];
};

export type ComposeResult =
  | { ok: true; report: QuoteIntelligenceReport }
  | { ok: false; errors: string[] };
