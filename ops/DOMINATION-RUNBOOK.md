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

## 2 · Fix the headers being injected in front of the site  ⏱ 20 min

Measured on the live site after the P0 deploy:

```
cache-control: public, s-maxage=300, stale-while-revalidate=86400   ← ours, correct
access-control-allow-origin: *                                      ← NOT ours
permissions-policy: autoplay=*, camera=(*), microphone=(*), sync-xhr=*, payment=*   ← NOT ours
```

The cache header proves the deploy is from this repository. The other two are
**not produced by any rule in `vercel.json`** — this was verified by compiling
every header `source` pattern against `/` with the same path-to-regexp Next
uses; none of them match the homepage.

So something in front of or above the project is adding them: a Vercel
project-level header configuration, or a proxy/CDN ahead of Vercel. Find it and
remove it — `Access-Control-Allow-Origin: *` on an HTML document lets any site
read the page cross-origin, and that permissions-policy re-enables camera,
microphone and payment for embedded content that the repo's own policy denies.

Check: Vercel → Project → Settings → (Headers / Firewall / Edge Config), and
whatever DNS the domain actually resolves through.

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

**b) Testimonial consent.** The case studies carry testimonial attributions with
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
