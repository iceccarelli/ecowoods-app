/**
 * content/constants/floor-plan-product.ts — the Personal Floor Plan spec PDF
 * (EW-0004), a NEW paid product and NOT yet a confirmed commercial term.
 *
 * Same Class C posture as the other paid-review constants files in this
 * branch: $99 is the ecowoods-opportunity agent's researched recommendation,
 * not an owner-confirmed price. See ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md
 * §7/§23.
 *
 * studio-products.ts already declares this exact rung — id 'floor-plan',
 * `priceCad: null`, `published: false` — and that file is deliberately not
 * edited here. Publishing a figure by editing that file is the one thing its
 * own header comment says no engineer or agent gets to do in a patch. This
 * file is the sibling NEW declaration the opportunity brief asked for
 * instead.
 */

export const FLOOR_PLAN_PRODUCT = {
  slug: 'floor-plan',
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
