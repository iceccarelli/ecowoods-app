# Claims register — confirm before use

Every item here appeared in a draft or a proposal and **could not be verified
from what this repository publishes**. None of them is on the site. None should
go into an email, a pitch, a meta description or a schema block until the row is
signed off with a source.

The reason this file exists rather than a judgement call: this site has already
had to retire a fabricated reputation figure once. `scripts/verify-business-facts.mjs`
permanently bans the string `348 verified reviews` at `4.9/5` "from Google, Houzz
and HomeStars combined", because it was published, was not true, and nobody could
say where it came from. The cost of that is not the correction. It is that every
other number on the site becomes a thing a reader has to wonder about.

| Claim | Where it was proposed | Status | What would settle it |
|---|---|---|---|
| 5.0 rating from 176 reviews | `aggregateRating` in LocalBusiness schema; three meta descriptions; two page bodies; a PR pitch | **Not verifiable from here** — the HomeStars profile is JS-rendered and could not be read. Separately, see the note below: even if exact, this must not go in `aggregateRating`. | A screenshot or CSV export of the HomeStars profile on the date claimed |
| Four "Best of" awards | PR pitch; service-area page copy | Unverified | Award name, issuing body, and year for each |
| 26 years in business | Service-area FAQ copy | **Do not hardcode.** `BUSINESS_NAP.foundedYear` is 2000 and `yearsInBusiness()` derives the count. A literal goes stale on 1 January. | Nothing — use the function |
| FSC-certified species | Installation service page bullet | Unverified certification claim | The chain-of-custody certificate number, or drop it |
| Zero-formaldehyde adhesives | Installation service page bullet | Unverified product claim | Product name and its emissions certification (e.g. CARB Phase 2 / TSCA Title VI) |
| Festool and Bona Atomic containment | Refinishing service page bullet | Unverified equipment claim | Confirm the machines actually in the vans |
| "Best hardwood flooring company in the GTA" | Homepage meta description | A superlative about ourselves, in our own voice, with nothing behind it | Not a factual question — a brand decision. It is also the weakest sentence in the description, because every competitor says it |

## Already published, and needing a source on file

These are **live on the homepage right now**. They were not added by this work;
they predate it. Each is a formal third-party certification or a measurement,
and each is the kind of claim a competitor, a journalist or a regulator can
check against a public register.

| Claim | Where | What would settle it |
|---|---|---|
| "FSC-Certified Eco Materials" | homepage pillar + hero copy | The FSC chain-of-custody certificate number of the supplier, and the product lines it covers. Note the wording claims the *materials* are certified, not the company — that is the defensible form, and it still needs the supplier's certificate on file |
| "GreenGuard Gold" | homepage pillar | The UL GREENGUARD Gold certificate for the specific finish or adhesive, by product name |
| "water-based ≤50 g/L VOC finishes" | homepage pillar | Product name and its technical data sheet |
| "zero-formaldehyde adhesives" | homepage pillar | Product name and its emissions certification |
| "many with us 10+ years" | homepage pillar | Nothing external — but it should be true of a named number of people |
| "99.7% dust capture" | homepage, FAQ, service pages | Already baselined in `scripts/schema-baseline.json` as an unsourced number. The equipment manufacturer's published figure would settle it |

None of these is being removed. The point of listing them is that the site now
publishes a great deal that *is* verifiable — the framework, the standards
register with dates, the price bands, the papers — and these six are the
remaining sentences a sceptical reader could challenge and we could not answer
in one move. Getting the product names and certificate numbers into a file turns
six weak claims into six strong ones.

## The `aggregateRating` question, separately

This one is not a verification problem, and it does not become safe if the
figure turns out to be exact. Google's review-snippet documentation says two
things directly:

> "Don't aggregate reviews or ratings from other websites."

> "If the entity that's being reviewed controls the reviews about itself, their
> pages that use `LocalBusiness` or any other type of `Organization` structured
> data are ineligible for star review feature."

Putting a HomeStars aggregate into `LocalBusiness.aggregateRating` on
ecowoods.ca is both of those at once. The stars will not appear — the page is
ineligible by rule — and the markup is the exact pattern that draws a structured
data manual action. A manual action does not remove the stars we would never
have got. It removes **every** rich result on the domain: the `HowTo` blocks on
the papers, the `FAQPage` blocks, the `Dataset` markup, the breadcrumbs. Months
of work, for a snippet that was never available.

**What actually produces stars in search results for a business like this:**
Google's own seller/place ratings, drawn from the Google Business Profile. They
are not marked up on your site at all — Google reads them from its own data.
That is what `docs/outreach/review-request.md` is for, and it is why the
Business Profile is the highest-value unfinished item on this project.

The HomeStars profile still does useful work: it is in `PROFILE_LINKS`, so it
appears in the organisation's `sameAs`, which is how Google resolves that this
entity and that profile are the same business. That is the legitimate version of
what the rating was reaching for.
