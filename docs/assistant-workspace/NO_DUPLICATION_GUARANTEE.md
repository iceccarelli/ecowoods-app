# NO DUPLICATION GUARANTEE — /assistant

One line per system: reuse X, never create Y. Every "never create" entry names the
specific tempting duplicate this project is likely to reach for, because it is the
obvious-looking shortcut.

| Reuse X | Never create Y | Why Y is tempting and wrong |
|---|---|---|
| `content/constants/pricing.ts` (`PriceBand`, `bandForWork`) | `PricingV2`, a "workspace pricing" module, or any price literal in a component/prompt | The economics rail needs numbers fast; hardcoding "starts around $12/sqft" in a card feels harmless until `verify-pricing-source.mjs` fails the build — which is the point of that guard |
| `apps/web/lib/floor-studio/catalog.ts` (`FLOOR_PRODUCTS`) | A second product list, or an invented SKU/species not in the catalog | The workspace will want a "recommended for you" subset — that's a *filter* over `FLOOR_PRODUCTS`, never a new array |
| `apps/web/lib/service-pages.ts` / `lib/seo-data.ts` (`SERVICES`) | An "AssistantProductDatabase" or duplicated service list for cards | ServiceCard needs a name/description/price-key — all three already exist per service |
| `apps/web/lib/floor-studio/design-id.ts` (`designId`) | A "workspace session id," "conversation id," or any second identity concept for the same floor | Two ids for one design is exactly the two-name problem `verify-assistant.mjs` polices for the assistant's brand — the same failure mode applies to identity keys |
| `QuoteRequest`, `Project`, `Invoice`, `Payment`, `Appointment` (Prisma models, `lib/actions/*`) | `ProjectV2`, `WorkspaceLead`, a parallel booking table | The commercial pipeline is real and wired (PG0-confirmed); a second lead table splits the funnel ledger and the admin desk's view of reality |
| `apps/web/lib/funnel-ledger.ts` (`recordFunnelEvent`, `FunnelStage`) | A second funnel/event table for "workspace conversions" | `source: 'assistant-workspace'` is a free-form string on the existing model — that's the extension point, not a new schema |
| `apps/web/lib/analytics.ts` (`AnalyticsEvent` union) | `lib/assistant-analytics.ts` or a second `track()` | New `workspace_*` names extend one closed union — a second module means two places to check for PII discipline |
| `packages/shared/ai/index.ts` (`estimateInstalledRangeCad`) | A reimplemented rate calculator, or resurrecting the deleted `FLOORING_RATES_CAD_PER_SQFT` per-species/finish multiplier table (GEO-005) | That table was removed because 4 of 6 computed ranges fell outside the published band and were never confirmed — reintroducing it under a new name reintroduces the same unverified numbers |
| `apps/web/lib/content/case-study-types.ts` / `case-study-loader.ts` | A new "proof database" or "testimonial store" for the workspace | Case studies are already typed with the exact fields a value-scenario evidence citation needs (species, sqft, moisture, results) |
| `packages/shared/constants/index.ts` (`REVIEW_EVIDENCE`) | A hardcoded review count in a card ("500+ 5-star reviews") | Every review count must trace to `REVIEW_EVIDENCE`; incrementing or inventing one is a law violation independent of this project |
| `apps/web/app/api/chat/route.ts` tool pattern (Zod schemas, `streamText` + tools) | A forked copy of the whole route, or editing this file to add workspace behavior | This file is sacred (corner assistant). `/assistant` gets its *own* route/tool set built the same way, never a branch inside this one |
| `apps/web/app/components/ChatWidget.tsx`, `ChatWidgetLoader.tsx` | `ChatWidgetV2.tsx`, or making the widget import from the workspace | Explicitly forbidden by the brief. The corner assistant must work with `/assistant` deleted, and vice versa |
| `apps/web/lib/assistant-identity.ts` (`ASSISTANT` const, "EcowoodsGuide") | Reusing this exact export for the Home Advisor's name/voice | Two products, two names, by design — but see `NEW_ASSISTANT_ARCHITECTURE.md`'s naming-discipline note: the *pattern* (a small identity constants file) is reused, the *content* is not shared |
| `apps/web/lib/navigation.ts` (`DESTINATIONS`) | A second nav data structure just for `/assistant`'s own internal links | One destinations list; `/assistant` is one more entry, findable by `find_on_site` and `siteCapabilitiesBlock()` too |
| `middleware.ts` auth gating (`isLoggedIn`, `role==='ADMIN'`) | A new auth check or session concept for `/assistant` | Anonymous-first is a law (08); when persistence is needed, it rides the existing `isLoggedIn` gate, not a new one |
| `apps/web/lib/floor-studio/room.ts` (`StudioRoomFacts`) | A second room-analysis pipeline, or any code path that stores/transmits pixel data | Re-deriving light-level/undertone/floor-tone heuristics in the workspace would be a second, likely-inconsistent implementation of a privacy-sensitive function |

## Explicitly out of scope for `/assistant` (do not build, even if convenient)

- **`FloorRecord` writes.** Orphaned today (zero write call sites, reconfirmed). OWN-01
  (Floor Passport) is a separate, named future patch. `/assistant` must not become its
  accidental first writer.
- **`Prediction`/`JobOutcome` reads for value scenarios.** These are price-accuracy and
  job-close-out data, not resale data, and have no resale-relevant columns. Using them
  as value-scenario inputs would misrepresent price-prediction accuracy as market value
  evidence.
- **A prediction/ML layer of any kind.** No trained model, no regression, no "learned"
  weighting anywhere in `/assistant`. Explicitly forbidden by the product laws and
  consistent with PG0's own "blocked on data volume" finding for ML generally.
- **`quote-intelligence`.** Internal, `Order`-keyed, admin-only competitor-quote
  workbench. Unrelated to `/assistant`'s homeowner-facing scope. Do not wire it in, do
  not reuse its PDF-report pipeline for anything customer-facing.

## Enforcement

Each PR in the `/assistant` series runs `pnpm verify` (or the relevant `verify:*`
scripts) plus a manual check against this table's "Never create Y" column before
merge. A PR that adds a new file matching one of the forbidden shapes above (a second
pricing module, a second product list, a `ChatWidgetV2`, etc.) fails review on sight,
independent of whether it otherwise works.
