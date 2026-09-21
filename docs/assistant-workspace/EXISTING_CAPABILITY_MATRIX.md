# EXISTING CAPABILITY MATRIX — AI Home Advisor (/assistant)

Phase 0, forensic. No product code in this PR. Every row is a file-verified claim,
not an assumption from the transformation brief. Method: read `docs/audit/PG0_*.md`
(prior forensic audit, still the base truth for the commercial pipeline) plus a fresh
sweep of everything the brief names for `/assistant` specifically — Floor Studio,
pricing, `packages/shared/ai`, the chat route, the `/api/v1` registry, quote-check /
quote-intelligence, case studies, floor-graph, analytics, nav/sitemap.

Columns: SYSTEM | KEY FILES | STATUS | REUSE PATH (what `/assistant` calls) |
DUPLICATION RISK (what not to rebuild) | MISSING (what `/assistant` needs that
does not exist yet).

---

## Corner Quick Assistant (sacred, do not touch)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| EcowoodsGuide chat | `apps/web/app/components/ChatWidget.tsx`, `ChatWidgetLoader.tsx`, `apps/web/app/api/chat/route.ts` | LIVE, 5 tools, funnel-instrumented | `/assistant` reads the same tools' *outputs* (pricing, availability) through the same primitives, never through the widget's own component tree | Building `ChatWidgetV2` or making the widget depend on the workspace | — |
| System prompt + identity | `packages/shared/ai/index.ts` (`ECOWOODS_GUIDE_SYSTEM_PROMPT`), `apps/web/lib/assistant-identity.ts`, `assistant-site.ts` | LIVE | `/assistant` has its own persona copy (a "Home Advisor" voice, not "EcowoodsGuide"); it may reuse `estimateInstalledRangeCad`, `FINISH_OPTIONS`, `PATTERN_OPTIONS`, `NAMED_SPECIES` from the same file, but does not import or rewrite the chat prompt string | A second, slightly different system prompt claiming the same assistant identity | `/assistant`'s own persona/voice doc (Phase 01) |
| Cross-surface open event | `apps/web/lib/assistant.ts` (`openAssistant`, `ASSISTANT_OPEN_EVENT`) | LIVE — Floor Studio, ⌘K, exit-intent all prefill the corner widget through this | `/assistant` may listen for the same event to auto-open *itself* instead of the corner widget when already on `/assistant`, but must not repurpose this bus to drive the widget's internal state | A parallel event bus for the same "hand off a prefilled message" job | — |

---

## Floor Studio (reuse target, not a rebuild)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| Catalog (species/finish/pattern/width) | `apps/web/lib/floor-studio/catalog.ts` (`FLOOR_PRODUCTS`, `BOARD_WIDTHS`, `incompatibilities()`) | LIVE, no price literals by design | `/assistant`'s ProductCard renders directly from `FLOOR_PRODUCTS` | Inventing a second product list, or a "recommended SKU" that isn't in `FLOOR_PRODUCTS` | — |
| Pricing wiring | `catalog.ts:501-512` `priceConfiguration()` → `estimateInstalledRangeCad()` (`packages/shared/ai`) × `bandForWork()` (`content/constants/pricing.ts`) | LIVE | `/assistant`'s economics engine calls the identical two functions, never a new pricing function | A parallel calculator that reproduces this arithmetic | — |
| Design identity | `apps/web/lib/floor-studio/design-id.ts` (`designId`, 12-char Crockford base32, `isDesignId`/`designIdOf`), `studio-config.ts` (`ensureDesignId`, `saveStudioDesign`, `estimateHref`) | LIVE (MEAS-01, shipped) | `/assistant` reads/writes `designId` exactly as Floor Studio and `/api/leads` do — mint via `ensureDesignId()`, never invent a second id shape | A second "session id" or "workspace id" standing in for design identity | Chat tools (`book_measure`, `create_quote_request` in `api/chat/route.ts`) do **not** set `designId` today — a real attribution gap `/assistant` inherits and should close, not re-break in a new way (see DATA_FLOW_MAP) |
| Room facts (no photo upload) | `apps/web/lib/floor-studio/room.ts` | LIVE | `/assistant`'s Floor Studio bridge (06) must carry only `StudioRoomFacts` (light level, wall undertone, existing floor tone — 3 enum strings), never pixel data, into any workspace state | Any code path that puts an image or image URL into workspace state, a share link, or an LLM prompt | — |
| Structured design on the lead | `QuoteRequest.designId`, `QuoteRequest.designCode` (schema.prisma, SALE-01, shipped) | LIVE | `/assistant`'s conversion tools write `designCode` (the raw share code) exactly as `/api/leads/route.ts` does — never an expanded/duplicated rendering of the design in a new column | A second "workspace design snapshot" table | — |

