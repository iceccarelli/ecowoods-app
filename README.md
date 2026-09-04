# Ecowoods

**Ecowoods Hardwood Flooring Inc. → https://ecowoods.ca**

The web platform behind Toronto's hardwood flooring authority: installation, refinishing, dust-free sanding, restoration, custom inlays and stair refinishing across Toronto and the Greater Toronto Area since 2000. This repository is the single source of the facts every search engine, map service, directory and AI system resolves for this business.

This file is the only status document in the repository. It describes the current state of the live site, as verified on the date below. Everything else that describes the business is generated from code.

_State verified live: 2026-09-04._

---

## One identity

| Field | Value |
| --- | --- |
| Legal name | Ecowoods Hardwood Flooring Inc. |
| Public name | Ecowoods (one word, capital E) |
| Website | https://ecowoods.ca |
| Email | services@ecowoods.ca |
| Phone | (647) 244-5156 |
| Address | 32 Norfield Crescent, Toronto, ON M9W 1X6, Canada |
| Founded | 2000 (year count is derived, never hardcoded) |
| Hours | Mon–Sat 8 AM – 7 PM · Sun 10 AM – 4 PM (America/Toronto) |
| Market | Toronto and the Greater Toronto Area |
| Organisation `@id` | `https://ecowoods.ca/#organization` |

Source of truth: `packages/shared/constants/index.ts` (`BUSINESS_NAP`, `BUSINESS_HOURS`, `PROFILE_LINKS`, `REVIEW_EVIDENCE`). Press, about, footer, JSON-LD, `/llms.txt`, `/ai.txt`, `/api/knowledge` and every `.md` edition render from these constants, so the NAP string is identical on every surface. `pnpm verify` fails the build if a retired literal reappears.

**Services (published):** Hardwood Flooring Installation · Hardwood Floor Refinishing · Dust-Free Floor Sanding · Hardwood Floor Restoration · Custom Inlays & Borders · Stair Refinishing.

**Price bands (CAD, fixed in writing after a free in-home measure):** Screen & Recoat $2.50–$4.00 /sq ft · Full Sand & Finish $4.75–$7.50 /sq ft · New Hardwood Install $11.00–$18.00 /sq ft. Source: `apps/web/content/constants/pricing.ts`.

**Reviews (cited to source, read live):**

