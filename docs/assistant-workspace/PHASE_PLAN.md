# PHASE PLAN — ASSISTANT-01…10

Each phase ships as its own PR (or tightly-scoped commit series), independently
reviewable and reversible. Every phase's gates from the brief apply in addition to its
own acceptance criteria: corner ChatWidget regression, `verify-pricing-source.mjs`
green, no duplicate pipeline, typecheck, PR body with FILES CHANGED | REUSED | NEW |
TESTS | RISKS | live URLs.

## ASSISTANT-01 — Shell

**Scope**: `/assistant` route, three-zone desktop shell (Project nav | AI workspace |
live economics), mobile sticky project bar + bottom sheets, loading/error/empty
states. Nav + footer + sitemap + llms.txt reachability. No economics logic yet — static
placeholder rail is acceptable if clearly a shell milestone.

**New files (indicative)**: `apps/web/app/assistant/page.tsx` (+ layout/components),
`apps/web/lib/assistant-workspace/identity.ts` (name/voice, mirrors
`assistant-identity.ts`'s pattern, own content).

**Reused**: `lib/navigation.ts` (add entry), `app/sitemap.ts` (add entry), whatever
manifest feeds llms.txt/ai.txt (add entry), `middleware.ts` (confirm ungated, no edit
needed unless matcher requires an explicit public-route note).

**Acceptance criteria**:
- `/assistant` renders on desktop and mobile with the three-zone/sticky-bar layouts,
  no horizontal overflow, no hover-only affordances.
- Corner ChatWidget still opens/streams/estimates/books — zero changes to sacred files.
- `/assistant` appears in `DESTINATIONS`, `sitemap.ts`, and the llms.txt-family
  manifest; page is indexable, no private state exposed (there is none yet).
- Playwright: page loads, shell renders, reduced-motion respected.

## ASSISTANT-02 — Project state

**Scope**: canonical workspace state (Project Decision State) as a typed client store,
backed by `designId`/`designCode` (minted via `ensureDesignId()`), no second source of
truth. Live updates propagate to all three zones.

**Reused**: `design-id.ts`, `studio-config.ts` patterns, `QuoteRequest.designId`/
`.designCode` (read-only in this phase — writes happen in 07).

**Acceptance criteria**:
- State is serializable, round-trips through localStorage (anonymous) without loss.
- `designId` is minted once per workspace session and stable across reloads.
- No component reads/writes a second, competing state shape.

## ASSISTANT-03 — Product + service orchestration

**Scope**: cards sourced from `FLOOR_PRODUCTS` (catalog.ts) and the service
registry (`service-pages.ts`/`seo-data.ts` `SERVICES`). "Recommended for your project"
is a pure filter/sort over these, driven by workspace state.

**Acceptance criteria**:
- Zero invented SKUs/services — every card's data traces to `FLOOR_PRODUCTS` or
  `SERVICES` by id.
- Every price shown traces to a `PriceBand` (no literal, guard stays green).
- `incompatibilities()` rules from `catalog.ts` are respected in recommendations
  (e.g. no herringbone recommendation at an incompatible board width).

## ASSISTANT-04 — Economics

**Scope**: implement `ECONOMICS_MODEL_SPEC.md` — pure `calculateProjectRange`,
`calculateExplicitSavings`, `compareScenarios`, `calculateDelta`. LLM never invents
dollars; bundle savings only when a real pricing-rule overlap justifies it.

**Acceptance criteria**:
- Unit tests per the spec's testing-obligation section (band selection by country,
  degenerate inputs, no-double-count invariant, currency-mismatch guard).
- `verify-pricing-source.mjs` green with zero new literals.
- Economics rail live-updates on every state change from 02/03.

## ASSISTANT-05 — Value scenario

**Scope**: implement `VALUE_SCENARIO_SPEC.md` — ranges + confidence + evidence drawer
+ assumption ledger, sourced from case studies (E2/E3) at launch. Insufficient
evidence renders "not quantified," not a suppressed card.

