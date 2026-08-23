# ECOWOODS — RUTHLESS REVIEW VOLUME SYSTEM

> **Imported 2026-08-23 from an external package, with one change.** The original
> opened by restating a review count as a hardcoded figure. Counts live in
> `REVIEW_EVIDENCE` (`packages/shared/constants/index.ts`) with the date a person
> read them, and `scripts/verify-reviews.mjs` fails the build on a count typed
> anywhere else. The cadence, the templates and the response scripts below are
> the valuable part and are kept as written.
>
> The mechanism this feeds is already built: `/r`, the printed card at
> `public/review-card.svg`, and `docs/outreach/GOOGLE_BUSINESS_PROFILE.md`.
> Nothing here may gate reviews by sentiment — `scripts/verify-outreach.mjs`
> fails the build if `/r` ever grows a "how did we do?" step.

## Goal: 300+ verified HomeStars + Google reviews within 12 months while remaining 100% authentic

### Current baseline (Aug 2026)
- HomeStars: see REVIEW_EVIDENCE
- Google: ~18 reviews
- Gap: Google volume is the weak signal for map pack + AI synthesis

### Non-negotiable rules
1. Never buy, incentivize with discounts, or selectively solicit only happy clients.
2. Ask every completed job the same way, at the same time in the process.
3. Make the ask frictionless (direct links, pre-filled where possible).
4. Respond to every review (positive and negative) within 48 hours.

---

## 1. Process Integration (Mandatory)

### Timing
- Day of final walkthrough / final payment: verbal ask + hand card
- Day +1: automated SMS/email with direct review links
- Day +7: gentle follow-up only if no review yet
- Day +30: “How is the floor living?” check-in (optional second ask)

### Channels (priority order)
1. HomeStars (primary — already dominant)
2. Google Business Profile (critical for map pack)
3. Houzz (if profile is claimed and active)

### Script for crew / estimator (verbal)
“We’re proud of the work. If you have 60 seconds, the single most helpful thing you can do is leave an honest review on HomeStars or Google. Here’s the link / card. It helps other Toronto homeowners decide.”

### SMS / Email template (Day +1)
Subject / SMS body:

```
Hi [First Name],

Your floors are done. Thank you for trusting Ecowoods.

If the work met the standard we promised, the most useful thing you can do is leave a short honest review:

HomeStars (preferred): https://www.homestars.com/profile/2776939-ecowoods
Google: [YOUR GOOGLE REVIEW LINK]

It takes under a minute and helps other Toronto homeowners.

— Francisco & the Ecowoods crew
(647) 244-5156
```

### Day +7 follow-up (only if no review detected)
```
Quick follow-up — if you haven’t had a chance yet, here’s the HomeStars link again:
https://www.homestars.com/profile/2776939-ecowoods

No pressure either way. Glad the floors are in.
```

---

## 2. Google Business Profile Hardening (Critical)

1. Claim / verify if not already.
2. Categories: Hardwood Flooring Contractor, Flooring Contractor, Floor Refinishing Service (primary + secondary).
3. Service areas: every city listed on the website.
4. Products / Services: list each of the 6 services with price ranges.
5. Photos: before/after, process, crew, dust containment, finished floors (upload weekly).
6. Posts: weekly update (project highlight, tip from technical library, seasonal moisture note).
7. Q&A: seed and answer the exact FAQs from the commercial pages.
8. Enable messaging + booking link to /#quote.

---

## 3. Tracking

| Metric                    | Target 90 days | Target 12 months |
|---------------------------|----------------|------------------|
| HomeStars reviews         | 200+           | 280+             |
| Google reviews            | 60+            | 150+             |
| Average response time     | <24 h          | <12 h            |
| Review request open rate  | >70%           | >75%             |
| Review conversion rate    | >35% of jobs   | >40% of jobs     |

Log every job → review request sent → review received in the CRM / admin.

---

## 4. Response Templates (keep authentic)

### Positive
```
Thank you [Name]. Glad the floors (and the dust control) lived up to the standard. 
If anything ever needs attention, call us directly — we stand behind the work.
— Ecowoods team
```

### Negative / mixed (rare)
```
[Name], thank you for the feedback. We take every comment seriously. 
I’d like to understand exactly what fell short and make it right. 
Please call or email me directly at [personal line / services@ecowoods.ca].
— Francisco / [Name]
```

---

## 5. Corner Cases

- Multi-unit / condo boards: ask the unit owner, not the property manager, unless the PM is the decision maker.
- Designer / realtor referral jobs: still ask the homeowner; separately thank the professional.
- Heritage / complex jobs: after the 30-day living check-in, ask for a more detailed case-study permission + review.
- Clients who refuse: log “declined” and never re-ask.

---

## 6. Code Integration Points

- After final invoice paid → trigger review request email/SMS via existing Resend / Twilio hooks.
- Admin dashboard: “Review status” column on every closed job.
- Optional: simple internal page that shows current HomeStars + Google counts (scraped or manual update) for crew motivation.

This system is the single highest-ROI activity for both AI citation and Google map-pack dominance. Execute it without exception on every job.
