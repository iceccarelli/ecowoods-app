# ECONOMICS MODEL SPEC — /assistant

Pure functions only. No LLM in this file's call graph. No network I/O. Every function
here takes typed inputs and a `PriceBand`/`PriceBand[]` and returns a typed, ranged
result — never a single point estimate presented as fact, and never a number the model
is free to restate differently than the function returned it.

## Inputs (all sourced, never invented)

- `PriceBand` — from `content/constants/pricing.ts`, selected via `bandForWork(service,
  country)` / `bandForCountry(country)`.
- `squareFeet` — user-provided, never inferred from a photo (per `room.ts`'s own
  refusal to estimate area — `UNMEASURABLE_FROM_A_PHOTO`).
- `country: 'CA' | 'US'` — explicit selection or explicit default, never inferred from
  IP (law). Determines which `PriceBand` set applies; USD/CAD never converted via an
  invented FX rate.
- Catalog selections (species/finish/pattern/width) — from `FLOOR_PRODUCTS`,
  `FINISH_OPTIONS`, `PATTERN_OPTIONS`, `BOARD_WIDTHS`. These affect *feasibility*
  (`incompatibilities()`) and which service/band applies, not a per-item price
  multiplier — the removed `FLOORING_RATES_CAD_PER_SQFT` table (GEO-005) is not being
  reintroduced anywhere in this spec.

## Function signatures (illustrative — exact module path decided in ASSISTANT-04)

```ts
type Money = { min: number; max: number; currency: 'CAD' | 'USD' };

function calculateProjectRange(input: {
  service: PricingServiceKey;
  squareFeet: number;
  country: 'CA' | 'US';
}): Money
// = estimateInstalledRangeCad(...) under the hood for CA, band-equivalent for US.
// Never rounds beyond the band's own precision. Never returns a single number —
// always { min, max }.

function calculateExplicitSavings(input: {
  baseline: Money;             // e.g. two separate services quoted independently
  bundled: Money;              // the same scope under one combined job
  overlapEvidence: PricingOverlapRule[]; // must cite a real Ecowoods pricing rule
}): Money | { notQuantified: true; reason: string }
// Returns a savings range ONLY when a pricing rule justifies the overlap
// (e.g. one mobilization, one dust containment setup, shared subfloor prep).
// Otherwise returns { notQuantified: true, reason }, rendered verbatim as
// "Potential efficiency: not quantified" — never a guessed percentage.

function compareScenarios(scenarios: ProjectScenario[]): ScenarioComparison
// Pure diff of N calculateProjectRange() outputs. Never blends into a single
// "average" number that discards the range.

function calculateDelta(a: Money, b: Money): Money
// Simple range subtraction, min-to-min and max-to-max. No cross-currency deltas —
// refuses (throws a typed error) if a.currency !== b.currency.
```

## No double-count rule

A dollar may appear in exactly one of: `calculateProjectRange` (the scope itself),
`calculateExplicitSavings` (an overlap discount against a *stated* baseline), or
`ValueScenario` (a resale/value effect — see `VALUE_SCENARIO_SPEC.md`). The same
efficiency can never be counted once as a "savings" card and again folded into the
value scenario's range. Enforcement: `ValueScenario`'s cost-basis input is always
`calculateProjectRange`'s *net* output (after any confirmed savings), never the gross
scope price plus a separately-added savings figure.

## Currency law

CAD and USD are never mixed in one comparison. `country` selects one `PriceBand` set
and stays fixed for the workspace session unless the visitor explicitly changes it
(a deliberate action, logged, not inferred). No FX conversion function exists or is
introduced — a US visitor sees US bands, a CA visitor sees CA bands, full stop.

## LLM boundary

The LLM (in `/assistant`'s conversation loop) receives the *output* of these functions
as structured tool results and explains/contextualizes them in prose. It never
computes a dollar figure itself, never "rounds for readability" in a way that changes
the returned range, and never answers a pricing question without first calling the
relevant pure function for this turn (same hard rule already enforced in
`ECOWOODS_GUIDE_SYSTEM_PROMPT`: "price only from `estimate_project` this turn" —
`/assistant`'s equivalent tool carries the identical constraint).

## Testing obligation (ASSISTANT-04 acceptance criterion)

Every function above ships with unit tests covering: band selection by country,
zero/negative/absurd square footage rejection, the no-double-count invariant (a
combined test asserting `calculateExplicitSavings` output is never re-added inside a
`ValueScenario` computation), and a currency-mismatch guard test for `calculateDelta`.
