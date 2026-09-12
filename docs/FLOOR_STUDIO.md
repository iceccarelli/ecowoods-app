# Ecowoods Floor Studio — recon map and build record

`/floor-studio` is the discovery door: a photograph of a real room, a real
Ecowoods configuration rendered into it, a live installed range, and one exit
into the measure. This document is the map that had to exist before any of it
was written, and the record of what was reused rather than rebuilt.

---

## 1. What already exists and must be reused

| Thing | Where | How Floor Studio uses it |
|---|---|---|
| Installed-range arithmetic | `packages/shared/ai` → `estimateInstalledRangeCad()` | **Called, never re-implemented.** `lib/floor-studio/catalog.ts` `priceConfiguration()` is a delegation. /design, EcowoodsGuide and Floor Studio are three renderings of one function. |
| Finish and pattern vocabulary | `packages/shared/ai` → `FINISH_OPTIONS`, `PATTERN_OPTIONS` | Imported. No second vocabulary. |
| Species swatches, Janka, notes | previously typed inline in `app/components/FloorConfigurator.tsx` | **Moved into the catalogue and projected back.** /design now reads `FLOOR_PRODUCTS`; the rendered page is byte-identical because the ids stayed the rate keys and `swatchNote` preserves the tooltip copy. |
| Published service bands | `apps/web/content/constants/pricing.ts` | Not touched. Floor Studio publishes no new dollar figure; `verify:pricing-source` stays the only place a band can live. |
| Movement coefficients | `lib/wood` (Wood Handbook FPL-GTR-190 Table 13–5) | `movementFor()` computes the seasonal board movement for the chosen width. This is what board width buys, instead of an invented price multiplier. |
| Design handoff | `lib/design-config.ts` (`ew-design-v1`) | Extended, not replaced. The v1 key keeps working; Studio writes a superset. |
| Photo consent + private storage | `lib/floor-graph/{consent,photo-storage,wording}.ts` | The only path a room photograph may ever take server-side. Studio's analysis is client-side and uploads nothing by default. |
| Estimate conversion | `/estimate` + `app/components/EstimateForm.tsx` + `/api/leads` | The terminal CTA. Receives structured design state, not a paragraph. |
| Analytics contract | `lib/analytics.ts` (`AnalyticsEvent` union) | Extended with studio events; `lib/funnels` binds them to a funnel, which `verify:strategy` checks. |
| Registry / `/api/v1` | `lib/registry/*` | Floor Studio becomes a discoverable action primitive, not just a page. |
| 66 guards | `scripts/verify-*.mjs` | The gate. Nothing here ships that fails `pnpm verify`. |

## 2. What was half-built and is being completed

- **`/design` had no room.** It is an excellent configurator with a flat swatch
  preview. Floor Studio is the room; `/design` stays the advanced engine.
- **`floor-graph` had photo capture but no consumer-facing capture surface**
  other than the triage form. Studio's photo path is built so that retention,
  when a visitor asks for it, goes through `grantConsent` and `storePhoto` and
  nothing else.
- **The configuration had no width axis** — the one specification question a
  homeowner asks first after species.

## 3. What was missing and is being added

- A room-photo understanding pass that is **measured rather than guessed**, and
  a verification screen where a person corrects it (`lib/floor-studio/room.ts`).
- A ranked recommendation over **real** configurations, with a sentence for
  every score (`lib/floor-studio/match.ts`).
- A renderer that composites a real configuration into the photograph while
  preserving the room's own light (`lib/floor-studio/render.ts`).
- A v2 handoff carrying configuration ids, width, area, range and room facts
  into `/estimate` (`lib/floor-studio/studio-config.ts`).

## 4. What would be a destructive rewrite and is therefore forbidden

- Replacing `/design`, its URL, its `ew-design-v1` key, or its querystring
  contract. Shared links exist in the wild.
- Introducing a second pricing model, a second species list, or a second photo
  store.
- Publishing any new dollar figure without the Class C patch-and-flag step.
- Routing a room photograph anywhere but `lib/floor-graph/photo-storage.ts`.

## 5. The decisions that will be argued with

**No generative imagery, ever.** Every pixel of wood laid into a room comes from
the parameters of a configuration this company can install: the species'
pigments, the finish's tint and sheen, the pattern's geometry, the board width.
A model that invents a plank invents a product, and the sale it produces cannot
be fulfilled.

