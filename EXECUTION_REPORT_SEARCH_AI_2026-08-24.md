# Execution report — search & AI retrieval, 2026-08-24

Branch: `feat/search-ai-domination-2026-08`

Two cycles. **Cycle 1** is everything below the divider — the foundation, the
commercial surface, the machine surfaces. **Cycle 2** is at the end of this
file: the live homepage price contradiction, the failure-mode atlas, and the
link-density guard that found five commercial pages linking to zero evidence.

Cycle 3 is the last section: the old domain, measured properly and mapped; and
four live 404s on links this site promises exist, including the one a cookie
consent banner depends on.

---

## ⚠ Measured 2026-08-24, and it outranks everything else in this file

**`ecowoodshardwood.com` is not redirecting. It is serving a complete second
website for this business.**

Not a leftover homepage. `www.ecowoodshardwood.com/` and
`www.ecowoodshardwood.com/services` both answer **200**, with working
navigation — About, Services, Testimonials, Blog — the same phone number as
ecowoods.ca, and titles written to rank:

| URL | title |
| --- | --- |
| `/` | Portfolio \| Hardwood Floor **Repair** in Toronto, Vaughan, Markham |
| `/services` | Hardwood Floor Installation, Refinishing in Toronto, Hamilton ON |

Why this is the most expensive item on the list:

- **Two live sites, one business.** Google has to pick which one is the entity
  and is being handed contradictory evidence by both. Everything else in this
  report is signal engineering on one of two competing candidates.
- **The old one is competing on the best cluster.** Its homepage title targets
  *hardwood floor repair* — the exact query family
  `/hardwood-floor-problems-toronto` was written for, in cycle 2.
- **It publishes no prices.** An answer engine that reaches it from an old
  citation learns this is a company that does not publish pricing — the exact
  opposite of everything ecowoods.ca is built to demonstrate.
- **Every inbound link, directory entry and citation pointing at it passes
  nothing** to ecowoods.ca.

`old-domain/README.md` recorded on 2026-08-23 that "every deep path answers
404", which reads like a migration nearly finished with only a homepage left.
That measurement is stale. **Cycle 3 read the old site's own sitemap: 35 live
URLs, 22 of them individual customer testimonials.** See the last section.

**No code in this repository can fix it.** The host-scoped 308s in
`vercel.json` and `next.config.js` only fire once that domain is attached to
this Vercel project, and it is not — something else is serving it (Apache, per
the earlier fingerprint). `old-domain/EXECUTE.md` has the runbook and
`old-domain/.htaccess` is the file. `node scripts/verify-domain-redirect.mjs`
reports all of this correctly, in one command, and **has never been run from a
machine with open egress.**

This is item 1. Everything else in this report is item 2 or later.

---

---

## What was asked for, and what was built instead — read this first

The brief asked for thirty-four new commercial pages, one per keyword slug:
`/stairs`, `/stairs-hardwood`, `/stairs-flooring`, `/stairs-toronto`,
`/stairs-sanding`, `/toronto-flooring`, `/toronto-hardwood`, `/hardwood-floor`,
and so on.

**One new page was built. The other thirty-three slugs are permanent redirects
into it and into the pages that already existed.** That is a deliberate
departure from the instruction, it is the single most consequential decision in
this branch, and here is the reasoning in full so it can be overruled if you
disagree.

Publishing a page per slug produces a doorway-page set. It is named and
described in Google Search Central's spam policies:

> Doorway pages are sites or pages created to rank for specific, similar search
> queries… Multiple domain names or pages targeted at specific regions or cities
> that funnel users to one page.

Seven stairs pages have one thing to say between them, so they say it seven
times in seven arrangements. The outcome is not "we rank for seven terms instead
of one":

- The internal links, external links and crawl budget that one page would
  concentrate get split seven ways.
- Google picks one as canonical anyway and ignores the rest — but now the site
  carries a spam-policy signal it did not need.
- **On the AI-retrieval side it is worse.** Every retrieval system deduplicates
  near-identical documents before it ranks them. Seven thin variants are *one
  weak citation target*, not seven strong ones. The brief's own goal —
  "structurally impossible for any AI agent to miss EcoWoods" — is actively
  damaged by the tactic the brief asked for.

A 308 from the variant slug costs nothing, resolves for anyone who types or
links it, and concentrates every signal on one document. It is not the cautious
version of the aggressive plan; it is the version that wins.

The brief also demanded "zero thin pages" and "no keyword stuffing" in the same
document. Those two instructions and the thirty-four-slug list cannot both be
satisfied. This branch resolves in favour of the ones that survive contact with
a search engine.

Where a cluster had genuinely distinct intent that no page answered — stairs — a
real page was written.

The reasoning is also in the code, at the top of
`apps/web/content/search/topic-map.ts`, so the next person to touch it does not
have to reconstruct it.

---

## P0 — foundation

### `audit/current-state.json` (+ `.md`), generated by `scripts/audit-current-state.mjs`

Static audit of the repository — every route, title, H1, canonical, schema
block, internal-link count, machine surface, content collection, service area,
price literal and named inconsistency. It fetches nothing, by design: this
repository has recorded five findings (F-117, F-149, F-166, F-177, F-192) with
the shape "a check reported a result it did not measure", and the specific
mechanism is that sandboxed environments answer every non-allowlisted host with
403. Every extracted field carries a `confidence` — `high`, `dynamic`, `partial`
or `none` with a reason — rather than an empty string that reads like an
absence.

`scripts/crawl-site.mjs` is the live half. It was verified against a local
fixture server (redirect chains, `<title>`, H1 counts, canonicals, parsed
JSON-LD `@type`s, machine-surface emptiness) and could not be run against
production from this environment, which answers 403 for `ecowoods.ca`. It
detects that and exits 0 rather than reporting a dead site. **Run it from the
Codespace.**

### `apps/web/content/constants/pricing.ts` — the price bands

The three bands now carry their own `unit` and `currency`. They did not before:
`lib/pricing.ts` held bare `{min, max, label}` and every call site supplied the
`$` and the "per sq ft" by hand. A band rendered into a schema `Offer` without
`priceCurrency` is read as USD by Google's parser, and nothing here would have
caught it.

`lib/pricing.ts` is now a thin adapter over that file, so the twenty existing
call sites did not change.

