# HUMAN-P0 — off-site work the code cannot do (0–7 days)

Everything in this file requires a human with account access. The code side of
P0 is done in this repo; none of it pays off fully until these are executed.
Work top to bottom — item 1 unblocks items 2 and half of the SEO value.

Every field value you need is spelled out. Do not retype from memory; copy from
here or from `packages/shared/constants/index.ts` (the NAP source of truth).

---

## 1. Kill ecowoodshardwood.com as a content host (redirect-only)

The old ColdFusion site is still serving pages and splitting the domain's
equity. The redirect files are ALREADY GENERATED in this repo under
`old-domain/` — one per hosting shape:

| Host type              | Upload this file            |
| ---------------------- | --------------------------- |
| Apache (most cPanel)   | `old-domain/.htaccess`      |
| nginx                  | `old-domain/nginx.conf`     |
| Netlify                | `old-domain/_redirects`     |
| PHP-only fallback      | `old-domain/index.php`      |
| DNS moved to Vercel    | nothing — root `vercel.json` already carries the host-scoped 301s; just add both `ecowoodshardwood.com` hosts to the Vercel project |

Follow `old-domain/EXECUTE.md` for the exact steps. The redirects are mapped
per URL from the old sitemap (`old-domain/path-map.json`), not blind
path-preservation — the two sites share zero paths, so blind `/:path*`
preservation would 404 every old URL.

**Verify (from any terminal):**

```
curl -sI https://www.ecowoodshardwood.com/ | grep -i location
# → location: https://ecowoods.ca/
curl -sI https://www.ecowoodshardwood.com/pages/flooring-services-toronto-etobicoke-hamilton | grep -i location
# → location: https://ecowoods.ca/services
```

Both must be `301`, not `302`.

## 2. Google Search Console — Change of Address

Prerequisite: item 1 is live (GSC validates the 301s before accepting).

1. Verify BOTH properties in GSC: `ecowoodshardwood.com` (domain property) and
   `ecowoods.ca` (already verified — env `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`).
2. Old property → Settings → **Change of Address** → new site: `https://ecowoods.ca`.
3. On the ecowoods.ca property, resubmit `https://ecowoods.ca/sitemap.xml`.
4. Diarize: the Change of Address notice stays active 180 days. Do not delete
   the old property before then.

## 3. Google Business Profile — make it byte-identical to the site

Field values (copy exactly):

- Business name: `Ecowoods Hardwood Flooring Inc.`
- Address: `32 Norfield Crescent, Toronto, ON M9W 1X6`
- Phone: `(647) 244-5156`
- Website: `https://ecowoods.ca` (NOT ecowoodshardwood.com — check this field,
  it is the most common leftover)
- Hours — must match the site to the minute:
  - Monday–Saturday: `8:00 AM – 7:00 PM`
  - Sunday: `10:00 AM – 4:00 PM`
- Categories: primary `Flooring contractor`, secondary `Wood floor installation service` /
  `Wood floor refinishing service` (pick the closest GBP taxonomy entries).
- Services (with the published bands, verbatim):
  - Screen & Recoat — $2.50–$4.00 / sq ft
  - Full Sand & Finish — $4.75–$7.50 / sq ft
  - New Hardwood Install — $11.00–$18.00 / sq ft

When the GBP public URL (`https://www.google.com/maps/place/...` share link or
`g.page/...`) is confirmed, add it to `PROFILE_LINKS` in
`packages/shared/constants/index.ts` (set `href`) and redeploy — `sameAs`
in the schema graph derives from that file and will pick it up. Do NOT add it
anywhere else by hand.

## 4. YellowPages — fix the website field

Listing: `yellowpages.ca/bus/Ontario/Etobicoke/Ecowoods-Inc/102363922.html`
(already in `PROFILE_LINKS` as verified).

- Website field → `https://ecowoods.ca`
- NAP identical to item 3. Name on YP is `Ecowoods Inc.` — that form is already
  declared as `alternateName` in the schema, so leave it if YP won't change it,
  but the address/phone/site must match.

## 5. CallRail (or equivalent) — speed to lead

- Missed-call text-back within 60 s on (647) 244-5156.
- Target speed-to-lead < 5 min during open hours (Mon–Sat 08:00–19:00,
  Sun 10:00–16:00).
- ⚠️ NAP warning: do NOT swap the site's visible number for a raw CallRail
  tracking number. Use CallRail's dynamic number insertion (their JS swaps only
  for paid-traffic sessions) or track at the carrier level. The number printed
  in HTML, schema, GBP and every directory must stay `(647) 244-5156` or local
  rankings take the hit. If dynamic insertion is added, its script domain must
  be added to the CSP allowlist in `apps/web/next.config.js` first.

## 6. Environment variables to actually turn features on

Set in Vercel → Project → Settings → Environment Variables (all documented in
`apps/web/.env.example`):

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 id. The consent banner is now mounted;
  without this id, consent is collected but no analytics load.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL=services@ecowoods.ca` —
  lead + photo-triage emails. Until set, submissions are still captured in the
  structured Vercel logs (`event: lead.captured` / `photo_triage.captured`)
  but nobody is emailed.
- `INDEXNOW_KEY` — GitHub Actions secret (workflow `.github/workflows/indexnow.yml`
  pings on every successful production deploy; it fails loudly if unset).

## 7. Caching caveat to verify after deploy

`vercel.json` now requests `s-maxage=300, stale-while-revalidate=86400` on HTML
routes. Vercel manages the cache of ISR/prerendered pages itself and may
override response cache headers for them. After the next production deploy run:

```
curl -sI https://ecowoods.ca | egrep -i 'cache-control|x-vercel-cache'
```

and record what actually ships. If Vercel overrides it, the CDN cache is still
doing the work (`x-vercel-cache: HIT`) — the header rule then only covers
non-ISR HTML and is harmless.
