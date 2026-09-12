# Geography — contradiction log

Every place the system states two different geographies, found by GEO-000 at

```text
GEO_BASELINE_COMMIT = b206f12fdbd63bfddc777e002288c68efb5fa8f5
```

How each entry was established: the TypeScript modules at the baseline were
executed and their output compared (`GEO_MEASUREMENT_20260911.json →
repository`), then every file:line below was read by hand. Production
observations are marked as such and are **leads, not measurements** until
`node scripts/geo-measure.mjs` has been run from Codespaces — the sandbox that
produced GEO-000 could not reach ecowoods.ca.

Severity, per the protocol's contradiction law (§49): **P0** = the system says
"we serve X" and "X is not served / is somewhere else" for the same entity, in
words or in machine form. **P1** = a wrong fact about a place (hierarchy,
country, count, label) without a served/not-served split. **P2** = a latent
defect that is consistent today by coincidence, or a model gap. **P3** =
documentation only.

An entry is closed only by the patch named in *Resolution*, with a regression
guard, verified against production. Nothing here is closed at GEO-000.

---

## Status after GEO-001

GEO-001 took the protocol's GEO-001…GEO-013 intent in one change, because the
architecture allowed it: every contradiction below traced to three places
(`seo-data.ts` lists, `locations.ts` region list, `root-schema.ts` place
builder) plus the territory label, and fixing those three made every
projection agree. Measured in the repository after the change (production is
measured by `node scripts/geo-measure.mjs` after deploy):

| Set | Before | After |
|---|---|---|
| markets | 101 | 101 |
| `service_area` (municipalities) | 59 | 59 |
| org JSON-LD City nodes | 54 | 59 (= `service_area`) |
| `in_area_served` | 53 | 59 (= `service_area`) |
| published pages = sitemap = graph `serves` = llms = `has_page` | 89 | 100 (every market except the City of Toronto, which is served through its 23 published districts and neighbourhoods) |
| location nodes | 126 | 132 (+ United States, New York State, Niagara Region, Waterloo Region, Port Colborne, Kawartha Lakes) |
| `service_area` without a page | 12 | 1 — Toronto, a region node by definition (below) |
| New York places under a Canadian parent | 24 | 0 |
| districts emitted as `City` | 6 | 0 |
| Ontario place nodes without province/country | 29 | 0 |

| ID | Status | How |
|---|---|---|
| GC-001 | fixed (Toronto rule) | the eleven confirmed municipalities have pages with local content; Toronto is a `region` node served through its 23 pages |
| GC-002 | fixed | `ASSESSMENT_MUNICIPALITIES` moved to `content/geo/regions.ts` as `DISCOVERY` (23 non-markets only); every market is a node from `markets.ts` |
| GC-003 | fixed | the six former municipalities of Toronto moved from `AREAS` to `DISTRICTS`; they emit `Place ⊂ City Toronto ⊂ Ontario ⊂ Canada` |
| GC-004 | fixed (machine) · open (marketing copy) | NY under `new-york-state`; every City node carries its state; CAD offers name Ontario cities only; territory named by `lib/geo/territory.ts` on llms, ai.txt, about, team, press, head-term pages, Markdown hub, matcher; "Nearby" replaces "Across the GTA". Service-page H1s such as "Stair refinishing in Toronto and the GTA" are unchanged head-term copy |
| GC-005 | fixed | Niagara municipalities under `niagara-region`; Kitchener, Cambridge and the City of Waterloo under `waterloo-region` |
| GC-006 | fixed | the sentence names the real DISCOVERY places instead of "outside the GTA" |
| GC-007 | fixed | `PUBLISHED_PARTITION`: 58 municipalities + 25 districts + 17 neighbourhoods = 100 |
| GC-008 | fixed | Kitchener and Cambridge are published; the index sentence is `TERRITORY` |
| GC-009 | fixed | "101 municipalities and districts — 75 in Ontario, 26 in New York State" |
| GC-010 | fixed by definition | Toronto: `service_area` ✓, org City ✓, `in_area_served` ✓; `coverage: region`, no `serves` edge — the graph serves its 23 pages, each `within` Toronto. The golden-query suite pins Toronto as a region, and that model is kept |
| GC-011 | fixed in data (100 = 100) | the two deciders still exist; one selector is future work |
| GC-012 | reclassified | `in_area_served` is documented as "a City in the organisation JSON-LD"; districts and neighbourhoods are correctly false. Municipalities: `service_area` ⇔ `in_area_served`, 0 disagreements |
| GC-013 | fixed | parents read from `markets.ts` `partOf`; Williamsville ⊂ Amherst ⊂ New York ⊂ United States |
| GC-014 | fixed | every place carries province/state and country; "Niagara Falls, ON" in titles, llms, ai.txt, twins |
| GC-015 | fixed | twin title uses the display name and states the same service sentence(s) as the HTML |
| GC-016 | open | corridors still list five districts (display choice on corridor pages) |
| GC-017 | partly | Bowmanville, Courtice, Lakeview Park are content/aliases on Clarington and Oshawa; City of Waterloo and Waterloo Region are two nodes; Brantford, Paris, Ayr unchanged |
| GC-018 | fixed (emitted) | location note and matcher answers no longer say "Toronto and the Greater Toronto Area" |
| GC-019 | not pursued | per owner instruction no new guard was added |
| GC-020 | closed — not a defect | live run 2026-09-11: 0 of 7 surfaces differ with/without cache-buster; `x-vercel-cache: HIT`, `age` 10–17 s on both. The stale copies were the fetcher's |
| GC-021 | open | job cards still keyed by display name |
| GC-022 | open | no twins for corridors / where-we-work (none advertised) |
| GC-023 | open | measure after the first geography deploy |
| GC-024 | **closed by GEO-004** | New York pages publish United States bands in United States dollars; 0 Canadian figures remain on any New York surface, HTML or twin. Method recorded in docs/GEO_SOURCE_MAP.md D6 and published nowhere |
| GC-025 | **closed by GEO-005** | one price source; `FLOORING_RATES_CAD_PER_SQFT` and every invented multiplier deleted |
| GC-026 | **open — opened by AUDIT-01** | Floor Studio has no concept of country. Every figure is CAD, and it is linked from the global header and footer of all 26 New York markets. GC-024 is reopened on one surface |
| AV-01 | **open — opened by AUDIT-01** | the occlusion mask paints hardwood over people, light dogs, jute rugs, wooden furniture legs, stair risers and cardboard — 6 of 14 tested objects, 100% of their pixels |
| AV-02 | **open — opened by AUDIT-01** | `floorConfidence` reports `measured` while losing 72% of the floor plane in a room with a rug |
| NAV-03 | **closed by NAV-03** | ⌘K carried its own hand-written nav from when this site was one page: 6 of 13 actions were homepage-only anchors that silently no-opped on 46 of 47 public routes, and it could reach none of the corpus. One navigation source now feeds the panels, the drawer and the palette |
| VIS-02 | **closed by VIS-02** | five pages carried a full openGraph block with no images key — the four commercial head terms and Floor Studio all served the site default, the same card /terms serves |
| TREE-01 | **closed by VIS-02** | /technical-library is the breadcrumb parent of every article and sits at sitemap priority 0.95, and appeared in no menu; the Reference column now names it beside /resources with notes that distinguish them |