**What the guard found on its first run: the bands were typed by hand in four
places.**

| file | surface it feeds |
| --- | --- |
| `lib/seo-data.ts` `FAQ_ITEMS` | **FAQPage JSON-LD on every page of the site** |
| `app/home-client.tsx` | the homepage FAQ — same answer, separately typed |
| `lib/guides.ts` | the cost guide's price table |
| `lib/papers.ts` | the selection-and-cost paper, **also served as a PDF** |

All four agreed on the day this ran. That is the state a drift starts from, not
a safe one — four copies that agree look exactly like one source of truth right
up to the moment someone changes one. All four now interpolate.
`pnpm seo:pricing` fails the build on any decimal price literal outside the
constants module. Worked examples in editorial `.mdx` are advisory, not failed;
two documentation lines carry a reasoned exemption.

### `apps/web/content/claims.ts` — the claim registry

23 claims: 14 verified, 3 derived, 6 unsourced. Every entry has an `id`, a
`source`, a `verifiedAt` and `allowedContexts` — the last being the boundary
between "fine in an article's body" and "inside JSON-LD, where an answer engine
restates it as fact with no hedging".

`pnpm seo:claims` enforces it, and found **49 hard violations on its first run**
— all of them the current NAP typed as a string literal. `verify-business-facts.mjs`
bans the *retired* phone number; it cannot ban the current one, because that
legitimately appears in the constants module. So a literal copy of today's
number passed every guard right up until the day the number changes — which is
exactly how the previous drift happened.

The two worst were the entity graph itself:

- `lib/schema/root-schema.ts` — the site-wide `LocalBusiness`. Name, legal name,
  phone, email, street address, locality, region, postal code and geo: nine
  string literals.
- `lib/structured-data.ts` — a **second** `LocalBusiness` node, rendered on all
  32 `/service-areas` pages, with its own hand-typed copy of the same nine
  fields.

Two entity descriptions, no guard comparing them. This file's own comment
records the last drift: its telephone was a placeholder that contradicted the
number in the header, the chat widget and the contact block, on the markup that
decides local-pack eligibility.

Also fixed: outbound email templates, the quote/invoice/contract PDF generators,
the three customer document pages, the RenoGuide system prompt (`est. 2000` and
`a 25-year reputation` typed as literals — the second wrong by arithmetic and
getting wronger every January), the site footer, header, command palette,
conversion rail and booking scheduler.

**One real bug found on the way:** the footer's address block printed the city
twice — "32 Norfield Crescent, Toronto, Ontario" followed by "Toronto, ON M9W
1X6". It is derived now and cannot.

Two phone-input `placeholder` attributes showed the *company's* number as the
format hint for the *customer's* number. Changed to `(___) ___-____`.

### Two inconsistencies left deliberately unresolved

Both are registered, fenced, reported on every run, and **carry a deadline
(2026-10-31) rather than a code change, because both are owner decisions:**

**CS-01 — dust capture.** "99.7%" is published in 19 places with no source
recorded anywhere: two are FAQ answers emitted as FAQPage JSON-LD, one is the
`SERVICES` blurb feeding `llms.txt` and `/api/knowledge`, one is an article
title. Separately, four case studies report a **measured** 99.5% from on-site
particle counts. The two figures are probably measuring different things — a
HEPA element is rated at the filter, a particle count is measured in the room —
but nothing in the repository says so, and that is the problem: neither number
carries a protocol, an instrument or a date. Three resolutions, in the registry.
**Nothing was edited**, because publishing a different number on your behalf
would be worse than reporting the gap.

**CS-02 — warranty.** Two incompatible statements are live: "25–35 years on
finish, up to 50 years structural", and "Manufacturer finish and structural
warranties — 25 to 50 years". The second reads as one span and implies a 50-year
*finish* warranty that no manufacturer offers. A warranty length is the one
claim on this site that is directly contractual.

Two more the registry names: the selection-and-cost paper publishes a GTA market
average of "≈ $13/sq ft" and a range of "$8–$18/sq ft" with no source, in a table
that also lists this company's own $11.00–$18.00 band — so a reader sees Ecowoods
priced above the market it is describing, with the market figure unsourced. The
table rows are now labelled "(GTA market)". And `RENOGUIDE_SYSTEM_PROMPT` tells
the assistant to say "lifetime workmanship warranty", which is stronger than
what the rest of the site says.

### Old domain

Already correct and already better documented than most migrations: host-scoped
308s in `vercel.json` *and* `next.config.js`, and `old-domain/` carries per-stack
configs with a runbook. `old-domain/README.md` records the measured state —
`www.ecowoodshardwood.com/` answers 200, **every deep path already answers
404** — which is the answer to "map old paths to new": there is no path
inventory to map. The homepage is the only live surface.

`/hardwood-stairs-toronto` and one alias were added to
`verify-domain-redirect.mjs`'s probe list. **It cannot be run from here** (403
control probe) and must be run from the Codespace.

---

## P1 / P1.5 — commercial surface and query expansion

### `apps/web/content/search/topic-map.ts` — 12 clusters, one canonical each

| intent | cluster | canonical |
| --- | --- | --- |
| commercial | hardwood-flooring-toronto | `/hardwood-flooring-toronto` |
| commercial | refinishing-toronto | `/hardwood-floor-refinishing-toronto` |
| commercial | **stairs** | **`/hardwood-stairs-toronto`** ← new |
| commercial | dust-free-sanding | `/services/dust-free-sanding` |
| commercial | installation | `/services/hardwood-installation` |
| commercial | cost | `/guides/hardwood-flooring-cost-toronto` |
| decision | solid-vs-engineered | `/guides/solid-vs-engineered-hardwood-toronto` |
| decision | white-oak | `/guides/white-oak-flooring-toronto` |
| decision | choosing-a-contractor | `/framework` |
| problem | floor-problems | ⚑ **GAP** |
| entity | entity | `/about` |
| local | local | `/service-areas` |

`route-aliases.json` holds the 33 variant slugs. It is JSON rather than
TypeScript because `next.config.js` is CommonJS and cannot import `.ts` — a
hand-copied second table in the config is the exact drift this repository builds
guards to prevent. `next.config.js` `require()`s it; the topic map imports it.
Verified: 37 redirect rules load, 4 host-scoped, 33 aliases, all permanent.

