/**
 * lib/geo/opportunity.ts — the 0–100 market opportunity score, and the
 * classification that decides where the next page gets written.
 *
 * WHAT THIS IS FOR
 *
 * There are seventy-six markets in this model and there will never be an
 * afternoon for all of them. The question is always the same: which one next.
 * This answers it with a number, and — the part that matters — with the
 * confidence behind the number.
 *
 * TWO NUMBERS, NOT ONE
 *
 * `score` is the weighted result over the inputs that are actually present.
 * `confidence` is the share of the total weighting those inputs represent.
 * A score of 78 at 10% confidence and a score of 78 at 90% confidence are not
 * the same claim, and a model that reports only the first number invites
 * exactly the decision it should be preventing.
 *
 * Today confidence is 10% everywhere: logistics and corridor value are
 * computed from facts this repository holds, and the eight economic inputs are
 * unsourced. Every classification therefore comes back UNSCORED, with the
 * missing inputs named. That is not the model failing. That is the model
 * declining to rank Oakville against Buffalo on figures nobody has opened.
 *
 * THE CLASSIFICATION GATE
 *
 * DOMINATE, HIGH_PRIORITY, BUILD_AUTHORITY, TEST and FUTURE are decisions about
 * where money goes. None of them may be assigned below MIN_CONFIDENCE, and the
 * threshold is deliberately high enough that the eight sourced inputs cannot be
 * skipped: a market cannot be promoted to DOMINATE by its highway access.
 *
 * WHAT IT WILL NOT DO
 *
 * It will not classify a United States market as anything but FUTURE. Not
 * because Buffalo is a poor market — the brief is right that it is a good one —
 * but because Ecowoods does not operate in New York State, and a model that can
 * rank an American market as HIGH_PRIORITY is a model one edit away from
 * producing an American commercial page.
 */
import { type Market } from '@/content/geo/markets';
import { INPUT_SPECS, TOTAL_WEIGHT, inputsFor, type InputId } from '@/content/geo/market-inputs';
import { corridorsFor as resolveCorridors } from '@/content/geo/corridors';
import { MARKETS } from '@/content/geo/markets';

const corridorsFor = (slug: string) =>
  resolveCorridors(slug, (x) => MARKETS.find((y) => y.slug === x)?.partOf);

export type Classification =
  | 'DOMINATE'
  | 'HIGH_PRIORITY'
  | 'BUILD_AUTHORITY'
  | 'TEST'
  | 'FUTURE'
  | 'UNSCORED';

/**
 * The share of the weighting that must be sourced before a market may be
 * classified at all. Set above the 10% that logistics and corridor value
 * contribute, so no market is ever ranked on routing alone.
 */
export const MIN_CONFIDENCE = 0.6;

export interface Opportunity {
  slug: string;
  name: string;
  country: 'CA' | 'US';
  /**
   * The opportunity score, 0–100 — and null until enough of the weighting is
   * sourced to mean it. A number computed over 10% of the weights would be
   * read as a score by everyone who saw it, however carefully the confidence
   * beside it was worded, so it is not published as one.
   */
  score: number | null;
  /**
   * The weighted result over whatever inputs ARE present, always. Useful for
   * ordering the queue and for watching the model come alive as rows are
   * sourced; never a ranking, and never the number a decision is made on.
   */
  partialScore: number | null;
  /** 0–1: share of the total weighting actually backed by an input. */
  confidence: number;
  classification: Classification;
  /** Why it is classified that way, in one line. */
  reason: string;
  components: Array<{ id: InputId; weight: number; score: number | null; source: string | null }>;
  /** Input ids with no value, and where each is obtainable. */
  missing: Array<{ id: InputId; weight: number; obtainableFrom: string }>;
}

/* ── the two inputs this repository can defend ───────────────────────────── */

/** Reachability, from status. Not a drive time — a statement about the day. */
const logisticsScore = (m: Market): number => {
  if (m.country === 'US') return 0;
  if (m.status === 'core-active') return 100;
  if (m.status === 'active-expansion') return 75;
  if (m.status === 'travel-by-confirmation') return 35;
  return 20;
};

