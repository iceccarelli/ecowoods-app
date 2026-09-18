# Geography — source map

The permanent architecture map for every geographic fact this site publishes:
where each fact is written, which code projects it onto which public surface,
and which guard or test watches the join. It was produced by GEO-000 (Phase 0,
repository archaeology) and is updated by every later GEO patch that moves a
fact or a projection. It is not an audit report; the audit evidence lives in
[`GEO_CONTRADICTION_LOG.md`](GEO_CONTRADICTION_LOG.md) and
[`GEO_MEASUREMENT_20260911.json`](GEO_MEASUREMENT_20260911.json).

```text
GEO_BASELINE_COMMIT = b206f12fdbd63bfddc777e002288c68efb5fa8f5
                      fix(api): updated_at never moved when the geography did
measured            = 2026-09-11, by executing the modules at that commit
```

Every line number below is at the baseline commit.

---

## 0. Status after GEO-001

The five lists are now three facts and their selectors:

| Fact | Owner | Selector / projection |
|---|---|---|
| who is covered, kind, `partOf`, country | `content/geo/markets.ts` | every other file |
| region of each municipality; the 23 named-but-not-covered places; region nodes | `content/geo/regions.ts` (new) | `lib/registry/locations.ts` builds every node from markets + regions + pages; no default parent |
| which areas have a page | `lib/seo-data.ts` `AREAS` / `NEIGHBOURHOODS` / `DISTRICTS` (kept because six guards read them) | `CITIES` (58 municipalities), `PRIMARY_AREAS`, `SERVICE_AREAS` (100) |
| the territory's name | derived — `lib/geo/territory.ts` `TERRITORY`, `TERRITORY_SHORT`, `PUBLISHED_PARTITION` | llms, ai.txt, about, team, press, head-term pages, Markdown, matcher, /service-areas |
| where a place is, in JSON-LD | derived — `root-schema.ts` `placeForArea` / `cityNode` from markets | page `spatialCoverage`, org `areaServed`, services `areaServed`, offers (Ontario only) |

Toronto rule: the City of Toronto is a `region` node. It is in the markets
`service_area`, is the first City in the organisation JSON-LD and has
`in_area_served: true`; it has no `/service-areas/toronto` page, and the graph's
`serves` edges go to its 23 published districts and neighbourhoods.

## 0b. Status after GEO-002 — the corridors

GEO-002 took the protocol's GEO-013 (corridor normalisation) together with the
GEO-009 twin decision for the corridor surfaces, and added JSON-LD to them.

| Fact | Owner | Selector / projection |
|---|---|---|
| which municipalities a corridor runs through, and in what order | `content/geo/corridors.ts` `Corridor.members` — **municipalities only** | `/corridors`, `/corridors/{id}`, `/api/v1/corridors`, the territory map, `TERRITORY` |
| which district belongs to which municipality | `content/geo/markets.ts` `partOf` (unchanged) | `lib/geo` `corridorStops()` / `corridorMarkets()` — the one derivation every corridor surface reads |
| where a corridor's markets are, in JSON-LD | derived — `root-schema.ts` `placeForMarket` (new, same rule as `placeForArea`) | `lib/schema/corridor-schema.ts` → `Service.areaServed`, `ItemList.itemListElement` |

The rule this restores is the registry's own, written on `Market.corridors`: a
corridor is a drive between municipalities, and a district inherits membership
through `partOf`. Every district declared `corridors: []` and the guard enforced
that from the market side, while five districts sat in the corridor's own member
list where nothing looked (GC-016).

New public surfaces: `/corridors.md`, `/corridors/{id}.md` (11),
`/where-we-work.md`. Each is declared in `alternates.types`, in the `Link:`
header from `MARKDOWN_TWINS`, in `/md`, in `/llms.txt`, and — new — in the
page's own JSON-LD as `encoding` (`MediaObject`, `text/markdown`), so a consumer
that reads structured data but not `<head>` still finds the machine edition.

Sections 1–10 below describe the GEO-000 baseline and are kept as the record.

---

## 1. The answer in one paragraph

