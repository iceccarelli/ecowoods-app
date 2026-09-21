# NEW ASSISTANT ARCHITECTURE — /assistant (AI Home Advisor)

## What this is not

Not a rebuild of the site. Not a replacement for the corner Quick Assistant
(`ChatWidget.tsx`). Not a second chatbot. `/assistant` is a new route that renders a
different product around the same backend primitives EcowoodsGuide already uses.

## The central object

**Project Decision State** — not a chat transcript. A typed, serializable object that
holds everything known/assumed about one homeowner's project:

```
WorkspaceState {
  designId: string | null          // minted via ensureDesignId(), same id space as Floor Studio
  designCode: string | null        // the Floor Studio share code, verbatim (never expanded/re-rendered here)
  project: {
    service: 'installation' | 'refinishing' | ...   // from PRICING / SERVICES keys, never invented
    country: 'CA' | 'US'                              // explicit, never inferred from IP (law)
    squareFeet: number | null                         // asked, never guessed from a photo (room.ts law)
    species, finish, pattern, boardWidth: catalog ids from FLOOR_PRODUCTS/FINISH_OPTIONS/PATTERN_OPTIONS
    room: StudioRoomFacts | null                      // light/undertone/existing-floor tone only, never pixels
  }
  economics: EconomicsSnapshot   // pure function output, see ECONOMICS_MODEL_SPEC — never stored as freeform text
  valueScenario: ValueScenario | null   // see VALUE_SCENARIO_SPEC — ranged, evidenced, or explicitly "not quantified"
  conversation: Message[]        // the interface, not the record
  nextAction: 'measure' | 'quote' | 'estimate' | null
}
```

Conversation is *one interface* onto this state. Cards, the economics rail, and the
project nav are others. Any of them can mutate the state; the LLM only *proposes*
mutations to `project`/`nextAction` — it never writes `economics` or `valueScenario`
fields directly (those are always recomputed by the pure engines from `project` +
`PriceBand` + evidence).

## Three-zone shell

```
┌─────────────┬───────────────────────────────┬──────────────────────┐
│ PROJECT NAV │   AI WORKSPACE (conversation   │   LIVE ECONOMICS     │
│  (left)     │   + interactive cards, center) │   (right)            │
│             │                                │                      │
│ - New       │  Message bubbles (LLM + user)  │ Cost range           │
│ - Saved     │  Structured cards inline:      │ Deltas vs. baseline  │
│   projects  │   ProductCard, ServiceCard,    │ Explicit savings     │
│ - Floor     │   ScenarioComparisonCard,      │  (or "not quantified"│
│   Studio    │   SavingsCard, ValueScenario-  │ Value scenario       │
│   bridge    │   Card, EvidenceCard,          │  (ranged, confidence)│
│             │   FloorPreviewCard,            │ Known / assumed /    │
│             │   NextActionCard               │  needs-measure list  │
│             │                                │ Next action button   │
└─────────────┴───────────────────────────────┴──────────────────────┘
```

Mobile collapses right+left into: sticky project bar (summary chip, tap → economics
bottom sheet) above a conversation that dominates the viewport. No horizontal scroll.
No hover-only affordance (cards have tap-visible "Why this number?" triggers, not
hover tooltips).

## Workspace vs. widget — the boundary

| | Corner Quick Assistant | AI Home Advisor (`/assistant`) |
|---|---|---|
| Central object | Chat transcript (discarded on reload, per PG0) | Project Decision State (persisted/shareable) |
| Surface | A widget mounted on every page | A dedicated route |
| Tools | `find_on_site`, `get_company_context`, `estimate_project`, `get_availability`, `book_measure`, `create_quote_request` (`api/chat/route.ts`) | Same underlying primitives (calculators, catalog, pricing, registry), reached through workspace-specific server actions/tools — not the widget's route, not a fork of it |
| Response shape | Plain text, client-side link-ification (`splitReply`) | Structured typed cards, because the state has structure the widget was never asked to hold |
| Persona | EcowoodsGuide (`assistant-identity.ts`) | AI Home Advisor — separate identity, separate greeting/voice, still Ecowoods-branded, never a competing "brand" the way the retired "RenoGuide" was (see `verify-assistant.mjs`) |
| Depends on the other surface to function? | No — must keep working with `/assistant` deleted | No — must keep working with the widget deleted |

