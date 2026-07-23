export const PRICING = {
  screenAndRecoat:   { min: 2.50,  max: 4.00,  label: 'Screen & Recoat' },
  fullSandAndFinish: { min: 4.75,  max: 7.50,  label: 'Full Sand & Finish' },
  newInstall:        { min: 11.00, max: 18.00, label: 'New Hardwood Install' },
} as const;
export type PricingService = keyof typeof PRICING;
export const PRICE_PROMISE =
  'Fixed price in writing. It never moves after the free in-home estimate.';