The site does not have one geography. It has **five hand-maintained lists that
each decide part of it**, and three different hierarchies. The market registry
(`content/geo/markets.ts`) decides who is served. A second set of name lists in
`lib/seo-data.ts` decides who gets a page — and, as a side effect, which places
are schema.org `City` nodes. A third list inside the registry *projection*
(`lib/registry/locations.ts`) decides coverage for the location API and the
graph, and it disagrees with the first list about nine municipalities. The
organisation's JSON-LD takes its territory label from `BUSINESS_NAP.region`
("Toronto & the GTA") and applies it to all 89 published areas, 26 of which
are in New York State. The pieces that are derived are derived well — no
emitted count is hand-typed, the page gate refuses invented content, and the
New York NAP rule holds — but they are derived from *different* lists, and so
at the baseline every geography guard is green while the surfaces contradict
each other.

The fix is not to add a sixth list. It is to make `content/geo/markets.ts` the
only place a geographic fact is written and turn the other four into selectors
over it (§7).

---

## 2. Fact owners at the baseline

| # | File · symbol | What it decides | Size | Should be |
|---|---|---|---|---|
| F1 | `apps/web/content/geo/markets.ts` · `MARKETS` (170–391) | identity (name, slug, country, region), `kind` (municipality \| district), `partOf`, `status`, corridor membership, `parentHub`, `nearest`, `operationalTruth` (statement, date, who) | 101 (75 CA, 26 US; 59 municipalities, 42 districts) | **the single owner** |
| F2 | `apps/web/content/geo/corridors.ts` · `CORRIDORS` (44–160) | the eleven routes, hub, member order, route summary | 11 routes, 84 memberships | stays — a corridor is its own fact (a drive), but members must be validated against F1 |
| F3 | `apps/web/lib/seo-data.ts` · `AREAS` (35–60), `NEIGHBOURHOODS` (152), `EXTRA_TORONTO` (130), `DISTRICTS` (98–128), `AREA_SLUG_OVERRIDES` (78) | **which places have a page** and **which are `City` nodes**; a second `partOf` written by display name | 53 + 17 + 19 = 89 | a selector over F1 (`published` flag + `kind`) |
| F4 | `apps/web/lib/seo-data.ts` · `CITY_CONTENT` (260–1214) | local copy per page (intro, housing note, neighbourhoods, signature project) | 89 | stays — content is a separate fact; keyed by F1 slug |
| F5 | `apps/web/lib/registry/locations.ts` · `TORONTO_DISTRICT_SLUGS` (37), `PUBLISHED_ALIASES` (43), `ASSESSMENT_MUNICIPALITIES` (95–137), the five hierarchy roots (141–147), `parentOfPublished` default `'gta'` (165–166) | coverage state for `/api/v1/locations` and the graph; region parent for every place; aliases | 126 nodes | move into F1 (discovery records, aliases, region); the registry must own no fact (README §"Agentic primitives") |
| F6 | `apps/web/lib/schema/root-schema.ts` · `SERVICE_REGION` (86–90), `NEIGHBOURHOOD_CITY` (103), `GTA` (66–68) | the JSON-LD territory node ("Greater Toronto Area ⊂ Ontario ⊂ Canada"); the parent city of every neighbourhood | 1 region, 54 City names | derived from F1 hierarchy |
| F7 | `packages/shared/constants/index.ts` · `BUSINESS_NAP.region` (35) | the *label* "Toronto & the GTA", used as the name of the whole territory on 11 surfaces | 1 string | keep as the shop's region; stop using it as the territory label |
| F8 | `apps/web/content/job-cards.ts` · `JOB_CARDS`, `jobCardsForArea` (172); `content/work-map.ts` · `WORK_PLACES`; case-study frontmatter; `CITY_CONTENT.signatureProject` | **local proof** — completed, published work | 5 jobs; 4 match a page by name | stays separate from coverage (protocol §23); key by F1 slug, not display name |

`packages/shared/constants` holds **no geography** beyond F7 and the shop's
address. The protocol's premise that core facts live there is true for NAP,
hours, reviews and profiles, and false for geography — geography has always
lived under `apps/web/content/geo`, the same fact layer as
`content/constants/pricing.ts`. That is the right layer; §7 keeps it there.

---

## 3. Fact versus projection — where the rule is broken

The README states that `apps/web/lib/registry` "is a projection of the
constants — it owns no fact". For geography that is not true today:

