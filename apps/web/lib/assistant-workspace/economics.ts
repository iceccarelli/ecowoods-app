/**
 * lib/assistant-workspace/economics.ts — deterministic project economics.
 *
 * ASSISTANT-04. Implements docs/assistant-workspace/ECONOMICS_MODEL_SPEC.md.
 * Pure functions only: no LLM in the call graph, no network I/O, every
 * dollar traces to a `PriceBand` from `content/constants/pricing.ts` via
 * `bandForCountry`, and every arithmetic operation on it runs through
 * `estimateInstalledRangeCad` (packages/shared/ai) — the SAME function
 * Floor Studio, /design and the corner assistant's `estimate_project` tool
 * already call. No per-species multiplier is reintroduced here; GEO-005
 * removed that table because it produced numbers nobody had confirmed, and
 * `estimateInstalledRangeCad` has not priced by species since — the
 * "species" string this module passes it only selects whether a pattern
 * label applies, never the figure.
 */
import { bandForCountry, HOME_CURRENCY, type PriceCountry } from '@/content/constants/pricing';
import { estimateInstalledRangeCad } from '@ecowoods/shared/ai';
import { FLOOR_PRODUCTS, productById } from '@/lib/floor-studio/catalog';
import { pricingKeyForService } from './recommendations';
import type { PricingService } from '@/lib/pricing';
import { totalSquareFeet } from './state';
import type { WorkspaceState } from './types';

export interface Money {
  min: number;
  max: number;
  currency: string;
}

/**
 * `calculateProjectRange` — the one function that turns a service + area +
 * country into a dollar range. Never a single point estimate: always
 * `{ min, max }`, straight from the published band.
 *
 * Throws on a non-positive or non-finite `squareFeet` rather than silently
 * returning a zero or negative range — a "cost" of $0–$0 is not an honest
 * answer to "how much," it is a bug wearing a number.
 */
export function calculateProjectRange(input: {
  pricingKey: PricingService;
  squareFeet: number;
  country: PriceCountry;
  /**
   * The word estimateInstalledRangeCad uses to decide whether a pattern
   * label applies (its own `speciesKey !== 'refinishing'` check) — it never
   * changes the dollar figure. Defaults from `pricingKey` when omitted: the
   * install band gets the visitor's chosen species (or the catalog's first,
   * for metadata only), every refinishing-shaped band gets the literal word
   * 'refinishing', same convention `priceConfiguration` in catalog.ts uses.
   */
  workWord?: string;
  productId?: string;
}): Money {
  if (!Number.isFinite(input.squareFeet) || input.squareFeet <= 0) {
    throw new RangeError('calculateProjectRange requires a positive, finite squareFeet.');
  }
  const band = bandForCountry(input.pricingKey, input.country);
  const workWord =
    input.workWord ??
    (input.pricingKey === 'newInstall'
      ? (input.productId ? productById(input.productId)?.rateKey : undefined) ?? FLOOR_PRODUCTS[0].rateKey
      : 'refinishing');
  const result = estimateInstalledRangeCad({ species: workWord, squareFeet: input.squareFeet }, band);
  return { min: result.estimatedLowCad, max: result.estimatedHighCad, currency: result.currency };
}

/**
 * Simple range subtraction, min-to-min and max-to-max — never a single
 * blended number. Refuses to mix currencies: comparing a CAD range to a USD
 * one without a real FX rate (this codebase deliberately has none) would be
 * arithmetic on two different units wearing the same `$` sign.
 */
export function calculateDelta(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`calculateDelta refuses to mix currencies: ${a.currency} vs ${b.currency}.`);
  }
  return { min: b.min - a.min, max: b.max - a.max, currency: a.currency };
}

export interface ProjectScenario {
  label: string;
  range: Money;
}

export interface ScenarioComparison {
  scenarios: ProjectScenario[];
  /** Adjacent-pair deltas, in the order the scenarios were given — never averaged into one figure. */
  deltas: { from: string; to: string; delta: Money }[];
}

/** Pure diff of N `calculateProjectRange` outputs. Never blends into a single "average" that discards the range. */
export function compareScenarios(scenarios: ProjectScenario[]): ScenarioComparison {
  const deltas: ScenarioComparison['deltas'] = [];
  for (let i = 1; i < scenarios.length; i += 1) {
    const prev = scenarios[i - 1]!;
    const curr = scenarios[i]!;
    deltas.push({ from: prev.label, to: curr.label, delta: calculateDelta(prev.range, curr.range) });
  }
  return { scenarios, deltas };
}

