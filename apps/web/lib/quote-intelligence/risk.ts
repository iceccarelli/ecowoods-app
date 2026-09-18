/**
 * lib/quote-intelligence/risk.ts — pure: one quote's findings become risk
 * flags and questions to send back in writing.
 *
 * Deterministic on purpose. Two estimators who record the same statuses get
 * the same flags, and a customer who asks "why is this flagged high?" gets an
 * answer that is a rule in this file, not a judgement call nobody wrote down.
 *
 * WHAT A FLAG SAYS, AND WHAT IT NEVER SAYS
 *
 * A flag says the document does not settle something, and what fails if it
 * stays unsettled — the consequence text is the framework criterion's own
 * `risk` or the scope item's own `why`, both already published with a source.
 * A flag never says the work is defective, never prices the gap, and never
 * says what another company would do.
 */

import { allCriteria, PILLARS, sourceHref, type FrameworkCriterion, type Severity } from '@/lib/framework';
import { SCOPE_ITEMS, type ScopeItem } from '@/lib/quote-check';
import type { Finding, FindingStatus, Question, QuoteEntry, RiskFlag, RiskLevel } from './types';

type Unsettled = Exclude<FindingStatus, 'verified'>;

const CRITERION_LEVEL: Record<Exclude<Severity, 'advisory'>, Record<Unsettled, RiskLevel>> = {
  critical: { not_specified: 'high', inspection_needed: 'high', unclear: 'medium', cannot_determine: 'medium' },
  major: { not_specified: 'medium', inspection_needed: 'medium', unclear: 'low', cannot_determine: 'low' },
};

const SCOPE_LEVEL: Record<'changes' | 'certainty', Record<Unsettled, RiskLevel>> = {
  changes: { not_specified: 'medium', unclear: 'medium', inspection_needed: 'medium', cannot_determine: 'low' },
  certainty: { not_specified: 'low', unclear: 'low', inspection_needed: 'low', cannot_determine: 'low' },
};

const PREFIX: Record<Unsettled, string> = {
  not_specified: 'Not stated in the quote',
  unclear: 'Stated, but unclear',
  cannot_determine: 'Could not be read from what was sent',
  inspection_needed: 'Needs an on-site check',
};

const LEVEL_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

function criterionQuestion(c: FrameworkCriterion, status: Unsettled): Question | null {
  switch (status) {
    case 'not_specified':
      return { source: 'not-specified', refId: c.id, text: c.question };
    case 'unclear':
      return { source: 'unclear', refId: c.id, text: `${c.question} The quote's wording on this is unclear — please answer in writing.` };
    case 'inspection_needed':
      return {
        source: 'inspection-needed',
        refId: c.id,
        text: `${c.question} This needs an on-site check — who will do it, when, and will the result be recorded in writing before work starts?`,
      };
    case 'cannot_determine':
      return null; // rolled up into one "send a readable copy" question per quote
  }
}

function scopeQuestion(s: ScopeItem, status: Unsettled): Question | null {
  switch (status) {
    case 'not_specified':
      return { source: 'not-specified', refId: s.id, text: `Is "${s.label}" included in this quote? Please confirm in writing.` };
    case 'unclear':
      return {
        source: 'unclear',
        refId: s.id,
        text: `The quote's wording on "${s.label}" does not settle what is included — please state exactly what is and is not included.`,
      };
    case 'inspection_needed':
      return {
        source: 'inspection-needed',
        refId: s.id,
        text: `"${s.label}" needs an on-site check — who will do it, when, and will the result be recorded in writing before work starts?`,
      };
    case 'cannot_determine':
      return null;
  }
}

export type Derived = { riskFlags: RiskFlag[]; questionsToAsk: Question[] };

/**
 * Flags and questions for one quote. Assumes every criterion and scope item
 * has a finding — compose() rejects the input before calling this otherwise.
 */
export function deriveForQuote(quote: QuoteEntry): Derived {
  const flags: RiskFlag[] = [];
  const questions: Question[] = [];
  let unreadable = 0;

  for (const c of allCriteria()) {
    const f: Finding | undefined = quote.criteria[c.id];
    if (!f || f.status === 'verified') continue;
    const status = f.status;
    if (status === 'cannot_determine') unreadable++;
    // Advisory criteria are good practice, not a gap worth a flag or a question.
    if (c.severity === 'advisory') continue;
    flags.push({
      level: CRITERION_LEVEL[c.severity][status],
      refId: c.id,
      status,
      text: `${PREFIX[status]}: ${c.question}`,
      consequence: c.risk,
      basisHref: sourceHref(c),
    });
    const q = criterionQuestion(c, status);
    if (q) questions.push(q);
  }

  for (const s of SCOPE_ITEMS) {
    const f = quote.scope[s.id];
    if (!f || f.status === 'verified') continue;
    const status = f.status;
    if (status === 'cannot_determine') unreadable++;
    flags.push({
      level: SCOPE_LEVEL[s.changesScope ? 'changes' : 'certainty'][status],
      refId: s.id,
      status,
      text: `${PREFIX[status]}: ${s.label}`,
      consequence: s.why,
      basisHref: s.cite,
    });
    const q = scopeQuestion(s, status);
    if (q) questions.push(q);
  }

  if (unreadable > 0) {
    questions.push({
      source: 'cannot-determine',
      text: `Please send a complete, readable copy of the quote — ${unreadable} item(s) could not be read from the copy we were given.`,
    });
  }

  flags.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return { riskFlags: flags, questionsToAsk: questions };
}

/** The pillar name a criterion id belongs to, e.g. "1.1" -> its pillar's name. */
export function pillarNameFor(criterionId: string): string {
  return PILLARS.find((p) => p.criteria.some((c) => c.id === criterionId))?.name ?? '';
}
