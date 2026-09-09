# Why this site publishes no `aggregateRating`

`scripts/verify-reviews.mjs` fails the build if `aggregateRating` appears
anywhere in the schema layer. This is the reasoning behind that rule, so that
nobody has to reconstruct it from a guard's error message.

## The short version

A star rating in search results is worth having. Emitting one for yourself is
not how you get it, and doing it wrong is how a business gets a manual action.

## The three separate reasons

**1. Self-serving reviews are ineligible.** Google's structured-data guidance
for review snippets excludes reviews that a business writes about itself, and
excludes ratings the business assembles about itself. Marking up
`aggregateRating` on the `LocalBusiness` node is exactly that shape, whatever
the underlying numbers are.

**2. Aggregating other sites' reviews is specifically disallowed.** The reviews
this business has are on Google, HomeStars and similar platforms. Reading
them off those platforms, averaging them, and publishing the average as our own
structured data is the case the guidance names. It is also unverifiable by
anyone: the number is whatever this repository says it is.

**3. It would be a performance claim we could not substantiate on demand.**
Under the Competition Act, s.74.01(1)(b), a representation about performance
requires adequate and proper testing to have existed *before* it was made. A
rating average is a claim about how this business performs. Since Bill C-59 the
penalty is the greater of CAD 10M or 3% of worldwide gross revenue, and since
20 June 2025 a private party can bring the matter to the Competition Tribunal
directly, without the Commissioner. An average computed from platforms whose
data we cannot export, audit or reproduce is not a figure to stake that on.

## What the site does instead

`REVIEW_EVIDENCE` holds every review figure, each with:

- the platform it was read from,
- a direct `href` to the specific profile — not a platform home page, so anyone
  can check the number themselves in one click,
- an `asOf` date, which the guard requires to be a real past date.

`/reviews` publishes those figures with their sources and explains, in the page
itself, why the reviews live on platforms this business cannot edit. That is a
stronger position than a star rating: it is falsifiable by the reader.

## The marker in the code

The repository has carried a `ROOT_AGGREGATE_RATING` constant marked
`DO NOT WIRE THIS` for months. A comment is advisory and a guard is not — rule 1
of `verify-reviews.mjs` makes the prohibition enforceable, and it is why that
constant can safely continue to exist as documentation.

## If someone asks for stars anyway

The honest routes to a star display are:

- Reviews collected and displayed by an eligible third-party platform, which
  emits its own markup on its own domain.
- `Product`/`Service` review markup for a specific reviewed *thing*, written by
  identifiable reviewers, which is not what a contractor's homepage rating is.

Neither is "add `aggregateRating` to the LocalBusiness node", and that is the
only change the guard blocks.