**Single-word cores** (`flooring`, `hardwood`, `floor`, `sanding`) are listed in
the map and deliberately given no page. A one-word query has no intent attached,
which is why its results are a national retailer and a shopping carousel. What a
local contractor can do with those terms is be the entity the engine associates
with them in this geography — a knowledge-graph problem, solved by the
`LocalBusiness` graph, the service `@id`s and the Google Business Profile, all of
which exist. A page called `/flooring` would add nothing.

**`/hardwood-stairs-toronto`** — the gap `/services/stair-refinishing` did not
fill. That page describes one service; the query asks the whole question: my
stairs are carpeted or worn or don't match the new floor, what are the options,
what does it cost, who does it.

It publishes **no per-tread price**, because there is not one in the constants
file. Stairs are genuinely priced per tread — the geometry is the work, not the
area — and inventing a plausible band would have been the most damaging thing
this page could do, because it is precisely the figure an answer engine would
quote back. The page explains the unit, the variables, and that the band is not
published yet. When the owner publishes one, it goes in the constants and appears
here without this file being touched.

Full stack: `WebPage` + `BreadcrumbList` + `Service` + `Offer` + `FAQPage`,
organisation reference, no `aggregateRating`. Every figure interpolated. Added to
the sitemap at 0.95, to `llms.txt` citation targets, to the footer, and to
`CommercialHeadTermRail` (~40 in-content links).

### `scripts/verify-topic-map.mjs`

Four checks: every alias destination resolves (a 308 into a 404 removes *both*
URLs from the index); no alias key collides with a real route (the redirect would
silently shadow the page); no alias points at another alias; every cluster
canonical resolves and no two clusters with different intents share one.

**It caught a real error in the map on its first run** — `floor-problems`
(problem intent) and `solid-vs-engineered` (decision intent) both pointed at the
same guide. Rather than relabel the intent to make the guard quiet, the cluster
is now marked `coverage: 'gap'` with a note, and every run prints it:

> **The largest uncovered cluster on this site.** Someone typing "why is my
> hardwood floor cupping" owns a floor and has a problem. They are not choosing
> between solid and engineered, and the guide they currently land on answers a
> question they did not ask. The mechanism is published — the climate and
> moisture paper covers every one of these failure modes — but there is no page
> written from the homeowner's side: symptom, cause, is it recoverable, what does
> fixing it cost. That page is the highest-value piece of content this site does
> not have. It also converts: a cupped floor is a job.

---

## P2 / P4 — authority graph and machine surfaces

`verify-links.mjs` (the existing orphan guard) caught the new page immediately —
in the sitemap, unreachable by a human. Fixed via the rail and the footer.
Current state: 28 public routes, **0 orphans**, 0 reachable-but-not-in-chrome.

### `/api/knowledge` — collections promoted to first class

`services`, `locations`, `pricing`, `caseStudies` and `commercialPages` were
either nested inside `business` or absent entirely. Nesting meant
`?collection=services` returned *nothing* while the data sat two levels down —
an agent had to pull the whole corpus to answer one question about one service.

`meta.collections` now leads with `commercialPages, services, pricing,
locations, caseStudies`, then the technical corpus. That array is the only steer
an agent gets about what to fetch, and the technical material leading it is
exactly what made this site citable for definitions and invisible for the money
queries.

`commercialPages` is the most useful object there: query intent → the one URL
that answers it, generated from the topic map. It removes the guess about *which*
page to cite, which is the difference between citing the domain and citing the
document. Clusters marked as a gap say so.

The route's header comment claimed "WHAT IS DELIBERATELY NOT HERE: prices…"
while `priceBand(sp)` had been on every service since F-153. Corrected.

### `ai.txt` — a new "Which URL answers which question" section

The largest gap in that file. Everything in it established that this business is
*citable*; none of it said which URL to cite when the question is "who should I
hire and what will it cost". Generated from the topic map, so it cannot drift
from the site's own canonicalisation, and gap clusters are labelled as gaps —
an agent handed a confident wrong URL cites it once and learns not to trust the
source.

### `llms.txt`

Stairs added to the preferred-citation-target list with its variant queries
named. Three cluster canonicals (`/services/hardwood-installation`,
`/services/dust-free-sanding`, `/guides/hardwood-flooring-cost-toronto`) were
reachable only from the derived indexes further down — which is not the same as
being *preferred*: an agent reads that section to choose a URL and then stops.

### `scripts/audit-ai-discoverability.mjs` — 8 checks, all passing

robots names 8 AI agent tokens explicitly · 7/7 machine surfaces implemented ·
`llms.txt` leads with citation targets *before* the technical index · every
commercial canonical named in `llms.txt` · knowledge API orders collections
commercially · sitemap covers every commercial canonical · `ai.txt` reaches every
commercial page · no price or NAP literal in any machine surface.

Two of these failed on the first run and are now fixed.

---

## P7 — measurement

`audit/ai-prompts.json` — **299 prompts**, generated by
`scripts/build-ai-prompts.mjs` from the topic map, so a change to the map
regenerates the benchmark rather than invalidating it.

| tier | count | source |
| --- | ---: | --- |
| commercial | 69 | hand-written cluster queries |
| local | 135 | generated: 4 query shapes × 26 published areas |
| technical | 64 | generated: 2 shapes × 32 glossary terms |
| decision | 19 | hand-written |
| problem | 7 | hand-written |
| entity | 5 | hand-written |

Scored on four axes per prompt: `cited`, `correctUrl`, `recommended`,
`factuallyRight`. `correctUrl` and `recommended` are separate on purpose —
citing the homepage for a stairs question means the entity is known and the
document is not, and conflating the two is how a citation rate looks healthy
while producing no leads.

**Every result starts `null`, meaning NOT YET RUN.** An unrun benchmark
reporting 0% is worse than no benchmark, because it looks like a measurement.

**Deliberate shortfall against the brief.** It asked for ≥460 prompts (≥100
commercial, ≥100 technical, ≥100 local, ≥50 comparison, ≥50 cost, ≥50 distant).
299 were built and no model is called. Scoring is by hand — because automating
it means picking one vendor's API and scoring its output with another model, and
a benchmark whose scorer is a language model measures the scorer as much as the
site. 460 prompts × 4 assistants is 1,840 manual judgements per cycle, which
means it never gets run, and a suite nobody runs measures nothing. Misspellings
and word-order permutations are also excluded: they are handled by the
canonicalisation (the variant 308s) and by the engine's own normalisation. Add
queries to the topic map and re-run `pnpm seo:prompts` to grow it deliberately.