Two existing checks were edited because they encoded the old geography, and
both edits widen rather than tighten: `scripts/verify-work-map.mjs` now also
reads `DISTRICTS` (it could not see Downtown Toronto once it became a district),
and `lib/geo/geo.test.ts` expects at least one confirmed market without local
content instead of more than five (eleven were written).

---

## Status after GEO-002 — the corridors

GEO-002 closed the two corridor entries and added no guard.

| ID | Status | How |
|---|---|---|
| GC-016 | fixed | the five districts are out of `Corridor.members`; `corridorStops()` derives them from `partOf` and every corridor surface — page, API, twin, JSON-LD — nests them under the municipality that contains them |
| GC-022 | closed | `/corridors.md`, `/corridors/{id}.md` and `/where-we-work.md` are served, advertised in `<head>` (`alternates.types`), in the `Link:` header, in `/md`, in `/llms.txt` and in the page's own JSON-LD (`encoding`) |

Measured in the repository after the change:

| Set | Before | After |
|---|---|---|
| districts listed as corridor members | 5 | 0 |
| districts named by a corridor surface | 5 | 42 (every district in the registry, through its municipality) |
| markets named by a corridor surface | 64 (59 municipalities + 5 districts) | 101 (every market) |
| service-area links on `/corridors/core-gta` | 7 | 40 |
| corridor pages with JSON-LD beyond a breadcrumb | 0 | 11 (`WebPage` + `Service` + `ItemList`) |
| Markdown twins | 100 areas + 15 other surfaces | + `/corridors`, 11 route twins, `/where-we-work` |
| `Service.areaServed` nodes with no province/state or country | — | 0 (every node from `placeForMarket`) |
| guards / tests | 66 / 336 | 66 / 336 |

`itemListElement` and `areaServed` were kept deliberately different: the first
is the drive (municipalities, in travel order), the second is coverage (every
market on the route, districts included, whose operational position the owner
has confirmed on a date). A market nobody has confirmed appears on the page,
with the sentence saying so, and in neither list.

One existing check was edited, and the edit widens: `scripts/verify-destinations.mjs`
now asks `next.config.js` for its `rewrites()` and counts a literal `.md` source
as a route when its destination is one. It could not see any of the sixteen
markdown twins — a link to `/service-areas.md` read as "no route, no public
file, no manifest entry" — and nothing had noticed because until GEO-002 no page
linked to a twin in prose. A rewrite pointing at nothing still fails.

---

## Status after GEO-003 — currency made explicit

GEO-003 closes nothing. It is the patch that makes closing GC-024 safe, and it
changes no public output: 34 generated surfaces — `/llms.txt`, `/ai.txt`,
`/llms-full.txt`, every Markdown twin, the organisation JSON-LD, the three
commercial graphs, the six service-page `Offer` graphs, the registry price
primitives and the entity answers — are **byte-identical before and after**.

**What was wrong.** `PriceBand.currency` was the literal type `'CAD'` and
`formatBand` wrote a bare `$`. `$4.75–$7.50` is therefore the same string
whether it means Canadian or American dollars, and `tests/drift.test.ts`
asserts that exact string is present on every surface. A band published in the
wrong currency would have passed `tsc`, all 66 guards, all 336 tests and the
production build, and been read as a price by a customer. Four more places
built a price string or a currency by hand:

| Where | Was | Now |
|---|---|---|
| `content/constants/pricing.ts` | `currency: 'CAD'` literal type; bare `$` in both formatters | `Currency = 'CAD' \| 'USD'`; a band outside `HOME_CURRENCY` names itself in the string |
| `lib/service-pages.ts` `priceBand` | built `$${min}–$${max} per sq ft` itself — identical to `formatBand` by coincidence | delegates to `formatBand`; new `bandForPage` returns the object |
| `app/services/[slug]/page.tsx` | `priceCurrency: 'CAD'` twice; `minPrice`/`maxPrice` recovered by running a regex back over the formatted string | reads the band object |
| `lib/schema/commercial.ts` | `priceCurrency: 'CAD'` twice | the band's own currency |
| `lib/registry/types.ts`, `match.ts` | `currency: 'CAD'` literal type | `Currency` |
| `app/llms.txt/route.ts` | `PRICE_BANDS[0].currency` as "the site's currency", twice | `currenciesIn(PRICE_BANDS)` |
| `lib/registry/citations.ts` | `"…per square foot in CAD"` typed | read from the primitives |

**Why no new guard.** The currency now travels inside the rendered string, so
the presence assertions that already exist distinguish the two by construction:
`formatBand` of a USD band is a different string from `formatBand` of a CAD
one, and `drift.test.ts` compares exact strings. A guard that has to remember
to look is worth less than a format that cannot be confused.

Still open after this patch: GC-024 itself (no USD band exists yet — GEO-004),
GC-021, GC-023, and `openapi.ts:287` `currency: { const: 'CAD' }`, which is
accurate today and must widen when the second band set lands.

---

## Status after GEO-004 — New York is priced in New York

**GC-024 is closed.** The bands a New York visitor is shown are United States
bands in United States dollars, and no Canadian figure appears on any of the
twenty-six New York surfaces.

Measured by rendering every area page and every area twin:

| Page | HTML: CAD figures | HTML: USD figures | Twin: CAD | Twin: USD |
|---|---|---|---|---|
| Etobicoke, Hamilton, Niagara Falls ON (and the other 71 Ontario areas) | 3 | 0 | 2 | 0 |
| Buffalo, Amherst, Rochester, Williamsville (and the other 22 NY areas) | **0** (was 3) | 3 | 0 | 2 |

**Where the Canadian figures were reaching New York pages.** Four places, three
of which the first pass missed and a rendered diff caught:

| Surface | What a Buffalo visitor saw |
|---|---|
| `FAQ_ITEMS` → `faqPageSchema()` on all 100 area pages | "How much does hardwood flooring cost in **Toronto**?" answered in CAD, as FAQPage JSON-LD and as visible copy |
| the "Services delivered here" cards | `priceBand()`, which is the Ontario set, under a Buffalo heading |
| `CommercialHeadTermRail` | "Hardwood floor refinishing in **Buffalo** — a full sand and finish runs $4.75–$7.50 per square foot", in content, above the fold, on 26 pages |
| `areaToMarkdown` | the same Ontario bands in the machine edition |

