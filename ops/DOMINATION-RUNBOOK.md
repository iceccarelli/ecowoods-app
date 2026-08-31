# DOMINATION RUNBOOK — the work the code cannot do

The repository ships the software. This file is the parallel track a human
executes. Nothing in P0 or P1 reaches its full value until these are done, and
several of them are worth more than any further code.

Order matters. 1–3 are worth more than everything below them combined.

---

## 1 · Kill the old domain as a content host  ⏱ 30 min · 🔥 highest value

`ecowoodshardwood.com` is still serving pages and splitting the domain equity
that should be compounding on `ecowoods.ca`.

Every redirect file is already generated in `old-domain/` — pick the one that
matches the host (measured 2026-08-23 as **Apache**, so `.htaccess`) and follow
`old-domain/EXECUTE.md`.

**Verify:**

```
curl -sI https://www.ecowoodshardwood.com/ | grep -i location
# → location: https://ecowoods.ca/     (301, not 302)
curl -sI https://www.ecowoodshardwood.com/pages/flooring-services-toronto-etobicoke-hamilton | grep -i location
# → location: https://ecowoods.ca/services
```

Then: Google Search Console → old property → **Change of Address** → `https://ecowoods.ca`.
Resubmit `https://ecowoods.ca/sitemap.xml` on the new property. Keep the old
property for 180 days.

## 2 · Find the `Access-Control-Allow-Origin: *` nobody in this repo asked for  ⏱ 20 min

**RESOLVED, half of it.** The permissions-policy that looked wrong
(`autoplay=*, camera=(*), microphone=(*)`) was simply a stale deployment from
before P0 landed. It now reads exactly what `vercel.json` says:
`camera=(), microphone=(), geolocation=(), browsing-topics=()`. No proxy, no
mystery.

**STILL OPEN:** `access-control-allow-origin: *` is served on *every* path,
measured after the P2 deploy:

```
/                access-control-allow-origin: *
/refer           access-control-allow-origin: *
/commercial      access-control-allow-origin: *
/llms.txt        access-control-allow-origin: *     ← this one IS ours, by design
/robots.txt      access-control-allow-origin: *
/api/health      access-control-allow-origin: *     ← this one IS ours, by design
```

`vercel.json` sets that header on exactly four sources — `/(.*).md`,
`/llms.txt`, `/llms-full.txt`, `/ai.txt` — plus `/api/knowledge`, and the health
route sets its own. **None of those patterns matches `/` or `/robots.txt`**;
this was verified by compiling every `source` in the file against those paths
with the same path-to-regexp Next uses. So the blanket header is configured
outside this repository.

Where to look, in order:

1. **Vercel → Project → Settings → Functions / Headers**, and any custom rule
   under **Firewall**. A catch-all header rule added in the dashboard overrides
   nothing in `vercel.json` — it is simply added on top.
2. **Vercel → Project → Settings → Domains** — confirm `ecowoods.ca` points at
   THIS project and is not proxied through another one.
3. Whatever DNS the domain resolves through, if anything sits in front of
   Vercel.

Why it is worth twenty minutes: `Access-Control-Allow-Origin: *` on an HTML
document lets any website on the internet read the full response body of your
pages from a visitor's browser. For public marketing pages the direct harm is
small — but it is a header nobody chose, it applies to `/mypage` and `/admin`
too, and those are behind a login. Anything that ever renders customer data
server-side becomes cross-origin readable.

Once found, the intended state is: the header appears ONLY on the machine
surfaces `vercel.json` names. `scripts/verify-vercel-config.mjs` already
enforces that those four keep it.

## 3 · Environment variables — features that are built and dormant  ⏱ 15 min

Vercel → Project → Settings → Environment Variables:

