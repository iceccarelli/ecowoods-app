# Sprint 2026-08-29 — Observability & Entity Consistency

One unified patch. Every change below is in `fix-observability-sprint.patch`;
apply instructions at the bottom of this file. Verification: the full repo
guard suite (`pnpm verify`, 40 guards) passes after these changes, and
`tsc --noEmit` reports the same 107 pre-existing errors before and after
(none in touched files — all are portal/admin pages with implicit `any` and
ungenerated Prisma types).

## Shipped

### P0-4 — Homepage dust claim
`app/data/hero-variants.ts` still said "Zero dust." in seven variants
(v01, v03, v06, v09, v13, v14, v15) while `lib/guides.ts` publishes, verbatim:
"Dustless never means zero dust." The homepage was the one surface claiming
the absolute the inner pages explicitly refuse. All seven now carry the
registered claim (content/claims.ts): HEPA-sealed dust containment.
One same-shape line in the Distillery case study reworded.
Consequence: the homepage can no longer be quoted against the site's own
papers by an answer engine looking for a contradiction.

### P0-5 — Install-page bands on the first screen
`/hardwood-flooring-toronto` hero now prints all three published bands in
`fw-meta` (same pattern as `/hardwood-floor-refinishing-toronto`), derived
from `content/constants/pricing.ts`. The estimate form's sentence "The bands
above are real ranges" is now true of the layout — the bands are above it.

### P0-6 — /login and /register
Both pages had no metadata: they served the homepage `<title>` and the
site-wide `X-Robots-Tag: index, follow` while robots.txt disallows them.
Now: own titles ("Client sign in", "Create an account" — brand appended by
the layout template), explicit `robots: noindex, nofollow` metadata, and
vercel.json sends `X-Robots-Tag: noindex, nofollow` for
`/(login|register|verify-email)` and `/(admin|mypage|docs)(/.*)?`.
robots.txt Disallow stays; the three surfaces now agree.

### P0-7 — Hours, one constant
Schema and footer said Mon–Sat 8–19 + Sun 10–16; the header drawer,
exit-intent rail and command palette advertised Mon–Sat only. New
`BUSINESS_HOURS` + `HOURS_LINE` / `HOURS_LINE_SHORT` in
`packages/shared/constants`. Both JSON-LD builders
(`lib/structured-data.ts`, `lib/schema/builders.ts`) and all seven chrome
surfaces (Header, SiteFooter, UtilityBar, ConversionRail, CommandPalette,
BookingPanel, BookingScheduler, home-client quote panel) now derive from it.
Operational truth kept as the fuller set already published in schema:
Mon–Sat 08:00–19:00, Sun 10:00–16:00. If that is not the phone reality,
change the one constant. GBP must be set to the same values (operator task).

### P0-8 — Public name
`BUSINESS_NAP.name` was `'Ecowoods Inc.'` — a third form that is neither the
legal name nor the brand. It is now `'Ecowoods'` (public name), with
`alternateNames: ['Ecowoods Inc.', 'Ecowoods Hardwood Flooring']` emitted as
schema.org `alternateName` (type + both builders wired), so the YellowPages
listing ("Ecowoods Inc.") still reconciles to this entity. `legalName`
unchanged: Ecowoods Hardwood Flooring Inc.