| Projection file | Fact it owns that no fact file states | Consequence at baseline |
|---|---|---|
| `lib/registry/locations.ts` | `ASSESSMENT_MUNICIPALITIES` — 41 names with a region (`gta` / `southern-ontario`), 9 of which F1 marks owner-confirmed | Whitby, Oshawa, Clarington, Halton Hills, Caledon, Innisfil, Guelph, Cambridge, Kitchener are "assessment … do not present as covered" in the API while F1 lists them as service area (GC-001, GC-002) |
| `lib/registry/locations.ts` | the region parent of every published place, defaulting to `'gta'` when a place is not in the assessment list | all 24 New York municipalities and four Niagara municipalities hang from the GTA (GC-004, GC-005) |
| `lib/registry/locations.ts` | `TORONTO_DISTRICT_SLUGS` | the one place the six former Toronto municipalities are districts; F3 makes them `City` nodes (GC-003) |
| `lib/registry/registry.ts` | `in_area_served := slug ∈ CITIES` (287, 302) | a field named "in area served" means "is a schema City node"; false for 36 places the graph says the business serves, and for Toronto (GC-010, GC-012) |
| `lib/schema/root-schema.ts` | `SERVICE_REGION`, `NEIGHBOURHOOD_CITY` | New York cities listed as bare `City` nodes beside a GTA ⊂ Ontario ⊂ Canada node (GC-004) |
| `lib/seo-data.ts` | `DISTRICTS[].partOf` by display name | a third parent representation beside F1 `partOf` (slug) and F5 `parent` (slug + region fallback) (GC-013) |

`lib/seo-data.ts` calls itself "single source of truth for programmatic SEO".
For page membership that is accurate, and it is exactly the problem: page
membership and coverage are decided in two files, and only a regex guard
(`verify-geo.mjs` 7a) joins them — by name existence, not by kind or status.

---

## 4. The membership sets

Every geographic surface is a projection of one of these sets. At the baseline
they are not one set:

```text
                         F1 MARKETS  (101)
                               │
        ┌──────────────────────┼───────────────────────────────┐
        │ isOperational ∧ kind=municipality                    │ assess().indexable
        ▼                                                      ▼
  B  serviceAreaMarkets (59)                              E  has_page (89)
     /api/v1/markets service_area                            /api/v1/markets has_page
     (12 of them have no page)                               corridor "with a page" counts

                         F3 name lists
                               │
        ┌──────────────────────┼───────────────────────────────┐
        ▼                      ▼                               ▼
  C  SERVICE_AREAS (89)   D  CITIES (53)                  N / X  neighbourhoods (17)
     route params             schema City nodes                 districts (19)
     sitemap                  root areaServed (+Toronto = 54)
     graph serves             /services/[slug] areaServed
     llms / ai / md           locations in_area_served
     /about /team counts      llms "municipalities and districts"
     html + md index          6 of them are districts in F1

                         F5 LOCATION_NODES (126)
        published 89 (= C) · assessment 33 · region 2 · parent 2
        9 assessment nodes are owner-confirmed F1 markets
        2 owner-confirmed F1 markets have no node at all (port-colborne, kawartha-lakes)
```

Measured relations (from `GEO_MEASUREMENT_20260911.json → repository`):

| Set | Size | vs C (pages) |
|---|---|---|
| B `service_area` | 59 | 42 pages missing, **12 extra with no page** |
| E `has_page` | 89 | equal — by coincidence of two deciders (GC-011) |
| sitemap service-area URLs | 89 | equal (generated from C) |
| graph `serves` | 89 | equal (generated from C via F5 `published`) |
| llms per-area routing | 89 | equal (generated from C) |
| D `CITIES` | 53 | subset; carries 6 districts as cities |
| `in_area_served` | 53 | = D; 36 served places are `false` |
| org JSON-LD `areaServed` City names | 54 | D + Toronto; Toronto has no page |

So the HTML, sitemap, graph and AI files already agree with each other —
because they read the same list. The disagreements are between that list and
the two other deciders (B and F5), and inside the hierarchy.

---

## 5. Surface map

`C` = `SERVICE_AREAS`, `D` = `CITIES`, `B` = `serviceAreaMarkets()`, F-numbers
as in §2. "Guard" means a script under `scripts/`; "test" a vitest file under
`apps/web`.

