/**
 * content/constants/renovation-analysis-product.ts — Renovation Credits +
 * the Renovation Decision Analysis, the first paid product inside Ask
 * Francisco (Phase 3). NOT yet a confirmed commercial term of this business
 * — see the pricing note below, same governance this repo already applies
 * to `paid-review-product.ts`'s Well-Installed Quote Review.
 *
 * ────────────────────────────────────────────────────────────────────────
 * PRICING — PROPOSED, NOT CONFIRMED (Class C, ECOWOODS_AUTONOMOUS_EXECUTION_
 * PROTOCOL.md §7/§23 — a new public price claim needs human business
 * confirmation before it reaches a paying customer)
 * ────────────────────────────────────────────────────────────────────────
 *
 * Market evidence gathered 2026-09-23 (web search, current at that date —
 * re-check before shipping if this file is picked up materially later):
 *
 *  - monday.com: AI credits at $0.01 USD each, purchased in blocks from
 *    ~$960/year. (till-freitag.com, "monday.com AI Credits Explained", 2026)
 *  - GitHub Copilot: 1 credit = $0.01 USD, billed against model output.
 *    (digitalapplied.com, "GitHub Copilot AI Credits Are Live", 2026)
 *  - Across 52 AI products with public credit pricing, median bundled rate
 *    ~1.5¢/credit (range $0.0000018–$25/credit). (strategyoffinance.com,
 *    "The AI Credit Index", 2026)
 *  - Remodel AI: $29 USD/month unlimited renovation-cost generations.
 *    (remodelai.io, checked 2026-09-23)
 *  - CoolCalc: free to build a project, pay per-report to unlock the
 *    finished HVAC Manual J report, or a Pro subscription for unlimited.
 *    (coolcalc.com via search summary, checked 2026-09-23)
 *  - THE CLOSEST IN-REPO COMPARABLE: `paid-review-product.ts`'s Well-
 *    Installed Quote Review — $179 CAD standard / $249 CAD rush, a
 *    HUMAN-reviewed written analysis of a document the customer already
 *    has. This product is materially cheaper to deliver (a deterministic
 *    engine, not a person's time) and should price well under it — pricing
 *    at or above a human-reviewed product for a machine-computed one would
 *    misrepresent what's being sold.
 *
 * PROPOSED HYPOTHESIS: 1 Renovation Credit = $1.00 CAD (a legible, round
 * customer-facing unit — never shown as a raw token/model cost, per
 * directive rule 28). The Renovation Decision Analysis costs 20 credits
 * ($20 CAD) — priced as a professional-feeling but low-friction one-time
 * purchase, well under the human-reviewed comparable above, in line with
 * the ~1-2¢/credit-equivalent market median once translated into "what one
 * meaningful action costs" rather than raw per-token billing.
 *
 * This is a PROPOSED price, not an owner-confirmed one. Nothing in this
 * file is wired to accept a real customer payment until STRIPE_SECRET_KEY
 * is a live key AND a human has reviewed this number — see
 * ASSISTANT_PAYMENT_SPEC.md's launch checklist.
 */

export type CreditPackId = 'starter';

export interface CreditPackConfig {
  id: CreditPackId;
  name: string;
  credits: number;
  priceCad: number;
}

/**
 * Exactly ONE pack, per directive rule 9 — this tests willingness to pay,
 * it does not need a pricing page. 20 credits buys exactly one Renovation
 * Decision Analysis with nothing left over, so the first purchase maps
 * directly onto the first use — no confusing leftover balance to explain.
 */
export const CREDIT_PACKS: readonly CreditPackConfig[] = [
  { id: 'starter', name: 'Renovation Credits — starter pack', credits: 20, priceCad: 20 },
] as const;

export function creditPackConfig(id: string | undefined | null): CreditPackConfig | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/** Falls back to the only pack — same "never trust the client's price" rule as well-installed-review / lib/shop.ts. */
export function resolveCreditPack(requested: string | undefined | null): CreditPackConfig {
  return creditPackConfig(requested) ?? CREDIT_PACKS[0];
}

export const RENOVATION_DECISION_ANALYSIS = {
  slug: 'renovation-decision-analysis',
  name: 'Renovation Decision Analysis',
  creditCost: 20,
  deliverable:
    'A written priority order across the projects you have described, the sequencing rationale, relevant cost context from published Ecowoods bands and known market data, what assumptions the order rests on, what is still uncertain, and the next concrete step for each project.',
  refuses: [
    'not a house valuation or AVM',
    'not a contractor quote — a real quote still requires a measure',
    'not a claim about condition or urgency Francisco was not told',
  ],
} as const;
