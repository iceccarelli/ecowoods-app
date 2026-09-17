# Ecowoods

**Ecowoods Hardwood Flooring Inc. → https://ecowoods.ca**

The web platform behind Toronto's hardwood flooring authority: installation, refinishing, dust-free sanding, restoration, custom inlays and stair refinishing across Toronto and the Greater Toronto Area since 2000. This repository is the single source of the facts every search engine, map service, directory and AI system resolves for this business.

This file is the only status document in the repository. It describes what this repository publishes and how each surface stays in sync. Everything else that describes the business is generated from code.

_Facts last read from source: 2026-09-15._

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
| [Google](https://www.google.com/maps/place/?q=place_id:ChIJcZSiRZAwK4gRUz7OX0_K7U4) | 4.8 / 5 | 19 | see profile | 2026-09-04 |

Review figures are published as cited statistics — platform, count, rating, link, read date — the format Google's structured-data policy requires for reviews collected on another platform. `scripts/verify-reviews.mjs` enforces it.

**Verified profiles (declared as `sameAs`):** Google Maps place (Place ID ChIJcZSiRZAwK4gRUz7OX0_K7U4, also `hasMap`), HomeStars (2776939-ecowoods), HomeStars (2897115-ecowood), Instagram `@ecowoodshardwood`, Facebook `/ecowoodshardwood`, YellowPages.ca listing 102363922.

**Google Business Profile identifiers:** Business Profile ID `9189101272120311568` (dashboard / support) · Place ID `ChIJcZSiRZAwK4gRUz7OX0_K7U4` (write-review link) · CID `5687424346697383507` (Maps deep link) · knowledge-graph id `/g/11g02cm1tr`.

---

## One canonical entity

Every machine and public surface this repository generates resolves to one business, one
domain, and one NAP. There is no second published identity anywhere in this repository.

| Surface | State |
| --- | --- |
| Canonical domain | `https://ecowoods.ca` is the only domain this repository serves or publishes anywhere — press, about, schema, llms, ai, and every directory instruction in this file. |
| Domain consolidation | Every legacy `ecowoodshardwood.com` URL 301s to its equivalent page on `ecowoods.ca`, path-preserving rather than blanket-to-homepage. Declared in `vercel.json` and `apps/web/next.config.js`, both generated from `old-domain/path-map.json`. `scripts/verify-domain-redirect.mjs` and `scripts/verify-stale-hosts.mjs` check it live; `scripts/verify-business-facts.mjs` fails the build if the retired host ever reappears in a page, a schema builder, a content file or a shared constant. See `docs/outreach/DOMAIN_CONSOLIDATION.md`. |
| Non-canonical hosts | `www.ecowoods.ca` and the Vercel preview alias (`ecowoods-app.vercel.app`) both 301 to `https://ecowoods.ca`. |
| NAP on press / about / footer / schema / llms / ai | Legal name, public name, phone, address, founded year and hours render from one set of constants (`packages/shared/constants`), so no surface can disagree with another. |
| `robots.txt` | Allows all crawlers including Googlebot, Bingbot, OAI-SearchBot, GPTBot, PerplexityBot, ClaudeBot and Claude-User; sitemap and host declared. |
| JSON-LD | One stable organisation node `https://ecowoods.ca/#organization`; `sameAs`, `alternateName` and the Google Business Profile / Place / CID / HomeStars identifiers all derived from constants — never typed twice. |
| Google Business Profile | Business Profile ID `9189101272120311568`, Place ID `ChIJcZSiRZAwK4gRUz7OX0_K7U4` — name, address, phone, hours and category match the constants above; the Maps and write-review links render from `GOOGLE_PLACE` on `/reviews`, `/press`, `/contact`, `/llms.txt` and `/ai.txt`. |
| HomeStars 2776939-ecowoods | 177 reviews, 5.0/5, most recent 2026-08-10 — cited to source in `REVIEW_EVIDENCE`. |
| HomeStars 2897115-ecowood | "Ecowood", 4.9/5, 59 reviews — owner-confirmed same company, wired as `sameAs` and a second dated evidence row. |
| Review automation | `lib/review-request.ts`: one ungated email per COMPLETED project, stamped before it sends, triggered by `updateProjectStatus()` and swept hourly by `/api/cron/review-requests` (cron in `vercel.json`, guarded by `CRON_SECRET`). Same destinations as `/r`; `scripts/verify-outreach.mjs` enforces it. |
| Error tracking | `instrumentation.ts` (`onRequestError`) + `app/error.tsx` + `app/global-error.tsx` + `/api/client-error` → `lib/error-reporting.ts`: structured stderr line on Vercel, forwarded to `ERROR_WEBHOOK_URL` when set. |
| Geo coordinates | `BUSINESS_NAP.address` carries Google's pin for the address (43.7197642, -79.546973). |
| Analytics | `CookieConsentBanner` loads GA4 only after consent and only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured; `lib/analytics.ts` fires the conversion events. `pnpm env:check` reports which production integrations are currently configured. |
| Verify suite | `pnpm verify` runs every guard against this commit. `pnpm test:web` runs the vitest suite (golden queries, API contract, negative, invariants, drift, schema, security). |

Directory listings (Bing Places, YellowPages, 411.ca, TrustedPros and others) are kept aligned to
the field sheet below; a listing whose own website field still points anywhere but
`https://ecowoods.ca` is corrected there, not documented here as a site defect.

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

1. **Google Business Profile** (ID 9189101272120311568) — business.google.com → Edit profile → Contact → add phone **(647) 244-5156**; set the business name to the legal name if Google accepts it (the current "Ecowoods Hardwood Flooring" is joined via `alternateName`); confirm the Facebook link points at facebook.com/ecowoodshardwood (Google currently shows a numeric page id); add the six services and the description from the sheet; upload real job photos. The Maps deep link and the write-review link are already wired in `packages/shared/constants/index.ts` and render on /reviews, /r, the schema (`sameAs` + `hasMap`), /llms.txt and /ai.txt.
2. **Bing Places** — bingplaces.com → claim the existing listing (do not create a duplicate). Change name from "Ecowoods Inc." to the legal name, set hours to Mon–Sat 08:00–19:00 / Sun 10:00–16:00, website to `https://ecowoods.ca`.
3. **Directories** — YellowPages.ca (102363922), 411.ca (7521278) and TrustedPros (`ecowoods-inc`): set website to `https://ecowoods.ca`, hours to the sheet, email to services@ecowoods.ca. 411.ca states NWFA member #050884 — if the certificate is on file, send it to the repo and the claim enters `content/claims.ts` and the schema; until then it stays off the site.
4. **Vercel environment** — set `CRON_SECRET` (both crons), `ERROR_WEBHOOK_URL` (a Slack/Discord incoming webhook, optional), `NEXT_PUBLIC_GA_MEASUREMENT_ID`, and confirm `RESEND_*`, `ADMIN_EMAIL`, `NEXTAUTH_URL=https://ecowoods.ca`. `vercel env pull apps/web/.env.local && pnpm env:check` prints what is still unset.
5. **HomeStars** — ask HomeStars support to merge profile 2897115-ecowood into 2776939-ecowoods so one profile carries the whole record; until then both are cited.
6. **Houzz** — once a Houzz `/pro/` profile exists, paste its URL into `PROFILE_LINKS` (`Houzz`).

Domain and infrastructure cutover procedures (attaching a domain in Vercel, retiring a
non-canonical host) are an operations kit, not a status page: see `old-domain/EXECUTE.md`.

After any listing change, re-read it live and update `asOf` dates in `REVIEW_EVIDENCE` where a figure changed.

---

## What the site publishes

- **Commercial pages**: `/`, `/services/*`, `/hardwood-flooring-toronto`, `/hardwood-floor-refinishing-toronto`, `/hardwood-stairs-toronto`, `/service-areas/*` (32 areas), `/commercial`, `/realtors`.
- **Floor Studio**: `/floor-studio` — a photograph of a room, analysed and composited in the browser, with a real Ecowoods configuration rendered into it and a live estimated installed range. Four doors, one system: `/floor-studio` (discovery), `/design` (the configurator), `/estimate` (the measure and the fixed price), `/pricing` (the bands). The photograph is never uploaded; a share link carries the floor, never the room. No generative imagery — every board rendered is a configuration this company can install (`apps/web/lib/floor-studio/`, `docs/FLOOR_STUDIO.md`).
- **Authority**: `/papers` (5 technical papers), `/framework` (Well-Installed Framework v1.0 — 6 pillars, 27 criteria), `/guides`, `/glossary` (44 terms), `/standards`, `/data`, `/library`, `/case-studies`, `/blog`.
- **Entity**: `/about`, `/team`, `/press`, `/reviews`, `/authority`.
- **Machine surfaces**: `/llms.txt` (llmstxt.org shape, curated, `## Optional` long tail), `/llms-full.txt`, `/ai.txt`, `/robots.txt`, `/sitemap.xml`, `/feed.xml`, `/api/knowledge`, `/api/market`, `/md` (index) and a `.md` edition of every paper, guide, glossary term, service, service area, plus `/index.md`, `/about.md`, `/services.md`, `/service-areas.md`, `/pricing.md`, `/reviews.md`, `/estimate.md`, `/contact.md`, `/floor-studio.md` and the three head-term pages. Every page with a twin advertises it with `<link rel="alternate" type="text/markdown">` and a `Link` header.
- **Agentic primitives (Protocol v2)**: `/api/v1` — entity, services, locations, pricing, reviews, evidence, sources, FAQ, pages, actions, graph, manifest, changefeed, citation packs, `service-match`, `recommendation-context`, OpenAPI 3.1 at `/api/v1/openapi.json`. Every primitive carries `canonical_url`, `source`, `provenance.verified_at` and `status`; ETag/304 on every response. Registry: `apps/web/lib/registry/` (a projection of the constants — it owns no fact). Docs: `docs/agentic/API.md`. Constitution: `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md`.
- **P0 pages added**: `/pricing` (table first, stable row ids the registry cites), `/estimate` (the `request_estimate` action target; JSON-LD `potentialAction`), `/contact` (the NAP on one URL with citable fragment ids). Service pages carry "When this is the wrong service" and stable section ids.
- **Lead path**: estimate form → `/api/estimate` → Resend email + database record; booking scheduler; `/r` (noindex) is the printed review card destination.
- **Review flywheel**: admin marks a project COMPLETED → `lib/review-request.ts` stamps `Project.reviewRequestedAt` and sends the one review email (Google first, then HomeStars — the same links as `/r`, to every customer, no sentiment step); `/api/cron/review-requests` sweeps hourly for anything the trigger missed.
- **Observability**: every uncaught server error (`instrumentation.ts`) and every client render failure (`app/error.tsx`, `app/global-error.tsx` → `/api/client-error`) becomes one structured JSON line in the Vercel log and, when `ERROR_WEBHOOK_URL` is set, one webhook post. GA4 loads after consent.

---

## Repository

```text
apps/web                 Next.js 15 (App Router) — the live site
apps/admin, apps/mobile  companion apps
packages/shared          BUSINESS_NAP, hours, PROFILE_LINKS, REVIEW_EVIDENCE, AI prompt
apps/web/lib/schema      JSON-LD builders (organisation, services, pages) — one business entity, potentialAction, identifiers
apps/web/lib/registry    the entity truth system as primitives: registry, intents, locations, matcher, citations, changes, manifest, OpenAPI
apps/web/app/api/v1      the agentic primitives API (23 route files, all declared in lib/registry/manifest.ts)
apps/web/tests           vitest: golden queries, API contract, negative, invariants, drift, schema, security
scripts/agentic          01_baseline … 07_verify-production — the reproducible command manifest
scripts/gap-curator.mjs  the Web Gap Curator → audit/gaps.json (internal)
apps/web/lib/entity-answers.ts   the entity, answered in quotable sentences
apps/web/content         claims registry, pricing constants, topic map, articles, case studies
scripts/verify-*.mjs     50 build guards (facts, schema, reviews, links, sitemap, canonicals …) + live checks (domain, hosts)
apps/web/lib/review-request.ts, app/api/cron/review-requests   the post-job review flywheel
apps/web/lib/error-reporting.ts, instrumentation.ts              error tracking
old-domain/              generated redirect configs for the retired host
docs/papers-pending, docs/visual, docs/illustrations   source material for papers and images
```

### Commands

```bash
pnpm install
pnpm dev                 # turbo dev --filter=@ecowoods/web
pnpm build
pnpm verify              # every guard; must pass before push
pnpm test:web            # vitest: golden queries, contract, negative, invariants, drift, schema, security
node scripts/verify-production-agentic.mjs   # live: machine files, markdown twins, P0 pages, /api/v1 vs the constants
node scripts/gap-curator.mjs [--live]        # the gap register → audit/gaps.json
pnpm seo:consistency     # facts + claims + pricing + topics + entity + canonicals
pnpm seo:live            # live: old-domain redirect + stale hosts + crawl of the deployed site
pnpm seo:hosts           # live: ecowoods-app.vercel.app and www must redirect to the canonical
pnpm domain:check        # old-domain redirect configs match path-map.json
pnpm env:check           # which production integrations are configured (values never printed)
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
CRON_SECRET=...              # authorises /api/cron/quote-recovery and /api/cron/review-requests
ERROR_WEBHOOK_URL=https://... # optional: Slack/Discord/any webhook that receives error reports
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
