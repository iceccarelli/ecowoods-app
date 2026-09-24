# Valuation Lift Audit

Evidence-based, not aspirational. Every claim below cites a file. Where a
prior document already answered a question with better evidence than a fresh
read could produce in this pass, it is cited and re-verified rather than
redone — `docs/audit/PG0_FORENSIC_AUDIT.md` and `docs/FLOOR_GRAPH.md` are
the two most load-bearing prior audits and both remain largely accurate.
This audit's job is to say what has changed since (Phase 3 — Renovation
Credits) and what that changes about priority.

Repository state audited: `iceccarelli/ecowoods-app`, branch reset to
`origin/main` at `95690bc` (merge of PR #135, Phase 3 Renovation Credits,
commit `a0a37f6`).

## 1. What changed since PG0_FORENSIC_AUDIT.md

That audit (commit `d4db913`) found a real, wired commercial pipeline with
one structural gap (no attribution join key) and named `FloorRecord` as
**ORPHANED — 0 create calls in the entire repo**. Since then:

- MEAS-01 through SALE-02 shipped (Design ID, funnel ledger, tool
  instrumentation, the lying-handoff fix, structured design on
  `QuoteRequest`) — confirmed still present and functioning (all 82 test
  files pass, including `lib/funnel-ledger.test.ts`, `lib/design-id.test.ts`).
- **Phase 3 (Renovation Credits) shipped** — the first real paid product
  inside `/assistant`: `CreditWallet`, `CreditTransaction`,
  `RenovationAnalysis` (`apps/web/prisma/schema.prisma`), a Stripe
  checkout/webhook extension (`app/api/webhooks/stripe/route.ts`), and a
  deterministic analysis engine
  (`lib/assistant-workspace/renovation-analysis.ts`).