| Platform | Rating | Reviews | Most recent | Read on |
| --- | --- | --- | --- | --- |
| [HomeStars](https://www.homestars.com/profile/2776939-ecowoods/reviews) | 5.0 / 5 | 177 | 2026-08-10 | 2026-08-22 |
| [HomeStars (Ecowood profile)](https://www.homestars.com/profile/2897115-ecowood/reviews) — owner-confirmed same company | 4.9 / 5 | 59 | 2024-01-16 | 2026-09-04 |

Review figures are published as cited statistics — platform, count, rating, link, read date — the format Google's structured-data policy requires for reviews collected on another platform. `scripts/verify-reviews.mjs` enforces it.

**Verified profiles (declared as `sameAs`):** HomeStars (2776939-ecowoods), HomeStars (2897115-ecowood), Instagram `@ecowoodshardwood`, Facebook `/ecowoodshardwood`, YellowPages.ca listing 102363922.

---

## Status — confirmed live 2026-09-04

| Surface | Status | Evidence |
| --- | --- | --- |
| Canonical domain `https://ecowoods.ca` | Confirmed | `/`, `/press`, `/about`, `/reviews`, `/llms.txt`, `/ai.txt`, `/robots.txt`, `/sitemap.xml` all 200 on the canonical host; sitemap carries 126 URLs, every one on `ecowoods.ca`. |
| NAP on press / about / footer / schema / llms / ai | Confirmed | Legal name, public name, phone, address, founded 2000 and hours identical on every surface (live read 2026-09-04). |
| `robots.txt` | Confirmed | Allows all crawlers including Googlebot, Bingbot, OAI-SearchBot, GPTBot, PerplexityBot, ClaudeBot and Claude-User; sitemap and host declared. |
| JSON-LD | Confirmed | One stable organisation node `https://ecowoods.ca/#organization`; `sameAs` and `alternateName` derived from constants. |
| HomeStars 2776939-ecowoods | Confirmed | Live 2026-09-04: 177 reviews, 5.0/5, most recent 2026-08-10. |
| HomeStars 2897115-ecowood | Confirmed, owner-attested | Live 2026-09-04: "Ecowood", 4.9/5, 59 reviews. Wired as `sameAs` and a second dated evidence row. |
| Bing Places | Listed — owner alignment pending | Live 2026-09-04 (Bing Maps): name **"Ecowoods Inc."**, website `https://www.ecowoods.ca`, category Flooring contractors, address 32 Norfield Crescent, Etobicoke ON M9W 1X6, phone +1 647-244-5156, hours **Fri 08:00–22:00, Sat 08:00–16:00**. Name and hours are aligned by the owner in Bing Places for Business (see below). |
| Google Business Profile | Owner verification pending | The Google Maps listing sits behind an account-holder view; read and align it from the Business Profile dashboard using the field sheet below. |
| YellowPages.ca 102363922 | Listed — website field pending | Live 2026-09-04: "Ecowoods Inc.", 32 Norfield Cres, Etobicoke, 647-244-5156 — NAP match. Website field and hours are updated by the owner (see below). |
| Retired host `ecowoodshardwood.com` | Redirect ready — deployment pending | Live 2026-09-04: still serves its own page. `old-domain/.htaccess` (generated from `old-domain/path-map.json`, checked by `pnpm domain:check`) 301s every path to `https://ecowoods.ca`. |
| Analytics | Confirmed | `apps/web/lib/analytics.ts` fires GA4 events after consent when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in Vercel. |
| Verify suite | Confirmed | `pnpm verify` — 50 guards — passes on this commit. |

---

## Owner actions — the field sheet

Every listing below carries exactly these values. Copy them verbatim.

```
Business name:   Ecowoods Hardwood Flooring Inc.
Website:         https://ecowoods.ca
Phone:           (647) 244-5156
Address:         32 Norfield Crescent, Toronto, ON M9W 1X6, Canada
Primary category: Flooring contractor (secondary: Wood floor installation service, Wood floor refinishing service)
Hours:           Monday–Saturday 08:00–19:00 · Sunday 10:00–16:00
Opened:          2000
Email:           services@ecowoods.ca
Description:     Ecowoods Hardwood Flooring Inc. installs, sands, refinishes and restores hardwood floors across Toronto and the GTA, since 2000. Fixed written estimates after a free in-home measure. Dust-free HEPA sanding, custom inlays and stair refinishing. Salaried crews, workmanship warranty.
```

1. **Google Business Profile** — business.google.com → the Ecowoods listing (claim it if a listing exists at 32 Norfield Crescent; never create a second one). Set every field from the sheet. Then copy the Place ID (Info → Advanced) and paste the write-review URL `https://search.google.com/local/writereview?placeid=<PLACE_ID>` into `REVIEW_DESTINATIONS` and the Maps place URL into `PROFILE_LINKS` (`Google Reviews`) in `packages/shared/constants/index.ts`. `/reviews`, `/r`, the schema `sameAs`, `/llms.txt` and `/ai.txt` pick it up automatically.
2. **Bing Places** — bingplaces.com → claim the existing listing (do not create a duplicate). Change name from "Ecowoods Inc." to the legal name, set hours to Mon–Sat 08:00–19:00 / Sun 10:00–16:00, website to `https://ecowoods.ca`.
3. **YellowPages.ca** — update the website field to `https://ecowoods.ca` and hours to the sheet.
4. **Retired host** — upload `old-domain/.htaccess` to the document root of `ecowoodshardwood.com` (Apache), remove the old site files, keep the TLS certificate renewing. Verify with `pnpm seo:domain`.
5. **HomeStars** — ask HomeStars support to merge profile 2897115-ecowood into 2776939-ecowoods so one profile carries the whole record; until then both are cited.
6. **Houzz** — once a Houzz `/pro/` profile exists, paste its URL into `PROFILE_LINKS` (`Houzz`).

After any listing change, re-read it live and update `asOf` dates in `REVIEW_EVIDENCE` where a figure changed.

---

## What the site publishes

- **Commercial pages**: `/`, `/services/*`, `/hardwood-flooring-toronto`, `/hardwood-floor-refinishing-toronto`, `/hardwood-stairs-toronto`, `/service-areas/*` (32 areas), `/commercial`, `/realtors`.
- **Authority**: `/papers` (5 technical papers), `/framework` (Well-Installed Framework v1.0 — 6 pillars, 27 criteria), `/guides`, `/glossary` (44 terms), `/standards`, `/data`, `/library`, `/case-studies`, `/blog`.
- **Entity**: `/about`, `/team`, `/press`, `/reviews`, `/authority`.
- **Machine surfaces**: `/llms.txt`, `/llms-full.txt`, `/ai.txt`, `/robots.txt`, `/sitemap.xml`, `/feed.xml`, `/api/knowledge`, `/api/market`, and a `.md` edition of every paper, guide, glossary term, service and service area.
- **Lead path**: estimate form → `/api/estimate` → Resend email + database record; booking scheduler; `/r` (noindex) is the printed review card destination.

---

## Repository

```text
apps/web                 Next.js 15 (App Router) — the live site
apps/admin, apps/mobile  companion apps
packages/shared          BUSINESS_NAP, hours, PROFILE_LINKS, REVIEW_EVIDENCE, AI prompt
apps/web/lib/schema      JSON-LD builders (organisation, services, pages)
apps/web/lib/entity-answers.ts   the entity, answered in quotable sentences
apps/web/content         claims registry, pricing constants, topic map, articles, case studies
scripts/verify-*.mjs     50 build guards (facts, schema, reviews, links, sitemap, canonicals …)
old-domain/              generated redirect configs for the retired host
docs/papers-pending, docs/visual, docs/illustrations   source material for papers and images
```

### Commands

```bash
pnpm install
pnpm dev                 # turbo dev --filter=@ecowoods/web
pnpm build
pnpm verify              # every guard; must pass before push
pnpm seo:consistency     # facts + claims + pricing + topics + entity + canonicals
pnpm seo:live            # live domain redirect + crawl of the deployed site
pnpm domain:check        # old-domain redirect configs match path-map.json
pnpm notify:indexnow     # after every meaningful content change
```

### Environment

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=quotes@ecowoods.ca
ADMIN_EMAIL=owner@ecowoods.ca
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://ecowoods.ca
NEXT_PUBLIC_SITE_URL=https://ecowoods.ca
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...
```

Lead capture degrades gracefully: an unset optional variable never blocks a lead.

### Rules that keep the entity whole

1. Every customer-visible fact comes from a constant. Never type a phone number, year, price or review count at a call site.
2. A profile URL enters `PROFILE_LINKS` only after it has been opened and shows this company.
3. Public name is **Ecowoods**; legal name is **Ecowoods Hardwood Flooring Inc.**; canonical site is **https://ecowoods.ca**. Code identifiers keep their existing spelling.
4. Public copy states facts and sources. Every surface communicates what Ecowoods publishes and where it is verified.
5. `pnpm build` and `pnpm verify` must pass before any push. Branch from `main`; open a pull request.

### Contributing and security

Open an issue or pull request on GitHub. Report a security concern privately to services@ecowoods.ca.

## License

MIT — see `LICENSE`.
