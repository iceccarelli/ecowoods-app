# ECOWOODS — DIRECTORY & CITATION CONSISTENCY (NAP + Entity)

> **Imported 2026-08-23 from an external package.** The canonical NAP is
> `BUSINESS_NAP` in `packages/shared/constants/index.ts` and nowhere else;
> `pnpm verify:facts` fails the build on drift. If a directory disagrees with
> that constant, fix the directory. If the constant is wrong, fix the constant
> — never a page.

## Goal: 100% consistent Name / Address / Phone / Website across every Canadian directory that Google and AI agents trust

### Canonical NAP (use EXACTLY this everywhere)
- **Name**: Ecowoods Inc.  (or Ecowoods Hardwood Flooring Inc. on formal listings)
- **Address**: 32 Norfield Crescent, Toronto, ON M9W 1X6
- **Phone**: (647) 244-5156
- **Website**: https://ecowoods.ca
- **Email**: services@ecowoods.ca
- **Hours**: Mon–Sat 8:00 AM – 7:00 PM · Sun 10:00 AM – 4:00 PM

Any variation (Eco Woods, EcoWoods Hardwood, missing suite, old phone, old domain) dilutes entity strength.

---

## Priority Directories (Claim / Correct / Complete within 14 days)

| Priority | Directory                        | Action                                      | Status |
|----------|----------------------------------|---------------------------------------------|--------|
| P0       | Google Business Profile          | Claim, categories, photos, posts, Q&A, services |     |
| P0       | HomeStars                        | Already strong — keep responding            |     |
| P0       | Apple Maps / Apple Business Connect | Claim & sync NAP                          |     |
| P0       | Bing Places                      | Claim                                       |     |
| P1       | Yelp                             | Claim, photos, respond                      |     |
| P1       | Houzz                            | Claim, project photos, reviews              |     |
| P1       | BBB                              | Claim / maintain A+                         |     |
| P1       | YellowPages.ca                   | Claim                                       |     |
| P1       | Canada411 / 411.ca               | Correct                                     |     |
| P2       | Nextdoor                         | Local presence                              |     |
| P2       | Facebook Business                | Already have page — ensure NAP matches      |     |
| P2       | Instagram                        | Bio + link to ecowoods.ca                   |     |
| P2       | TrustedPros, BestProsInTown, etc.| Correct or claim                            |     |

---

## Schema sameAs Update
Once claimed, add the verified profile URLs to `ROOT_ORG_CONFIG.sameAs` in root-schema.ts and redeploy.

Current verified:
- https://www.homestars.com/profile/2776939-ecowoods
- https://www.instagram.com/ecowoodshardwood
- https://www.facebook.com/ecowoodshardwood

Add as soon as live:
- Google Business URL
- Houzz pro URL
- BBB profile URL
- Apple Maps URL

---

## Old Domain Cleanup (Critical)

1. 301 every page on ecowoodshardwood.com → corresponding page on ecowoods.ca (or homepage if no match).
2. Update all remaining citations of the old domain.
3. In Google Search Console, use Change of Address tool if still active.
4. Ensure Google Business Profile primary website is ecowoods.ca.

---

## Local Citation Building (Ongoing)

- Get listed in any Toronto / GTA “best of” or “recommended contractor” lists that accept submissions.
- Offer to write guest technical pieces for realtor blogs, designer newsletters, and local renovation media (with author bio + link).
- Encourage past clients who are realtors / designers to list you as preferred.

---

## Monitoring

Once a month:
1. Search “Ecowoods” + “Toronto” and “Ecowoods Hardwood” on Google.
2. Check top 20 results for NAP consistency.
3. Fix any outliers within 48 hours.
4. Re-submit corrected listings to Google / Bing.

Inconsistent NAP is one of the quietest but most expensive ranking and AI-entity problems. Fix it once, then keep it perfect.
