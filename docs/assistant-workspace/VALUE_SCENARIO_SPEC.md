# VALUE SCENARIO SPEC — /assistant

No evidence-hierarchy (E0–E7) construct exists anywhere in this repo today (confirmed:
zero hits for `EvidenceTier`/"evidence hierarchy" under `apps/web` and `packages`).
This spec introduces one for `/assistant`, scoped to this product only. It is not
imported from, and does not import, any other iceccarelli product's evidence system —
each product's evidence registry is its own; naming a shared tier scheme here is
convenience, not a dependency.

## What a "value scenario" is and is not

**Is**: a labelled, ranged, evidence-cited *scenario* — "if this project is completed
as scoped, here is a plausible range of effect on resale readiness, drawn from
comparable documented work and stated assumptions."

**Is never**: an appraisal, a guarantee, a single dollar figure, a percentage stacked
on another percentage, or a claim independently validated by a third party unless it
actually is (and then cited as such, at its real tier).

## Evidence hierarchy (E0–E7, defined here for `/assistant` only)

| Tier | Definition | Example source in this repo |
|---|---|---|
| E0 | No evidence — assumption stated as assumption | "typical GTA buyer preference," unsourced |
| E1 | Industry-general publication, not Ecowoods-specific | A trade publication's general remodeling-value survey |
| E2 | Ecowoods company claim / documented own project | `case-study-types.ts` entries — species, sqft, moisture, results — real but self-reported |
| E3 | Ecowoods documented project with third-party-visible outcome | A case study with a published, attributable testimonial or public review referencing the specific job |
| E4 | Aggregated Ecowoods outcome data across multiple jobs | Would require `JobOutcome`/`FloorRecord` populated at volume — **does not exist yet** (both orphaned per capability matrix); no E4 evidence is available today |
| E5 | Independent local market data (e.g. realtor/appraiser-sourced, GTA-specific) | Not currently sourced anywhere in this repo — would require a new, explicitly-cited external data feed, not invented |
| E6 | Independent academic/regulatory study | Not currently sourced — would need an explicit citation, added the same way `docs/` papers are cited elsewhere on the site |
| E7 | Direct comparable sale data (same property, before/after) | Never available to Ecowoods; explicitly out of scope — this is appraisal territory, not something this company can ethically claim |

**Today's real ceiling is E2/E3.** No E4–E7 evidence exists in this codebase. Any
value scenario shown at launch is built from E2/E3 (case studies) plus E0/E1
(labelled assumptions and general industry patterns) — and must say so, visibly, in
the evidence drawer. This is not a placeholder to fix later; it is the honest state,
and the UI must represent confidence accordingly (see confidence bands below).

## Structure of a `ValueScenario`

```ts
type ValueScenario = {
  scope: { service, squareFeet, species, ... }        // the project this scenario is about
  costBasis: Money                                     // = calculateProjectRange() NET of any savings (no double-count)
  effect: {
    range: { min: number; max: number } | null         // null when evidence is insufficient — see below
    unit: 'CAD' | 'USD' | 'qualitative'                 // a qualitative-only scenario is valid and often more honest
    confidence: 'low' | 'medium' | 'high'
  }
  evidence: EvidenceCitation[]                          // every citation has {tier: E0-E7, source, url?}
  assumptions: string[]                                 // the assumption ledger — plain language, always visible
  limitations: string[]                                 // stated, not buried
  label: string                                         // MUST include "scenario," "range," or "potential" — never "value"/"worth" alone
}
```

## Forbidden constructs (hard rules, enforced by review + `verify-assistant`-style guard in ASSISTANT-10)

- **Never** "your house will be worth +$X." No absolute dollar claim about a specific
  property's future sale price, ever, under any confidence level.
- **Never** stack percentage ROIs (e.g. "recoup 70% of cost" × "plus 10% faster sale" as
  if multiplicative or additive without a joint evidence basis for the *combination*).
  Each cited effect gets its own range or none at all.
- **Never** present a company claim (E2) as independent validation. The evidence
  drawer must label E2 sources exactly as "Ecowoods project record," not "verified" or
  "confirmed by data."
- **Insufficient evidence → `effect.range = null`**, rendered as "Potential resale
  effect: not quantified" with the reason stated (e.g. "no comparable documented
  project at this scope yet"). This is a valid, expected, frequent output — not a bug
  to route around by lowering the evidence bar.
- **No ML resale prediction.** No trained model, no regression against `JobOutcome`
  (which is not populated with resale outcomes and has no such column), no learned
  weighting presented as data-driven. If a future data source justifies E4+ evidence,
  that is a separate, later proposal — not built here, not scaffolded here as an
  empty hook waiting for data (no speculative infrastructure per the no-scope-creep law).

## Confidence bands (how `effect.confidence` is set — deterministic, not vibes)

- `low` — E0/E1 only, or a single E2 data point.
- `medium` — 2+ E2/E3 data points with materially similar scope (same service
  category, comparable sqft band).
- `high` — reserved; requires E4+ evidence, which does not exist in this codebase
  today. **No `/assistant` value scenario should ship at `high` confidence at launch.**
  If ASSISTANT-05's implementation ever produces `high`, that is a signal the evidence
  pool changed and warrants a review, not silent acceptance.

## UI contract

Every `ValueScenarioCard` opens an evidence drawer ("Why this number?") showing:
source, formula (which pure function combination produced `costBasis`), assumptions
list, limitations list, and confidence — matching the same "Why this number?" pattern
the brief specifies for economics generally. A scenario with `effect.range === null`
still opens the same drawer, showing why it couldn't be quantified — never a dead end.
