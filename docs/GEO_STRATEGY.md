# The corridor: Toronto → GTA → Hamilton → Niagara → Buffalo → Rochester

**101 markets. 75 Ontario, 26 New York. 89 published pages. Eleven corridors.**

Every market in the model is published. Every published page carries its own
local content — housing stock and substrate in that market's own terms — above a
floor the build enforces. `pnpm verify:geo:green` fails if any of it disagrees
with any other surface.

```
ECOWOODS GEO GREEN AUDIT
=========================
Markets in registry:              101  (75 Ontario, 26 New York)
Published service-area pages:      89
Areas with local content:          89
Areas with no market record:        0
Orphans (no corridor):              0
Retired statuses in shipped code:   0
Hardcoded territory counts:         0
Second address or telephone:        0
GREEN GATE: PASSED
```

## New York State, and the line that did not move

On 2026-09-10 the owner confirmed cross-border licensing and crew work
authorization. Twenty-six western New York municipalities became service areas
on the same terms as every Ontario one: a page, local content, a sitemap entry,
`areaServed`, a markdown twin, an API record and corridor membership.

The status `us-proxy` — *advertising reach, never service area* — is gone from
the type, from every guard, from the API and from the copy. It was the correct
architecture for a company with no United States position and the wrong one from
that date.

**What did not change:** there is one shop and one showroom, at 32 Norfield
Crescent in Toronto, one telephone number, one set of hours, one set of price
bands and one set of reviews. None of them appears on any page as a local United
States fact. Three guards enforce it — `verify:geo`, `verify:allocation` and the
green gate all fail the build if a second address or a non-Toronto telephone
number appears anywhere in the geography.

Every New York page says the same two things above everything else:

> **Ecowoods serves {city}. Book the measure.**
> **The showroom is Toronto. The job is in {city}. We take this work.**

## The depth budget

70/20/10 is how hard a page is worked, not whether it exists. The Toronto luxury
mesh carries the full anatomy; the QEW belt carries the standard one; the Niagara
hinge and western New York carry a tight complete matrix — all six services, the
booking path, the schema and the sitemap entry, on every page in every tier.

`MIN_MEAN_DEPTH` is read from the corpus rather than chosen: the floor sits just
under the tightest published page, so it fails a genuine regression without
retroactively condemning pages that shipped and rank.

## 1. The geographic map

### Ontario — 61 markets, all confirmed 2026-09-10

**Toronto core** (13 records: the city, six districts, six surrounding cities at
`core-active`)
Toronto · Downtown Toronto · North York · Etobicoke · Scarborough · East York ·
York · Mississauga · Brampton · Vaughan · Markham · Richmond Hill · Oakville

**Toronto neighbourhoods** (16 records, `kind: district`, all with published pages)
Rosedale · Forest Hill · Yorkville · Leaside · The Annex · High Park · Riverdale ·
Leslieville · The Beaches · Lawrence Park · Cabbagetown · Swansea ·
Davisville Village · Midtown Toronto · King West · Liberty Village

> These have had pages and local content since F-157 was resolved. What they did
> not have until now was a record in the geographic model, which meant the
> corridors, the API, the expansion score and the allocation audit could not see
> the sixteen highest-intent pages on the site. They enter as **districts of
> Toronto**, never municipalities — `serviceAreaMarkets()` filters to
> municipalities and the entity graph derives `areaServed` from that, so a
> neighbourhood arriving as a municipality would declare Rosedale a city of
> Ontario alongside Mississauga. It is not.

**Halton / Peel / York / Durham** (`active-expansion`)
Milton · Burlington · Halton Hills · Caledon · Whitby · Oshawa · Aurora ·
Newmarket · Pickering · Ajax

**Hamilton** (`active-expansion`) — Hamilton · Ancaster · Dundas · Stoney Creek ·
**Waterdown** *(added: Tier 3 of the brief, a community of the City of Hamilton)*

**Niagara belt** — Grimsby (`active-expansion`), then Lincoln · **Beamsville**
*(added)* · St. Catharines · Thorold · Welland · Niagara-on-the-Lake ·
Niagara Falls ON · Port Colborne · Fort Erie, all `travel-by-confirmation`