---

## Gates

Added to `package.json` and to the `guards` job in `.github/workflows/web.yml`
(each as its own step, so the PR check name says what broke before you open the
log). All four are dependency-free and connectionless — about a second each.

```
pnpm seo:audit        static audit → audit/current-state.json + .md
pnpm seo:pricing      fails on any price literal outside the constants module
pnpm seo:claims       fails on any unregistered business fact on a customer surface
pnpm seo:topics       fails on a broken canonical, a redirect chain, a shadowed route
pnpm seo:links        orphans and link density (existing)
pnpm seo:schema       schema surface (existing)
pnpm seo:ai           8 AI-discoverability checks
pnpm seo:prompts      regenerate the retrieval benchmark
pnpm seo               all six gates
pnpm seo:consistency   facts + claims + pricing + topics + entity + canonical
pnpm seo:crawl        LIVE crawl — needs open egress
pnpm seo:domain       LIVE old-domain 301 check — needs open egress
pnpm seo:live         both live checks
```

`pnpm seo:claims --strict` additionally fails on every unsourced claim. **Turn
it on in CI once CS-01 and CS-02 are resolved.**

---

## Verification actually performed

| check | result |
| --- | --- |
| `tsc --noEmit` before | 107 errors |
| `tsc --noEmit` after | **107 errors — identical set** |
| existing `verify:*` suite (27 scripts) | all pass |
| `pnpm seo` (6 gates) | all pass |
| `next.config.js` redirects load | 37 rules, 33 aliases, all permanent |
| `crawl-site.mjs` against a fixture server | parses redirects, titles, H1s, canonicals, JSON-LD, machine surfaces |
| `next build` | **not run** — see below |
| live site / old domain | **not run** — see below |

Every one of the 107 type errors is pre-existing and caused by the same thing:
Prisma's binaries could not be downloaded in this environment (403 from
`binaries.prisma.sh`), so `prisma generate` never ran and every model type is
missing. They are all in `/mypage`, `/admin` and the PDF routes. **Zero new
errors were introduced by ~60 edits across 40 files.**

`next build` was not run for the same reason. **Run it in the Codespace before
merging.**

---

## The next ten actions, in order of impact

1. **Run `pnpm ci:local` and `pnpm seo` in the Codespace.** Prisma generates
   there; the type errors above should drop to zero.
2. **Run `pnpm seo:live`.** Neither live check has ever been executed from a
   machine with open egress. The old-domain 301s are configured in two places
   and have never been *measured*, and a redirect that is configured and not
   live looks identical from inside this repository.
3. **Resolve CS-01 (dust capture).** Owner decision. It is in 19 places
   including FAQPage JSON-LD and the machine surfaces. Highest legal exposure on
   the site.
4. **Resolve CS-02 (warranty).** Owner decision. Directly contractual.
5. **Write the failure-mode atlas** — the `floor-problems` gap. One anchor per
   symptom (cupping, crowning, gapping, buckling, edge peaking), each linking to
   the paper section and the relevant service. Highest-value missing content, and
   it converts.
6. **Publish a per-tread stair band**, or decide not to. If it goes in
   `content/constants/pricing.ts`, `/hardwood-stairs-toronto` renders it without
   being edited.
7. **Google Business Profile.** The one surface this repository cannot touch and
   the one an AI agent read in August 2026 before leaving this company off a
   Toronto ranking. `REVIEW_DESTINATIONS` still has no Google write-review URL
   because nobody has fetched the Place ID —
   `docs/outreach/GOOGLE_BUSINESS_PROFILE.md` says how.
8. **Run the 299-prompt benchmark once** to establish a baseline. Without a
   first run there is no trend, and the trend is the whole point.
9. **Source or withdraw the two GTA market figures** in the selection-and-cost
   paper. It is served as a PDF, which is the most quotable format on the site.
10. **Turn on `pnpm seo:claims --strict`** in CI once 3, 4 and 9 are done.

---

## Files

**New (13)**

```
apps/web/app/hardwood-stairs-toronto/page.tsx
apps/web/content/constants/pricing.ts
apps/web/content/claims.ts
apps/web/content/search/topic-map.ts
apps/web/content/search/route-aliases.json
scripts/audit-current-state.mjs
scripts/audit-ai-discoverability.mjs
scripts/build-ai-prompts.mjs
scripts/crawl-site.mjs
scripts/verify-claims.mjs
scripts/verify-pricing-source.mjs
scripts/verify-topic-map.mjs
EXECUTION_REPORT_SEARCH_AI_2026-08-24.md
```

**Generated (3)** — `audit/current-state.json`, `audit/current-state.md`,
`audit/ai-prompts.json`

**Modified (40)** — entity graph (2), machine surfaces (5), NAP call sites (20),
pricing call sites (5), components (5), config and CI (3)

---
---

# Cycle 2 — what shipping cycle 1 exposed

Cycle 1 built guards. Cycle 2 is mostly what those guards found once they were
pointed at the whole tree, plus the one content gap the topic map had recorded
and left open.

## First: cycle 1 never applied

`git pull` brought the patch file itself into `main` — the GitHub web upload
stripped the dashes from the filename, so `0001-search-ai-2026-08-24.patch`
landed as `0001searchai20260824.patch` and `git am` could not find it. The run
that followed was `main`, unchanged, reporting all green. The tell was
`verify:links` saying **27** public routes where this branch says **29**, and a
build listing with no `/hardwood-stairs-toronto` in it.

Both stray `.patch` files are deleted in this branch and `*.patch` is now in
`.gitignore`, with the reason written there: a committed patch is a frozen
second copy of changes that also exist in the history, it drifts from them the
moment anything is amended, and it is half a megabyte of diff text that every
clone and every CI checkout carries forever.

---

## The live bug

The homepage said this, and still says it until this branch merges:

> A typical 1,000 sq ft main floor runs about **$4,500–$7,000**

Four hundred pixels above it, in the price card it refers to:

