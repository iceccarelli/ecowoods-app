# Home Renovation Platform — mechanism map

Companion to `VALUATION_LIFT_AUDIT.md`. That document is the evidence base;
this one describes, for what was actually built or connected, the mechanism
by which it can matter to the business. No valuation multiples, no "doubles"
or "triples" — mechanisms only, and what was deliberately left as a
documented gap rather than built.

## What exists today, as one spine

```
Visitor
  -> Ask Francisco (/assistant) — free conversation, Project Decision State
     (localStorage; ASSISTANT-02..09)
  -> Renovation Decision Analysis offer (Phase 3) — paid, credit-metered
  -> Stripe Checkout -> webhook -> CreditWallet -> deterministic analysis
     -> saved RenovationAnalysis (owner-only)
  -> [gap: no bridge back to Floor Studio, no portal history — see below]

Separately:
Floor Studio / /design -> real Ecowoods product, price, share code
  -> estimate handoff (FULL, PG0-verified)
  -> Project -> Invoice -> Stripe -> Payment (FULL, PG0-verified)
  -> Project marked COMPLETED
  -> /admin/floor-graph/[projectId] -> JobOutcome recorded
     -> [NEW] optional Floor Passport activation (this pass)
        -> FloorRecord + JOB_EXECUTION FloorAssessment
        -> /admin/floor-graph/records (read-back)
```

The two halves — the AI/paid-intelligence spine and the
Floor-Studio/execution/passport spine — do not yet share a bridge. That gap
is named, not hidden: it is ASSISTANT-06, explicitly stubbed in the codebase
(`app/assistant/components/ProductCard.tsx`), and it is Priority 1 of this
brief's own ordering. It was not attempted in this pass — see
`VALUATION_LIFT_AUDIT.md` §6 for why.

## Revenue mechanisms

| Mechanism | What makes it work | Where it stands |
|---|---|---|
| Renovation Credits (Phase 3) | A homeowner pays for a structured decision synthesis, not a longer chat reply — the deterministic engine ties every dollar to a published band and every fact to a known/estimated/assumption/unavailable tag, so the paid result is provably more than a paragraph. | Shipped, tested, but reachable from exactly one UI surface — its revenue ceiling today is bounded by discoverability, not by product quality. |
| Three orphaned paid reports | Well-Installed Review, Pre-List Floor Report, Personal Floor Plan each already have a real Stripe purchase path and a real fulfillment pipeline. | Built, zero discovery. The mechanism (linking them from the pages that create the need — `quote-check` → review, `/realtors` → pre-list report) is named in `VALUATION_LIFT_AUDIT.md` §3/§6 as the single highest-ratio unbuilt fix, not attempted this pass. |
| Floor Studio → estimate → deposit | Already FULL per the prior forensic audit; unaffected by this pass. | No change. |

## Data / moat mechanisms

| Mechanism | Why it compounds | Where it stands |
|---|---|---|
| Floor Passport (`FloorRecord`) | A structured record of a real, physical floor — species, pattern, finish, substrate, tied (softly) to a completed job — is the one dataset in this repository a competitor cannot copy from a public site, per `docs/FLOOR_GRAPH.md`'s own thesis. It only compounds if rows actually get written. | **First activation shipped this pass.** Zero rows existed before; the write path now exists, gated behind an explicit admin confirmation at job close, with real facts only. Volume is now possible for the first time — this pass does not and cannot claim volume yet. |
| Prediction ledger (`Prediction`/`JobOutcome`) | Closes the estimate-accuracy loop — the business can eventually say "we are 6% high on refinishing" with real, closed rows, not a guess. | Unchanged this pass. `PRICE_CAD` is the only kind ever written; `LABOUR_HOURS`/`MATERIAL_SQFT` predictions (ECON-01) remain unbuilt, correctly gated on data volume the business does not have. |
| Renovation Credits' `RenovationAnalysis.contextSnapshot` | Every paid analysis freezes the exact Project Decision State it ran against — a durable, per-homeowner record of what was known and decided at that moment. | Shipped in Phase 3; not new this pass, but is itself a proprietary-data mechanism worth naming here since it sits inside the same "structured record of a decision" family as the Floor Passport. |