/**
 * A citation to a real, documented Ecowoods pricing/overlap rule — never a
 * plausible-sounding sentence invented for one card. Nothing in
 * content/constants/pricing.ts currently documents a bundle-overlap rule
 * (no "one mobilization" or "shared containment setup" discount is
 * published anywhere in this repo today), so `calculateExplicitSavings`
 * below has nothing real to cite yet and returns `notQuantified` until one
 * exists — see docs/assistant-workspace/ECONOMICS_MODEL_SPEC.md's
 * no-double-count rule for why this function refuses to guess.
 */
export interface OverlapEvidence {
  rule: string;
  source: string;
}

export type SavingsResult = Money | { notQuantified: true; reason: string };

export function calculateExplicitSavings(input: {
  baseline: Money;
  bundled: Money;
  overlapEvidence: OverlapEvidence[];
}): SavingsResult {
  if (input.baseline.currency !== input.bundled.currency) {
    throw new TypeError('calculateExplicitSavings refuses to mix currencies.');
  }
  if (!input.overlapEvidence.length) {
    return {
      notQuantified: true,
      reason: 'No Ecowoods pricing rule documents an overlap for this combination yet.',
    };
  }
  // baseline (separate) minus bundled (combined) — min-to-min, max-to-max, same as calculateDelta.
  return calculateDelta(input.bundled, input.baseline);
}

export interface ScopeRange {
  pricingKey: PricingService;
  /** The band's own published label — "Full Sand & Finish," never a name invented for this card. */
  label: string;
  range: Money;
}

export type ProjectRangeResult =
  | { status: 'ready'; total: Money; scopes: ScopeRange[] }
  | { status: 'needs-sqft' }
  | { status: 'needs-service' };

/**
 * The distinct `PricingService` keys implied by `state.selectedServiceSlugs`
 * — the same set `projectRangeForState` prices, computed once so a caller
 * that needs to know WHICH bands are in scope (not just their summed total,
 * e.g. ASSISTANT-05's value-scenario evidence matching — see
 * value-scenario.ts) reads it here rather than recomputing it a second way.
 */
export function distinctPricingKeys(state: WorkspaceState): Set<PricingService> {
  const keys = new Set<PricingService>();
  for (const slug of state.selectedServiceSlugs) {
    const key = pricingKeyForService(slug);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * The workspace's own composition of `calculateProjectRange` over Project
 * Decision State: one scope per DISTINCT `PricingService` key among
 * `state.selectedServiceSlugs` (deduplicated — two selected services billed
 * against the SAME published band, e.g. floor refinishing and stair
 * refinishing, are one scope of work at one square footage, not two; adding
 * the second does not double the first, which is the no-double-count rule
 * applied to scope composition rather than to savings). Totals sum min-to-
 * min and max-to-max across scopes, never averaged.
 *
 * Returns a status rather than `undefined` so the UI can say exactly what
 * is missing — "Needs sq ft" and "Needs service" are different honest
 * answers, not one generic placeholder.
 */
export function projectRangeForState(state: WorkspaceState): ProjectRangeResult {
  const sqft = totalSquareFeet(state);
  if (sqft === undefined) return { status: 'needs-sqft' };

  const keys = distinctPricingKeys(state);
  if (!keys.size) return { status: 'needs-service' };

  const scopes: ScopeRange[] = [...keys].map((pricingKey) => {
    const band = bandForCountry(pricingKey, state.country);
    const range = calculateProjectRange({
      pricingKey,
      squareFeet: sqft,
      country: state.country,
      productId: state.targetFloor.productId,
    });
    return { pricingKey, label: band.label, range };
  });

  const total = scopes.reduce<Money>(
    (acc, s) => ({ min: acc.min + s.range.min, max: acc.max + s.range.max, currency: s.range.currency }),
    { min: 0, max: 0, currency: scopes[0]!.range.currency },
  );

  return { status: 'ready', total, scopes };
}

/**
 * "$9,900–$16,200" in CAD (the home currency, no suffix needed) or
 * "$8,325–$13,500 USD" otherwise — same non-home-currency-gets-labelled
 * convention `content/constants/pricing.ts`'s own `formatBand` uses, so a
 * range never reads as CAD to someone in New York or vice versa. Rounds to
 * whole dollars for display only; the underlying `Money` keeps the
 * precision `estimateInstalledRangeCad` returned. Never collapses a range
 * to one number.
 */
export function formatMoneyRange(money: Money): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: money.currency, maximumFractionDigits: 0 }).format(n);
  const suffix = money.currency === HOME_CURRENCY ? '' : ` ${money.currency}`;
  return `${fmt(money.min)}–${fmt(money.max)}${suffix}`;
}