- **ECON-01 and OWN-01/OWN-02 (the PG0 roadmap's ranks 7–9) had NOT shipped**
  as of this audit's start. `FloorRecord` still had zero `.create` calls
  anywhere in the repository — confirmed by direct grep and independently by
  a parallel read-only audit agent in this session. **OWN-01 is the one item
  this pass implements** (see §5).

## 2. Capability matrix update (extends PG0's table, does not repeat it)

| Capability | State (this audit) | Evidence |
|---|---|---|
| Renovation Credits / paid analysis | **FULL, but ISOLATED** | Real Stripe purchase → webhook → credit grant → deterministic analysis → saved `RenovationAnalysis`, all tested (`tests/renovation-credits-flow.test.ts`). But: only reachable from one component, `app/assistant/components/RenovationAnalysisOffer.tsx` — no other page links to it, and `/mypage` has zero surface for it (no "your purchased analyses" anywhere; confirmed by grep across `app/(portal)/mypage/**`). |
| Well-Installed Quote Review, Pre-List Floor Report, Personal Floor Plan | **FULL execution, ORPHANED discovery** | Each has a real checkout → `Order` → PDF pipeline. None has an inbound link from navigation, homepage, `/realtors`, or any other content page — reachable only by a direct URL a visitor would have to already know. |
| Ask Francisco ↔ Floor Studio | **NOT BUILT** | `app/assistant/components/ProductCard.tsx` contains a disabled stub literally labelled "Coming in a later phase (ASSISTANT-06)". `lib/assistant-workspace/types.ts`'s `designCode` field exists and is unused. The two products (Ask Francisco, Floor Studio) share no continuity today beyond both existing. |
| `FloorRecord` (Floor Passport) | **ORPHANED → FIRST ACTIVATION (this pass)** | Confirmed 0 `.create` calls pre-existing; see §5 for what this pass adds. |
| `/api/v1`, llms.txt, ai.txt | **STALE relative to Phase 3** | `app/llms.txt/route.ts` describes Ask Francisco's free conversation but never mentions Renovation Credits, paid analysis, or a Floor Passport. None of the ~30 `/api/v1` routes reference the credit system. |
| Analytics ↔ margin | **STILL NOT JOINED** | `app/admin/funnel/page.tsx` states explicitly that it does not show margin because `JobOutcome` join is future work (ECON-01, unbuilt). Confirmed still true. |
| Referral | **STILL WEAK** | No `Referral` model in `schema.prisma`. `app/api/referrals/route.ts` exists but has no dedicated table to write structured attribution to. Unchanged since PG0. |

## 3. What is valuable but invisible (ranked by how cheap the fix is)

1. **The three paid report products have zero inbound links.** This is the
   single cheapest, highest-ratio fix in the repository: three fully-built,
   Stripe-integrated commercial products (`well-installed-review`,
   `listing-floor-report`, `floor-plan`) generate zero demand because nothing
   points at them. Fixing this is pure linking work, not a build — see §7.
2. **Renovation Credits has no portal presence.** A homeowner who buys an
   analysis has to keep the exact URL or the chat session; there is no
   "your analyses" list in `/mypage`. This is a retention leak on a product
   that exists specifically to prove repeat-worthy value.
3. **`FloorRecord` (Floor Passport)** — see §5. Now partially activated.
4. **AI distribution (llms.txt / `/api/v1`) does not know Phase 3 exists.**
   An AI system reading this site's own machine-readable description of
   itself would not learn that a paid renovation-analysis product exists.

## 4. What should NOT be built now (repository evidence agrees with the brief's NO list)

- A second auth, project, product, or analytics system — none needed;
  existing ones are real and sufficient (confirmed above and in PG0).
- A prediction/ML layer — `JobOutcome`/`Prediction` still lack the volume
  PG0 gated this on, and this pass does not change that volume.
- A generic developer billing portal for `/api/v1` — the API's own
  documentation (`docs/FLOOR_GRAPH.md` §8) explicitly defers a public Floor
  Graph API until the corpus behind it is real; that has not changed.
- A new `Home`/`Property` model — see §5's lifecycle analysis for why
  `FloorRecord` already owns this role and a parallel model would duplicate it.

## 5. Floor Passport — first activation (implemented this pass)

**Lifecycle analysis, per the brief's own requirement before adding a new
model:** `Project`, `QuoteRequest`, and `designId` each own a *commercial*
or *session* lifecycle — they are created, updated, and (for `QuoteRequest`)
subject to erasure requests tied to a person. `FloorRecord` already exists
in the schema specifically to own the *physical* lifecycle of a floor,
deliberately decoupled from the commercial record via soft (non-`@relation`)
UUID links (`docs/FLOOR_GRAPH.md` §4.1) so that erasing a lead can never
cascade into deleting the physical facts about a floor that still exists in
a house. **No new model is needed or was created.** The gap was purely that
nothing ever wrote to the one that already exists correctly.

**What was built:**

- `createFloorRecord()` in `lib/floor-graph/index.ts` — the first function in
  the codebase that writes a `FloorRecord` row. Follows the file's existing
  conventions exactly (`CaptureResult<T>`, never throws, structured failure
  logging) and reuses `nextFloorRecordRef()`, which existed and was already
  correct but had never been called by anything that then created a row.
- `recordAssessment()` extended (backward-compatibly — all new fields
  optional) to accept `floorRecordId`, `reviewedBy`, `recommendation`, so a
  provenance-carrying assessment can be linked to the record it documents.
- **Activation point: a confirmed job close**, the most conservative of the
  four legitimate triggers the brief names (measure / project / explicit
  save / job completion). Wired into the existing
  `POST /api/admin/floor-graph/outcome` — the one place in the codebase that
  already writes `JobOutcome` — behind a new, unchecked-by-default,
  explicit admin checkbox: "Save this floor to the Floor Passport." Nothing
  is created from a chat message, an inferred value, or a default-on toggle.
- Every fact written comes from data already on file (`Project.city`,
  `.province`, `.squareFeet`, `.species`) or typed by the admin at the exact
  moment of job close (storey, pattern, finish system, substrate, install
  method, board dimensions) — never derived, never guessed. A second job
  closed against the same project reuses the existing passport rather than
  minting a duplicate.
- A paired `FloorAssessment` (`source: JOB_EXECUTION`) is written for
  provenance, naming who closed it and when — using the Floor Graph's own
  `source` field exactly as `docs/FLOOR_GRAPH.md` describes its purpose
  ("what stops a photo triage and a measured visit from being averaged
  together").
- **Read-back added**: `/admin/floor-graph/records` — a plain list of every
  `FloorRecord` with its linked assessment/outcome counts, and the
  project's close-job page now shows whether a passport already exists
  before offering to start one. This directly answers the forensic
  audit's standing complaint that Floor Graph tables are "captured,
  consent-gated, correct — and never read back."

**What this pass deliberately did not do:** it did not add a public-facing
Floor Passport page for homeowners, did not touch photo consent or
retention (no photographs are involved in this activation path at all —
`AssessmentPhoto` is untouched), and did not add automatic activation from
Floor Studio or the assistant chat (both explicitly forbidden by the
brief's "never from typing in chat" rule, and neither has a legitimate
job-completion signal to trigger from yet).

**Mechanism, not a valuation number:** each `FloorRecord` created this way
is a data point this business owns that no competitor's public repository
or marketing site can produce — a real board species, pattern, and
substrate combination, tied to a real completed job, in a schema designed
specifically so it can compound across jobs (`docs/FLOOR_GRAPH.md` §1's
"structured record of two thousand Toronto floors cannot be rebuilt at all
without doing the work"). Whether it becomes a maintenance/referral/repeat
mechanism depends on volume this activation makes possible for the first
time — it does not itself claim that outcome.

## 6. Remaining priorities, not attempted this pass (honest roadmap)

In the order the new brief proposes, with why each was not attempted here:

- **Priority 1 (identity → project → design → assistant → next action
  continuity)** — the biggest single gap (ASSISTANT-06, the Floor
  Studio↔assistant bridge) is explicitly stubbed and unbuilt. Not attempted
  this pass: it touches the premium `/assistant` UX directly and deserves
  its own focused pass with browser verification, not a shared pass with a
  backend data-model change.
- **Priority 3 (assistant orchestration of existing tools)** — depends on
  Priority 1's bridge existing first.
- **Priority 4 (Floor Studio → measurement → estimate continuity)** —
  Floor Studio's estimate handoff is already FULL per PG0; the gap is
  specifically the assistant-side bridge above, not Floor Studio itself.
- **Priority 5 (unified paid intelligence discovery)** — the highest
  *ratio* fix identified in §3 (linking the three orphaned paid products,
  and giving Renovation Credits a `/mypage` presence) was not implemented
  this pass because it touches marketing/portal pages outside this pass's
  reviewed scope; it is the single most evidence-backed next step.
- **Priority 7 (AI/API/MCP distribution)** — `/api/v1` and llms.txt being
  stale relative to Phase 3 is confirmed (§3); not fixed this pass.
- **Priority 8 (referral/maintenance loop)** — correctly gated behind the
  Floor Passport existing at all, which this pass only just activated.
- **ECON-01 (predicted vs. actual labour/material)** — `Prediction` still
  only ever writes `PRICE_CAD`; unchanged this pass. Real, well-scoped, and
  independent of the Floor Passport work — a reasonable next increment.

None of these were skipped because they lack evidence; they were left
undone because attempting all of them in one pass would repeat the exact
failure mode this brief warns against — parallel, uncoordinated changes to
the same systems, verified by nobody.
