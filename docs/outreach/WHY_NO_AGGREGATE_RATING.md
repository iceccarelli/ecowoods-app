# Why there is no aggregateRating loophole

The request, made more than once: put the HomeStars 5.0 / 176 — or any
third-party aggregate — into `LocalBusiness.aggregateRating` on ecowoods.ca, to
force review stars into search results.

**That markup does not produce stars on your own domain.** Google's
review-snippet documentation states both of the following:

> "Don't aggregate reviews or ratings from other websites."

> "If the entity that's being reviewed controls the reviews about itself, their
> pages that use `LocalBusiness` or any other type of `Organization` structured
> data are ineligible for star review feature."

A HomeStars number on this site is both at once. The stars were never available:
the page type is ineligible by rule, not by chance.

## What it would actually cost

The pattern is the one associated with structured-data manual actions. A manual
action does not remove the stars you were never going to get. It removes **every
rich result on the domain**:

- the `HowTo` blocks on the technical papers
- the `FAQPage` blocks on the service and service-area pages
- the `Dataset` markup on the figures and the market data
- the breadcrumbs on every route

All of it, earned over the whole project, traded for a snippet that did not
exist. This is not a cautious reading. `lib/schema/root-schema.ts` has carried
the line **"⚠️ DO NOT WIRE THIS INTO ANY EMITTED SCHEMA"** above
`ROOT_AGGREGATE_RATING` since before this conversation, and
`verify-business-facts.mjs` permanently bans the fabricated `348 verified
reviews` at `4.9/5` that was published here once already.

## The variants that get proposed, and why each fails

| Idea | Why it fails |
|---|---|
| Put the same numbers on `Product` instead of `LocalBusiness` | Still an aggregate from another website. The rule is about where the reviews came from, not which type carries them. |
| Embed a HomeStars or Google widget and mark that up | Reviews about the business, displayed on the business's own site, are self-serving by definition — the case the guideline names explicitly. |
| Collect a handful of on-site reviews so the aggregate is "first-party" | Only genuine, ungated, first-party reviews qualify — and gating (asking only happy clients) is separately prohibited. This repo already retired one fabricated figure; a second would end the credibility of every number on the site. |
| Use `CriticReview` | For independent editorial critics reviewing a subject, not for a business reviewing itself. |
| Mark it up and accept the risk | The downside is not "no stars". It is losing every rich result the site already has. |

## What actually produces stars for this business

Google's **own** place rating, from the **Google Business Profile**. It is not
site markup, and no markup can create it. Google reads it from its own data.

That is what `docs/outreach/review-request.md` is for:

1. Claim and verify the Business Profile.
2. Make the profile's name, address and phone match `BUSINESS_NAP` exactly.
3. Send the request to **every** completed job — not only the happy ones, which
   is prohibited as review gating.
4. Answer every review, especially the critical ones.

That path compounds and cannot be taken away. Schema fiction does neither.

See also `CLAIMS_REGISTER.md`.