---

## Pricing (single source of truth)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| Published bands | `apps/web/content/constants/pricing.ts` (`PriceBand`, CAD + US/NY bands, `bandForWork`, `bandForCountry`, `formatBand`) | LIVE | `/assistant` imports bands from here only; every dollar shown in the workspace resolves to a `PriceBand` from this file | A price literal anywhere in a component, prompt, tool, or the scenario engine | — |
| Legacy adapter | `apps/web/lib/pricing.ts` (`PRICING`, `estimateServiceBandCad`) | LIVE, thin re-export | `/assistant` may use `estimateServiceBandCad` for a quick band×area figure, but the canonical range calc stays `estimateInstalledRangeCad` | A second adapter with different rounding | — |
| Pricing guard | `scripts/verify-pricing-source.mjs` | LIVE, enforced on `apps/web/app`, `apps/web/lib`, `packages/shared`; advisory on `apps/web/content` | `/assistant`'s files fall under the enforced paths — the guard already covers it, no changes needed to the script | Adding a `pricing-allow` escape hatch to hide a literal | — |

---

## AI orchestration primitives

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| Shared calculators | `packages/shared/ai/index.ts` (`estimateInstalledRangeCad`, `describeFloorForChat`, `bookMeasureIntent`) | LIVE | `/assistant`'s economics engine (Phase 04) calls `estimateInstalledRangeCad` directly; it does not re-derive per-species rates (the removed `FLOORING_RATES_CAD_PER_SQFT` table, GEO-005, was deleted for exactly this reason — never resurrect it) | Re-adding a per-species/finish multiplier table | Country-aware pricing in the *chat tool* (`estimate_project` ignores `country`, GEO-006) — `/assistant` should accept country explicitly and not repeat that omission |
| Finish/pattern vocab | `packages/shared/ai/index.ts` (`FINISH_OPTIONS`, `PATTERN_OPTIONS`) | LIVE | `/assistant` cards render from these, same as Floor Studio | A second finish/pattern enum | — |
| LLM chat endpoint | `apps/web/app/api/chat/route.ts` — 5 tools (`find_on_site`, `get_company_context`, `estimate_project`, `get_availability`, `book_measure`, `create_quote_request`) | LIVE | `/assistant`'s conversation surface reuses this route's tool *definitions and Zod schemas* as the pattern (and may hit the same route, or a sibling route built from the same tool set) — never a second `streamText` call with re-implemented tools | A second `/api/chat`-equivalent with drifted tool logic (double lead-creation, double booking) | Streaming today is raw text (`textStream`) with no structured tool-call metadata reaching the client — `/assistant` needs a structured response channel (ProductCard/ScenarioCard/etc.) that the corner widget does not have and should not be forced to adopt |

---

