# ecowoodshardwood.com → ecowoods.ca

**Status, measured 2026-08-23: the old domain is LIVE and not redirecting.**

`www.ecowoodshardwood.com/` answers **200** — a second live homepage for this
business — and every deep path answers **404**. So the Next redirects below are
not merely inert; they can never fire, because the domain does not resolve to
this app at all.

**The executable fix is `old-domain/` in the repository root:** a config file for
every host type, and `old-domain/EXECUTE.md`, which starts by identifying what is
actually serving that 200 and then gives the exact steps for it. Attaching the
domain to this Vercel project (below) is one of the options it covers, and the
simplest one if the DNS can be moved.

Gate: `pnpm verify:domain` — it exits non-zero until every path is a clean,
path-preserving, single-hop 301.

## Why this matters more than it looks

Two domains serving the same business split every signal that matters. Links
point at one, citations at the other, directory listings at whichever was
current when they were created — and a search engine resolving *which entity is
Ecowoods* has to guess. That guess is exactly the failure that started this
work: an AI assistant read a local listing, saw a small review count, and never
reconciled it with the 177 on HomeStars.

Every link ever earned by the old domain is currently a link to a different
website as far as a crawler is concerned. Consolidating hands all of it to one
address.

## What is already done

`apps/web/next.config.js` declares four permanent redirects — bare and `www`,
root and every path:

```
ecowoodshardwood.com/:path*      → https://ecowoods.ca/:path*   301
www.ecowoodshardwood.com/:path*  → https://ecowoods.ca/:path*   301
```

Two deliberate choices:

- **301, not 302.** A temporary redirect tells a crawler to keep the old URL
  indexed, which is the opposite of consolidation.
- **Path-preserving, not all-to-homepage.** A link to
  `/services/floor-refinishing` on the old domain lands on the page about floor
  refinishing. Redirecting everything to `/` is the common way this is done and
  it discards most of the value — the visitor arrives somewhere generic and the
  crawler learns nothing about which page replaced which.

## The one thing that cannot be done from the repository

**`ecowoodshardwood.com` must be added as a domain on this Vercel project.**
Until it is, its requests never reach this app and the rules above match
nothing — they are inert and cannot break anything.

1. Vercel → the `ecowoods-app` project → Settings → Domains.
2. Add `ecowoodshardwood.com` and `www.ecowoodshardwood.com`.
3. Vercel shows the DNS records required. Set them at whoever holds the old
   domain's DNS. If the old domain currently points at a different host, this
   step takes it off that host — confirm nothing else is served from it first
   (an old email setup on the same DNS is the usual surprise; MX records are
   separate and are not affected by an A or CNAME change, but check).
4. Wait for propagation, then verify:

```
curl -sI https://ecowoodshardwood.com/services/floor-refinishing | head -5
# expect: HTTP/2 301
#         location: https://ecowoods.ca/services/floor-refinishing
```

The path must survive. If it lands on `https://ecowoods.ca/` instead, the
path-preserving rule is not firing and the redirect is doing a fraction of its job.

## After it is live

- **Search Console:** add `ecowoodshardwood.com` as a property and use the
  Change of Address tool. This is not optional — it is how Google is told the
  move is deliberate rather than an outage.
- **Bing Webmaster Tools:** same, via Site Move.
- **Directories:** every listing still pointing at the old domain should be
  updated to `ecowoods.ca`. The 301 covers visitors; the listing itself is a
  citation and should name the canonical address.
  See `DIRECTORY_CONSISTENCY_CHECKLIST.md`.
- **Do not remove the redirects, ever.** They are permanent by design. A 301
  that disappears turns every inbound link into a 404 years after anyone
  remembers why.

## What must not happen

- **No canonical tag from the old domain to the new one instead of a redirect.**
  A canonical is a hint; a 301 is an instruction. Use the instruction.
- **No redirect chains.** `www` → bare → `https` → destination costs signal at
  each hop. The rules above go straight to the final URL in one step.
- **No redirecting the old domain to a marketing landing page.** It goes to the
  matching page or the homepage, nothing else.