The rail is the one worth naming: it built its own `$X–$Y` strings from
`PRICING` and had no idea a second currency existed. It is the fifth
hand-written price string this series has removed, and the only one that put a
foreign price next to an American place name.

**What is published, and what is not.**

| | |
|---|---|
| Published | Three USD bands; that the crossing and the travel are already inside them; that there is no mobilisation line and no later surcharge; that the fixed price follows the free in-home measure, as in Ontario |
| Not published, anywhere | The exchange basis and the size of the travel allowance. A rate is stale within a day of being printed; an uplift is one division away from the margin. Both are recorded once, in docs/GEO_SOURCE_MAP.md D6 |

**One rate card per country, not per corridor.** The site tells every visitor
that the bands do not change by place and that distance shows up in the written
price after the measure. Three corridor rate cards would have made that false
to buy a little precision. Eleven sentences across the HTML, the twins and
llms.txt were rescoped to say "within a country" instead of "everywhere", so
the promise and the prices agree.

**Guards.** None added. One widened and disclosed:
`scripts/verify-production-agentic.mjs` parsed every `PriceBand` block and
asserted there were exactly three. It now reads each band's currency, still
requires exactly three Canadian bands on the Ontario surfaces it probes, and
additionally requires the three New York bands on `/pricing.md` and all six in
`/api/v1/pricing`. It checks more than it did.

Also widened, mechanically: `openapi.ts` `currency` moved from
`const: 'CAD'` to `enum: ['CAD', 'USD']`, and three test assertions that
counted three bands now count six and match on currency as well as label —
matching on label alone would have checked the Ontario numbers twice and never
looked at New York.

Registry ids are additive: `price:screen-and-recoat` and its two siblings are
unchanged, and the New York primitives are `price:screen-and-recoat-usd` and so
on. Nothing that resolved before resolves differently.

Still open: GC-021 (job cards keyed by display name) and GC-023 (cache windows).

---

## GC-025 · P0 · two published prices for the same work

Found 2026-09-12, immediately after the floor-studio series shipped. **Closed by
GEO-005 the same day.**

**A says** `/pricing`, `/pricing.md`, `/api/v1/pricing`, `/llms.txt`, `/ai.txt`
and the organisation's `OfferCatalog`: a new hardwood install is one published
band, and a full sand and finish is another.
**B says** the configurator, `/design`, the spec sheet, `/api/estimate`,
`/api/chat`'s `estimate_project` tool and — from 2026-09-12 — `/floor-studio`:
an installed rate per species, multiplied by a finish factor and a pattern
factor.

B was `FLOORING_RATES_CAD_PER_SQFT` in `packages/shared/ai/index.ts`, and it was
never derived from the bands. Four of its six install rates fell outside the
published band — red oak $2/sq ft under the floor, maple $1 under, engineered $3
under, black walnut $4 over the ceiling — and its refinishing range missed the
published full-sand band at both ends. At 800 sq ft a walnut floor came back
above what the same site publishes as its ceiling.

The multipliers were not merely underived. The file labelled them itself:

> ⚠ ACTION REQUIRED BEFORE LAUNCH … The FINISH_ and PATTERN_ multipliers below
> are PLACEHOLDERS I chose to make the model structurally correct — they are NOT
> Ecowoods' real numbers. Have the estimator confirm them, **or the site will
> quote prices nobody has agreed to honour.**

The confirmation never happened and the numbers shipped. Asked directly on
2026-09-12 whether they were rates he would honour, the owner said no.

**Resolution (GEO-005).** The rate table and both multiplier sets are deleted.
`estimateInstalledRangeCad` takes a `PublishedBand` and multiplies it by an
area; it calculates no rate. `packages/shared` cannot import the bands — it is
upstream of `apps/web`, where `content/constants/pricing.ts` lives for the guard
that exempts it by path — so the band travels IN, from
`bandForWork(work, country)`. One source, one direction.

| | Before | After |
|---|---|---|
| price sources on the site | 2 | 1 |
| install rates outside the published band | 4 of 6 | 0 |
| unconfirmed multipliers reaching a visitor | 9 | 0 |
| surfaces quoting the underived table | 6 | 0 |
| guards / tests | 66 / 465 | 66 / 465 |

**What removing the invented numbers exposed.** The "best value" recommendation
in `lib/floor-studio/match.ts` divided one estimate by another and told the
visitor "the pattern and finish add roughly 38% over the plainest version". That
percentage was the placeholder multipliers, restated as a fact about money. With
them gone the ratio is 1.0 for every configuration, and the old code would have
called a chevron "the least expensive way to lay this species". It now ranks the
cut by the labour the catalogue itself describes — a straight lay is the fewest
cuts and the least waste, a diagonal costs waste, a chevron is "the hardest floor
we lay" — and says where that shows up: inside the band, in the written price
after the measure. No percentage, and the same recommendation for a true reason.

Still open: the studio prices in Canadian dollars on a page linked from the
header and footer of all 26 New York pages. Owner decision taken 2026-09-12: a
region control in the studio, driving currency and band together. That is
GEO-006.

---

## Summary

