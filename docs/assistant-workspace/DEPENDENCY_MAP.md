# DEPENDENCY MAP — /assistant

Arrows read "depends on." Everything left of `/assistant` already exists and is
verified live (see `EXISTING_CAPABILITY_MATRIX.md` for citations). Everything right
of it does not exist and is scoped to a numbered phase.

```
/assistant (new route, ASSISTANT-01)
 │
 ├─ Shell + three-zone layout ─────────────────────── ASSISTANT-01
 │
 ├─ Workspace state (Project Decision State) ──────── ASSISTANT-02
 │    ├─ depends on: design-id.ts (mint/read designId)
 │    ├─ depends on: studio-config.ts patterns (share-code shape, StudioRoomFacts)
 │    └─ depends on: QuoteRequest.designId / .designCode (schema, MEAS-01/SALE-01)
 │
 ├─ Product/Service orchestration ─────────────────── ASSISTANT-03
 │    ├─ depends on: catalog.ts (FLOOR_PRODUCTS, BOARD_WIDTHS, incompatibilities)
 │    ├─ depends on: service-pages.ts, seo-data.ts (SERVICES)
 │    └─ depends on: /api/v1/services, /api/v1/pricing (read-path parity check only —
 │         /assistant imports the modules directly, does not fetch its own API)
 │
 ├─ Economics engine (pure fns) ────────────────────── ASSISTANT-04
 │    ├─ depends on: content/constants/pricing.ts (PriceBand, bandForWork, bandForCountry)
 │    ├─ depends on: packages/shared/ai (estimateInstalledRangeCad)
 │    └─ depends on: ASSISTANT-02 (needs project state to compute against)
 │
 ├─ Value scenario engine ──────────────────────────── ASSISTANT-05
 │    ├─ depends on: ASSISTANT-04 (a resale scenario is a cost-basis derivative,
 │    │    never an independent number)
 │    ├─ depends on: case-study-loader.ts / case-study-types.ts (E2/E3 evidence)
 │    ├─ depends on: REVIEW_EVIDENCE (packages/shared/constants) for company-claim tier
 │    └─ depends on: a NEW evidence-hierarchy definition (E0–E7 does not exist in this
 │         repo yet — /assistant introduces it; GridForge's evidence-hierarchy pattern
 │         is precedent/inspiration only, not a shared import — these are separate
 │         products with separate evidence registries)
 │
 ├─ Floor Studio bridge ────────────────────────────── ASSISTANT-06
 │    ├─ depends on: studio-config.ts (estimateHref, encodeStudioDesign, share code)
 │    ├─ depends on: design-id.ts (same designId space)
 │    └─ depends on: room.ts (StudioRoomFacts type only — hard boundary, no pixels
 │         cross into workspace state, ever)
 │
 ├─ Conversion actions (estimate/availability/measure/quote) ─ ASSISTANT-07
 │    ├─ depends on: app/api/appointments/route.ts, app/api/availability/route.ts
 │    ├─ depends on: lib/actions/quotes.ts (submitQuoteRequest / saveEstimate pattern)
 │    ├─ depends on: lib/funnel-ledger.ts (recordFunnelEvent) — extend `source` values,
 │    │    thread designId through (closes a gap the chat route currently has)
 │    └─ depends on: ASSISTANT-02 (state to convert), ASSISTANT-04 (price to quote)
 │
 ├─ Save / share ───────────────────────────────────── ASSISTANT-08
 │    ├─ depends on: ASSISTANT-02 (serializable state)
 │    ├─ depends on: app/(portal)/mypage/*, middleware.ts (auth) for persistence
 │    └─ depends on: design-id.ts share-code conventions (config-only link, no PII)
 │
 ├─ Analytics ──────────────────────────────────────── ASSISTANT-09
 │    ├─ depends on: lib/analytics.ts (AnalyticsEvent union — extend, don't fork)
 │    └─ depends on: lib/funnels/index.ts (ROUTE_FUNNEL — add `/assistant` + `assistant` funnel)
 │
 └─ Hardening (a11y, perf, security, regression) ───── ASSISTANT-10
      ├─ depends on: scripts/verify-pricing-source.mjs (must stay green)
      ├─ depends on: scripts/verify-assistant.mjs (corner-widget guard — must stay green,
      │    unmodified in its retired-name/identity checks)
      └─ depends on: ChatWidget.tsx / api/chat/route.ts regression (corner assistant
           must still open/stream/estimate/book, unmodified in behavior)
```

## External dependency notes

- **No new database migration is required to start ASSISTANT-01–04.** `designId`/
  `designCode` already exist on `QuoteRequest`/`Project`. Persistence for save/share
  (08) may need a new lightweight table (e.g. `WorkspaceSnapshot`) — decide in 08's own
  spec, not here; do not repurpose `FloorRecord` (orphaned, out of scope, see
  `NO_DUPLICATION_GUARANTEE.md`).
- **No new LLM tool infrastructure is required.** The Vercel AI SDK / Anthropic
  `streamText` + tool pattern already in `api/chat/route.ts` is the template; `/assistant`
  needs its own route (or route family) because its response shape (structured cards)
  differs from the corner widget's plain-text stream, not because the underlying SDK
  usage differs.
- **`packages/shared/ai` is a shared package boundary.** It cannot import from
  `apps/web/content` (documented in-repo: bands travel IN as a parameter). Any new pure
  function shared between the corner widget and `/assistant` belongs here, following
  that same boundary — never a per-app duplicate of `estimateInstalledRangeCad`.
