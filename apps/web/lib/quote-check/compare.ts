/**
 * lib/quote-check/compare.ts — arithmetic on numbers the visitor supplied,
 * about documents we have never seen.
 *
 * Every function here is pure and total. Nothing fetches, nothing stores,
 * nothing is written to the network by the page that calls it. The visitor is
 * holding somebody else's commercial documents; the design position is that
 * those never leave their browser unless they separately choose to send them to
 * a human at /framework/assess.
 *
 * THE ONE IDEA
 *
 * Two totals are comparable only if they price the same work. So: take the
 * union of everything any of the quotes includes, and report, per quote, what
 * is missing from that union. A quote that is cheaper and shorter is not a
 * better price; it is a smaller job, and until the missing items are priced
 * nobody knows which is cheaper — including us.
 *
 * WHAT THIS DELIBERATELY REFUSES TO COMPUTE
 *
 * The obvious next step is to price the gaps: "Quote B omits subfloor prep,
 * typically $1.80/sq ft, so the real difference is …". We will not, and the
 * guard will not let anyone add it later. We have no adequate and proper test
 * for a typical GTA price of a line item — Competition Act s.74.01(1)(b)
 * requires the testing to exist BEFORE the claim, not after somebody complains
 * — and an invented figure would be the one number in this whole tool that a
 * homeowner actually acts on.
 *
 * The honest output is the question they should ask, not our guess at the
 * answer.
 */
import { SCOPE_ITEMS, type ScopeItem } from '@/content/quote-check/scope-items';

export interface QuoteInput {
  /** The visitor's own label: "Company A", "the one from Tuesday". Never sent anywhere. */
  label: string;
  /** Total, in dollars, as written on the document. Undefined when not entered. */
  total?: number;
  /** Area in square feet, as written on the document. Undefined when not entered. */
  areaSqFt?: number;
  /** Ids of SCOPE_ITEMS the visitor found in the document. */
  includes: string[];
}

export interface QuoteReading {
  label: string;
  total?: number;
  areaSqFt?: number;
  /** total / areaSqFt, when both are present. Two decimals. */
  perSqFt?: number;
  /** Items present in at least one other quote and absent from this one. */
  missing: ScopeItem[];
  /** The subset of `missing` that changes what is being priced. */
  missingScope: ScopeItem[];
  /** Items nobody's quote mentions — a question for all of them, not a mark against one. */
  absentEverywhere: ScopeItem[];
}

export type Verdict =
  /** Same scope. The totals are measuring the same thing. */
  | 'comparable'
  /** Same scope, but items nobody mentioned. Comparable to each other, incomplete against the checklist. */
  | 'comparable-with-gaps'
  /** Scopes differ. The totals are not measuring the same thing. */
  | 'not-comparable'
  /** Fewer than two quotes with enough entered to say anything. */
  | 'insufficient';

export interface Comparison {
  readings: QuoteReading[];
  verdict: Verdict;
  /** Ids present in at least one quote. */
  union: string[];
  /** Ids in every quote. */
  intersection: string[];
  /** Scope-changing items on which the quotes disagree. The reason for 'not-comparable'. */
  divergent: ScopeItem[];
  /** Checklist items no quote mentions. */
  absentEverywhere: ScopeItem[];
  /** Plain-language statement of what the arithmetic supports. Never a recommendation. */
  statement: string;
}

const byId = new Map(SCOPE_ITEMS.map((i) => [i.id, i]));
const item = (id: string): ScopeItem | undefined => byId.get(id);
const items = (ids: Iterable<string>): ScopeItem[] =>
  [...ids].map(item).filter((i): i is ScopeItem => Boolean(i));

/** Order results the way the checklist is ordered, whatever order the ids arrive in. */
const inChecklistOrder = (a: ScopeItem, b: ScopeItem) =>
  SCOPE_ITEMS.indexOf(a) - SCOPE_ITEMS.indexOf(b);

export function perSquareFoot(q: QuoteInput): number | undefined {
  if (typeof q.total !== 'number' || typeof q.areaSqFt !== 'number') return undefined;
  if (!Number.isFinite(q.total) || !Number.isFinite(q.areaSqFt)) return undefined;
  if (q.total <= 0 || q.areaSqFt <= 0) return undefined;
  return Math.round((q.total / q.areaSqFt) * 100) / 100;
}