| ID | Sev | Class | One line | Entities | Resolution |
|---|---|---|---|---|---|
| GC-001 | P0 | membership | `service_area` lists 12 municipalities that have no page, no sitemap entry and no `serves` edge | 12 | GEO-006 / GEO-011 |
| GC-002 | P0 | membership | 9 owner-confirmed markets are "assessment — do not present as covered" in the location API; 2 are absent from it | 11 | GEO-002 / GEO-005 |
| GC-003 | P0 | hierarchy | 6 districts of Toronto are emitted as schema.org `City` nodes | 6 | GEO-003 / GEO-007 |
| GC-004 | P0 | country | New York geography sits under Toronto / GTA / Ontario on nine surfaces (table in the entry) | 26 | GEO-004 … GEO-010 |
| GC-005 | P1 | hierarchy | 4 Niagara municipalities hang from the GTA | 4 | GEO-002 / GEO-005 |
| GC-006 | P0 | membership | llms.txt and /service-areas.md say non-GTA Ontario is not published; 15 published areas are non-GTA Ontario | 15 | GEO-009 |
| GC-007 | P1 | count | "89 published areas (53 …, 17 …)" — the parts sum to 70 | — | GEO-004 / GEO-009 |
| GC-008 | P1 | membership | "west to Waterloo Region" — nothing in Waterloo Region is published | 3 | GEO-008 / GEO-012 |
| GC-009 | P1 | country | /corridors: "101 Ontario municipalities and districts" — 26 are in New York | 26 | GEO-004 |
| GC-010 | P0 | membership | Toronto is served in JSON-LD and `service_area`, unserved in the graph and `in_area_served` | 1 | GEO-011 (D2) |
| GC-011 | P2 | membership | two independent deciders of "has a page" that agree only by coincidence | 89 | GEO-001 / GEO-002 |
| GC-012 | P1 | semantics | `in_area_served: false` on 36 places the graph says are served | 36 | GEO-005 |
| GC-013 | P2 | hierarchy | three `partOf`/parent representations; US districts inside a city with no state | 19 + 2 | GEO-002 / GEO-007 |
| GC-014 | P1 | disambiguation | 29 Ontario place nodes carry no region or country; Niagara Falls ON and Brighton undisambiguated | 29 + 2 names | GEO-007 |
| GC-015 | P1 | twin drift | HTML and Markdown twins name and frame the same area differently | 89 | GEO-009 |
| GC-016 | P2 | corridor | corridors list 5 districts; the model forbids it and the guard checks one direction | 5 | GEO-003 / GEO-013 |
| GC-017 | P2 | model gap | target-model places absent or assessment-only | 9 | GEO-012 / GEO-013 (D4, D5) |
| GC-018 | P1 · P3 | stale semantics | one emitted API note, and several comments and guard headers, describe a retired geography | — | GEO-005, then hygiene |
| GC-019 | P1 | guard gap | every geography guard is green while GC-001…017 exist | — | GEO-003, GEO-022, GEO-023 |
| GC-020 | P1 † | production drift | un-busted requests observed serving an older build (`/team` 32 areas; `/corridors` 404) | — | measure, then GEO-022 |
| GC-021 | P2 | local proof | job cards attach to pages by display name; 1 of 5 attaches to nothing | 5 | GEO-002 |
| GC-022 | — | twin gap | no Markdown twin for /corridors, /corridors/{id}, /where-we-work (none advertised) | — | GEO-009 decision |
| GC-023 | P1 | production drift | machine files and HTML cache for different windows, so surfaces can disagree after a deploy | — | GEO-022 |

† observed through a summarising fetcher; unconfirmed until measured.

---

## GC-001 · P0 · `service_area` without a page

**A says** `/api/v1/markets` → `service_area` includes the slug (the API's
list of what "may be claimed").
**B says** `/service-areas/{slug}` does not exist (`dynamicParams = false`),
the sitemap has no entry, the graph has no `serves` edge, and for nine of the
twelve the location API says "do not present as covered" (GC-002).

- Entities: toronto, whitby, oshawa, clarington, kawartha-lakes, halton-hills,
  caledon, innisfil, guelph, cambridge, kitchener, port-colborne.
- Evidence: `apps/web/lib/geo/index.ts:34` (`serviceAreaMarkets` = operational
  ∧ municipality — no page condition); `lib/registry/handlers.ts:726`;
  `app/service-areas/[city]/page.tsx:14–17` (params from `SERVICE_AREAS`).
  Measured: B = 59, C = 89, B \ C = the twelve above.
- Production (lead): `/service-areas/whitby?cb` → 404.
- Root cause: coverage (F1) and publication (F3) are decided in different
  files, and `service_area` projects coverage alone.
- Resolution: GEO-006 applies the category rule — an operational municipality
  without a passed page gate is OPERATIONAL_CORRIDOR, keeps its corridor and its
  dated statement, and leaves `service_area`. Publication (Outcome A) follows
  per municipality only with owner content (D1). Toronto is D2 (GC-010).

## GC-002 · P0 · confirmed coverage reported as "assessment"

**A says** `content/geo/markets.ts` — Whitby is `active-expansion`,
"Owner-confirmed coverage … routine scheduling", verified 2026-09-10.
**B says** `/api/v1/locations/whitby` — `coverage: assessment`,
`status: unverified`, note "Not a published service area. Work here is
assessed per project through the estimate path; do not present as covered."
— **and** `provenance.verified_at: 2026-09-10`. One record carries both the
confirmation date and the instruction not to present the place as covered.

- Entities (assessment ∧ confirmed): whitby, oshawa, clarington, halton-hills,
  caledon, innisfil, guelph, cambridge, kitchener.
  Confirmed but **absent** from the location API: port-colborne, kawartha-lakes.
- Evidence: `lib/registry/locations.ts:95–137` (`ASSESSMENT_MUNICIPALITIES`
  lists them); `lib/registry/registry.ts:326–337` (`verified_at` from the
  market, note from the coverage); `markets.ts:265–287, 291–296`.
- Production (lead): observed exactly as above for whitby.
- Root cause: a fact list inside a projection (F5) that predates the
  2026-09-10 confirmation and was never re-derived.
- Resolution: GEO-002 moves the list into `markets.ts` (discovery records for
  the 23 that are not markets); GEO-005 derives coverage from `category()`.

## GC-003 · P0 · districts emitted as cities

**A says** `markets.ts:176–181` — Downtown Toronto, North York, Etobicoke,
Scarborough, East York and York are `kind: 'district', partOf: 'toronto'`;
`locations.ts:37` agrees (`TORONTO_DISTRICT_SLUGS`).
**B says** they are in `AREAS` (`seo-data.ts:37`), therefore in `CITIES`,
which the file itself defines as "Municipalities. These, and only these,
become schema.org City nodes" (`seo-data.ts:161–165`). They are emitted as
`City` in the organisation `areaServed` on every page
(`root-schema.ts:66–68, 275`), in every `/services/{slug}` `areaServed`
(`services/[slug]/page.tsx:131`), as the page's own `spatialCoverage`
(`placeForArea` falls through to `root-schema.ts:147`), with
`in_area_served: true`, and in llms.txt under "Municipalities and districts".

- This is the F-157 defect class the code comments describe as prevented. The
  guard that should catch it (`verify-geo.mjs` 7a, 477–539) checks that each
  `AREAS` name exists as a market, not that it is a municipality.
- Resolution: GEO-003 adds the negative test (district ∈ schema City nodes →
  fail); GEO-007 emits `Place ⊂ City Toronto`. Owner confirmation D3.

## GC-004 · P0 · New York under Toronto / GTA / Ontario

The owner confirmed New York service on 2026-09-10, and the service claim is
consistent (page, sitemap, graph, markets, llms, corridors). What is not
consistent is **where** New York is:

