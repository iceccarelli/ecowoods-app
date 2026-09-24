/**
 * lib/assistant-workspace/credits-config.ts — the two numbers this whole
 * commercial loop turns on.
 *
 * Renovation Credits are the customer-facing unit; nothing downstream (the
 * offer card, the checkout line item, the wallet display) ever shows a raw
 * token count or a provider's per-call price — see chat-tools.ts and
 * renovation-analysis.ts.
 *
 * DELIBERATELY NOT A DATABASE TABLE. A price-versioning schema (rows for
 * "offer version", promo codes, multiple packs) is the enterprise-billing
 * layer the Phase 3 directive explicitly says not to build before a single
 * purchase has been proven. Changing the price today means editing the two
 * numbers below and shipping — one file, no migration. If pricing ever needs
 * to change mid-flight for orders already in progress, `CreditTransaction`
 * and `Order` already carry enough (createdAt, metadata) to tell which price
 * era a given purchase belongs to without a dedicated version table.
 */

/**
 * What one Renovation Decision Analysis costs. Fixed, not tiered — Phase 3
 * ships exactly one paid operation.
 *
 * NOT MARKET-TESTED. This is a starting number chosen to be legible
 * (round, easy to say in conversation) and small enough for a first purchase
 * to feel low-risk — not a figure backed by pricing experiments. See
 * ASSISTANT_MONETIZATION_SPEC.md.
 */
export const ANALYSIS_CREDIT_COST = 15;

export interface CreditPack {
  id: string;
  /** Renovation Credits granted on purchase. */
  credits: number;
  /** CAD, before tax — same tax handling as every other checkout on this site (Settings.defaultTaxRate). */
  priceCad: number;
  label: string;
}

/**
 * The single starter pack. One offer, not a pricing table — directive rule
 * "the smallest viable commercial offer." Priced so the first purchase buys
 * slightly more than one analysis (room to try it again without being back
 * at checkout in the same session), never a bulk "stock up" quantity.
 */
export const CREDIT_PACK: CreditPack = {
  id: 'starter-40',
  credits: 40,
  priceCad: 19,
  label: 'Renovation Credits',
};
