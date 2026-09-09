# The claims register

Every factual assertion this site makes about the business — a number, a
timeframe, a capability, a credential — is registered in
`apps/web/content/claims.ts` before it may appear on a page.
`scripts/verify-claims.mjs` fails the build on an unregistered business fact,
and `scripts/verify-cities.mjs` and `scripts/verify-schema-figures.mjs` both
send you here when they find one.

## Why a register rather than careful writing

Careful writing works once. The failure this exists to prevent is not somebody
inventing a fact; it is a fact that was true when it was written and quietly
stopped being true — a crew size, a year founded, a number of completed
projects, a "same-week scheduling" promise. Nothing in a codebase notices that.
A register does, because every entry carries where the fact came from and when
it was last confirmed.

It is also what makes the site defensible. Under the Competition Act,
s.74.01(1)(b), a performance claim requires adequate and proper testing to have
existed *before* the representation was made — not to be assembled afterwards
if someone complains. Since Bill C-59 the exposure is the greater of CAD 10M or
3% of worldwide gross revenue, and since 20 June 2025 a private party can go to
the Competition Tribunal directly. "Where did this number come from?" is a
question that must have an answer on the day it is asked.

## What counts as a claim

Register it if a reasonable reader would take it as a statement of fact about
this business or its work:

- counts and quantities — years in business, projects completed, crew size
- timeframes — scheduling, acclimation periods, drying times, warranty terms
- capabilities and credentials — certifications, memberships, equipment owned
- comparatives of any kind — faster, quieter, longer-lasting, more durable
- anything with a unit attached

Not a claim: published price bands, which live in
`apps/web/content/constants/pricing.ts` and are guarded separately by
`verify:pricing`; and the wood-science figures in the papers, which are cited to
their published sources and guarded by `verify:papers` and `verify:figures`.

## Adding one

Each entry records the claim, its source, and the date the source was read. A
claim with no source is not a claim that needs better wording — it is a claim
that cannot ship. The options are to find the source, to soften the sentence
until it is no longer an assertion of fact, or to remove it.

For a city or neighbourhood page, `verify-cities.mjs` additionally requires that
signature content not be duplicated across pages: thirty near-identical service
area pages saying the same thing about themselves are thirty claims about places
where the differentiating fact was invented to fill a template.

## Reviewing it

The register is worth reading end to end whenever the business changes — new
service, new equipment, new territory — and at least annually. Every entry has a
date; an entry whose date is old is not automatically wrong, but it is the list
of things nobody has checked lately.

## Related

- `docs/outreach/WHY_NO_AGGREGATE_RATING.md` — why review figures are never
  aggregated into structured data.
- `apps/web/content/constants/pricing.ts` — the one place a price may live.