## Registry / public API (data source for cards, not UI)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| `/api/v1/*` (33 routes) | `apps/web/app/api/v1/**`, `lib/registry/handlers.ts`, `lib/registry/http.ts` | LIVE — services, pricing, evidence, faq, framework, locations, media, movement, quote-check, recommendation-context, service-match, reviews, sources, etc. | `/assistant`'s ServiceCard/EvidenceCard pull from `services`, `pricing`, `evidence`, `reviews`; NextAction/measure flows reuse `recommendation-context` / `service-match` if their shape fits | A parallel internal services/evidence list inside the workspace | — |
| `/api/knowledge` | `apps/web/app/api/knowledge/route.ts` | LIVE — full corpus incl. price bands, case studies, framework | Reference only; `/assistant` should not re-fetch its own backend over HTTP — import the underlying data modules directly (`seo-data`, `service-pages`, case-study loader) | Round-tripping through the public JSON endpoint for an in-process render | — |
| llms.txt / ai.txt | `apps/web/app/llms.txt/route.ts`, `ai.txt/route.ts`, `llms-full.txt/route.ts` | LIVE, generated from the same data modules | `/assistant` route's *existence* should be indexable (add to whatever manifest these generators read), private project state never included | — | `/assistant` is not referenced by any generator input today — needs one manual addition to whatever manifest/services list feeds them |

---

## Quote-check vs quote-intelligence (do not conflate)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| `quote-check` (public, stateless) | `apps/web/lib/quote-check/` (`SCOPE_ITEMS`, `compare()`), `app/quote-check/page.tsx`, `/api/v1/quote-check` | LIVE, no persistence, `quote_check_compared` analytics event | `/assistant` may offer the same comparison as one card type, calling `compare()` directly | Rebuilding the scope-item checklist as a second list | — |
| `quote-intelligence` (internal, admin, `Order`-keyed) | `apps/web/lib/quote-intelligence/*`, `app/admin/quote-intelligence/[orderId]/Workbench.tsx` | LIVE, admin-only, PDF-persisted | Not reused by `/assistant` — this is a competitor-quote workbench for the desk, keyed to shop `Order`, unrelated to homeowner-facing scope comparison | Confusing this with `quote-check` in any spec or copy | — |

---

## Booking / commercial pipeline

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| Lead → Quote → Project → Invoice → Payment | `lib/actions/quotes.ts`, `lib/actions/projects.ts`, `lib/actions/invoices.ts`, `app/api/webhooks/stripe/route.ts` | LIVE, fully wired (PG0-confirmed, unchanged) | `/assistant`'s conversion actions (Phase 07) call `submitQuoteRequest`/`book_measure`'s underlying transaction, never a new lead-creation function | A second `QuoteRequest`-equivalent model or endpoint | — |
| Appointments / availability | `app/api/appointments/route.ts`, `app/api/availability/route.ts`, `computeAvailability()` | LIVE | `/assistant`'s NextActionCard "measure" flow calls `get_availability`'s underlying function | A second slot-computation function | — |
| Funnel ledger | `schema.prisma` `FunnelEvent`/`FunnelStage` enum, `lib/funnel-ledger.ts`, `recordFunnelEvent()` | LIVE (SALE-01/02, MEAS-03, shipped) — called from `/api/leads`, `/api/chat` (`book_measure` ×2 stages, `create_quote_request` ×1) | `/assistant`'s own conversion tools call `recordFunnelEvent()` with `source: 'assistant-workspace'` (a new, honest `source` string — the field is free-form by design) | A second funnel table | `designId` not threaded into the chat tools' `recordFunnelEvent()` calls today — `/assistant` should pass it when available, closing part of the attribution gap |
| Customer portal | `app/(portal)/mypage/*`, `middleware.ts` (`isLoggedIn` gate) | LIVE | `/assistant`'s save/share (Phase 08) is anonymous-first; persistence for a logged-in visitor reuses the portal's auth, not a new account system | A second login/session mechanism | — |

---