| Variable | Without it |
| --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Consent is collected and **no analytics load at all**. Every event in `ops/GA4-events.md` goes nowhere. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL=services@ecowoods.ca` | Leads, photo triage and quote reviews are captured in the Vercel logs but **nobody is emailed**. |
| `CRON_SECRET` | The abandoned-quote reminder returns 401 and never sends. Generate: `openssl rand -hex 32`. |
| `ANTHROPIC_API_KEY` | The chat assistant returns 503. |
| `INDEXNOW_KEY` (GitHub secret) | Post-deploy IndexNow submission fails loudly in Actions. |
| `NEXT_PUBLIC_BOOKING_URL` *(optional)* | Booking writes a DB row and emails, but touches nobody's real calendar. Set a Cal.com/Calendly URL to make a live calendar the primary path. |

**Vercel Cron:** `vercel.json` registers `/api/cron/quote-recovery` hourly. Confirm
it appears under Project → Cron Jobs after the deploy, and that `CRON_SECRET` is
set — the route refuses every unauthenticated request by design.

## 3b · P2 environment variables (all optional — nothing breaks unset)

| Variable | What it turns on |
| --- | --- |
| `NEXT_PUBLIC_YOUTUBE_PROCESS_ID` | The process film on the homepage and the refinishing page. Unset, both render the poster, the "Film coming" badge and a two-sentence explanation of HEPA containment — which is a page that still works. Set it only to a video **we filmed**. |
| `NEXT_PUBLIC_BOOKING_URL` | A Cal.com/Calendly calendar as the primary booking path (P1.7). |
| `CRON_SECRET` | The abandoned-quote reminder (P1.8). Without it the cron route 401s. |

**Removed in P2.4: `NEXT_PUBLIC_META_PIXEL_ID`.** It was never set, so the pixel
never loaded — while `/privacy` told every reader that Meta received their
browsing data, and the CSP carried two Meta origins to permit a script that
never ran. Over-declaring a data processor is a false statement about where
personal data goes, so the loader, the consent toggle, the CSP entries and the
legal declaration were removed together. Re-adding it means restoring all four
deliberately; `lib/legal.ts` carries the note.

## 3c · Watch the CSP for a week  ⏱ 10 min, then 5 min a week later

P2.4 promoted the Content-Security-Policy from report-only to **enforced**,
minus `unsafe-eval`. Violations now post to `/api/csp-report` and appear in the
Vercel log as `event: csp.violation`.

After the first deploy, search the logs for that string. Expect silence. If
something appears, it names the exact directive and blocked URL — fix or
allowlist that one origin rather than reverting the header.

A second, **stricter** report-only policy ships alongside it, with no
`unsafe-inline`. Its violations are the inventory of work a future nonce
migration would need. Do not act on those yet; they are a measurement, and the
migration would require rendering all 287 pages dynamically, which costs the
caching and LCP work in P0.1 and P2.5.

## 4 · Google Business Profile  ⏱ 45 min

Exact values (copy, do not retype):

- Name: `Ecowoods Hardwood Flooring Inc.`
- Address: `32 Norfield Crescent, Toronto, ON M9W 1X6`
- Phone: `(647) 244-5156`
- Website: `https://ecowoods.ca` — check this field, the old domain is the common leftover
- Hours: Mon–Sat `8:00 AM – 7:00 PM`, Sun `10:00 AM – 4:00 PM`
- Categories: primary `Flooring contractor`; secondary `Wood floor installation service`, `Wood floor refinishing service`
- Services with the published bands: Screen & Recoat $2.50–$4.00/sq ft · Full Sand & Finish $4.75–$7.50/sq ft · New Hardwood Install $11.00–$18.00/sq ft
- Photos: 50 job photos. **These are also the missing asset in the codebase** — see §8.
- Q&A: paste the FAQ from `/commercial` and `/hardwood-floor-refinishing-toronto`.

When the public GBP URL is confirmed, add it to `PROFILE_LINKS` in
`packages/shared/constants/index.ts` and redeploy. `sameAs` derives from that
file — do not add the URL anywhere else.

## 5 · Directories — same NAP everywhere  ⏱ 1 h

YellowPages (listing already verified in `PROFILE_LINKS` — fix the **website**
field), Bing Places, Apple Business Connect, Yelp, BBB, Houzz. Identical name,
address, phone, hours, and `https://ecowoods.ca`.

Only add a profile to `PROFILE_LINKS` once its URL has been opened and
confirmed. A wrong `sameAs` asks Google to resolve this business to a page that
is not it.

## 6 · Speed to lead  ⏱ ongoing · the highest-ROI operational habit

- Missed-call text-back within 60 seconds.
- Reply to every form lead in under 5 minutes during open hours.
- ⚠️ **NAP warning:** do not replace the site's visible number with a raw
  tracking number. Use dynamic number insertion (paid traffic only), and add the
  script's domain to the CSP in `apps/web/next.config.js` first.

## 7 · Reviews — Google first, never gated  ⏱ ongoing

Job closed → Day+1 SMS with the Google review link → Day+7 email. Never gate on
sentiment (`scripts/verify-outreach.mjs` fails the build if `/r` grows a
gating step). Never pay for a review. Target 80 Google reviews before
diversifying.

The site cites **HomeStars 177 at 5.0, read 2026-08-22** and publishes no
`aggregateRating` — that is deliberate and correct. When the HomeStars figures
are re-read, update `REVIEW_EVIDENCE` in `packages/shared/constants/index.ts`
with the new count and a new `asOf` date. Nothing else needs touching.

---

## 8 · The two content assets that unlock code already written

These are the only places where the software is finished and the input is not.

**a) Job photography.** `JobCard` has an `imageSlot` that renders a photo the
moment one exists; none of the five case studies sets an image, so every proof
card is currently typographic. Photographs of the five published jobs — or any
new job — turn the strongest module on the site visual. Put the file in the case
study's frontmatter and set `imageSlot` in `apps/web/content/job-cards.ts`.

**b) The process film.** `ProcessVideo` renders the moment
`NEXT_PUBLIC_YOUTUBE_PROCESS_ID` is set. One take of a real HEPA-contained sand
in an occupied house answers the objection that costs the most jobs — "will my
house be full of dust" — better than any paragraph on the site. Phone footage
is fine; it must be ours.

**c) Testimonial consent.** The case studies carry testimonial attributions with
full customer names. This repository has no record of who collected them or
whether the customers consented to publication, so **P1 deliberately did not
amplify them** into the JobCard component or into `Review` schema. Get written
consent for two or three, record it, and they can be published properly — with
first name and neighbourhood — and become first-party `Review` markup. Until
then they stay where they are.

---

## Do not do these

- Do not put HomeStars or Google stars into `aggregateRating`. Google's policy
  prohibits self-serving aggregate markup, and `verify-reviews.mjs` fails the
  build on it.
- Do not add a profile to `sameAs` before its URL is confirmed.
- Do not change a published price band anywhere except
  `apps/web/content/constants/pricing.ts`.
- Do not buy links.