| Public contract | Generator | Data source | Fact owner | Transformation | Guard | Test |
|---|---|---|---|---|---|---|
| `GET /api/v1/markets` | `lib/registry/handlers.ts` `handleMarkets` (699–777) | `MARKETS`, `serviceAreaMarkets()`, `assess()` | F1 (+F4 via assess) | `service_area` = B; `has_page` = `assess().indexable`, **not** route existence | verify-geo, verify-allocation | geo.test, drift.test |
| `GET /api/v1/locations`, `/locations/{id}` | `registry.ts` `buildLocations` (286–340) | `LOCATION_NODES`, `CITIES`, `marketBySlug` | **F5**, F3, F1 (date only) | coverage from F5; `in_area_served` = ∈ D; `verified_at` from F1; note text hard-coded (334, 336) | verify-agentic (shape only) | registry-invariants, provenance |
| `GET /api/v1/graph` | `registry.ts` `buildGraph` (915–957) | `buildLocations()` | F5 | `serves` ⇔ coverage=`published` (= C); `within` = F5 parent | — | registry-invariants |
| `GET /api/v1/corridors` | `handlers.ts` `handleCorridors` (1003–1027) | `CORRIDORS`, `marketBySlug` | F2, F1 | members with status and date; no page flag | verify-geo §2 | geo.test |
| `GET /api/v1/entity` | `handlers.ts` `handleEntity` → `buildOrganization` | constants | F7 | region label | verify-entity | api-contract |
| `GET /api/v1/pages` | `registry.ts` `buildPages` (650–700) | `LOCATION_NODES` published | F5 → C | one page primitive per published area | verify-agentic | api-contract |
| `GET /api/v1/opportunity` | `handlers.ts` `handleOpportunity`, `lib/geo/opportunity.ts` | `MARKETS`, `market-inputs.ts` | F1 | classification; docstring still says US = FUTURE (GC-018) | verify-market-inputs | opportunity.test |
| `GET /api/v1/manifest` | `lib/registry/manifest.ts` (113) | C | F3 | `.md` mirror list | verify-manifests | api-contract |
| `/service-areas/{slug}` HTML | `app/service-areas/[city]/page.tsx` | `generateStaticParams` ← C; `dynamicParams=false` | F3, F4, F8 | title via `areaDisplayName` (", NY"); JSON-LD `spatialCoverage`/`areaServed` via `placeForArea`; "Also serving — Across the GTA" = first 10 of C (123, 347) | verify-cities, verify-geo-green §7 | reachability, schema.test |
| page metadata, canonical | same file, `generateMetadata` (29–56) | C | F3 | canonical `/service-areas/{slug}`; `alternates.types` → `.md` | verify-canonical | — |
| page JSON-LD place | `lib/schema/root-schema.ts` `placeForArea` (105–148) | `NEIGHBOURHOOD_AREAS`, `DISTRICT_AREAS`, `US_AREA_SLUGS` | F3, F6, F1 (country) | neighbourhood → Place ⊂ City Toronto; district → Place ⊂ City (partOf name, no region); US → City ⊂ New York ⊂ United States; **everything else → bare `City`** (147) | verify-schema | schema.test |
| `/service-areas` index | `app/service-areas/page.tsx` (25–48) | C | F3 | link per area; prose claims "west to Waterloo Region" (36) | verify-links | reachability |
| `/service-areas.md`, `/service-areas/{slug}.md` | `lib/markdown-export.ts` `areasHubToMarkdown` (597–650), `areaToMarkdown` (348–379); `app/md/service-areas/[slug]/route.ts` | C, D, N, X, F4 | F3, F7 | hub headed "— Toronto & the GTA"; says elsewhere in Southern Ontario is not published (610); area title uses bare name, no ", NY" (351) | verify-markdown | drift.test |
| `/sitemap.xml` | `app/sitemap.ts` (284–291, 191–192) | C, `CORRIDORS` | F3, F2 | one URL per C; one per corridor | verify-sitemap | — |
| `/robots.txt` | `app/robots.ts` | — | — | no geography | verify-aeo | — |
| `/llms.txt` | `app/llms.txt/route.ts` (100, 154–159, 249–253) | C, D, `NEIGHBOURHOOD_AREAS`, F7 | F3, F7 | "Serving: Toronto & the GTA, 89 … (53 …, 17 …)"; D listed as "Municipalities and districts"; sentence that non-GTA Ontario is not published | verify-geo-green §5 (counts) | — |
| `/llms-full.txt` | `app/llms-full.txt/route.ts` → `lib/markdown-export.ts` `corpusToMarkdown` (950–; "{n} service area(s) across Toronto and the GTA" at 983) | C, F4, F7 | F3, F7 | every area twin concatenated under a GTA label | verify-knowledge | drift.test |
| `/api/knowledge` | `app/api/knowledge/route.ts` (292, 330) | C, F4 | F3, F4 | area list with local notes | verify-knowledge | — |
| `/ai.txt` | `app/ai.txt/route.ts` (67, 97–104) | C, F7 | F3, F7 | "Service area: Toronto & the GTA"; list of C | verify-aeo | — |
| `/about` "Where does Ecowoods work?" | `lib/entity-answers.ts` (75–80) | C, F7 | F3, F7 | "89 areas across Toronto & the GTA: …" | verify-entity | — |
| `/team`, `/press`, `/hardwood-*-toronto`, `/commercial`, `/realtors` | the page files (team 79, 143; press 160; hardwood-flooring-toronto 31, 100, 373) | C | F3 | `SERVICE_AREAS.length` + "Toronto and the GTA" | verify-geo-green §5 | — |
| FAQ geography | `FAQ_ITEMS` (seo-data 223–249) | — | — | no geographic membership list; Toronto-titled questions only | verify-claims | — |
| Organisation JSON-LD `areaServed` (every page) | `root-schema.ts` `ROOT_ORG_CONFIG` (247–312) → `builders.ts` `buildOrganization` (184–186) | D + shop locality, `SERVICE_REGION` | F3, F6, F7 | `[AdministrativeArea GTA ⊂ Ontario ⊂ Canada, City × 54]`; price-band offers carry the same 54 (228) | verify-schema, verify-schema-figures | schema.test |
| `/services/{slug}` JSON-LD `areaServed` | `app/services/[slug]/page.tsx` (131) | D | F3 | `City` × 53 | verify-services | — |
| `/commercial` JSON-LD | `lib/schema/commercial.ts` (65–84) | C via `placeForArea` | F3, F6 | Service areaServed per area | verify-schema | — |
| Header / MegaMenu / footer | `app/components/Header.tsx` (107–121), `SiteFooter.tsx` (270) | C, D, `CORRIDORS` | F3, F2 | counts and first 8 of D | verify-navigation, verify-chrome | reachability |
| `/corridors` | `app/corridors/page.tsx` (29–56) | `MARKETS`, `assess` | F1 | "{101} Ontario municipalities and districts" (56) | verify-geo | — |
| `/corridors/{id}` | `app/corridors/[id]/page.tsx` (60–140) | `CORRIDORS`, `MARKETS`, `assess`, F4 | F2, F1 | members, status sentence, "part of", page link when indexable | verify-geo | — |
| territory map (`/service-areas`, homepage) | `app/components/TerritoryMap.tsx` (173–231) | `CORRIDORS`, `MARKETS` | F2, F1 | aria-label: "{75} in Ontario … west to Waterloo Region" | verify-sliders (map) | territory-map.test |
| `/where-we-work` | `app/where-we-work/page.tsx`, `content/work-map.ts` | `WORK_PLACES` | F8 | job pins, neighbourhood precision | verify-work-map | — |
| job cards on area pages | `content/job-cards.ts` `jobCardsForArea(city.name)` (172) | `JOB_CARDS` | F8 | matched by **display name**; "Distillery District" matches no page | verify-job-cards | — |
| service-match / recommendation-context | `lib/registry/match.ts` (151) | `publishedWithin`, `ancestorsOf` | F5 | "in the GTA" / "in Ontario" answers include New York (GC-004) | — | golden-queries, negative |
| estimate form area select | `app/components/EstimateForm.tsx` (316) | C | F3 | option per area | verify-conversion | — |