## Retention / switching-cost mechanisms

- **Floor Passport, once it has volume**, is the mechanism `docs/FLOOR_GRAPH.md`
  and this brief both point to for the post-job relationship (maintenance,
  recoat, future room, referral) — but that relationship cannot be built
  before the passport itself holds real rows, which is what this pass starts.
- **Renovation Credits has no retention surface today** — a customer who
  buys an analysis cannot find it again without the original URL. This is a
  named, unbuilt gap (`VALUATION_LIFT_AUDIT.md` §3.2), not a claim of
  retention that does not exist yet.

## AI distribution mechanisms

- `/api/v1`, `llms.txt`, `llms-full.txt`, `ai.txt` are real, structured,
  machine-readable descriptions of this business — genuinely differentiated
  infrastructure per the existing `docs/agentic/` documentation. They are
  **stale relative to Phase 3**: none of them mention Renovation Credits or
  a paid analysis product, so an AI system reading this site's own
  self-description would not learn that product exists. Not fixed this
  pass — flagged as the cheapest AI-distribution fix available (updating
  existing generators, not building new infrastructure).
- No MCP server exists in this repository. Building one was correctly
  deferred by this pass — the brief requires verifying the current MCP
  specification and SDK before implementation, which is out of scope for a
  pass focused on the Floor Passport activation, and premature ahead of the
  API contract cleanup the brief itself sequences first (Priority 7).

## What was deliberately not built (with reasons, not just a list)

- **A new `Home`/`Property` model** — lifecycle analysis (see
  `VALUATION_LIFT_AUDIT.md` §5) showed `FloorRecord` already owns exactly
  this role, by design, with the correct soft-link decoupling from the
  commercial record. Adding a second model would have duplicated it.
- **Automatic Floor Passport creation from chat or Floor Studio** — the
  brief is explicit that a floor becomes a passport row only through a
  deliberate, explainable workflow. Job completion (already the site's most
  conservative, human-confirmed commercial milestone) was chosen over
  "confirmed measure" or "explicit user save" because it is the one point
  in the existing codebase where a human already reviews and enters
  real physical facts about the floor (`OutcomeForm.tsx`), not just a
  square-footage guess.
- **The assistant ↔ Floor Studio bridge (ASSISTANT-06)** — real,
  well-scoped, and explicitly Priority 1 of this brief's own ordering, but
  it is premium-UX-facing work that deserves browser verification at the
  three specified viewports, which this pass (backend/data-model focused)
  did not perform. Attempting it without that verification would risk
  exactly the "claim a test passed when it was not run" failure this brief
  forbids.
- **Linking the three orphaned paid products from their natural discovery
  contexts** — real, cheap, and the single highest-value remaining item
  named in this audit, but it touches live marketing pages
  (`/realtors`, `quote-check`, homepage) that were not in this pass's
  reviewed diff and deserve their own focused, reviewable change.
- **ECON-01, referral model, MCP server** — all correctly sequenced after
  the above by the brief's own priority order; none attempted this pass.

## Honest status of "one coherent system"

The golden-path tests this brief specifies (TEST A–E) exercise the
Ask-Francisco-to-payment spine, which Phase 3 already covers end to end
(tested, not browser-verified — see `ASSISTANT_PHASE3_RENOVATION_CREDITS.md`),
and the Floor-Studio-to-execution spine, which PG0 already verified as FULL.
**This pass connected neither spine to the other** and did not perform new
browser verification of either. What it did was activate a third, previously
inert asset (the Floor Passport) at its one legitimate, evidence-backed
trigger point, and document — rather than paper over — the size of the work
that remains before this platform is the one coherent system the brief
describes.
