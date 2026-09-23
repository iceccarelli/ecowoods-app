# DATA FLOW MAP — /assistant

`designId` stays design identity, never a user/session/tracking id, end to end.
It names a floor configuration, not a person — nullable everywhere, and a share
link handed to a spouse or contractor deliberately carries the same id.

## Canonical flow (target state after ASSISTANT-01…09)

```
ANONYMOUS VISITOR
  │
  ▼
/assistant opens (no login required — law 08)
  │  ensureDesignId() mints a designId if none in local state yet
  ▼
CONVERSATION + CARDS mutate Project Decision State
  │  species/finish/pattern/sqft/country/service selections
  │  economics engine recomputes on every state change (pure fn, ASSISTANT-04)
  ▼
        ┌────────────────────────────┐
        │  Floor Studio bridge (06)  │◄──── visitor may instead start in
        │  opens/embeds Floor Studio │      /floor-studio and arrive here
        │  same designId round-trips│      via "Ask Francisco"-style handoff
        └────────────────────────────┘
  │  design (share code) + designId flow back into workspace state,
  │  never retyped, never re-rendered as a second description of the floor
  ▼
NEXT ACTION chosen: measure | quote | estimate
  │  PLAN → REVIEW → USER CONFIRMS → EXECUTE → RESULT → RECEIPT (law 07)
  ▼
CONVERSION ACTION (07) — reuses existing backends, not new ones:
  │  book_measure-equivalent  → Appointment + QuoteRequest in one transaction
  │  create_quote_request-eq. → QuoteRequest
  │  BOTH now set QuoteRequest.designId AND QuoteRequest.designCode
  │  (closing the gap: today's chat tools in api/chat/route.ts do NOT set these —
  │   /assistant's conversion actions must, from day one, not inherit that gap)
  ▼
QuoteRequest (real row, indexed on designId)
  │  admin decodes designCode against the live catalog — never a stale free-text note
  ▼
Project (designId copied forward at conversion, same as today) ──► Invoice ──► Payment
  │
  ▼
JobOutcome / Prediction (admin close-out) — UNCHANGED, /assistant does not read/write these
```

## Funnel ledger events (extends existing `FunnelStage` enum, no new enum values needed)

```
FunnelEvent { stage: LEAD_CAPTURED | APPOINTMENT_BOOKED | QUOTE_ISSUED | ...
              designId, source: 'assistant-workspace' }   ← new `source` string only
```

Recorded at the same two/three points the chat route already records them
(`book_measure` → LEAD_CAPTURED + APPOINTMENT_BOOKED; `create_quote_request` →
LEAD_CAPTURED), via the same `recordFunnelEvent()` — with `designId` populated this
time.

## Analytics events (extends `AnalyticsEvent` union, no new module)

```
workspace_open, workspace_project_started, workspace_product_selected,
workspace_studio_bridge_opened, workspace_estimate_viewed,
workspace_measure_requested, workspace_quote_requested,
workspace_value_scenario_viewed, workspace_evidence_opened, workspace_shared
```

No PII, no photos, no quote documents, no free-form private chat content in any
`params` object — same discipline `lib/analytics.ts`'s existing per-event comments
already enforce.

## What never crosses a boundary

- **Room photo pixels** — captured client-side only by `room.ts`, reduced to
  `StudioRoomFacts` (3 enum-ish strings) before anything is stored, shared, or sent to
  an LLM. Never in workspace state as an image, never in a share URL, never uploaded
  unless the visitor explicitly opts into the existing, separate photo-retention
  consent flow (`ASSESSMENT_PHOTOS` purpose) — which is Floor Studio's flow, not a new
  one `/assistant` invents.
- **Price literals** — never typed in a component, prompt, tool, or the scenario
  engine. Every dollar traces to a `PriceBand` from `content/constants/pricing.ts`.
- **PII in share links** — a shared workspace link carries config (species, sqft,
  finish, designId) only. No name/email/phone/address/photos.
- **LLM-invented numbers** — the LLM narrates `economics`/`valueScenario` objects it is
  handed; it does not compute or restate them from memory. `estimate_project`-style
  tools return the pure-function output verbatim for the model to explain, not a
  number for the model to reason about and possibly round or "helpfully" adjust.

## Where this diverges from the corner assistant's current data flow

The corner widget's `book_measure`/`create_quote_request` tools create real rows today
but leave `designId`/`designCode` null even when the visitor arrived via a Floor Studio
handoff sentence (`describeFloorForChat()`). That is an existing, separate gap in a
sacred file (`api/chat/route.ts`) that this PR does not touch. `/assistant`'s own
conversion actions are new code and must not repeat the omission — but fixing the
corner widget's version of the gap, if ever done, is its own patch against
`api/chat/route.ts`, decided later, not bundled into `/assistant`'s phases.