Markdown twins exist for `/service-areas` and every `/service-areas/{slug}`.
`/corridors`, `/corridors/{id}` and `/where-we-work` have **no** twin, and
nothing advertises one — a gap, not a false claim (GC-022).

---

## 6. What the geography guards actually check

All fifteen geography-adjacent guards pass at the baseline. What each can and
cannot see:

| Guard | Checks | Cannot see |
|---|---|---|
| `verify-geo.mjs` | slug uniqueness; corridor ↔ market agreement **from the market side only**; `partOf` resolves; no future dates; no invented local facts; every `AREAS` name exists in F1 (7a) | a district in `AREAS` (7a checks existence, not `kind`); a corridor listing a district (§2 loops markets, not corridor members); check "7. a page exists only for a market that earned one" is a file-exists check (541–543); header item 4 still describes `us-proxy` (29) |
| `verify-geo-green.mjs` | every page has a market; every market with content has a page; no orphan; no retired status string; no hard-coded territory count; one NAP; contiguous sentences | B ≠ C (service_area without a page); F5 coverage ≠ F1 status; hierarchy/country of any node |
| `verify-cities.mjs` | 89 areas with distinct local content | anything about coverage or hierarchy |
| `verify-allocation.mjs`, `verify-market-inputs.mjs`, `verify-market.mjs` | the 80/20 split, scoring inputs, no invented economics | publication, hierarchy |
| `verify-sitemap.mjs` | no build-time dates | membership |
| `verify-agentic.mjs`, `verify-manifests.mjs`, `verify-markdown.mjs` | route ↔ manifest, twins exist | what the twins say |
| `verify-schema.mjs` | schema baseline shape | `City` vs `Place`, country, region |
| `verify-production-agentic.mjs` (network) | NAP, prices, twins, P0 pages on the live host | any geographic set |

