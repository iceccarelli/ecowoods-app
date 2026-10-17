/**
 * content/constants/floor-plan-product.ts — the Personal Floor Plan spec PDF
 * (EW-0004), a NEW paid product and NOT yet a confirmed commercial term.
 *
 * The $99 figure is a researched recommendation, not an owner-confirmed
 * price. `priceConfirmed` remains false until the owner confirms the
 * commercial term. The product page hides the proposal and checkout form
 * while it is false, and the API refuses checkout before writing an Order or
 * creating a Stripe session. Only an owner-approved change should set it true.
 *
 * studio-products.ts already declares this exact rung — id 'floor-plan',
 * `priceCad: null`, `published: false` — and that file is deliberately not
 * edited here. Publishing a figure by editing that file is the one thing its
 * own header comment says no engineer or agent gets to do in a patch.
 */

export const FLOOR_PLAN_PRODUCT = {
  slug: 'floor-plan',
  /** Owner approval required before the price or checkout is shown publicly. */
  priceConfirmed: false as boolean,
  name: 'Personal Floor Plan',
  priceCad: 99,
  deliverable:
    'The floor you configured in Floor Studio, written out as a specification you can email a spouse, a designer, a condo board, or your own contractor: species, finish, pattern, board width, seasonal movement for that width, and the indicative installed range.',
  refuses: [
    'not a fixed price — the installed range is an estimate, and the fixed price is written after an in-home measure',
    'not a substitute for the in-home measure',
    'not a floor this company cannot actually lay — every configuration is checked against the real catalogue before a page or a PDF is generated',
  ],
} as const;