They may both call `estimateInstalledRangeCad`, `bandForWork`, `FLOOR_PRODUCTS`,
`recordFunnelEvent`. They must not call *each other's* route handlers, share a
component tree, or share mutable client state (no shared localStorage key beyond the
existing, already-intentional `ew-studio-v1`/`ew-design-v1` bridge Floor Studio owns).

## Shared primitives only (the reuse boundary, precisely)

Everything `/assistant` is allowed to import without asking:

- `content/constants/pricing.ts` — bands, `bandForWork`, `bandForCountry`, `formatBand`
- `packages/shared/ai/index.ts` — `estimateInstalledRangeCad`, `FINISH_OPTIONS`,
  `PATTERN_OPTIONS`, `NAMED_SPECIES`
- `apps/web/lib/floor-studio/catalog.ts` — `FLOOR_PRODUCTS`, `BOARD_WIDTHS`,
  `incompatibilities()`
- `apps/web/lib/floor-studio/design-id.ts`, `studio-config.ts` — `ensureDesignId`,
  `isDesignId`, `estimateHref` pattern
- `apps/web/lib/floor-studio/room.ts` — `StudioRoomFacts` type only, never pixels
- `apps/web/lib/funnel-ledger.ts` — `recordFunnelEvent`
- `apps/web/lib/actions/quotes.ts`, `lib/actions/invoices.ts`, `app/api/appointments`,
  `app/api/availability` — the real booking/quote/invoice pipeline
- `apps/web/lib/content/case-study-loader.ts`, `case-study-types.ts` — evidence
- `apps/web/lib/service-pages.ts`, `lib/seo-data.ts` (`SERVICES`) — service catalog
- `packages/shared/constants/index.ts` — `BUSINESS_NAP`, `REVIEW_EVIDENCE`
- `apps/web/lib/analytics.ts` — extend the `AnalyticsEvent` union, don't fork it
- `apps/web/lib/navigation.ts` — add a `DESTINATIONS` entry

Everything `/assistant` must never create a second copy of: pricing engine, product
catalog, lead/quote/project models, funnel ledger, review evidence, case-study schema,
navigation data, analytics module. See `NO_DUPLICATION_GUARANTEE.md`.

## New code `/assistant` actually needs (not reuse, because nothing plays this role today)

1. `/assistant` route + three-zone shell components (desktop) and mobile
   sticky-bar/bottom-sheet variant.
2. Workspace state store (client) + persistence layer (anonymous localStorage +
   optional server save for logged-in users, Phase 08).
3. A server action / tool set for the workspace's own conversation loop — reusing the
   *tool logic* pattern from `api/chat/route.ts` (same Zod schemas where the job is
   identical — `get_availability`, `book_measure`, `create_quote_request` — extended to
   thread `designId`/`country` through, which the corner assistant's tools currently
   omit) but returning structured card payloads instead of plain text.
4. Card renderer components: `ProductCard`, `ServiceCard`, `ScenarioComparisonCard`,
   `SavingsCard`, `ValueScenarioCard`, `EvidenceCard`, `FloorPreviewCard`,
   `NextActionCard`.
5. Pure economics functions per `ECONOMICS_MODEL_SPEC.md` (new file(s) under
   `apps/web/lib/assistant-workspace/economics.ts` or similar — pure, no LLM, no I/O).
6. Value scenario engine per `VALUE_SCENARIO_SPEC.md` — evidence lookup + range
   composition, also pure/deterministic; the LLM explains it, never invents it.
7. `/assistant` entries in `navigation.ts`, `sitemap.ts`, `lib/funnels/index.ts`
   (`ROUTE_FUNNEL`), and whichever manifest feeds llms.txt/ai.txt/`/api/knowledge`.
8. New `workspace_*` analytics events appended to `AnalyticsEvent`.

## Naming discipline

"AI Home Advisor" is the product name shown to users on `/assistant`. It is not
"EcowoodsGuide," it is not a duplicate assistant identity file — a new, small identity
constant (name, voice line, greeting) lives beside the workspace code, structured the
same way `assistant-identity.ts` is, but is its own file/export so `verify-assistant.mjs`'s
one-name guard for the *corner* widget is untouched and unambiguous. If a single shared
identity module ends up serving both, that is an ASSISTANT-01 implementation decision,
not assumed here — do not merge the two identities in Phase 0.