The new `scripts/geo-measure.mjs` (GEO-000) is the first instrument that reads
the geography as sets from the served bytes. It is a measurement, not a gate;
GEO-022 turns its mechanical contradictions into a `--strict` production gate.

---

## 7. Target architecture (proposal — implemented from GEO-001 on)

```text
content/geo/markets.ts   ← the ONLY place a geographic fact is written
  Market {
    slug, name, displayName?            identity (displayName carries ", NY" / ", ON" where a name exists twice)
    country, region                     CA/ON, US/NY — required, never inferred from a parent
    kind                                municipality | district | neighbourhood | locality  (+ region for hierarchy roots)
    partOf                              slug, always a slug
    regionOf                            gta | hamilton | niagara | waterloo-region | simcoe | kawartha | wny-erie | wny-niagara | wny-monroe … (a fact, not a default)
    status                              owner decision (unchanged vocabulary + 'discovery' + 'not-served')
    operationalTruth                    unchanged
    published                           true only when the owner/content gate has passed — replaces the F3 name lists
    aliases                             moved from locations.ts
  }
content/geo/corridors.ts ← unchanged; members validated against kind (municipality only)
content/geo/geo-category.ts (derived, never hand-written)
  category(m) =
    NOT_SERVED            status = 'not-served'
    ADVERTISING_ONLY      status = 'advertising-only'        (vocabulary kept; no member today)
    DISCOVERY_ONLY        status = 'discovery'               (today's 23 assessment-only municipalities)
    UNCONFIRMED           operationalTruth.verifiedAt = null
    SERVICE_AREA          operational ∧ published ∧ page gate passes
    OPERATIONAL_CORRIDOR  operational ∧ ¬(published ∧ gate)  (today's 12)
```

Projections, all selectors over `MARKETS` + `category()`:

| Selector | Replaces | Feeds |
|---|---|---|
| `publishedAreas()` = category SERVICE_AREA | `SERVICE_AREAS` | routes, sitemap, graph `serves`, llms/ai/md, about/team, index, manifest |
| `schemaCityNodes()` = SERVICE_AREA ∧ kind=municipality | `CITIES` | org `areaServed`, services `areaServed` |
| `serviceAreaMarkets()` = SERVICE_AREA ∧ kind=municipality | today's B | `/api/v1/markets service_area` |
| `locationNodes()` = all markets + hierarchy roots | `LOCATION_NODES` | locations API, graph `within`, matcher |
| `placeFor(m)` = kind + partOf chain + region + country | `placeForArea` | every JSON-LD place |
| `territoryLabel()` = derived from the regions present | `BUSINESS_NAP.region` as a territory label | every "N areas across …" sentence |

Why the owner stays under `apps/web/content/geo` and does not move to
`packages/shared`: nothing outside `apps/web` reads geography (`apps/admin`
and `apps/mobile` import no market), `content/` is already the fact layer for
pricing, claims and geography, and moving 101 records across a package
boundary is churn that makes no surface more correct. What changes is that the
four other lists stop being written by hand.

Category mapping of the baseline data, computed from the rules above without
changing any record:

