# The strategy layer

Three registries and one number. Each says something about this site that stops
being true the moment a route is renamed, a page retires, or an event stops
firing — so each is checked by `pnpm verify:strategy` on every build, and none
of them is allowed to assert anything the repository cannot back.

| Registry | File | What it asserts |
|---|---|---|
| Funnels | `apps/web/lib/funnels/index.ts` | Six intents, the tool that serves each, the event that completes it, and what its visitor is **not** ready for |
| Tracked questions | `apps/web/content/aeo/queries.ts` | 33 questions people ask an answer engine, each mapped to the page that answers it — or declared as a gap |
| Expansion score | `apps/web/lib/geo/worthiness.ts` | Which Ontario market is worth reaching next, from what is known — and the ten economic inputs that are not |

---

## 1. Funnels — six, not one

Every page on this site used to end the same way: *book a free measure*. That is
correct for exactly one of the six reasons somebody arrives here. A homeowner
halfway through comparing three quotes is not refusing to book; they have not
decided, and a booking button at that moment reads as not having listened.

| Funnel | Intent | Tool | Completes on | Not yet ready for |
|---|---|---|---|---|
| `problem` | Something is wrong and I don't know what | `/hardwood-floor-problems-toronto` | `photo_triage_submit` | A price |
| `decision` | Refinish or replace? | `/guides/reference-refinishing-existing-hardwood` | `quote_start` | A booking |
| `price` | What does this cost? | `/pricing` | `quote_start` | A fixed number |
| `evaluation` | I have quotes — is this fair? | `/quote-check` | `quote_review_submit` | Our own quote |
| `design` | What should this floor look like? | `/design` | `quote_start` | Substrate detail |
| `purchase` | I want Ecowoods to do the work | `/estimate` | `quote_submit` | Nothing — get out of the way |

`<NextStep route="…" />` reads `ROUTE_FUNNEL` and renders the one call that
matches. A route absent from that map renders nothing and keeps the generic
chrome CTA — correct for a page whose visitor could be anyone. A page whose own
route *is* the funnel's next step also renders nothing, because a band telling
someone to visit the page they are reading is noise.

**The guard.** `verify:strategy` fails the build when a funnel's completion event
exists only in the `AnalyticsEvent` union and nothing emits it. That funnel would
report 0% forever and read as a broken page rather than a missing instrument.
It also fails when a route in `ROUTE_FUNNEL` renders no `<NextStep>` — a funnel
that lives only in `lib/` is a strategy document the visitor never sees.

---

## 2. Tracked questions — the AI visibility number

`apps/web/content/aeo/queries.ts` holds 33 questions across five families
(diagnostic, decision, commercial, evaluation, professional), each with the route
that answers it or `coverage: null` — a **declared gap**. Two gaps are declared
today: Burlington and Hamilton cost pages.

The score is produced from observations a person made, never scraped:

```bash
pnpm aeo:score --template          # writes audit/aeo/YYYY-MM.json to fill in
pnpm aeo:score                     # scores the newest month on file
pnpm aeo:score --month 2026-10
```

Ask the 33 questions cold — new session, no history — on each engine once a
month and record whether the answer **named or linked ecowoods.ca**. Not
"mentioned the topic". Not "would probably have". Named it.

The script deliberately does not query the engines. Automating them is governed
by their terms, and a scraped number would be precise and dishonest: an answer
engine's response depends on who is asking, from where, in what session, on what
day. Thirty-three questions asked by a person once a month gives a coarse honest
number, and the trend in a coarse honest number is worth more than the level of a
precise dishonest one.

The report names the competitors cited instead of us, and — the most useful line
in it — the questions this site **answers** and is cited for by nobody.

`AEO_QUERY_SET_VERSION` exists so that a month-over-month comparison is like
with like. Changing the question set bumps it.

---

## 3. Expansion score — a ranking that says what it does not know

`expansionOrder(MARKETS)` ranks every Ontario market out of 100 from four
components this repository can actually source:

- **routing** (max 30) — corridors the market sits on. A junction is worth more than a terminus.
- **adjacency** (max 24) — neighbours whose operational position is confirmed.
- **confirmation** (26) — a confirmed position, on a date. Zero without one.
- **evidence** (max 26) — real local content, a signature project, local facts.

It carries `missing`: the ten economic inputs the brief asks for and this
business does not hold — population, household income, home values, housing age
profile, hardwood prevalence, renovation spend, search demand and CPC,
competitive intensity, travel time from the shop, historical project value. They
are named in the payload of `/api/v1/markets` rather than estimated, because a
ranking that quietly includes a population figure nobody sourced is a ranking
that directs capital on a number somebody typed. `verify:strategy` fails the
build if any of those five field names is ever assigned a literal number in
`worthiness.ts`.

**On 2026-09-10 the owner confirmed all 43.** Every Ontario market now carries a
dated operational position and `verifiedBy: 'owner'`, so nothing scores zero on
`confirmation` and nothing is excluded from the service area. They are not all
the same coverage: 28 are inside the daily-return radius (13 core-active, 15
active-expansion), and 15 — the far Niagara belt, the 403/6 run to Kitchener,
the north end of the 400, Kawartha Lakes — are scheduled as a trip and say so in
their own sentence.

`verifiedBy` exists so that one fact is never read as another. An owner's
confirmation of coverage and a photographed job in that municipality are
different things; the API reports them in different fields, and
`verify-geo.mjs` fails the build if a confirmation appears without an
attribution, or if a status and a confirmation ever disagree in either
direction.

**The bottleneck moved, it did not disappear.** 27 confirmed markets still have
no local content, so none of them has a page — `worthiness.ts` requires real
content independently and confirming coverage was never going to conjure it.
Every one of those rows now reads *"Write local content from a real job here.
The page appears automatically once it exists."* That is one photographed job
and two real paragraphs per market, and it is worth more than any further code
in this layer.

---

## 4. `/api/v1/framework`

The Well-Installed Framework as citable, versioned data: every pillar, every
criterion, its risk, its severity, and the paper section behind it. Licensed
CC BY, no auth, no key. An assistant that reads it can quote a criterion by id
— *"Well-Installed Framework v1.0, criterion 1.3"* — and that id is permanent.

It also publishes what the framework **refuses** to do, which is the part a
competitor's marketing page cannot copy: no criterion scores a named company,
and no criterion exists without a published paper section behind it.

---

## Running it

```bash
pnpm verify:strategy    # the seven checks above
pnpm verify             # all 63 guards, in parallel, ~5s
pnpm aeo:score          # the monthly number, from audit/aeo/
```