**Board width does not change the price.** It changes the picture and the
millimetres. The finish and pattern multipliers already in
`packages/shared/ai/index.ts` are flagged there as placeholders awaiting the
estimator; a third invented multiplier would make that debt worse. What width
really changes, `lib/wood` can compute from a published table.

**The room analysis is arithmetic and says so.** Mean luminance, wall undertone,
existing floor tone, a floor-region seed. Every one is a statistic over pixels,
and every one is presented on a screen whose primary control is "that's wrong,
fix it". Nothing claims a confidence it cannot defend.

**The photograph stays in the browser.** Analysis, masking and compositing all
run on the visitor's device. Nothing is uploaded unless they ask us to keep it,
and then only through the consent ledger.

## 6. Phase 1 — definition of done, and where it stands

| # | Done when | Status |
|---|---|---|
| 1 | `/floor-studio` is a real route, reachable within the depth budget | ✅ header "Start here" (depth 0), footer, homepage band, `/design`, species dossiers, the new-install head term |
| 2 | Photo → analysis → correction → match → visualisation → controls → range → compare → save/share → estimate, phone and desktop | ✅ one client island; CSS is mobile-first with the stage/panel split at 900px |
| 3 | Every visualised floor is layable | ✅ `isLayable` gates the catalogue, the share code, the matcher and the renderer |
| 4 | Ranges come from `estimateInstalledRangeCad`, labelled ESTIMATE | ✅ `priceConfiguration` delegates; a test asserts byte equality with the shared function |
| 5 | Design state survives into `/estimate` as structured data | ✅ `design` on `leadSchema`; `EstimateForm` reads `?design=`; `/api/leads` stores the code verbatim |
| 6 | Analytics fire across the funnel and are bound in `lib/funnels` | ✅ ten events; the `studio` funnel completes on `studio_estimate_handoff` |
| 7 | `pnpm verify` and `pnpm test:web` pass | ✅ 66 guards, 465 tests |
| 8 | A machine can understand what Floor Studio is | ✅ `/floor-studio.md`, `action:visualise_floor` (a `ViewAction`), the page primitive with a `limits` fragment |
| 9 | Money paths are explicit | ✅ samples (free, a lead); the two paid rungs declared in `content/constants/studio-products.ts` with `priceCad: null` and `published: false` |

## 7. The patch series

| Patch | What it lands |
|---|---|
| FS-01 | `lib/floor-studio/catalog.ts` — the floors this company can lay, the compatibility rules, the delegation to the shared estimator. `/design` becomes a projection of it. |
| FS-02 | `lib/floor-studio/room.ts` — what a photograph honestly contains, and `UNMEASURABLE_FROM_A_PHOTO` for what it does not. |
| FS-03 | `lib/floor-studio/match.ts` — a score produced by its own explanations. |
| FS-04 | `lib/floor-studio/render.ts` + `render-canvas.ts` — exact perspective, the room's own light, and everything standing on the floor left alone. |
| FS-05 | `lib/floor-studio/studio-config.ts` — the handoff, `leadSchema.design`, `EstimateForm`, `/api/leads`. |
| FS-06 | `/floor-studio`, the client experience, the chrome, the sitemap, the markdown twin, the registry action. |
| FS-07 | "See this in my room" on the species dossiers and the new-install head term; docs. |

## 8. Phase 2 and 3, and what was built so they are not rewrites

- **Accounts, sample commerce, paid reports** — the rungs exist as data already
  (`studio-products.ts`); publishing one is a price and a boolean, not a
  refactor. The design reference (`FS-XXXXXXX`) is derived from the design, so
  it is stable before there is a database row to hang it on.
- **Photo retention, when somebody asks for it** — the only path is
  `grantConsent` + `storePhoto`, both of which already exist and both of which
  fail closed. Nothing in the studio bypasses them because nothing in the studio
  uploads anything.
- **AR / live camera (Phase 3)** — the renderer takes a quad and a photograph.
  A camera frame is a photograph arriving sixty times a second; the homography
  and the composite do not change, only where the quad comes from.
- **Floor Passport** — `configurationId` is already the durable identity of a
  floor, and it is the same string in the share link, the lead note and the
  estimate payload.