| Category | Count | Members |
|---|---|---|
| SERVICE_AREA | 89 | every published area (6 of them mis-typed as `City`, GC-003) |
| OPERATIONAL_CORRIDOR | 12 | toronto, whitby, oshawa, clarington, kawartha-lakes, halton-hills, caledon, innisfil, guelph, cambridge, kitchener, port-colborne |
| DISCOVERY_ONLY | 23 | uxbridge, whitchurch-stouffville, east-gwillimbury, georgina, waterloo, bradford-west-gwillimbury, orangeville, brantford, london, woodstock, stratford, peterborough, cobourg, port-hope, belleville, kingston, collingwood, wasaga-beach, muskoka, sarnia, windsor, chatham-kent, owen-sound |
| ADVERTISING_ONLY | 0 | — (`us-proxy` retired 2026-09-10) |
| UNCONFIRMED | 0 | — (`UNVERIFIED()` exists for the next market) |
| NOT_SERVED | 0 | — |
| absent from every model | — | lakeview-park, bowmanville (alias of Clarington only), paris, ayr, waterloo-region, kitchener-waterloo |

Toronto sits in OPERATIONAL_CORRIDOR only because it has no page of its own —
it is the head-office city. That is decision D2 (§9), not an expansion
question.

---

## 8. Revised patch graph

The protocol's GEO-001…023 sequence is kept in intent. Two changes after
inspection: fact normalisation (002) must land **with output snapshots** so it
provably changes nothing public, and the Whitby/Oshawa resolution is a
consequence of the category rule (006), not a separate content decision.

**Shipped so far**, and what each one actually took, because the patch numbers
below are the protocol's plan and the ones that shipped are wider than it:

```text
GEO-000  archaeology: this map, the contradiction log, the measurement, geo-measure.mjs
GEO-001  one geography: 11 municipalities published; took GEO-001…GEO-013's intent for
         the fact/projection split, the counts, the API, the JSON-LD and the twins
UI-NAV-01 the mega-menu you can reach, and one mobile drawer (not a GEO patch)
GEO-002  corridors: districts out of the member lists (GEO-013), corridor JSON-LD, and
         the twins for /corridors, /corridors/{id} and /where-we-work (GEO-009 decision)
GEO-003  currency made explicit. No public output change at all — 34 surfaces byte-identical
         before and after. The groundwork GC-024 needs before a second currency can exist.
GEO-004  New York priced in New York (D6). Closes GC-024: three USD bands, the offer catalog
         split by country, a New York FAQ, and eleven "one rate card everywhere" sentences
         rescoped to "within a country" so the promise and the prices agree.
FS-001–7  the floor studio (another agent's series), rebased onto GEO-004 and landed.
GEO-005  one price source again. Closes GC-025: the per-species rate table and the placeholder
         finish/pattern multipliers are deleted; every estimator takes a published band.
```

**The protocol's plan, for the record:**

```text
GEO-001  contract: GeoCategory + category() + selectors in lib/geo; snapshot tests pin every
         current output (C, D, B, locations, graph, llms, org JSON-LD). No output changes.
GEO-002  fact normalisation: F3 lists → Market.published/kind; F5 assessment list, aliases and
         regions → markets.ts discovery records; seo-data/locations become selectors.
         Snapshots must stay byte-identical except the documented diffs.
GEO-003  hierarchy + kind guards (negative tests first): district-as-City, corridor lists a
         district, US under a Canadian parent, Ontario node without region, partOf as name.
GEO-004  count/label system: territoryLabel(); "N areas across Toronto & the GTA" everywhere.
GEO-005  locations/API alignment: coverage from category; in_area_served redefined; notes derived.
GEO-006  graph alignment: serves ⇔ SERVICE_AREA; OPERATIONAL_CORRIDOR gets no serves edge and
         leaves /api/v1/markets service_area (resolves Whitby/Oshawa as Outcome B until content).
GEO-007  JSON-LD alignment: placeFor() with region + country for every node; US offers out of
         CAD price catalog areaServed; Niagara Falls disambiguated.
GEO-008  sitemap / index / navigation alignment ("Across the GTA" → nearest from F1).
GEO-009  llms / ai / Markdown alignment (non-GTA sentence, arithmetic, US heading, twin titles).
GEO-010  Buffalo / New York: whatever of GC-004 is left after 005–009, closed with a guard.
GEO-011  Toronto (D2) and the twelve OPERATIONAL_CORRIDOR municipalities (D1).
GEO-012  Waterloo / Brantford / Kitchener entity normalisation (discovery records, no pages).
GEO-013  corridor normalisation (districts out of member lists; Brantford/Waterloo decision D4).
         ← districts done in GEO-002; the Brantford/Waterloo decision (D4) is still open.
GEO-014+ controlled publication, one municipality per patch, only with owner content (D1).
GEO-022  production gate: geo-measure --strict in scripts/verify-live.sh.
GEO-023  regression suite completion.
```