| Surface | What it says about a New York place | Evidence |
|---|---|---|
| `/api/v1/locations`, graph `within` | Buffalo ⊂ **GTA** ⊂ Southern Ontario ⊂ Ontario ⊂ Canada — all 24 NY municipalities | `locations.ts:165–166` default `'gta'` |
| `service-match` / `recommendation-context` | "in the GTA" and "in Ontario" return Buffalo, Amherst, Niagara Falls NY, Rochester, Greece … | `match.ts:151` → `publishedWithin` |
| organisation JSON-LD (every page) | `areaServed = [AdministrativeArea "Greater Toronto Area" ⊂ Ontario ⊂ Canada, City "Buffalo", City "Amherst", … City "Brighton"]` — US cities bare, beside a GTA node | `root-schema.ts:66–68, 86–90, 275`; `builders.ts:184–186` |
| organisation JSON-LD price offers | CAD Ontario price bands with `areaServed` including the 24 US City nodes — while `markets.ts:338–345` says price bands appear nowhere as local US facts | `root-schema.ts:218–232` |
| llms.txt | "Serving: **Toronto & the GTA**, 89 published areas" | `llms.txt/route.ts:100`; `constants/index.ts:35` |
| /about | "89 areas across **Toronto & the GTA**: …, Buffalo, …" | `entity-answers.ts:75–80` |
| /team, /press, /hardwood-flooring-toronto, /hardwood-stairs-toronto, /hardwood-floor-refinishing-toronto, /hardwood-floor-problems-toronto | "N municipalities and neighbourhoods in Toronto and the GTA" / "N areas across Toronto and the GTA" with N = 89 | team 79; press 160; hardwood-flooring-toronto 31, 100, 373; hardwood-stairs-toronto 426; refinishing 305, 329; problems 268 |
| /service-areas.md, /llms-full.txt, ai.txt | "— Toronto & the GTA", "across Toronto and the GTA", "Service area: Toronto & the GTA" | `markdown-export.ts:601, 607, 866, 983`; `ai.txt/route.ts:67` |
| every NY `/service-areas/{slug}` page | "Also serving — **Across the GTA.**" followed by Downtown Toronto, North York … (first ten of the list, regardless of place) | `[city]/page.tsx:123, 347` |

- The prior audit's "Buffalo corridor says not a service area" is **not
  reproduced** at the baseline: `corridors.ts:124–136` and the live
  `/corridors/buffalo-metro` (lead) no longer carry that wording, and
  `verify-geo-green.mjs` §4 forbids it. The remaining Buffalo defect is
  geographic, not a served/not-served split — it is P0 because a machine
  reading the graph concludes Buffalo is in Ontario.
- Resolution: GEO-004 (territory label derived from the regions present),
  GEO-005 (US parents from the record), GEO-007 (US out of the GTA node and the
  CAD offer catalog), GEO-008 (nearest from `Market.nearest`), GEO-010 guard.

## GC-005 · P1 · Niagara municipalities under the GTA

`lincoln`, `welland`, `thorold`, `fort-erie` resolve to parent `gta` in the
location API because they are not in `ASSESSMENT_MUNICIPALITIES` and
`parentOfPublished` defaults to `'gta'` (`locations.ts:165–166`). Their
neighbours St. Catharines, Niagara-on-the-Lake and Niagara Falls resolve to
`southern-ontario` because they are. Same region, two parents.
Resolution: GEO-002 (`regionOf` is a field on the record), GEO-003 guard
(no default parent).

## GC-006 · P0 · "outside the GTA … not published" vs thirty published areas

**A says** llms.txt: "Southern Ontario projects outside the GTA are assessed
per project through the estimate path; they are not published service areas."
(`llms.txt/route.ts:158`). /service-areas.md: "Projects elsewhere in Southern
Ontario are assessed per project … They are not published service areas, and
this page does not claim them as covered." (`markdown-export.ts:610–611`).
**B says** Hamilton, Ancaster, Dundas, Stoney Creek, Waterdown, Grimsby,
Lincoln, Beamsville, St. Catharines, Thorold, Welland, Niagara-on-the-Lake,
Niagara Falls, Fort Erie and Barrie are published pages, in the sitemap, in the
graph and in the same llms.txt's per-area routing — fifteen published
Ontario areas outside the GTA. (The 26 New York areas are outside the GTA too,
but the sentence is about Southern Ontario, so they are not counted here.)

- Production (lead): the llms.txt sentence is live.
- Resolution: GEO-009 derives the sentence from DISCOVERY_ONLY (what really is
  assessed per project: London, Kingston, Windsor, …).

## GC-007 · P1 · arithmetic that does not add up

"Serving: Toronto & the GTA, **89** published areas (**53** municipalities and
districts, **17** Toronto neighbourhoods)" — 53 + 17 = 70. The 19
`DISTRICT_AREAS` (Ancaster … Kenmore) are in the 89 and in no bracket.
Same structure at `markdown-export.ts:543–544`. And the "53 municipalities and
districts" are `CITIES`, which contains 24 US municipalities and the 6
districts of GC-003. Every number is derived; the partition is wrong.
Resolution: GEO-004 (counts from `category()` × `kind`), GEO-009.

## GC-008 · P1 · "west to Waterloo Region"

`/service-areas` (`page.tsx:36`) and the territory map's accessible name
(`TerritoryMap.tsx:229`) describe the **published** areas as reaching "west to
Waterloo Region". Nothing in Waterloo Region is published: Kitchener and
Cambridge are OPERATIONAL_CORRIDOR (GC-001), and the City of Waterloo is not a
market at all — only an assessment location. The corridor text "toward Guelph
and Waterloo Region" (`corridors.ts:93, 97`) is a route description and is
accurate; the index sentence turns it into a publication claim.
Resolution: GEO-008 derives the sentence from the published set; GEO-012 keeps
City of Waterloo and Waterloo Region as two entities.

## GC-009 · P1 · "Ontario" over a set with New York in it

`/corridors`: "{counts.total} Ontario municipalities and districts are in the
model" with `counts.total = MARKETS.length` = 101, of which 26 are in New York
(`corridors/page.tsx:29–31, 56`). Resolution: GEO-004.

## GC-010 · P0 · Toronto — served and not served