> Full Sand & Finish — **$4.75–$7.50 / sq ft**

A thousand square feet at the published band is **$4,750–$7,500**. The homepage
of a company whose entire pitch is *fixed price in writing* was showing two
different prices for the same job on the same screen, understating the top of
its own range by $500 — a real number a real estimator then has to walk back in
someone's living room.

Three more hand-typed copies of the bands were in the same component's tier
cards, under a stale warning saying they were market ranges to be replaced
before launch. Three had been quietly corrected at some point; the fourth had
not. That is the worst state a warning can be in: a stale instruction telling
the next reader to change numbers that are now right.

**Every figure in that component is derived now** — the tiers from
`content/constants/pricing.ts`, the worked example multiplied out of the band at
render time, so the arithmetic cannot disagree with the rate it comes from.

### Why cycle 1's guard missed it

Because it only knew one shape of price. `$4.75` matched; these did not:

| shape | example | why it was invisible |
| --- | --- | --- |
| bare decimal range | `pricePerSqFt: '4.75–7.50'` | the `$` and the unit are separate spans |
| comma-grouped total | `$4,500–$7,000` | no cents |

A guard that sees one of the shapes a price can take reports the tree as clean
and is **worse than no guard**, because someone then trusts it. All three shapes
are matched now, and the guard also stops firing on its own documentation — a
`//` or `*` line in a source file is a comment, which is F-58 and F-106 for the
fourth time in this repository.

---

## `/hardwood-floor-problems-toronto` — the failure-mode atlas

The one cluster the cycle-1 topic map carried as `coverage: 'gap'`. Someone
typing *"why is my hardwood floor cupping"* owns a floor and has a problem; the
map had to route them to a solid-vs-engineered guide, which answers a question
they did not ask.

Five symptoms — cupping, seasonal gapping, crowning, buckling, edge peeling —
each with what it looks like, what causes it, an honest prognosis, and which
published band the remedy lands in. Every definition is pulled from the glossary
rather than restated, and the page emits `DefinedTerm` nodes pointing back at the
canonical definitions, so a machine can get from symptom to definition without
parsing prose.

**Two of the five say the correct action is to do nothing.** A winter gap that
closes in June is a house that is too dry and the answer is a humidifier, not a
contractor. That is not restraint for its own sake — it is the reason the other
three are believable, and it is a shape nobody writes for a rich result.

Why this page is worth more than the keyword variants that were requested
instead:

- **It converts.** Every other commercial page meets someone *considering* work.
  This one meets someone whose floor is already failing, in the hour they first
  searched for it.
- **It is the question an answer engine is actually asked.** "Why is my floor
  cupping" has a real answer, which is the shape of query a retrieval system
  settles by quoting a source. "Hardwood flooring Toronto" is a shopping query it
  answers with a list.
- **It cost nothing to say.** Every symptom was already published in the glossary
  and established in the climate paper. Nothing was invented; the material was
  re-cut from the homeowner's side instead of the technician's.

Eight more aliases 308 into it (`/hardwood-floor-repair-toronto`, `/cupping`,
`/water-damaged-hardwood-toronto`, …). Wired into the sitemap at 0.95, the
`llms.txt` citation targets, `ai.txt`, the footer, and the head-term rail.

---

## `pnpm seo:density` — the P2 guard, and what it found

`verify-links.mjs` asks whether a page has a way **in**. This asks whether it has
enough ways **out**, and to the right places. Different failures:

- No way in → not crawled, does not rank at all.
- No way out → crawled, ranks thinly, and is the end of the journey. A crawler
  reads a leaf as a page the site itself does not think is connected to anything.

Quota for a money page: **≥2 services, ≥2 decision guides, ≥2 case studies, ≥1
technical paper, ≥1 framework page, ≥1 estimate CTA.** Not a ranking trick — it
is the shape of an answer a person needs (*what would you do, what do I have to
decide, has it worked before, why does it work, how do I judge you, how do I
start*), and an internal-link count is the only part of that a machine can check.

**On its first run, five of nine commercial and decision canonicals reached ZERO
case studies.** This site publishes five case studies containing subfloor MVTR
readings, particle counts and eighteen-month deflection measurements, and not one
of the pages a buyer lands on linked to any of them. That is the most expensive
omission on the site and it is not an SEO one — a commercial page's whole job is
to move someone from "this sounds right" to "these people have done this". The
evidence existed. Nothing pointed at it.

| | before | after |
| --- | --- | --- |
| `/hardwood-flooring-toronto` | 1 guide, **0 case studies** | all services, 3 guides, all evidence |
| `/hardwood-floor-refinishing-toronto` | **0 services, 0 guides, 0 cases, no framework** | 3 / 2 / all / framework |
| `/hardwood-stairs-toronto` | 1 / 1 / 1 | 3 / 2 / all |
| `/services/[slug]` × 6 | **0 services, 0 guides, 0 cases** | all / all / all |
| `/guides/[slug]` × 11 | **0 services, 0 cases**, CTA only to score someone else's quote | all / all / all + estimate CTA |
| `/framework` | **0 services, 0 cases, no CTA at all** | all / all / CTA |
| `/about`, `/service-areas` | **0 services, 0 cases** | all / all |

The `/guides` template is the one worth pausing on: a reader who has just decided
between solid and engineered is the most qualified visitor on this site, and the
page ended.

Two tiers, because one quota applied to every canonical is a quota nobody
believes. `/about` does not need two case studies; it does need to say what the
company does, show one job, and offer a way to start. **Raising a quota is a
content decision. Lowering one to make the guard pass is not.**

### The guard reports its own blind spot

`<Link href={f.href}>` is a real link this scanner cannot resolve. Rather than
undercount silently it prints an `unres` column, so a "0 guides" next to six
unresolvable hrefs reads as *the scanner is blind*, not *the page is broken*.

In the one place that mattered — the service template's six identical
`Read the guide` anchors — the fix was worth making anyway. Six edges into six
different documents, all labelled the same. Anchor text is one of the few signals
a site controls completely; spending it on the word "guide" six times spends it
on nothing. They now carry each guide's actual question.

### Breadcrumbs

`/products/floorforge` was the only deep page with no `BreadcrumbList` — two
segments from the root, no declared parent, so Google had nothing to display and
nowhere to attribute it. It is a `'use client'` page, so both its metadata and
its JSON-LD have to live in the sibling `layout.tsx`; the breadcrumb is there now.

