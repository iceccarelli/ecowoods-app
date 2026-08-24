/**
 * Published service price bands — the module every existing consumer imports.
 *
 * THE NUMBERS ARE NO LONGER HERE.
 *
 * They live in `apps/web/content/constants/pricing.ts`, which carries the unit
 * and the currency alongside each band. This module is now a thin adapter over
 * that file: it keeps the `PRICING.screenAndRecoat.min` shape that roughly
 * twenty call sites already use, so nothing had to be rewritten, while making
 * it impossible for the two to disagree — there is only one set of numbers and
 * this is a projection of it.
 *
 * Do not add a number to this file. `pnpm seo:pricing` fails the build on a
 * price literal found anywhere outside the constants module, including here.
 *
 * Species-level installed ranges live in @ecowoods/shared/ai (FLOORING_RATES +
 * estimateInstalledRangeCad) so the configurator, RenoGuide and this module
 * cannot drift.
 */
import {
  PRICE_BANDS_BY_KEY,
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBand,
  formatBandBare,
  priceSpecification,
  type PriceBand,
  type PriceBandKey,
} from '@/content/constants/pricing';

export {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBand,
  formatBandBare,
  priceSpecification,
};
export type { PriceBand, PriceBandKey };

/**
 * The legacy projection. Same keys, same `min`/`max`/`label` as before, now
 * read straight off the canonical bands rather than retyped.
 */
export const PRICING = {
  screenAndRecoat: {
    min: SCREEN_RECOAT.min,
    max: SCREEN_RECOAT.max,
    label: SCREEN_RECOAT.label,
  },
  fullSandAndFinish: {
    min: FULL_SAND_FINISH.min,
    max: FULL_SAND_FINISH.max,
    label: FULL_SAND_FINISH.label,
  },
  newInstall: {
    min: NEW_INSTALL.min,
    max: NEW_INSTALL.max,
    label: NEW_INSTALL.label,
  },
} as const;

export type PricingService = keyof typeof PRICING;

/** The full band object, when the unit and currency are needed too. */
export const bandFor = (service: PricingService): PriceBand =>
  PRICE_BANDS_BY_KEY[service];

export const PRICE_PROMISE =
  'Fixed price in writing. It never moves after the free in-home estimate.';

/** Rough service-band total for a known sqft. Not a fixed quote. */
export function estimateServiceBandCad(service: string, squareFeet: number) {
  const key = service as PricingService;
  const band = PRICING[key];
  if (!band) return null;
  const sqft = Math.max(0, squareFeet);
  return {
    service: key,
    label: band.label,
    perSqftLowCad: band.min,
    perSqftHighCad: band.max,
    estimatedLowCad: Math.round(band.min * sqft),
    estimatedHighCad: Math.round(band.max * sqft),
    squareFeet: sqft,
    currency: PRICE_BANDS_BY_KEY[key].currency,
    unit: PRICE_BANDS_BY_KEY[key].unit,
    disclaimer:
      'Rough service-band range only. Species, pattern, stairs and substrate move the number. Final price is fixed in writing after a free in-home measure.',
  };
}

export function formatCadRange(low: number, high: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  return `${fmt(low)} – ${fmt(high)}`;
}
