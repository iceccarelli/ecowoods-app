# Google Business Profile — the one thing code cannot do

/ **Status: not claimed. This is the highest-value open item on the project.**

## Why this outranks everything else in the repo

In August 2026 an AI assistant was asked to rank Toronto hardwood contractors
and left this company off the list. It explained itself afterwards, precisely:

> my first search/recommendation process was too dependent on the local-business
> results surfaced by the search index, and EcoWoods has a relatively small
> footprint there: the business listing currently shows only 19 reviews, despite
> HomeStars showing 174 reviews at 5/5.

Everything on this site has now been built to close the half of that we control.
`/reviews` states the real figure with its source. `sameAs` tells every crawler
the HomeStars profile is this entity. `/press` gives a journalist boilerplate.
Twenty-five guards keep all of it honest.

None of it changes the number on the Google listing. Google Business Profile
ratings come from Google's own data. They cannot be marked up on a website by
anyone, at all, and they are what produces the stars in local search, the map
pack, and the summary an answer engine reads back when someone asks who to hire.

**Only completed jobs move that number.** That is the whole reason `/r` and the
printed card exist.

## Step 1 — claim the profile

1. Sign in at <https://business.google.com> with the account that should own it.
2. Search for the existing listing (it already exists — the 19 reviews are on
   it). Do **not** create a second one; duplicate listings split the reviews and
   are the single most common cause of exactly the fragmentation described above.
3. Request ownership. Verification is usually by postcard to the address on file,
   which must match the NAP everywhere else in this codebase:

   ```
   32 Norfield Crescent, Toronto, ON M9W 1X6
   ```

   `BUSINESS_NAP` in `packages/shared/constants/index.ts` is the source of truth
   and `pnpm verify:facts` fails the build if anything drifts from it. If the
   postcard address and that constant disagree, fix the constant — do not fix the
   listing to match a stale value.

## Step 2 — get the Place ID

Once verified, the write-a-review deep link needs the Place ID.

1. Open <https://developers.google.com/maps/documentation/places/web-service/place-id>
2. Search the business name and address in the finder.
3. Copy the `ChIJ…` string.

Then, in `packages/shared/constants/index.ts`, set the `href` on the Google entry
in `REVIEW_DESTINATIONS`:

```ts
{
  platform: 'Google',
  href: 'https://search.google.com/local/writereview?placeid=ChIJ…',
  note: 'The one most people see first, in Maps and in search results.',
  rank: 1,
},
```

Open the URL first and confirm it lands on a write-review dialog for this
business. That is the rule for every URL in that file and it exists because
seven of nine footer links once pointed at platform home pages.

`/r` renders it automatically after that — first, because `rank: 1`. No other
change is needed.

Also add the public Maps profile URL to `PROFILE_LINKS`, which puts it into
`sameAs` in the organisation schema and onto `/reviews`. That is the edge that
tells Google the listing and the website are one entity.

## Step 3 — hand out the card

`public/review-card.svg` is a 6×4in leave-behind. The QR encodes
`https://ecowoods.ca/r` and was verified by decoding it back out of the finished
artwork at 1200, 800 and 600px wide. Print at full size; do not recolour it,
shrink it, or crop its quiet zone.

Give one to **every** customer on **every** completed job. Not the ones that went
well. Every one.

`review-request.md` in this folder is the email and SMS version, with the timing
and the reasoning.

## What must not happen

- **No gating.** No asking how it went and then deciding who gets the link.
  Google's UGC policy prohibits discouraging negative reviews and selectively
  soliciting positive ones. `scripts/verify-outreach.mjs` fails the build if `/r`
  ever grows a sentiment step.
- **No incentives.** No discount, no draw, no gift card. Prohibited, and it
  contaminates every review already there.
- **No writing them yourself, and none from staff or family.** One is enough to
  lose the profile.
- **No second listing.** If a duplicate appears, report it rather than using it.

## What to expect

Slowly. A real profile climbs at the rate jobs finish, and that is the property
that makes it worth anything. Reviews arriving faster than jobs complete is the
pattern platforms detect and AI assistants distrust.

The number to watch is not the average — it is the count, and whether the most
recent review is recent. Both are visible to everything that reads the listing.