/** Corridor centrality. A junction is worth more per drive than a terminus. */
const corridorScore = (m: Market): number => {
  const n = corridorsFor(m.slug).length;
  if (m.country === 'US') return 0;
  return Math.min(n * 40, 100);
};

const COMPUTED: Record<string, (m: Market) => number> = {
  logistics: logisticsScore,
  corridorValue: corridorScore,
};

export function opportunity(market: Market): Opportunity {
  const sourced = inputsFor(market.slug);
  const components: Opportunity['components'] = [];
  const missing: Opportunity['missing'] = [];

  let weighted = 0;
  let weightPresent = 0;

  for (const spec of INPUT_SPECS) {
    const computed = COMPUTED[spec.id];
    if (spec.kind === 'computed' && computed) {
      const v = computed(market);
      components.push({ id: spec.id, weight: spec.weight, score: v, source: 'computed from this repository' });
      weighted += v * spec.weight;
      weightPresent += spec.weight;
      continue;
    }
    const value = sourced[spec.id];
    if (value) {
      components.push({ id: spec.id, weight: spec.weight, score: value.score, source: value.source.url });
      weighted += value.score * spec.weight;
      weightPresent += spec.weight;
    } else {
      components.push({ id: spec.id, weight: spec.weight, score: null, source: null });
      missing.push({ id: spec.id, weight: spec.weight, obtainableFrom: spec.obtainableFrom });
    }
  }

  const confidence = weightPresent / TOTAL_WEIGHT;
  const partialScore = weightPresent === 0 ? null : Math.round(weighted / weightPresent);
  const trustworthy = confidence >= MIN_CONFIDENCE;

  const { classification, reason } = classify(market, partialScore, confidence, missing);
  return {
    slug: market.slug,
    name: market.name,
    country: market.country,
    score: trustworthy ? partialScore : null,
    partialScore,
    confidence: Math.round(confidence * 100) / 100,
    classification,
    reason,
    components,
    missing,
  };
}

function classify(
  market: Market,
  score: number | null,
  confidence: number,
  missing: Opportunity['missing'],
): { classification: Classification; reason: string } {
  if (market.country === 'US') {
    return {
      classification: 'FUTURE',
      reason:
        'United States market. Ecowoods operates in Ontario, from Ontario. This market is advertising reach for ' +
        'Ontario property and is never classified above FUTURE, whatever it would score.',
    };
  }
  if (score === null || confidence < MIN_CONFIDENCE) {
    const weight = missing.reduce((n, x) => n + x.weight, 0);
    return {
      classification: 'UNSCORED',
      reason:
        `${Math.round(confidence * 100)}% of the weighting is sourced; ${weight} points of it are not. ` +
        `Missing: ${missing.map((x) => x.id).join(', ')}. A classification decides where money goes and this one ` +
        'would be decided by highway access.',
    };
  }
  if (score >= 80) return { classification: 'DOMINATE', reason: `Scores ${score} at ${Math.round(confidence * 100)}% confidence.` };
  if (score >= 65) return { classification: 'HIGH_PRIORITY', reason: `Scores ${score} at ${Math.round(confidence * 100)}% confidence.` };
  if (score >= 50) return { classification: 'BUILD_AUTHORITY', reason: `Scores ${score} at ${Math.round(confidence * 100)}% confidence.` };
  if (score >= 35) return { classification: 'TEST', reason: `Scores ${score} at ${Math.round(confidence * 100)}% confidence.` };
  return { classification: 'FUTURE', reason: `Scores ${score} at ${Math.round(confidence * 100)}% confidence.` };
}

/** Every market, best first. Ties broken by slug so the order is stable. */
export const opportunityOrder = (all: Market[]): Opportunity[] =>
  all
    .map(opportunity)
    .sort((a, b) => (b.partialScore ?? -1) - (a.partialScore ?? -1) || a.slug.localeCompare(b.slug));

/** What the model is missing, aggregated — the shopping list, once. */
export const unsourcedInputs = (): Array<{ id: InputId; weight: number; obtainableFrom: string }> =>
  INPUT_SPECS.filter((s) => s.kind === 'sourced').map((s) => ({
    id: s.id, weight: s.weight, obtainableFrom: s.obtainableFrom,
  }));