### Brand spelling — "EcoWoods" purged
49 occurrences of "EcoWoods" (capital W) across 30 files — page titles,
schema `name` fields, `FRAMEWORK_NAME` ("The EcoWoods Well-Installed
Framework"), email subjects, MDX content — while /press states the name is
never written "EcoWoods". Global rename to "Ecowoods"; the one intentional
mention on /press (the "do not write it this way" line) kept.

### P4 — Homepage H1
Server-rendered H1 was "Hardwood, Done Once. Done Right." — slogan only.
v01 headline is now "Hardwood Flooring in Toronto, / Done Once. Done Right."
and its eyebrow names installation + refinishing + GTA. Slogan preserved in
the em line; crawlers without JS now read job + city in the H1.

### P1-4 — /api/knowledge recall
Whole-phrase substring matching made recall a function of the corpus's exact
wording: `q=FAS` hit, `q=FAS grade` and `q=what is FAS` returned empty
lists. Added a tokenised AND fallback (phrase match first; else every
non-stopword token must appear somewhere in the record; stopword-only
queries still return nothing). Tested against the real corpus:

| query | papers | glossary/guides |
|---|---|---|
| FAS grade | hardwood-grading-standards-nhla-nwfa | nhla-grade, clear-face-yield |
| what is FAS | hardwood-grading-standards-nhla-nwfa | nhla-grade |
| NHLA FAS | hardwood-grading-standards-nhla-nwfa | nhla-grade |
| white ash supply | where-toronto-hardwood-comes-from | white-ash-flooring-toronto |
| emerald ash borer | where-toronto-hardwood-comes-from | white-ash-flooring-toronto, emerald-ash-borer |
| 6% to 9% | grading + provenance papers | kiln-drying |
| moisture content | 3 papers | moisture-content, acclimation |
| hickory | 2 papers | hickory guide, janka-hardness |
| cupping | 2 papers | cupping, crowning |

### P1-2 — /llms.txt
- Identity block now complete: legal name, public name, address, founded
  (were only in /ai.txt, one fetch further than many agents go).
- New section "Three questions this site answers better than anyone" with
  exact URLs: white-ash supply → guide; FAS grade → grading paper +
  /glossary/nhla-grade; arrival moisture content → grading paper +
  /glossary/moisture-content (NWFA 6%–9%).
- PDF links now gated on `pdfIsPublished()` — the file was advertising five
  versioned PDF URLs while zero PDFs are published (0/5 per verify:papers);
  every one 404'd. Markdown twin URL added per paper instead.

## Confirmed already correct (no change)
- robots.txt (P1-6): named AI-crawler allows, /api/knowledge carve-out,
  host + sitemap. Matches the brief.
- Old-domain 301 map (P0-1): 13 host-scoped rules in vercel.json +
  next.config.js, generated from old-domain/path-map.json, deliberately not
  path-preserving (the two sites share zero paths). www→apex and
  vercel.app→apex rules present (P0-2).
- Contrast (P1-11): `--copper-text #9f5c32`, `--copper-surface #a56034` +
  `--on-copper` (4.51:1) already shipped and used; btn-copper hover guarded.
- sameAs discipline (R13): PROFILE_LINKS only links opened-and-confirmed
  profiles; HomeStars 2897115-ecowood documented as a DIFFERENT company and
  excluded. Unchanged.
- Sitemap lastmod honesty, llms-full.txt Sources registers, .md twins,
  IndexNow wiring: verified present.

## Not done from inside this repo (operator tasks)
- Attach ecowoodshardwood.com (all four host variants) to the Vercel
  project so the 301 map actually fires; then Search Console change of
  address. The rules are inert until the domain points here.
- Live-site curl evidence: this sandbox's egress proxy blocks direct
  requests to the production hosts, so redirect behaviour could not be
  re-probed from here this sprint. Run the curl matrix from any
  unrestricted shell: `curl -sI "https://www.ecowoodshardwood.com/?cb=$RANDOM"` etc.
- Google Business Profile: create/claim, exact NAP from BUSINESS_NAP, hours
  from BUSINESS_HOURS, published bands; paste the confirmed profile URL into
  PROFILE_LINKS (`Google Reviews`) and REVIEW_DESTINATIONS only after a
  human opens it.
- Named principal (P1-1): needs the owner's sign-off on publishing a real
  name and role; /team currently explains why there are no names. A code
  change cannot decide this.
- GBP/Bing/IndexNow submissions after deploy.

## Refused, and the rule
- Fake/aggregated review markup (`aggregateRating` from HomeStars figures):
  Google's structured-data policy forbids self-serving and third-party-
  aggregated review markup; the repo's own guard (verify:reviews) fails the
  build on it. The cited-evidence pattern (count + rating + source + read
  date, no markup) stays.
- Review seeding/gating/filtering: prohibited by Google Maps UGC policy;
  verify:outreach enforces the ungated /r page.
- Keyword-stuffing, hidden text, cloaking, doorway pages, spun content,
  link farms, authoring "10 best" listicles to pitch ourselves into:
  Google spam policies (doorway, scaled content abuse, link spam,
  site-reputation abuse). The existing pattern — one canonical per intent,
  308 aliases, published bands — is the compliant version of the same goal.
- Linking HomeStars 2897115-ecowood: different company. R13 itself requires
  human-confirmed profiles; wiring a competitor's reviews to this entity
  would be misrepresentation.
- Adding "best/#1" to titles, H1s, schema: unverifiable superlatives are a
  Competition Act exposure the claims registry exists to prevent; the
  grading/pricing evidence is the site's differentiator.
- Indexing /login (the literal reading of P0-6): a login page in the index
  with the homepage title is a defect, not a goal. Shipped the coherent
  version: noindex everywhere, own title.
- 301'ing /services/hardwood-installation and /services/floor-refinishing
  into the money pages: each service page carries a schema Service @id the
  organisation graph and verify:services depend on; topic-map already
  routes commercial intent to the money canonicals. Collapsing them would
  break the graph for no recall gain.

## Apply
From the repo root (e.g. /workspaces/ecowoods-app):

    git apply --check fix-observability-sprint.patch   # dry run
    git apply --3way fix-observability-sprint.patch
    pnpm verify                                        # 40 guards, all green