**403 / Highway 6 west** — Guelph · Cambridge · Kitchener, `travel-by-confirmation`

**North and east edge** — Barrie · Innisfil · Clarington · Kawartha Lakes,
`travel-by-confirmation`

### New York — 15 markets, every one `us-proxy`

**Erie County / Buffalo metro** (new corridor `buffalo-metro`)
Buffalo · Amherst · **Williamsville** *(village in Amherst — district)* ·
Clarence · Cheektowaga · Tonawanda · **Kenmore** *(village in Tonawanda —
district)* · Grand Island · Orchard Park · Hamburg · East Aurora

**Niagara County** (`buffalo-niagara`, the one corridor that crosses the border)
Niagara Falls NY · Lewiston · North Tonawanda · Lockport

> Nine of these fifteen are new, and the brief's Tier US-1 and US-2 are now
> complete. Not one of them can hold a page, enter the service area, or be
> classified above `FUTURE`. Three independent guards enforce that, and a test
> asserts that exactly one corridor contains both countries.

### Ten corridors

| Corridor | Hub | Markets |
|---|---|---|
| `core-gta` | Toronto | 8 |
| `400-north` | Vaughan | 5 |
| `401-east` | Toronto | 7 |
| `407-york-peel` | Vaughan | 6 |
| `qew-west` | Mississauga | 6 |
| `403-6-west` | Hamilton | 6 |
| `niagara-belt` | Grimsby | 9 |
| `buffalo-niagara` | Fort Erie | 10 — the only cross-border route |
| `buffalo-metro` | Buffalo | 11 — entirely American, a map of demand, no Ecowoods drive on it |
| `cottage-north-east` | Barrie | 3 |

---

## 2. The market scoring model

`/api/v1/opportunity` publishes the brief's ten weighted inputs, exactly as
specified:

| Weight | Input | Where it comes from |
|---:|---|---|
| 20 | purchasing power | StatCan Census Profile · ACS S1901 |
| 15 | housing values | StatCan · ACS B25077 |
| 10 | housing age | StatCan period of construction · ACS B25034 |
| 10 | detached prevalence | StatCan structural type · ACS B25024 |
| 10 | renovation potential | municipal permit open data · CMHC · Building Permits Survey |
| 10 | hardwood opportunity | no public dataset; a recorded proxy with its method written down |
| 10 | search demand | Keyword Planner · Search Console impressions |
| 5 | competition | a dated SERP observation |
| 5 | **logistics** | **computed** from status and hub |
| 5 | **corridor value** | **computed** from corridor membership |

**Every market currently returns `score: null`, `confidence: 0.10`,
`classification: UNSCORED`.**

That is the model working, not failing. Two of the ten inputs are computable
from facts this repository holds. The other eight are census tables and keyword
figures nobody has opened yet. A score of 78 built from a typed guess and a
score of 78 built from the census look identical, rank markets identically, and
send a season's work to the wrong municipality identically — the difference only
surfaces afterwards.

So: a value requires a `source` with a URL and a retrieval date, there is
deliberately no "estimate" flag, and `score` is withheld entirely until 60% of
the weighting is sourced — above the 10% that logistics and corridor value
contribute, so no market can ever be promoted to DOMINATE on highway access.
`partialScore` is published for ordering the queue and is never a ranking.

**Filling this in is an afternoon's work per tranche and it is the single
highest-leverage thing left.** One census table for the eight Tier-1 and Tier-2
markets moves confidence from 10% to 30%; income, values, age and detached
prevalence together reach 55%; add search demand and the model starts
classifying.

---

## 3. What is enforced, not merely intended

| Guard | Refuses |
|---|---|
| `verify:geo` | a coverage claim with no dated confirmation; a status and a confirmation that disagree; a district declaring its own corridors; a US market in the service area |
| `verify:allocation` | Canada below 70% of the model; a us-proxy market holding a page; the service-area filter being loosened |
| `verify:inputs` | a score with no source URL and retrieval date; weights that do not sum to 100; a confidence gate at or below the computed share; a US market classifiable above FUTURE |
| `verify:strategy` | a funnel whose completion event nothing emits; a tracked question pointing at a 404; a route with no intent-matched call |
| `verify:cities` | a service area losing its local content |

