/**
 * Published service price bands — single source for service pages, homepage,
 * FAQ answers, and /api/estimate service-mode responses.
 *
 * Species-level installed ranges live in @ecowoods/shared/ai (FLOORING_RATES +
 * estimateInstalledRangeCad) so the configurator, RenoGuide and this module
 * cannot drift.
 */

export const PRICING = {
  screenAndRecoat:   { min: 2.50,  max: 4.00,  label: 'Screen & Recoat' },
  fullSandAndFinish: { min: 4.75,  max: 7.50,  label: 'Full Sand & Finish' },
  newInstall:        { min: 11.00, max: 18.00, label: 'New Hardwood Install' },
} as const;

export type PricingService = keyof typeof PRICING;

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
    disclaimer:
      'Rough service-band range only. Species, pattern, stairs and substrate move the number. Final price is fixed in writing after a free in-home measure.',
  };
}

export function formatCadRange(low: number, high: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  return `${fmt(low)} – ${fmt(high)}`;
}
