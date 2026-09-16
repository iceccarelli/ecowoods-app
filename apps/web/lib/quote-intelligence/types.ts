/**
 * lib/quote-intelligence/types.ts — the Quote Intelligence Report shape
 * (EW-0002). The report is the paid deliverable EW-0001 sold but never
 * produced: EW-0001 gets the customer's document to the estimating desk,
 * this turns the estimator's read of it into something the customer
 * actually receives.
 */

export type CriterionAnswer = 'yes' | 'no' | 'unsure';

/** What the estimator submits from the workbench. */
export type ComposeInput = {
  orderId: string;
  /** e.g. "Standard" or "Rush" — read from the order, not typed by the estimator. */
  tier: string;
  /** Keyed by framework criterion id, e.g. "1.1". */
  answers: Record<string, CriterionAnswer>;
  /** Scope item ids (content/quote-check/scope-items.ts) present in the document. */
  presentScopeIds: string[];
  /** What is present, in the estimator's own words. */
  present: string;
  /** What is missing, in the estimator's own words. */
  missing: string;
  /** Manual questions to add beyond the ones derived from failed/unsure criteria and missing scope. */
  askInWriting?: string;
  /** Set only when the quote is sound — the brand's stated behavior, not the default. */
  ifSoundSaySo?: string;
};

export type QuestionSource = 'failed-criterion' | 'unsure-criterion' | 'missing-scope' | 'estimator';

export type Question = {
  source: QuestionSource;
  /** Criterion id or scope item id, when the question was derived rather than typed. */
  refId?: string;
  text: string;
};

export type QuoteIntelligenceReport = {
  orderId: string;
  tier: string;
  frameworkVersion: string;
  scoredOn: string; // date only, e.g. "2026-09-17"
  verdict: 'incomplete' | 'defect' | 'weak' | 'sound' | 'strong';
  pct: number;
  failedCritical: Array<{ id: string; question: string }>;
  missingScope: Array<{ id: string; label: string }>;
  questionsToAsk: Question[];
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