- Served: `root-schema.ts:66–68` puts `BUSINESS_NAP.address.addressLocality`
  ("Toronto") first in the organisation's `areaServed` City list;
  `serviceAreaMarkets()` includes `toronto` (`core-active`, "Head office and
  shop. Routine daily coverage.").
- Not served (machine form): the location node `toronto` has
  `coverage: region`, `in_area_served: false`, **no `serves` edge** in the graph
  (`registry.ts:936` emits `serves` only for `published`), and its
  `canonical_url` is the `/service-areas` index.
- No `/service-areas/toronto` page exists; `/hardwood-flooring-toronto` is the
  page that actually answers the Toronto head term.
- Resolution: GEO-011 after owner decision D2.

## GC-011 · P2 · two deciders of "has a page"

`/api/v1/markets.has_page` = `assess(market).indexable` — computed from
`CITY_CONTENT`, confirmation and cannibalisation (`worthiness.ts`,
`handlers.ts:752`). The route, sitemap, graph and AI files use
`SERVICE_AREAS` — the hand lists in `seo-data.ts`. Both are 89 and identical
today. Adding a `CITY_CONTENT` entry without an `AREAS` name makes the API
announce a page that 404s; adding an `AREAS` name for a market without content
publishes a page the API says is not earned. `verify-geo-green.mjs` §1–2 check
each direction only partially.
Resolution: GEO-001 defines one `published` selector; GEO-002 removes the lists.

## GC-012 · P1 · `in_area_served: false` on served places

`in_area_served` is `slug ∈ CITIES` (`registry.ts:287, 302`) — i.e. "is a
schema City node". For 36 published places with a page and a graph `serves`
edge it is `false`, including forest-hill, midtown-toronto, rosedale and
yorkville, which have published completed jobs. Toronto is `false` too
(GC-010). A consumer reading the field by its name concludes these places are
outside the service area. Resolution: GEO-005 (the field means what it says:
category = SERVICE_AREA; the City-node fact gets its own field if needed).

## GC-013 · P2 · three parent representations

`markets.ts` `partOf` (slug) · `seo-data.ts` `DISTRICTS[].partOf` (display
name: 'Hamilton', 'Amherst') · `locations.ts` `parent` (slug, else region
fallback). `locations.ts:192` still says Beamsville hangs from Southern Ontario
because Lincoln has no page — Lincoln has had one since 2026-09-10 and
Beamsville now resolves to `lincoln`. In JSON-LD, Williamsville and Kenmore are
`Place ⊂ City "Amherst"` / `City "Tonawanda"` with no state or country
(`root-schema.ts:123–130`) — the one place the New York disambiguation of
`root-schema.ts:136–146` does not reach. (Which Tonawanda — town or city — is a
fact for the record, not for this log.) Resolution: GEO-002, GEO-007.

## GC-014 · P1 · places without region, names without disambiguation

- 29 Ontario pages emit `spatialCoverage` / `areaServed` as a bare
  `{ "@type": "City", "name": … }` with no `containedInPlace`
  (`root-schema.ts:147`) — Ajax … York; the New York branch has a state and a
  country, the Ontario branch has neither.
- "Niagara Falls" (Ontario) is emitted bare in the page title, the page's
  JSON-LD and the organisation `areaServed`, beside "Niagara Falls, NY"
  (`seo-data.ts:78–80` is a slug override only).
- The organisation `areaServed` names are inconsistent: "Rochester, NY" and
  "Niagara Falls, NY" carry the state in the name, "Buffalo" and "Brighton" do
  not — and there is a Brighton in Ontario.
- Resolution: GEO-007 (`placeFor()` always emits region and country; names are
  display names, not disambiguators).

## GC-015 · P1 · HTML and its Markdown twin disagree

| | HTML `/service-areas/buffalo` | Twin `/service-areas/buffalo.md` |
|---|---|---|
| title / H1 | "… in Buffalo, NY" (`areaDisplayName`) | "# Hardwood floor installation & refinishing in Buffalo" (`markdown-export.ts:351`) |
| service sentence | "Ecowoods serves Buffalo, NY. Book the measure. The showroom is Toronto. The job is in Buffalo." | absent |
| hub framing | `/service-areas`: "across the corridor … into western New York" | `/service-areas.md`: "# Hardwood flooring service areas — Toronto & the GTA" |

A twin is a projection of the same page; it may format differently, it may not
say something different. Resolution: GEO-009.

## GC-016 · P2 · corridors that list districts

`corridors.ts` lists `stoney-creek` (qew-west, 86), `ancaster` and `dundas`
(403-6-west, 95), `williamsville` and `kenmore` (buffalo-metro, 129–130). The
model's own rule (`markets.ts:127–133`) is that a corridor is a drive between
municipalities and a district inherits membership through `partOf`.
`verify-geo.mjs` §2 (276–299) enforces the rule from the market side only, so a
corridor naming a district passes. Resolution: GEO-003 guard, GEO-013 data.

## GC-017 · P2 · target-model places absent

| Place | Baseline state | Note |
|---|---|---|
| Lakeview Park (Oshawa) | absent | locality under Oshawa (D5) |
| Bowmanville (Clarington) | alias of Clarington in `locations.ts:98`; named in the 401-east summary | locality under Clarington (D5) |
| City of Waterloo | assessment location only, no market | must never be merged with Waterloo Region (D4) |
| Waterloo Region | named in corridor route text; no entity | region, not a municipality |
| Brantford | assessment location only | no Hamilton → Brantford corridor edge (D4) |
| Paris, Ayr | absent | investigate only (protocol §11) |
| Woodstock | assessment location only | investigate only |
| Stoney Creek | district of Hamilton | correct since 2001 amalgamation; keep as district |
| Kitchener / Waterloo | Kitchener is a market; Waterloo is not; no "Kitchener-Waterloo" entity anywhere | no collapse today — keep it that way (GEO-003 guard) |

## GC-018 · stale semantics

Emitted (P1): `registry.ts:336` returns, in the public location API for the
hierarchy nodes, "Hierarchy node. The published service area is Toronto and
the Greater Toronto Area." — false since Hamilton was published.

Comments and headers (P3): `handlers.ts:691–693` ("United States markets are
excluded from it by construction — they are a service area…"),
`handlers.ts:796–803` (opportunity: "Every American market comes back
FUTURE"), `verify-geo.mjs:29` (item 4 still requires `us-proxy`),
`locations.ts:1–19` (16 + 16 areas; Hamilton and Barrie as assessment
examples), `locations.ts:192` (GC-013), and seven comments that still say
"32" areas (`EstimateForm.tsx:32`, `where-we-work/page.tsx:33`,
`[city]/page.tsx:35, 181`, `claims.ts:249`, `verify-business-facts.mjs:60`,
`match.ts:44`). No emitted count is hand-typed — the `verify-geo-green` §5 rule
holds; these are comments.

## GC-019 · P1 · green while wrong

At the baseline `verify-geo`, `verify-geo-green`, `verify-cities`,
`verify-sitemap`, `verify-allocation`, `verify-market-inputs`,
`verify-market`, `verify-agentic`, `verify-canonical`, `verify-markdown`,
`verify-entity`, `verify-business-facts`, `verify-repo-hygiene`,
`verify-changelog` and `verify-links` all pass. Gaps that let GC-001…017
through: 7a checks existence not kind (GC-003); §2 one direction (GC-016);
check 7 is a file-exists check (`verify-geo.mjs:541–543`); nothing compares
`service_area` with the published set (GC-001), location coverage with market
status (GC-002), any node's country or parent (GC-004, GC-005), or HTML with its
twin (GC-015). No guard reads production geography.
Resolution: GEO-003 (repository guards, negative tests first), GEO-022
(`geo-measure.mjs --strict` against production), GEO-023.

## GC-020 · P1 (unconfirmed) · un-busted requests serve an older build

Observed through a summarising fetcher on 2026-09-11:

| URL | without `?cb` | with `?cb` |
|---|---|---|
| `/team` | "32 areas" | "89 municipalities and neighbourhoods in Toronto and the GTA" |
| `/corridors` | 404 | 200, H1 "The routes, not a list of place names" |

The baseline build derives `/team` from `SERVICE_AREAS.length` (89) and builds
`/corridors`. If the stale copies are the CDN's, crawlers — which never add a
cache-buster — are reading a geography two builds old. If they are the
fetcher's, there is no defect. `geo-measure.mjs` fetches both forms and
records `x-vercel-cache` and `age` to decide. Until then this entry is open and
unconfirmed.

## GC-021 · P2 · local proof keyed by display name

`jobCardsForArea(city.name)` (`job-cards.ts:172`) matches a job's `area`
string to a page's display name. Four of five jobs match (Midtown Toronto,
Forest Hill, Yorkville, Rosedale); "Distillery District" matches no page and
attaches to nothing, though it lies inside Downtown Toronto. Coverage and proof
are correctly separate concepts here (protocol §23); the join is the defect.
Resolution: GEO-002 (proof keyed by market slug, locality allowed).

## GC-022 · twin gap (not a contradiction)

`/corridors`, `/corridors/{id}` and `/where-we-work` have no Markdown twin
and none is advertised (no `alternates.types`, no manifest entry, no llms
reference). No false capability claim. GEO-009 decides whether to generate
them.

## GC-023 · P1 · different staleness windows per surface

| Surface | Cache-Control at the baseline |
|---|---|
| HTML (vercel.json catch-all) | `s-maxage=300, stale-while-revalidate=86400` |
| `/api/v1/*` | `max-age=300, s-maxage=3600, stale-while-revalidate=86400` |
| `/llms.txt`, `/ai.txt` | `max-age=3600, s-maxage=86400` |
| `/llms-full.txt`, `/md`, `/service-areas/{slug}.md` | `s-maxage=86400, stale-while-revalidate=604800` |
| `/sitemap.xml` | `revalidate = 86400` |

A geography change deployed at T can be served as the old geography by the
Markdown twins for up to 8 days while HTML updates in minutes — which would
recreate GC-015 in production after it is fixed in the repository. Whether a
Vercel deployment purges these depends on the deployment; GEO-022 measures it
after a real geography deploy rather than assuming.

---

## Not reproduced from the prior audit

| Prior finding (2026-09-11 audit) | At the baseline |
|---|---|
| `/corridors/buffalo-metro` says "not a service area" | Not in the source; not observed live. Closed before GEO-000. |
| About / Team list = 45 | The build derives 89 on both. Live `/team` observed at 32 or 89 depending on cache-busting (GC-020). |
| 1 of 89 pages is 5/5 | Local proof is a separate gate (protocol §23) and is not re-scored here; job-card attachment measured in GC-021. |

## Verified as correct at the baseline (do not "fix")

- No emitted geographic count is hand-typed (`verify-geo-green` §5 holds).
- No second address, telephone or hours appears for any New York market.
- Every published page has real `CITY_CONTENT` (89 of 89), and the worthiness
  gate refuses template content.
- Sitemap ⇔ route set ⇔ graph `serves` ⇔ llms per-area routing are equal
  (89 = 89 = 89 = 89).
- Every page self-canonicalises to `/service-areas/{slug}` and advertises its
  `.md` twin.
- The stale preview host `ecowoods-app.vercel.app` returns 404 (lead) and
  `vercel.json` 301s the legacy domain.

---

## GC-026 · P0 · the studio prices a New York room in Canadian dollars

GEO-004 closed GC-024 by establishing the rule this repository now holds: a New
York surface shows no Canadian figure and an Ontario surface shows no United
States one. `verify-geo` enforces it on the city pages, the twins, the
OfferCatalog and the FAQ.

Floor Studio was never brought under the rule, and the rule never noticed,
because the guard checks the pages that name a market and the studio names
none.

| Where | What it does |
|---|---|
| `apps/web/lib/floor-studio/catalog.ts:426` | `bandForWork(work)` — `country` left at its `'CA'` default |
| `apps/web/app/components/floor-studio/FloorStudio.tsx:99` | `Intl.NumberFormat('en-CA', { currency: 'CAD' })`, hard-coded |
| `apps/web/app/components/floor-studio/FloorStudio.tsx:589` | the budget field is labelled "optional, CAD" |
| `apps/web/app/floor-studio/page.tsx:117` | the `WebApplication` JSON-LD tells machines the range is "in Canadian dollars" |
| `apps/web/app/components/Header.tsx:68`, `SiteFooter.tsx:247` | link `/floor-studio` from every page, which is all 26 US markets |

A homeowner in Amherst reads a United States band on `/service-areas/amherst`,
clicks "See it in your room" in the header, and is quoted in Canadian dollars
with no explanation. That is two published versions of one fact, which is the
single class of error this log exists to catch.

`bandForWork(work, country)` already takes the argument. Nothing calls it with
one. Closed by GEO-006.

---

## AV-01 · P0 · the renderer paints hardwood over people

`apps/web/lib/floor-studio/render.ts:474` is the entire object-protection
system: a pixel is left alone if and only if its **chroma** differs from the
floor region's mean chroma by more than 0.075. No luminance term, no texture,
no edge, no spatial coherence, no segmentation.

The renderer's own docblock states the intent — "a sofa leg, a rug, a plant pot
inside the quad is not floor and must not be painted over… painting oak across
the cat looks like a toy" — and the implementation does not meet it. It is
conservative against *colour*, which makes it anti-conservative against exactly
the objects standing on a hardwood floor in a hardwood customer's house.

Executed against the real `compositeFloor()` by
`scripts/audit/occlusion.audit.ts`, 14 objects on a known floor inside an honest
quad: **6 painted over, 100% of their pixels** — a jute rug, a human leg, a
golden retriever, an oak stair riser, a wooden table leg, a cardboard box. The
8 survivors are the ones whose hue is not wood: a grey sofa, a charcoal rug, a
plant, a black cat, a white toe-kick, a navy armchair, terracotta, brass.

Consequence beyond the picture: `FloorStudio.tsx:625` warns "a lot of this room
is furniture rather than floor" when `painted < 0.5`. Because wooden furniture
is painted rather than skipped, `painted` stays high in precisely the rooms
where the warning is needed. The safety net is wired to the wrong signal.

Closed by VIS-02.

---

## AV-02 · P0 · `measured` is asserted where it is not true

`room.ts` offers two confidence values and argues, correctly, that a percentage
would be "a claim about a distribution nobody estimated". The argument is right;
the boundary between the two values is wrong.

`scripts/audit/boundary.audit.ts`, six synthetic rooms with a floor plane whose
true coverage is 0.55 by construction:

| Scene | Reported | Coverage | Error | Honest? |
|---|---|---|---|---|
| empty room, oak floor | `measured` | 0.551 | 0% | yes |
| dark walnut floor | `measured` | 0.551 | 0% | yes |
| **with a large pale area rug** | `measured` | 0.153 | **72%** | **no** |
| with a sofa | `measured` | 0.551 | 0% | yes |
| **rug + sofa (a real living room)** | `measured` | 0.153 | **72%** | **no** |
| shot from a doorway (angled) | `measured` | 0.417 | 24% | yes |

The estimator is excellent on an empty room and wrong by 72% the moment there is
a rug, because a rug collapses the colour run exactly the way a wall does and
the algorithm cannot tell them apart. `weak` fires only on degeneracies — an
image under 8px, a run that never collapses, a far edge under a fifth of the
frame — and never on the common case.

So the screen headed "We found your room" says `measured` to a visitor whose
floor has been cut to a sixth of its real size, and the copy inviting a
correction is undercut by the label that has just said none is needed.

Closed by VIS-03.

---

## NAV-03 · P0 · three navigation surfaces, two of them lying

`verify-navigation` measures DEPTH and passed at the baseline: every public
route within three clicks. It reads Header.tsx and SiteFooter.tsx, and both were
honest. The surface it does not read is the one that was wrong.

### The palette navigated by scrolling to an id that was not there

`CommandPalette.tsx` shipped its own navigation, written when this site was one
page:

```ts
const go = (hash: string) => () => {
  close();
  document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(null, '', `#${hash}`);
};
```

Six ids — `services`, `process`, `reviews`, `faq`, `quote`, `gallery`. All six
are rendered by `home-client.tsx` and by nothing else:

```
$ for id in services process reviews faq quote gallery; do grep -rl "id=\"$id\"" apps/web/app; done
services   Header.tsx  home-client.tsx
process    services/[slug]/page.tsx  home-client.tsx
reviews    home-client.tsx
faq        services/[slug]/page.tsx  pricing/page.tsx  home-client.tsx
quote      home-client.tsx
gallery    home-client.tsx
```

So on 46 of 47 public routes the optional chain swallowed a null, nothing
scrolled, the dialog closed — and `replaceState` ran anyway, rewriting the
address bar to a fragment matching nothing on the page. **Six of thirteen
actions, silently dead, everywhere but the homepage.** A control that does
nothing is worse than a missing control: the visitor concludes the site is
broken and stops using the mechanism.

### And it could not reach the site

Beyond the six anchors it knew `/design`, and that was all. Not Floor Studio,
`/pricing`, `/service-areas`, `/corridors`, `/estimate`, `/guides`, `/papers`,
`/case-studies`, `/quote-check` or `/framework` — the pages a visitor is most
likely hunting when they reach for ⌘K in the first place.

### Two pages were footer-only

| Route | What it is | Where it appeared |
|---|---|---|
| `/pricing` | the three published bands — the source every other surface links to when it names a number | footer only |
| `/where-we-work` | every published job, each linked to what was measured — the first-party proof page | footer only |

Neither is a duplicate of anything: `/service-areas` is where we will go,
`/corridors` is how we get there, `/where-we-work` is where we have been. The
one carrying the evidence was the one no menu named.

### The fix

The menus moved to `apps/web/lib/navigation.ts` — no `use client`, no React —
and the three surfaces project it: desktop panels, mobile drawer, and a ⌘K whose
destination list is **derived** rather than written. A page added to a menu is
searchable the same commit and cannot be forgotten, because nobody has to
remember.

`go()` now takes an href. A fragment on the current page still scrolls; anything
else navigates. The palette's resting state stays short — the assistant, six
high-intent destinations, the phone — and the first keystroke opens the whole
corpus, so completeness costs nothing at rest.

One widening edit, disclosed: `scripts/verify-navigation.mjs` `CHROME` gained
`apps/web/lib/navigation.ts`, because the guard reads strings and the strings
moved. It loosens no rule and `MAX_DEPTH` is untouched. Chrome link count 43 →
44 after the move, with `/pricing` and `/where-we-work` added.

---

## VIS-02 · P1 · five pages shared one share card

`verify:images` passed and was right about what it checks: no slot declared,
bundled and sitemapped without a page drawing it. What it does not check is the
image a page hands to WhatsApp, iMessage, Slack, LinkedIn and every crawler that
reads Open Graph.

Measured across 55 public routes: 24 declared `openGraph.images`, 31 did not.
Most of the 31 are correct to inherit the default. Five were not, and each one
carried a full `openGraph` block — title, description, type, url — with the
`images` key simply absent:

| Page | What it is |
|---|---|
| `/hardwood-flooring-toronto` | the installation head term |
| `/hardwood-floor-refinishing-toronto` | the refinishing head term |
| `/hardwood-stairs-toronto` | the stairs head term |
| `/hardwood-floor-problems-toronto` | the problems head term |
| `/floor-studio` | the flagship feature |

So sharing the most commercially valuable page on this site produced a card
identical to sharing the privacy policy. VIS-01 gave nine pages their own card
and stopped; these five were the ones that needed it most.

Five cards drawn in the same language as those nine — cream `#FAF7EF`, the
brand's dark, green and copper, subject in the left forty percent, right third
left empty because the platform lays its own title over it. One idea each:
staggered courses with a copper starting course; three abrasive passes into a
clean finish bar; a four-step section with treads picked out from risers; five
board cross-sections on one subfloor line; a floor plane in perspective with
chevron laid into it and a handle at each corner.

Checked by brace depth on all five that `images` is a DIRECT child of
`openGraph` rather than nested — that is the VIS-01a bug and it cost a build.

`verify:images` after: 162 slots, 162 on disk, 0 pending, 0 orphans.

---

## TREE-01 · P1 · the article tree had a parent the menu never named

Not a duplicate page. A wing of the tree with no door on the map.

| Page | What it says it is | Where it appeared |
|---|---|---|
| `/resources` | "Everything we publish, organised by what you are trying to do" | the Reference column of the Library menu |
| `/technical-library` | "The engineering reference behind our work" | no menu at all |

Those are different jobs, and both are worth having. But `ArticleLayout.tsx:29`
makes `/technical-library` the breadcrumb parent of EVERY article, `sitemap.ts`
gives it priority 0.95, and `/resources` links down to it as a sub-item while it
links back to nothing. A visitor following a breadcrumb up from an article
landed on a page the navigation could not show them the position of.

The Reference column now names both, with notes that say which is which. Same
fix as UI-NAV-02 made for /floor-studio and /design, for the same reason: the
labels alone read as duplicates and the notes do not.

WHAT WAS MEASURED AND FOUND CLEAN

Prose from all 58 public route templates, normalised and compared as 4-word
shingles. Highest overlap between any two pages: 12.6%, `/guides/[slug]` against
`/services/[slug]` — shared breadcrumb, CTA and next-step rail, not shared
content. No identical title except the notFound fallback. No identical meta
description. No pair of pages on this site tells the same story.
