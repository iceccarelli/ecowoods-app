# The photo queue

Internal. Not rendered on any page, and deliberately so — a live page that
apologises for a missing photograph is worse than the same page without one.

## The slot already exists

`CityContent.signatureProject` is the field. It is the only field in that type
that asserts a specific job, it is `undefined` in all forty-five published
areas, and `scripts/verify-cities.mjs` fails the build if one is written that
reads as a claim without a job behind it. When a photographed job exists, the
paragraph goes in that field and the page gains a proof block. Nothing else has
to change: the page, the metadata, the schema, the sitemap entry, the `.md`
edition and the API record are already live.

So this is not a list of unfinished pages. Every market below has a finished
page today. This is the shot list that upgrades each one from *"here is what
this housing stock needs"* to *"here is that work, in this town."*

## What each entry means

**Housing type** — the stock the page already describes, so the photograph and
the prose are about the same building.
**Floor** — the condition the page names.
**Two shots, minimum** — one room-scale frame that shows the space, one detail
frame at 300mm or closer that shows the surface. Both after; before-and-during
are worth more than either alone.
**Matches** — the sentence already published that the photograph has to be true
to. If the job on site does not match, the photograph is still worth taking and
the sentence gets rewritten to it.

---

### Burlington
- **Housing type:** post-war or 1950s–70s detached, Aldershot / central / Roseland.
- **Floor:** original narrow-strip red oak lifted from under broadloom.
- **Shots:** the room with the carpet up and the tack strip still down; a detail of the perimeter damage and the cupping at a seam.
- **Matches:** *"spent decades under broadloom, which protects the wear layer but hides cupping, pet damage and old water staining until the carpet lifts."*

### Hamilton
- **Housing type:** pre-1930 lower-city brick — Durand, Kirkendall, Strathcona, Crown Point.
- **Floor:** narrow-strip hardwood over plank subfloor with board loss at a removed partition.
- **Shots:** the piecing-in before sanding; a detail of the feathered join once finished.
- **Matches:** *"board loss around removed walls and old radiator penetrations that have to be pieced in and feathered before any uniform finish is possible."*

### Grimsby
- **Housing type:** older core house below the escarpment brow, or a lakeside build.
- **Floor:** original softwood or early strip hardwood needing board replacement.
- **Shots:** replacement boards in place before finish; a detail of the grain match.
- **Matches:** *"houses on the lake side hold summer humidity longer than those above the brow, which shows up as seasonal gapping."*

### Barrie
- **Housing type:** 1990s–2010s subdivision detached, or an older house near the bay.
- **Floor:** builder-grade strip oak thin on wear layer, or a nail-down install over corrected plywood.
- **Shots:** the flatness correction in progress; a detail of a finished long run.
- **Matches:** *"flatness accepted for carpet has to be corrected before a nail-down floor goes in."*

### Niagara Falls, Ontario
- **Housing type:** older centre or Chippawa, pre-war to early post-war.
- **Floor:** strip hardwood over plank with old heating-run patches.
- **Shots:** the patch before sanding; the same area finished.
- **Matches:** *"board loss at removed partitions and old heating runs that has to be pieced in before a uniform sand."*

### Milton
- **Housing type:** post-2000 subdivision detached — Hawthorne Village, Scott, Willmott.
- **Floor:** carpet-to-hardwood conversion over engineered joists.
- **Shots:** subfloor preparation before the first board; the finished open-plan run.
- **Matches:** *"the flatness a builder signed off for carpet is not the flatness a nail-down floor needs."*

### St. Catharines
- **Housing type:** Old Glenridge / Yates Street heritage, or post-war north of the canal.
- **Floor:** original hardwood already sanded at least once — thickness measured, not assumed.
- **Shots:** the depth gauge at the tongue; the finished floor in the room.
- **Matches:** *"the first measurement is remaining thickness rather than the finish system."*

---

## The other half of the queue: four census figures

Separate from photography and just as mechanical. For each Tier-1 and Tier-2
market, four numbers with the URL they came from and the date retrieved:

| Figure | Canada | United States |
|---|---|---|
| median household income | StatCan Census Profile | ACS 5-year, S1901 |
| median dwelling value | StatCan Census Profile | ACS B25077 |
| share built before 1980 | StatCan period of construction | ACS B25034 |
| share single-detached | StatCan structural type | ACS B25024 |

They go into `apps/web/content/geo/market-inputs.ts` as `MARKET_INPUTS`, each
with `source: { title, url, retrievedAt }`. `pnpm verify:inputs` refuses any
value without one. Four figures across eight markets takes the opportunity model
from 10% confidence to 55% and turns every `UNSCORED` classification into a real
one.
