# Domain consolidation — ecowoodshardwood.com → ecowoods.ca

`old-domain/EXECUTE.md` is the procedure. This is why it is the procedure, and
why the obvious version of it would have made things worse.

## The situation

Two websites exist for one business. `ecowoods.ca` is this repository.
`ecowoodshardwood.com` is a hosted store platform, still live, answering HTTP
200 on 35 URLs as measured on 2026-09-09, served by `Apache/2.4.68 (Debian)`.

Both describe the same company, at the same address, with the same phone number.
To a search engine that is not one business with two sites; it is an entity
whose signals are split across two domains, each competing with the other for
the same queries.

## What is actually stranded there

Twenty-two of the 36 URLs in the old sitemap are individual customer
testimonials with real names — Audrey in Toronto, Andre Fauteux, Melissa
McCormack, Joan Endersby, Michelle P in East York. Published reviews, written by
customers, sitting on a domain that does nothing with them.

That is the largest reputation asset this business owns outright, and every one
of them is a single line in `old-domain/path-map.json` away from pointing at
`/reviews`.

## Why the redirects are not path-preserving

`/x → ecowoods.ca/x` is the correct default for a migration and it is exactly
wrong here. The two sites share **zero** paths. The old URLs look like:

```
/pages/flooring-services-toronto-etobicoke-hamilton
/blogs/testimonials/172376--audrey-in-toronto
/?fuseaction=store.returns
```

None of those exists on `ecowoods.ca`. A path-preserving rule turns all 36 live
URLs into hard 404s — which is worse than the pages they serve now, because now
it is `ecowoods.ca` serving the 404, and the destination domain absorbs the
signal that the content is gone.

Both `vercel.json` and `apps/web/next.config.js` carried path-preserving
host-conditioned rules for the old domain at one point. They were inert only
because the domain was never attached. Attaching it would have shipped the
defect silently.

## Why the map was built from the navigation, not the slugs

Each old URL was matched to a destination using the old site's own navigation
labels — Home, About, Services, Testimonials, Portfolio, Blog, Contact — read
from the live pages, rather than by reading the slugs.

The reason is on the record in `path-map.json`: the contact page's slug is
`hardwood-floor-installation-and-refinishing-toronto-etobicoke-hamilton`. Slug
matching sends it to `/services`. It is the contact form. Slug-based mapping
does not fail loudly; it produces confident wrong answers.

## One source, four targets

`old-domain/path-map.json` is the only file anyone edits. `pnpm domain:build`
generates from it:

| target | for |
|---|---|
| `old-domain/.htaccess` | Apache — what the old host runs today |
| `old-domain/nginx.conf` | nginx |
| `old-domain/_redirects` | Netlify |
| `old-domain/index.php` | a host that allows none of the above |
| `vercel.json` redirects | attaching the domain to this Vercel project |

`pnpm domain:check` fails the build if any of them has drifted from the map, and
`scripts/verify-vercel-config.mjs` asserts the Vercel rules stay
non-path-preserving. Hand-editing a generated file is the one way to reintroduce
the failure above.

## Order of operations, and the one that matters

1. Execute the redirects (`old-domain/EXECUTE.md`).
2. `pnpm verify:domain` until it reports **36 correct, 0 failures**.
3. Only then file the change of address in Google Search Console and the site
   move in Bing Webmaster Tools.

Step 3 before step 2 is actively harmful. Telling Google a move happened while
the old site still answers 200 on every URL is a statement it can check and
find false, and the usual outcome is that the move is not honoured and both
domains keep competing.

## Keep the redirects forever

A 301 is not a task that completes. Links to those 36 URLs exist in other
people's pages, in directories, and in the index, for years. Do not retire the
old DNS zone or the old hosting for at least twelve months after the move, and
keep the redirect rules permanently. The redirect is the only thing carrying
that equity across.