## Proof / evidence surfaces

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| Case studies (structured) | `apps/web/lib/content/case-study-types.ts`, `case-study-loader.ts`, `content/case-studies/` | LIVE — typed: species, sqft, moisture readings, substrate, challenges, results, testimonial | `/assistant`'s EvidenceCard cites these as E2/E3 (company-documented project, not independent validation) | A second "proof" schema | — |
| Photographed projects | `apps/web/lib/projects.ts`, `content/projects/*.ts` | LIVE — 2 entries, stills/films, no measurement fields | `/assistant`'s FloorPreviewCard may link out to these as visual proof, distinct from case studies | Treating photo-only projects as measured evidence | — |
| Before/after sliders | `content/proof-sliders.ts`, `ProofSlider.tsx` | LIVE | Reused as-is via existing components if `/assistant` embeds a proof strip | A fourth proof surface | — |
| Reviews | `packages/shared/constants/index.ts` (`REVIEW_EVIDENCE`), `/api/v1/reviews` | LIVE, cited to source | `/assistant` cites review counts only from `REVIEW_EVIDENCE`/`/api/v1/reviews`, never increments or invents a count | A hardcoded review number in a card | — |

---

## Floor Graph (orphaned — do not build on top of empty tables)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| `FloorRecord` | `schema.prisma` (fields exist), zero write call sites (`floorRecord.create/update` — 0 hits, reconfirmed) | ORPHANED | None yet — `/assistant` must not be the first writer of this table as a side effect of an unrelated phase; OWN-01 (Floor Passport) is a named, separate patch | Writing to `FloorRecord` inside an `/assistant` phase "since we're already touching Project" | OWN-01 itself, out of scope for `/assistant` |
| `Prediction` / `JobOutcome` | `lib/floor-graph/prediction.ts`, `app/api/admin/floor-graph/outcome/route.ts` | PARTIAL (PRICE_CAD only), LIVE for admin close-out | `/assistant` does not read or write these — value-scenario ranges come from `PriceBand` + evidence, never from `Prediction` | Presenting `Prediction`/`JobOutcome` data as if it were a resale/value model | — |

---

## Analytics / nav / sitemap (must add, cannot assume)

| System | Key files | Status | Reuse path | Duplication risk | Missing |
|---|---|---|---|---|---|
| `AnalyticsEvent` union | `apps/web/lib/analytics.ts` | LIVE, closed union, PII-forbidden by comment convention | `/assistant` adds new `workspace_*` event names to this same union — never a second analytics module | A parallel `lib/assistant-analytics.ts` | New `workspace_*` events themselves (Phase 09) |
| Funnels | `apps/web/lib/funnels/index.ts` (`ROUTE_FUNNEL`) | LIVE, 7 funnels, 13 routes mapped | `/assistant` gets its own funnel entry (`assistant` funnel, steps mirroring workspace events) | Shoehorning `/assistant` into an existing funnel (e.g. `studio`) that doesn't fit | `/assistant` is not in `ROUTE_FUNNEL` today — must be added explicitly |
| Navigation | `apps/web/lib/navigation.ts` (`DESTINATIONS`) | LIVE | `/assistant` is added as a `DESTINATIONS` entry so Header/drawer/⌘K and the chat's own `find_on_site`/`siteCapabilitiesBlock()` can name it | A second nav data structure | `/assistant` entry itself |
| Sitemap | `apps/web/app/sitemap.ts` | LIVE, hand-maintained `entry()` calls for top-level pages | `/assistant` gets one `entry()` line | Auto-deriving it and skipping the guard | The `entry()` line; `scripts/verify-sitemap.mjs` compliance (real `lastModified`, no invented date) |
| Auth gating | `apps/web/middleware.ts` | LIVE — only `/admin`, `/mypage`, `/login`, `/register` gated | `/assistant` stays public/ungated by default, matching `/floor-studio`/`/estimate` | Gating `/assistant` behind login (breaks "anonymous useful without login", law 08) | — |

---

## Dead/duplicated systems already flagged (from PG0) — do not touch, do not extend

`apps/admin` (dead, no package.json), `apps/mobile/frontend/` (duplicate mobile app), four empty workspace packages (`@ecowoods/ui`/`/auth`/`/config`/`/utils`), root `.env.example` (documents a different, dead backend). None of these are inputs to `/assistant`. Listed here only so no future patch reaches for them by mistake.