/** A quote counts once the visitor has told us anything at all about it. */
export function isEntered(q: QuoteInput): boolean {
  return Boolean(q.label.trim()) && (q.includes.length > 0 || typeof q.total === 'number');
}

export function compare(quotes: QuoteInput[]): Comparison {
  const entered = quotes.filter(isEntered);

  const union = new Set<string>();
  for (const q of entered) for (const id of q.includes) if (byId.has(id)) union.add(id);

  const intersection = new Set<string>(
    entered.length
      ? [...union].filter((id) => entered.every((q) => q.includes.includes(id)))
      : [],
  );

  const absentEverywhere = SCOPE_ITEMS.filter((i) => !union.has(i.id));

  const readings: QuoteReading[] = entered.map((q) => {
    const has = new Set(q.includes);
    const missing = items([...union].filter((id) => !has.has(id))).sort(inChecklistOrder);
    return {
      label: q.label.trim(),
      total: q.total,
      areaSqFt: q.areaSqFt,
      perSqFt: perSquareFoot(q),
      missing,
      missingScope: missing.filter((i) => i.changesScope),
      absentEverywhere,
    };
  });

  const divergent = items([...union].filter((id) => !intersection.has(id)))
    .filter((i) => i.changesScope)
    .sort(inChecklistOrder);

  let verdict: Verdict;
  if (entered.length < 2) verdict = 'insufficient';
  else if (divergent.length) verdict = 'not-comparable';
  else if (absentEverywhere.length) verdict = 'comparable-with-gaps';
  else verdict = 'comparable';

  return {
    readings,
    verdict,
    union: [...union],
    intersection: [...intersection],
    divergent,
    absentEverywhere,
    statement: statementFor(verdict, readings, divergent),
  };
}

/**
 * The sentence at the top of the result. It reports arithmetic and asks a
 * question. It never says which quote to accept, and it never characterises
 * anyone's document as good, bad, high or low.
 */
function statementFor(verdict: Verdict, readings: QuoteReading[], divergent: ScopeItem[]): string {
  if (verdict === 'insufficient') {
    return 'Enter what at least two of the quotes contain. With one, there is nothing to compare it to.';
  }

  const priced = readings.filter((r) => typeof r.perSqFt === 'number');
  const spread =
    priced.length >= 2
      ? (() => {
          const sorted = [...priced].sort((a, b) => (a.perSqFt ?? 0) - (b.perSqFt ?? 0));
          const lo = sorted[0];
          const hi = sorted[sorted.length - 1];
          return lo.perSqFt === hi.perSqFt
            ? ''
            : ` ${lo.label} works out to $${lo.perSqFt?.toFixed(2)} per square foot and ${hi.label} to $${hi.perSqFt?.toFixed(2)} — your numbers, divided.`;
        })()
      : '';

  if (verdict === 'not-comparable') {
    const n = divergent.length;
    const names = divergent.slice(0, 3).map((d) => d.label.toLowerCase());
    const tail = n > 3 ? `, and ${n - 3} more` : '';
    return (
      `These quotes are not priced for the same work. ${n} item${n === 1 ? '' : 's'} that change${n === 1 ? 's' : ''} the scope ` +
      `appear${n === 1 ? 's' : ''} in some and not others — ${names.join('; ')}${tail}.` +
      `${spread} Until every quote has priced the same list, the difference between the totals is not a price difference.`
    );
  }

  if (verdict === 'comparable-with-gaps') {
    return (
      `The scopes match: every quote here covers the same list.${spread} ` +
      'The items below appear in none of them — that is one question to put to all of them, not a mark against any one.'
    );
  }

  return `The scopes match and nothing on the checklist is missing from any of them.${spread} These totals are measuring the same job.`;
}

/**
 * The row contributed to the benchmark, when — and only when — the visitor
 * opts in. No label, no total, no area, no company, nothing that identifies the
 * documents or the person: the count of quotes and which checklist ids were
 * present. What accumulates is which line items GTA quotes leave out, which is
 * a fact about the market and about no individual.
 */
export interface BenchmarkRow {
  quoteCount: number;
  includedIds: string[][];
}

export function benchmarkRow(quotes: QuoteInput[]): BenchmarkRow {
  const entered = quotes.filter(isEntered);
  return {
    quoteCount: entered.length,
    includedIds: entered.map((q) => q.includes.filter((id) => byId.has(id)).sort()),
  };
}