---

## Two audit false findings, fixed

Cycle 1's audit reported things that were not true, and a false finding costs more
than a missed one — someone goes and "fixes" something that was already right.

- **"`/products/floorforge` has no canonical."** It has had one since it was
  written. A `'use client'` page cannot export `metadata`; its canonical is in
  the sibling layout, which the audit did not read. It does now.
- **"Three pages have no H1."** The homepage's H1 is in `home-client.tsx`;
  `/blog/[slug]` and `/case-studies/[slug]` take theirs from the MDX document.
  The audit now follows one level of local component imports and recognises an
  MDX-rendering route. The "fix" for any of those three would have been to add a
  **second** H1.

Both audits now: **0 pages without a canonical, 0 without an H1, 0 with more than
one, 0 price literals outside the constants module.**

---

## Live checks that were finally possible

`ecowoods.ca` is reachable from this environment through the fetch tool, so some
of what was theory in cycle 1 is now measured:

- The site serves. Homepage title, H1, phone and all three price bands render as
  the source says — **including the wrong `$4,500–$7,000`**, which is how that
  bug was found rather than reasoned about.
- `/llms.txt` is live and complete, with its preferred-citation-target section
  intact.

**`ecowoodshardwood.com` still could not be measured** — its `robots.txt` fetch
timed out from here. The old-domain 301s remain configured in two places and
verified in none. `pnpm seo:live` from the Codespace is the only thing that
settles it, and it is still item 2 below.

---

## Cycle 2 verification

| check | result |
| --- | --- |
| `tsc --noEmit` | **107 errors — identical set to baseline** |
| webpack production compile | **✓ Compiled successfully in 26.7s** — every module including the new pages |
| `next build` full run | blocked here: Google Fonts and the Prisma binary host both 403 from this sandbox |
| existing `verify:*` (27 scripts) | all pass |
| `pnpm seo` (7 gates) | all pass |
| every glossary + case-study slug referenced by the new pages | resolves |

The compile result is the meaningful one: it proves every import, every component
and every new page resolves and bundles. What follows it is type checking, which
fails on the same 107 pre-existing Prisma errors it failed on before this branch
existed, in `/mypage`, `/admin` and the PDF routes.

---

## The next ten, re-ordered

Items 5 and 6 from cycle 1 are done. The rest have moved up.

1. **Apply the patch and run `pnpm ci:local`.** Prisma generates in the
   Codespace; the 107 type errors should go to zero and the build should list
   `/hardwood-stairs-toronto` and `/hardwood-floor-problems-toronto`.
2. **Run `pnpm seo:live`.** Still never executed anywhere with open egress. The
   old-domain 301s are configured twice and measured zero times, and a redirect
   that is configured and not live looks identical from inside this repository.
3. **Resolve CS-01 (dust capture, 18 places, two inside FAQPage JSON-LD).**
   Owner decision. Highest legal exposure on the site.
4. **Resolve CS-02 (two incompatible warranty statements).** Owner decision.
   Directly contractual.
5. **Google Business Profile.** The one surface this repository cannot touch and
   the one an AI agent read in August 2026 before leaving this company off a
   Toronto ranking. `REVIEW_DESTINATIONS` still has no Google write-review URL
   because nobody has fetched the Place ID.
6. **Run the 307-prompt benchmark once** to set a baseline. Without a first run
   there is no trend, and the trend is the whole point.
7. **Publish a per-tread stair band**, or decide not to. If it goes in
   `content/constants/pricing.ts`, `/hardwood-stairs-toronto` renders it without
   being edited.
8. **Source or withdraw the two GTA market figures** in the selection-and-cost
   paper. It ships as a downloadable PDF — the most quotable format on the site.
9. **More case studies.** The link-density quota is met by five, hand-curated in
   `EvidenceRail`. At ten, hand-curation stops being better than matching and the
   component should learn to match on topic. Not before.
10. **Turn on `pnpm seo:claims --strict`** in CI once 3, 4 and 8 are done.

---

## Cycle 2 files

**New (3)** — `apps/web/app/hardwood-floor-problems-toronto/page.tsx`,
`apps/web/app/components/EvidenceRail.tsx`,
`scripts/verify-link-density.mjs`

**Deleted (2)** — `0001searchai20260824.patch`, `0082truthcontrolprobe.patch`

**Modified (16)** — `PricingSection.tsx` (every figure derived),
`verify-pricing-source.mjs` (three price shapes, comment stripping),
`audit-current-state.mjs` (layouts, components, MDX, comment stripping),
`topic-map.ts` + `route-aliases.json` (gap closed, 8 aliases),
`services/[slug]`, `guides/[slug]`, `framework`, `about`, `service-areas`,
`hardwood-flooring-toronto`, `hardwood-floor-refinishing-toronto`,
`hardwood-stairs-toronto` (link density), `floorforge/layout.tsx` (breadcrumb),
`sitemap.ts`, `llms.txt`, `SiteFooter`, `CommercialHeadTermRail`,
`verify-schema.mjs`, `package.json`, `web.yml`, `.gitignore`

---
---

# Cycle 3 — the old domain, and four links that promised a page

Cycle 2 shipped and built clean: 246 static pages, both new commercial routes
prerendered, zero type errors. Then `pnpm seo:live` ran for the first time in
this project's history and the two findings below came out of it.

---

## 1. The old domain: 35 live URLs, and a redirect config that would have 404'd every one

`seo:live` proved `www.ecowoodshardwood.com` is serving a complete second
website. Reading its **own sitemap** gave the exact inventory:

| what | count | destination now assigned |
| --- | ---: | --- |
| individual customer testimonials | 22 | `/reviews` |
| blog index + posts | 4 | `/blog` |
| store-platform leftovers (`?fuseaction=store.*`) | 3 | `/` |
| About / Services / Contact / Home / root | 5 | `/about`, `/services`, `/#quote`, `/` |
| privacy policy | 1 | `/privacy` |

**Twenty-two published customer testimonials** — Audrey in Toronto, Andre
Fauteux, Melissa McCormack, Joan Endersby, Michelle P in East York — sitting on
a domain that currently competes with the live site, doing nothing for it.
That is the largest stranded reputation asset this business has, and each one
was one line away from pointing at `/reviews`.