Each shipped with regressions that were run and observed to fail.

---

## 4. What is published

**Forty-five service-area pages, every one with its own local content.** No page
in the set renders a generic paragraph with a place name substituted in;
`pnpm verify:cities` fails the build if one ever does.

**Municipalities — 24.** Toronto's six districts (Downtown, North York,
Etobicoke, Scarborough, East York, York), Vaughan, Markham, Richmond Hill,
Mississauga, Oakville, Brampton, Aurora, Newmarket, Pickering, Ajax — and now
**Milton, Burlington, Hamilton, Grimsby, St. Catharines, Niagara-on-the-Lake,
Niagara Falls and Barrie.** These, and only these, are schema.org `City` nodes
in `areaServed`.

**Toronto neighbourhoods — 16.** Rosedale, Forest Hill, Yorkville, Leaside, The
Annex, High Park, Riverdale, Leslieville, The Beaches, Lawrence Park,
Cabbagetown, Swansea, Davisville Village, Midtown, King West, Liberty Village.
Pages, never `City` nodes: each is emitted as a `Place` contained in Toronto.

**Communities within a municipality — 5.** Ancaster, Dundas, Stoney Creek and
Waterdown, each a `Place` contained in Hamilton; Beamsville, a `Place` contained
in Lincoln. The containing city is read from the record rather than assumed, so
Beamsville is not published as a neighbourhood of Toronto.

Every one of the eighteen Canadian markets in the first-release brief is live.

### What each new page carries

Four layers, in the voice the existing fifteen set:

1. **Housing stock.** What was built here and when — period, form, typical
   subfloor, typical original floor. Publicly checkable, no figures this site
   does not publish.
2. **The floor that belongs here.** Which construction the stock actually takes:
   nail-down solid over plywood, glue-down engineered over slab, refinish
   against replace when the original strip has been under carpet for forty
   years — and the measurement that decides it.
3. **The work.** What the job is on this stock: levelling against accepting the
   plane the house has settled into, board replacement in kind, remaining wear
   layer above the tongue, acclimation to the room rather than to a delivery
   date.
4. **Corridor fit.** Where the market sits on the drive, and — for the
   travel-by-confirmation markets — that a job there is scheduled as a trip,
   confirmed in advance, and priced with that in the written quote.

`signatureProject` is undefined on all forty-five, exactly as it was on the
first fifteen. It is the one field that asserts a specific job. The shot list
that fills it is `docs/PHOTO_QUEUE.md`.

## 5. Expansion roadmap — the next markets, in order

Ranked by what this repository can defend today: confirmed position, corridor
centrality, neighbour coverage, and published evidence. It is deliberately not
ranked by the economic model, which is at 10% confidence and says so.

**Next pages — confirmed markets with no local content yet (16):**
Whitby · Oshawa · Clarington · Halton Hills · Caledon · Innisfil ·
Kawartha Lakes · Lincoln · Welland · Thorold · Port Colborne · Fort Erie ·
Guelph · Cambridge · Kitchener · Toronto (the city record; its commercial pages
carry the local content today)

Each takes the same four layers as the eighteen already published. None is
blocked on anything.

**Never, without the business first establishing a United States presence:** any
Buffalo or western New York page.

**The two queues that upgrade what is already live**, both in
`docs/PHOTO_QUEUE.md`:

- **Seven photographs.** Burlington, Hamilton, Grimsby, Barrie, Niagara Falls
  ON, Milton, St. Catharines. Each brief names the housing type, the floor
  condition, the two shots, and the sentence already published that the
  photograph has to be true to. The slot is `signatureProject`; the page is
  already live around it.
- **Thirty-two census figures.** Four per market across the eight Tier-1 and
  Tier-2 markets, each with its source URL and retrieval date. That takes the
  opportunity model from 10% confidence to 55% and turns every `UNSCORED`
  classification into a real one.