No page is published before GEO-009 closes: the protocol's §36 dependency
rule, restated here so the order is visible where the architecture is.

---

## 9. Decisions only the owner can make

| # | Decision | Why code cannot make it |
|---|---|---|
| D1 | For each of whitby, oshawa, clarington, kawartha-lakes, halton-hills, caledon, innisfil, guelph, cambridge, kitchener, port-colborne: **publish** (Outcome A — needs a real CityContent entry from a real job or real local knowledge) or **hold as OPERATIONAL_CORRIDOR** (Outcome B — coverage stays true in the API and on its corridor, no service-area claim). | The page gate refuses invented content; only the owner has the local facts. Until an entry exists, GEO-006 applies Outcome B mechanically — which is not a demotion of coverage, only of publication. |
| D2 | Toronto's canonical service-area URL: a `/service-areas/toronto` page, or declaring `/hardwood-flooring-toronto` (which exists) as the Toronto area page. | It is the head-office city; either choice changes a canonical URL crawlers already hold. |
| D3 | Whether Downtown Toronto, North York, Etobicoke, Scarborough, East York and York stay published as districts of Toronto (the model's own classification) — GEO-003 changes their JSON-LD from `City` to `Place ⊂ City Toronto`. | Six URLs with index history change entity type. The model already says they are districts; this is confirmation, not choice. |
| D4 | Whether Brantford, Waterloo (city), Paris, Ayr and Woodstock enter the model as DISCOVERY_ONLY records, and whether the 403/6 corridor gains a Hamilton → Brantford branch. | A corridor is an operating plan (corridors.ts header). |
| D5 | Lakeview Park (Oshawa) and Bowmanville (Clarington) as locality records under their municipality. | Only useful with local content; otherwise an alias is enough. |
| D6 | **Decided 2026-09-11.** New York is priced in US dollars. One published band set for the whole state; the per-corridor difference in travel lives in the written quote, not in a second rate card. The exchange basis and the mobilization uplift are not published on any surface. | A price is a business decision, and the uplift has no external source — it cannot be derived, only stated. Recorded here because the numbers below are an owner decision, delegated and executed on 2026-09-11, and revisable in one file. |

### D6, in full — the New York bands

| Band | Ontario (published) | New York (published) |
|---|---|---|
| Screen & recoat | $2.50–$4.00 CAD | $2.00–$3.25 USD |
| Full sand & finish | $4.75–$7.50 CAD | $4.00–$6.25 USD |
| New hardwood install | $11.00–$18.00 CAD | $9.25–$15.00 USD |

How they were set, recorded here and **on no public surface**: the Ontario band
converted at the Bank of Canada daily rate for 2026-09-10 (1.3822 CAD per USD),
plus a 15% mobilization uplift for the crossing and the drive, rounded to the
nearest quarter dollar. Checked against the western New York market before
adoption: local refinishing runs $2–$7 per square foot and dustless
specifically $5–$8, so the full-sand band sits mid-market and below the local
dustless band while this business is the one actually containing the dust.

Neither the rate nor the uplift is emitted anywhere. A published exchange rate
is stale within a day, and a published uplift is one division away from the
margin. What IS said plainly, on every New York surface, is that the crossing
and the travel are already inside the band and that the fixed price is written
after the free in-home measure — the same sentence Ontario gets.

---

## 10. Keeping this map true

- A patch that adds, moves or removes a geographic fact updates §2 and §5 in
  the same commit.
- A patch that adds a projection adds its row to §5 with its guard and test,
  or states "none" and why.
- The measurement file is dated and never edited after its phase closes; the
  next measurement is a new file.
- "Green" is never cited as proof of geographic correctness without the
  matching line from `geo-measure.mjs` against production.