**Acceptance criteria**:
- No scenario ever renders `effect.confidence: 'high'` (no E4+ evidence exists yet —
  if this criterion needs to change, that is a signal to revisit, not silently pass).
- No absolute-dollar house-value claim anywhere in copy or generated text.
- No stacked/multiplied percentages without a joint evidence basis.
- Every `ValueScenarioCard` opens an evidence drawer, including "not quantified" cases.

## ASSISTANT-06 — Floor Studio bridge

**Scope**: open/embed Floor Studio from `/assistant`, preserve `designId` both ways,
zero retyping. Respect `room.ts` privacy rules absolutely.

**Acceptance criteria**:
- Round-trip test: select a floor in `/assistant` → open in Floor Studio → same
  `designId`/config on return, no manual re-entry.
- `StudioRoomFacts` (light/undertone/tone) may cross the bridge; no pixel data, no
  image URL, ever, in workspace state, network payloads, or share links.
- No casual upload UI is added to `/assistant` that Floor Studio itself doesn't already
  have.

## ASSISTANT-07 — Conversion

**Scope**: estimate / availability / measure / quote actions via existing backends
(`app/api/appointments`, `app/api/availability`, `lib/actions/quotes.ts`). Pattern:
PLAN → REVIEW → USER CONFIRMS → EXECUTE → RESULT → RECEIPT. No silent booking/charges.

**Acceptance criteria**:
- Every booking/quote-request write sets `designId`/`designCode` when available
  (closing the gap the corner widget's tools currently have — see `DATA_FLOW_MAP.md`),
  and records a funnel event with `source: 'assistant-workspace'`.
- No action executes without an explicit user confirmation step rendered and
  acknowledged (verified in a Playwright test: interrupting before confirm leaves no
  row created).
- Same `Appointment`/`QuoteRequest`/`Project` models as the rest of the site — no
  parallel table.

## ASSISTANT-08 — Save / share

**Scope**: anonymous-useful without login; auth for persistence. Share-safe project
link (config only, no PII).

**Acceptance criteria**:
- A logged-out visitor completes the full golden path (state → recommendation →
  economics → value scenario → next action) with zero forced login.
- A shared link, inspected, contains no name/email/phone/address/photo — config and
  `designId` only.
- Persistence for a logged-in visitor rides `middleware.ts`'s existing `isLoggedIn`
  gate; no new auth mechanism.

## ASSISTANT-09 — Analytics

**Scope**: `workspace_*` events appended to `AnalyticsEvent`; `/assistant` added to
`ROUTE_FUNNEL` with its own funnel definition. Funnel: open → project → product →
studio → estimate → measure → quote → deposit → job.

**Acceptance criteria**:
- No PII, photos, quote documents, or free-form private chat content in any event's
  `params`.
- `lib/funnels`'s compile-time step enforcement passes for the new `assistant` funnel.
- `scripts/verify-strategy.mjs` (or equivalent funnel-consistency guard) green.

## ASSISTANT-10 — Hardening

**Scope**: a11y, perf (lazy heavy modules — Floor Studio bridge, evidence drawers),
security (prompt injection cannot change prices/policy — same defense pattern as
`ECOWOODS_GUIDE_SYSTEM_PROMPT`'s injection-defense paragraph, adapted for the
workspace's own tool set), pricing guard green, corner-assistant regression suite,
Playwright happy path + mobile + keyboard + reduced-motion.

**Acceptance criteria**:
- A prompt-injection red-team pass (adversarial user/tool/web text attempting to
  change a displayed price or policy statement) fails to alter any economics/value
  output — the pure functions are the only source of those numbers, verified by test.
- Full corner ChatWidget regression suite green, unmodified behavior.
- Lighthouse/a11y pass on `/assistant` at parity with the rest of the site's standard.
- Playwright: desktop happy path, mobile happy path, keyboard-only navigation,
  `prefers-reduced-motion` respected.

---

Phases 01–04 are the minimum for a visibly working, honest (no-invented-numbers)
workspace and are the natural first implementation PR after this Phase 0 docs PR
merges. 05–10 build conversion, trust surface, and hardening on top, in order.
