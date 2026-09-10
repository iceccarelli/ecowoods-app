/**
 * content/geo/market-inputs.ts — the economic inputs behind the opportunity
 * score, and the rule that none of them may be typed from memory.
 *
 * THE BRIEF, AND WHY IT NEEDS A FILE RATHER THAN A FUNCTION
 *
 * The market model asks for a 0–100 opportunity score weighted:
 *
 *   20% purchasing power · 15% housing values · 10% housing age ·
 *   10% detached-home prevalence · 10% renovation potential ·
 *   10% hardwood opportunity · 10% population and search demand ·
 *    5% competition · 5% logistical feasibility · 5% strategic corridor value
 *
 * Eight of those ten are external facts. They exist — Statistics Canada's
 * census profiles carry median household income, dwelling values, period of
 * construction and structural type by census subdivision; the American
 * Community Survey carries the same for every place in Erie and Niagara
 * counties; search demand and CPC come from a keyword tool; competitive
 * intensity from the local pack. Every one is obtainable in an afternoon.
 *
 * None of them is obtainable by thinking hard about Oakville.
 *
 * That is the entire reason this file exists as data with a source slot rather
 * than as numbers inside the scoring function. A score built on a plausible
 * figure someone typed ranks markets, directs where the next page gets written
 * and where the ad budget goes, and is indistinguishable from a score built on
 * the census — right up to the point where it sends a season's work to the
 * wrong municipality.
 *
 * THE RULE
 *
 * An input carries a value only with a `source`: a title, a URL, and the date
 * it was retrieved. scripts/verify-market-inputs.mjs fails the build on any
 * value without one. There is no override, and there is deliberately no way to
 * mark a figure as an estimate — an estimate that survives one edit becomes a
 * fact, and this model has no mechanism for un-believing it.
 *
 * WHAT IS HERE TODAY
 *
 * Nothing sourced yet, which the API says plainly: `confidence` reports the
 * share of the weighting actually backed by data, and the two inputs that ARE
 * computable from this repository — logistical feasibility and strategic
 * corridor value, 10% between them — are computed rather than stored, because
 * corridor membership, hub distance and confirmed status are facts this
 * repository already holds and can defend.
 *
 * So the model runs today at 10% confidence and says so. Add one census table
 * and it moves. That is a better starting position than 100% confidence in
 * numbers nobody can point at.
 */

/** The ten weighted inputs, in the brief's own words and weights. */
export type InputId =
  | 'purchasingPower'
  | 'housingValues'
  | 'housingAge'
  | 'detachedPrevalence'
  | 'renovationPotential'
  | 'hardwoodOpportunity'
  | 'searchDemand'
  | 'competition'
  | 'logistics'
  | 'corridorValue';

export interface InputSpec {
  id: InputId;
  /** Share of the 100-point score. Sums to 100 across all ten. */
  weight: number;
  /** What it measures, in the words a person would use to go and find it. */
  measures: string;
  /** Where this is obtainable. Named so nobody has to rediscover it. */
  obtainableFrom: string;
  /**
   * `sourced` inputs must come from MARKET_INPUTS with a citation.
   * `computed` inputs are derived from facts this repository already holds.
   */
  kind: 'sourced' | 'computed';
}

export const INPUT_SPECS: InputSpec[] = [
  {
    id: 'purchasingPower', weight: 20, kind: 'sourced',
    measures: 'median household income after tax',
    obtainableFrom: 'Statistics Canada Census Profile (CSD level) · US Census ACS 5-year, table S1901',
  },
  {
    id: 'housingValues', weight: 15, kind: 'sourced',
    measures: 'median value of owner-occupied dwellings',
    obtainableFrom: 'Statistics Canada Census Profile · US Census ACS table B25077',
  },
  {
    id: 'housingAge', weight: 10, kind: 'sourced',
    measures: 'share of dwellings built before 1980 — old stock is refinishing work',
    obtainableFrom: 'Statistics Canada period-of-construction table · US Census ACS table B25034',
  },
  {
    id: 'detachedPrevalence', weight: 10, kind: 'sourced',
    measures: 'share of dwellings that are single-detached houses',
    obtainableFrom: 'Statistics Canada structural-type table · US Census ACS table B25024',
  },
  {
    id: 'renovationPotential', weight: 10, kind: 'sourced',
    measures: 'residential renovation permit value per dwelling',
    obtainableFrom: 'Municipal building-permit open data · CMHC · US Census Building Permits Survey',
  },
  {
    id: 'hardwoodOpportunity', weight: 10, kind: 'sourced',
    measures: 'prevalence of hardwood floors in the local stock',
    obtainableFrom:
      'No public dataset publishes this directly. The defensible proxy is housing age crossed with detached ' +
      'prevalence, recorded as its own figure with the method written down — not silently inferred inside the score.',
  },
  {
    id: 'searchDemand', weight: 10, kind: 'sourced',
    measures: 'monthly search volume for the service terms in this market',
    obtainableFrom: 'Google Keyword Planner · Search Console impressions for queries already ranking',
  },
  {
    id: 'competition', weight: 5, kind: 'sourced',
    measures: 'how contested the local pack and the organic top ten are',
    obtainableFrom: 'A recorded SERP observation for the market, dated — the same discipline as the AEO score',
  },
  {
    id: 'logistics', weight: 5, kind: 'computed',
    measures: 'whether a crew can reach it and return inside the day',
    obtainableFrom: 'Computed from status and hub in content/geo/markets.ts',
  },
  {
    id: 'corridorValue', weight: 5, kind: 'computed',
    measures: 'corridor centrality — a junction serves more jobs per drive than a terminus',
    obtainableFrom: 'Computed from corridor membership in content/geo/corridors.ts',
  },
];

export const TOTAL_WEIGHT = INPUT_SPECS.reduce((n, x) => n + x.weight, 0);

export interface SourcedValue {
  /** Normalised 0–100. The raw figure and its units belong in `note`. */
  score: number;
  /** The raw figure as published, with units, so the normalisation is auditable. */
  note: string;
  source: { title: string; url: string; retrievedAt: string };
}

/**
 * Sourced inputs by market slug. Empty until somebody opens a census table.
 *
 * Adding one market's purchasing power moves this model's confidence for that
 * market from 10% to 30% and changes nothing about any other market, which is
 * the property that makes it worth filling in one row at a time.
 */
export const MARKET_INPUTS: Record<string, Partial<Record<InputId, SourcedValue>>> = {};

export const inputsFor = (slug: string): Partial<Record<InputId, SourcedValue>> =>
  MARKET_INPUTS[slug] ?? {};
