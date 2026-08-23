# GOOGLE BUSINESS PROFILE — EXECUTE THIS WEEK (HIGHEST ROI LEFT)
> **Imported 2026-08-23, with figures unhardcoded.** Review counts live in
> `REVIEW_EVIDENCE` and prices in `lib/pricing.ts`; `verify:reviews` and
> `verify:schema-figures` fail the build on either typed anywhere else. When
> filling GBP fields, read the current value from `/reviews` and `/services`
> rather than from this document — a number copied into a profile is a number
> that goes stale silently.
>
> The Q&A section should be seeded with the exact questions already answered on
> `/hardwood-flooring-toronto` and `/hardwood-floor-refinishing-toronto`, in the
> same words. Consistency between the profile and the site is itself a ranking
> and trust signal, and it means one place to update.
>
> **Never** offer anything in exchange for a review, and never ask how it went
> before deciding who gets asked. `verify:outreach` enforces the second rule in
> code; the first is on you. Both are prohibited by Google and both are how a
> perfect rating stops meaning anything.

This is the single highest-ROI remaining lever for map-pack dominance and AI synthesis.

## Canonical data (copy exactly)

- **Business name**: Ecowoods Inc.
- **Primary category**: Hardwood Flooring Contractor
- **Additional categories**: Flooring Contractor, Floor Refinishing Service
- **Address**: 32 Norfield Crescent, Toronto, ON M9W 1X6
- **Phone**: (647) 244-5156
- **Website**: https://ecowoods.ca
- **Hours**: Mon–Sat 08:00–19:00 · Sun 10:00–16:00

## Services to list (with exact published ranges)

1. Hardwood Flooring Installation — $11.00–$18.00 per sq ft
2. Hardwood Floor Refinishing — $4.75–$7.50 per sq ft
3. Dust-Free Floor Sanding — HEPA containment, clients stay home
4. Hardwood Floor Restoration
5. Stair Refinishing
6. Custom Inlays & Borders

## Mandatory actions (checklist)

- [ ] Claim / verify the profile if not already owner-verified
- [ ] Set primary + additional categories exactly as above
- [ ] Enter every service with the price ranges above
- [ ] Upload 20–40 high-quality photos (before/after, process, HEPA setup, finished floors, crew)
- [ ] Create a Google Post at least once per week (project highlight + one technical tip from the papers)
- [ ] Seed Q&A with the exact FAQs from the two commercial pages:
  - How much does hardwood flooring cost in Toronto?
  - Is the estimate fixed?
  - Can I stay in the house during sanding?
  - Do you use subcontractors?
  - Solid or engineered for Toronto?
- [ ] Enable messaging and add booking link → https://ecowoods.ca/#quote
- [ ] Add all 32 service areas if the UI allows
- [ ] Respond to every review within 24–48 h using the templates in POST_JOB_REVIEW_FLOW.md

## After claim
Add the Google Business Profile URL to `sameAs` in `apps/web/lib/schema/root-schema.ts` and redeploy.

This profile is what Google and many AI systems use as the primary local entity signal. The commercial pages and schema are already strong. This closes the map-pack gap.