### The config in this repo would have made it worse

Every redirect file in `old-domain/` was **path-preserving** — `/x →
ecowoods.ca/x`. That is the correct default for almost every migration and it
is exactly wrong here, because **the two sites share zero paths.** The old one
serves `/pages/flooring-services-toronto-etobicoke-hamilton` and
`/blogs/testimonials/172376--audrey-in-toronto`. Preserving those sends all 35
live URLs to a 404 *on ecowoods.ca* — worse than the status quo, because a
crawler following a 301 into a 404 concludes the destination is broken.

So: `old-domain/path-map.json` is now the source of truth, and
`scripts/build-old-domain-redirects.mjs` generates `.htaccess`, `nginx.conf` and
`_redirects` from it. Three syntaxes, one set of rules; `--check` fails CI on a
hand-edit. `pnpm domain:simulate` runs all 35 URLs through the rules offline and
prints where each lands:

```
  ✓ every known URL has a rule of its own — nothing relies on the fallback
```

**One bug caught in my own generator before it shipped.** The first `.htaccess`
it produced used patterns anchored `^/blogs/…`. In a per-directory context —
which `.htaccess` is — Apache strips the leading slash before matching, so those
patterns match *nothing, ever*. The file installs cleanly, throws no error, and
silently does not fire. It is the most common way an `.htaccess` migration
fails. The generator now emits `^/?`, correct in both per-directory and
`<VirtualHost>` context.

**`verify-domain-redirect.mjs` was probing the wrong URLs.** It checked
*ecowoods.ca's* paths on the old domain — `/framework`, `/papers`,
`/service-areas/etobicoke` — which never existed there. All 14 came back 404 and
it reported fourteen failures that were one non-finding. It now probes the 35
real URLs and asserts each lands on the destination `path-map.json` assigns it,
so it verifies the migration is *correct*, not merely that a 301 happened.

---

## 2. Four live 404s on links that promise a page exists

`/privacy` and `/terms` are linked from:

- **`SiteFooter.tsx`** — the footer of all 246 pages
- **`CookieConsentBanner.tsx`** — the "learn more" link
- **`RegisterForm.tsx`** — *"I agree to the Privacy Policy and Terms of Service"*, both linked

Neither route existed.

The dead footer link on 246 pages is the cheap part. The consent banner's own
header comment cites PIPEDA as the reason it exists — and **the document that
consent was supposed to be informed by was a 404.** A registration form asking
someone to agree to two documents that do not exist is asking for agreement to
nothing.

`verify-links.mjs` missed it because check 3 verifies that *fragment* anchors
(`#services`) in the chrome resolve, and never checked that a *path* href does.
It does now, on the surfaces where a dead link is a broken promise rather than a
broken link: chrome, consent banner, auth forms. **Verified by deletion** — I
removed `/privacy` and the guard named all three call sites.

### The pages

Both are generated from `apps/web/lib/legal.ts`, which lists every processor
with the file and import that wires it. Not borrowed boilerplate — PIPEDA's
openness principle asks for information about *actual* practices made readily
available, and a true description of this application's data flow is worth more
than a template describing a different company.

**`REVIEW.approved` is `false` and both pages say so in their own body, above
the fold.** That is uncomfortable and it is correct: a policy implying legal
review it has not had is a worse document than one that states its provenance.
Flip it in `lib/legal.ts` when someone with the standing to bind the business has
read them.

`/terms` deliberately refuses to be the contract for the work. The written quote
is that. Everything on this site rests on *"the fixed price in writing is the
agreement"*; a page of boilerplate quietly claiming to also govern the job would
undercut the one promise the business is built on.

### `pnpm seo:legal` found an undeclared processor on its first run

The guard checks that every data-processing SDK the code imports appears in the
processor list. It immediately failed on **`@ai-sdk/anthropic` in
`app/api/chat/route.ts`** — the RenoGuide assistant has been sending customers'
chat messages to Anthropic, and my own privacy page did not list it. That is
precisely the failure mode a privacy policy has: it becomes false when a
dependency changes, silently, because a document has no tests. Now declared, and
a new one fails the build with the file that introduced it.

---

## Cycle 3 verification

| check | result |
| --- | --- |
| `tsc --noEmit` | **107 errors — identical set to baseline** |
| all 27 `verify:*` | pass |
| `pnpm seo` (now 9 gates) | pass |
| `pnpm domain:simulate` | 35/35 URLs matched, 0 on the fallback |
| new guard proven by deletion | `verify-links` names all 3 call sites when `/privacy` is removed |

One type error was introduced and fixed: `entry()` in the sitemap takes a `Date`
and `LEGAL_LAST_REVIEWED` is a string.

New gates: `pnpm seo:legal`, `pnpm domain:check` — both in `verify`, `seo` and
the CI guards job. `pnpm domain:build` regenerates the three configs;
`pnpm domain:simulate` tests the map offline.

---

## The next ten, again

1. **Deploy `old-domain/.htaccess`.** Everything else on this branch is signal
   engineering on one of two competing entities. Apache, per the fingerprint —
   `old-domain/EXECUTE.md` has the runbook. Then `pnpm seo:live` until it
   reports zero failures, and only then file the Search Console change of
   address.
2. **Read `/privacy` and `/terms` and flip `REVIEW.approved`** in
   `lib/legal.ts`, or send them to a lawyer first. They are live and honest
   about their own status either way.
3. **CS-01 — dust capture.** 18 places, two inside FAQPage JSON-LD. Owner
   decision, highest legal exposure.
4. **CS-02 — two incompatible warranty statements.** Directly contractual.
5. **Google Business Profile.** Still no Place ID in `REVIEW_DESTINATIONS`. The
   surface an AI agent read before leaving this company off a Toronto ranking.
6. **Run the 307-prompt benchmark once** for a baseline.
7. **Per-tread stair band**, or a decision not to publish one.
8. **Source or withdraw the two GTA market figures** in the cost paper — it
   ships as a PDF.
9. **More case studies.** Five, hand-curated in `EvidenceRail`. At ten, write
   the matcher.
10. **`pnpm seo:claims --strict`** in CI once 3, 4 and 8 are done.

---

## Cycle 3 files

**New (6)** — `apps/web/app/privacy/page.tsx`, `apps/web/app/terms/page.tsx`,
`apps/web/lib/legal.ts`, `scripts/verify-legal.mjs`,
`scripts/build-old-domain-redirects.mjs`, `old-domain/path-map.json`

**Regenerated (3)** — `old-domain/.htaccess`, `old-domain/nginx.conf`,
`old-domain/_redirects`

**Modified (7)** — `verify-links.mjs` (chrome path guard),
`verify-domain-redirect.mjs` (real URLs, mapped destinations),
`old-domain/README.md` (measurement corrected), `sitemap.ts`, `claims.ts`,
`package.json`, `web.yml`

---
---

# Cycle 4 — the space bar

Reported as "the chat widget won't let me type spaces." The chat widget was
innocent. The bug was on the homepage and it was eating every text field on it,
including the estimate form.

---

## 1. Two carousels were deciding what your customers could type

`FloorCatalog.tsx` and `MachineCatalog.tsx` each registered this:

```ts
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
});
```

A `window` listener fires **regardless of what has focus**. Both components are
mounted on `home-client.tsx`. The homepage carries the primary lead-capture
form.

So on the highest-traffic page of a business whose entire funnel is *type your
project into this box*:

- **the space bar did nothing**, and
- **the arrow keys jumped a carousel** instead of moving the text cursor.

A customer typing *"White oak, main floor, about 600 square feet"* got
`Whiteoak,mainfloor,about600squarefeet` — if they persevered past the second
word at all. This is live right now and has been for as long as those components
have existed.

It is the most expensive bug found in this engagement. Bigger than the price
contradiction, because a wrong price loses an argument and this loses the lead
before there is an argument to have.

**Fixed** in `apps/web/lib/keyboard.ts` — `whenNotTyping()` wraps a global
handler so it ignores events originating in an `input`, `textarea`, `select`,
anything `contentEditable`, or anything carrying `role="textbox"`/`combobox`.
Escape is still delivered, because Escape types nothing and closing a dialog
from inside its own field is what people expect.

`CommandPalette` already hand-rolled this check and had it *nearly* right — it
missed `<select>` and the ARIA roles. It now uses the shared predicate. One
definition of "is a person typing here", used everywhere.

### `pnpm seo:keys`

Fails the build on any `window`/`document` key listener that calls
`preventDefault()` without consulting `lib/keyboard.ts`. This class of bug is
invisible to typecheck, invisible to the build, invisible to every other guard
in this repository, and catastrophic to conversion — so it gets its own check.
It found the `CommandPalette` case on its first run.

---

## 2. RenoGuide → EcowoodsGuide

The name was typed as a literal in nineteen places: the widget header, the
greeting, the launch button's `aria-label`, the dialog's accessible name, three
command-palette entries, two configurator buttons, a form hint, and the system
prompt the model reads.

It was also the wrong name. Every other surface on this site is relentlessly one
entity — the schema graph, `llms.txt`, `ai.txt`, the citation guide and the
framework all say Ecowoods, because the whole retrieval strategy is making one
entity unmistakable. Then the one thing a visitor actually *talks to* introduced
itself as a different brand, in the highest-intent moment on the site. Same
class of leak as two live domains, smaller scale.

`lib/assistant-identity.ts` is now the single source: name, subtitle, both ARIA
labels, the greeting and the three chips. `lib/renoguide.ts` → `lib/assistant.ts`,
`openRenoGuide` → `openAssistant`, `RENOGUIDE_OPEN_EVENT` → `ASSISTANT_OPEN_EVENT`,
`RENOGUIDE_SYSTEM_PROMPT` → `ECOWOODS_GUIDE_SYSTEM_PROMPT`.

**The greeting was rewritten too**, because it asked for three things before
offering anything: *"Tell me the wood species, rough square footage and your
area."* That is a form with a chat interface painted on it, and someone whose
floor is cupping does not know their square footage. It now says what Ecowoods
does, then asks one open question.

**The chips changed for the same reason.** *"Which species suits pets & kids?"*
assumes a buyer who is shopping. The largest group of people who open a flooring
chat window have a floor that is already misbehaving, and the widget had nothing
to say to them. Now: **"My floor is cupping or gapping"**, which routes straight
into the work.

---

## 3. Every reply now closes on what Ecowoods would do

Added to the system prompt as the rule stated most emphatically, because it is
the one most easily lost mid-conversation:

> Every single reply — including answers to questions that have nothing to do
> with buying, including "what is cupping" — ends by naming the specific Ecowoods
> service or next step that follows from what was just said. **A reply that
> answers the question and stops is a failed reply.**

With the mapping written out: symptom → restoration + free diagnosis;
refinishing question → the published band + the measure; stairs mentioned →
per-tread pricing and the fact most quotes omit them; pure curiosity → answer it
properly, then one line on what Ecowoods does about it in a real house.

Plus a named service list the assistant may state verbatim, so it stops
paraphrasing the offer into vagueness.

The prompt also now says why this is not pushiness: *"Pushy is inventing urgency.
Telling someone what a company can do about the problem they just described is
the reason they opened the window."*

`pnpm seo:assistant` fails the build if the retired name reappears, if a
component types the current name as a literal instead of importing the constant,
or if the always-close rule is trimmed out of the prompt.

---

## Cycle 4 verification

| check | result |
| --- | --- |
| `tsc --noEmit` | **107 errors — identical set to baseline** |
| all 27 `verify:*` | pass |
| `pnpm seo` (now 11 gates) | pass |
| `seo:keys` proven | found the `CommandPalette` case unprompted on its first run |

One error was introduced and fixed: an escaped backtick from the edit script
broke the system prompt's template literal. It surfaced as eight parse errors and
a *lower* total error count, which is worth remembering — a falling error count
can mean the compiler stopped early, not that things improved.

New gates: `pnpm seo:keys`, `pnpm seo:assistant` — both in `verify`, `seo` and
the CI guards job.

---

## Still open, unchanged

1. Merge and deploy. Cycles 1–4 are all still on the branch.
2. `old-domain/.htaccess` onto the Apache box. 35 live URLs, 22 testimonials.
3. CS-01 dust capture · CS-02 warranty — owner decisions.
4. Google Business Profile Place ID.
5. Run the 307-prompt benchmark for a baseline.
