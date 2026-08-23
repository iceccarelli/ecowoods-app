# Image work order — every explanation on this site that needs a picture

Generated 2026-08-23 against `origin/main`. This is a complete audit, not a
wishlist: every gap below was computed from the content manifests, not guessed.

**Live site:** <https://ecowoods.ca> · **Repo:** <https://github.com/iceccarelli/ecowoods-app>

---

## 0 — Read this first

Two rules do most of the work. `docs/visual/DIAGRAM_BRIEF.md` has the full
specification; this is the short version.

### The two registers

Every image belongs to one of two visual languages. The work order says which.

| | `d` — flat vector diagram | `p` — labelled detailed render |
| --- | --- | --- |
| **Looks like** | Editorial cross-section, 2px linework, flat colour | Photorealistic, real material fidelity, raking light |
| **Text in image** | **None. Ever.** | Labels allowed, and expected |
| **Use for** | Assemblies, plan views, decision structures, comparisons | Things a homeowner must *see* to believe: defects, machines, meters |
| **Palette** | cream `#faf6ef`, walnut `#3d2b1f`, copper `#c87e4f`, sage `#42704f` | Neutral professional lighting, real material colour |

### Non-negotiables for both

- **1600px minimum on the long edge.** Deliver `.png` masters; the repo converts.
- **≤ 90 KB per megapixel after WebP conversion** — a build guard enforces this.
  Flat vector art lands around 5–60. A render that lands above 90 is carrying
  photographic noise the page does not need.
- **Never invent a number.** If a figure is not quoted in this document, it is
  not published on the site, and putting it in a picture publishes it. The
  moisture delta is the trap: the site deliberately says *"Both readings must sit
  within the manufacturer's and EcoWoods' acceptable delta"* — the number is not
  ours to state. Do not print one.
- **Every label in a `p` image must also exist in its caption.** No fact may live
  only in pixels, where no screen reader, translator or crawler can reach it.
- **The six pillar names are fixed**, character for character: Moisture and
  acclimation · Substrate and method · Product specification · Expansion and
  movement · Dust containment and sequence · Commercial accountability.
- **No dates or version stamps inside artwork.** They go stale; the page renders
  them from constants.

### Naming

One file per row, named exactly `<id>.png`. The id is the filename. Nothing else
about the delivery matters — the repo wires it from there.

---

## 1 — What already exists (31 slots). Do not remake these.

| ids | status |
| --- | --- |
| `pillar-moisture` `pillar-substrate` `pillar-specification` `pillar-movement` `pillar-containment` `pillar-accountability` | live, `p` register |
| `failure-cupping` `failure-crowning` `failure-gapping` `failure-buckling` `failure-edge-peaking` | live, `p` |
| `concept-mc-differential` `concept-edger-halo` | live, `p` |
| `concept-expansion-gap` `concept-acclimation` | live, `d` |
| `paper-climate` `paper-craft` `guide-solid-vs-engineered` | live, `p` |
| `paper-selection` `guide-method` `guide-evaluate-quote` `guide-ref-condo` `guide-ref-radiant` `guide-ref-refinish` | live, `d` |
| `framework-hero` `resources-hero` | live, `p` |
| `og-framework` `og-market` `og-glossary` `og-standards` `og-data` | live, 1200×630 social cards |

**One correction wanted on an existing file:** `framework-hero` labels its six
pillars with names that appear nowhere else on the site, and stamps
"VERSION 1.0 • MAY 2024". The page renders the real names as headings directly
beneath it, so the hero currently contradicts the page it introduces. Regenerate
with the six names above and no date stamp.

---

## 2 — TIER 1 · Service pages · 6 images · **highest commercial value**

These are the pages a buyer lands on from search. **They have no images at all.**

Repo: `apps/web/app/services/[slug]/page.tsx` · Content: `apps/web/lib/seo-data.ts`

| id | live URL | register | must show |
| --- | --- | --- | --- |
| `service-installation` | /services/hardwood-installation | `p` | A room mid-install: boards going down over a prepared substrate, the next bundle staged, spacers holding the perimeter gap. The work in progress, not a finished showroom. |
| `service-refinishing` | /services/floor-refinishing | `p` | One floor, half stripped to raw wood and half finished, with the boundary running through frame. Same boards, both states. |
| `service-dust-free` | /services/dust-free-sanding | `p` | The containment itself: a sander hosed to a sealed collector, hose run visible, a zip-wall at the doorway, furniture still in the next room. The point is that the house stays livable. |
| `service-restoration` | /services/floor-restoration | `p` | A damaged original floor — board replacement woven into surrounding grain, a repaired section indistinguishable from the old. Restoration, not replacement. |
| `service-inlays` | /services/custom-inlays | `p` | A border or medallion detail at an angle: mitred corner, contrasting species, tight joinery. Close enough to see the seams. |
| `service-stairs` | /services/stair-refinishing | `p` | A staircase mid-refinish: treads sanded to raw, risers masked, nosings sharp. Stairs are where hand work shows. |

---

## 3 — TIER 2 · Technical paper figures · 12 images · **highest explanatory value**

The three papers have 21 sections between them and **three figures total**, one
per paper hero. Every section below already contains a table or a numbered
sequence — structured data with no picture. These are the images that make a
homeowner understand the argument.

Repo: `apps/web/lib/papers.ts` · rendered by `apps/web/app/papers/[slug]/page.tsx`

### 3a — Climate & moisture · /papers/toronto-hardwood-climate-moisture-protocol

| id | § | register | must show | source data (use exactly) |
| --- | --- | --- | --- | --- |
| `fig-climate-rh-bands` | `climate-reality` | `p` | Indoor RH across a Toronto year with the safe band marked. | Winter indoor low **18–25% RH** · Summer indoor high **above 60% RH** · Safe operating band **35–55% RH** |
| `fig-moisture-testing-sequence` | `moisture-testing` | `p` | The order readings are taken: subfloor first, then material, then written down. Both meters, one clipboard. | No numeric delta. Show meters reading, not a target. |
| `fig-method-substrate-matrix` | `method-and-substrate` | `d` | A 3-row matrix, method against substrate, drawn as three cutaway assemblies. | Nail-down = solid over plywood · Glue-down = engineered over concrete or condo · Floating = engineered over radiant, or where acoustic separation is required |
| `fig-protocol-gates` | `protocol` | `d` | The protocol as a sequence of gates, each one a point where work stops until a condition is met. | Moisture testing is the first gate — **before any deposit** |
| `fig-failure-cascade` | `failure-modes` | `d` | One skipped step branching into the five named failure modes. Cause on the left, consequences on the right. | The five: cupping, crowning, gapping, buckling, edge peaking |

### 3b — Machines & sequence · /papers/hardwood-refinishing-machines-and-sequence

| id | § | register | must show | source data (use exactly) |
| --- | --- | --- | --- | --- |
| `fig-four-machines-roles` | `the-four-machines` | `p` | Four machines, numbered, each labelled with what it does. | 1 Belt floor sander — levels the open field and removes the old finish · 2 Floor edger — walls, baseboards, closets, stairs, under cabinets · 3 Planetary/multi-disc — refines and blends field and perimeter together · 4 Buffer/screening — final surface prep and abrasion between finish coats |
| `fig-grit-progression` | `belt-sander` | `p` | The grit sequence as a physical progression: three abrasive samples with the surface each produces. | **36 → 60 → 80/100.** The edger follows the same sequence rather than running ahead of it. |
| `fig-planetary-blend` | `planetary` | `d` | Overhead plan: the belt-sanded field, the edged perimeter, and the planetary machine working the boundary between them. | This is the machine whose omission causes the edger halo. |
| `fig-screening-between-coats` | `buffer` | `d` | Cross-section through a finish build: coat, light abrasion, coat. Screening shown as abrasion, not removal. | Mandatory between coats on multi-coat water-based systems. Excessive pressure or dwell burnishes the surface or leaves swirl. |
| `fig-full-sequence-timeline` | `sequence` | `d` | The whole refinish as one horizontal sequence, machine by machine, coat by coat. | Follows the four-machine order above. No day counts — none are published. |

### 3c — Selection & cost · /papers/hardwood-selection-and-cost-framework-gta

| id | § | register | must show | source data (use exactly) |
| --- | --- | --- | --- | --- |
| `fig-installed-cost-bands` | `installed-cost` | `d` | Five cost bands on one axis, so the scopes are comparable at a glance. | Fully installed average **≈ $13/sq ft** · Typical range **$8–$18** · Screen and recoat **$2.50–$4.00** · Full sand and finish **$4.75–$7.50** · Premium new install **$11–$18** |
| `fig-species-janka` | `species` | `p` | Five species side by side, real grain visible, ordered by Janka with the number labelled. | White oak / European oak **≈1360** (aesthetic and resale sovereign) · Hard maple **1450** (high-traffic workhorse) · Red oak northern **≈1290** (traditional default) · Hickory **1820** (extreme durability) · Black walnut **1010** (luxury accent) |

---

## 4 — TIER 3 · Guides with no image · 5 images

Repo: `apps/web/lib/guides.ts` · map at `apps/web/app/guides/[slug]/page.tsx`

| id | live URL | register | must show |
| --- | --- | --- | --- |
| `guide-cost-toronto` | /guides/hardwood-flooring-cost-toronto | `d` | What actually moves a quote: area, species, substrate, stairs, condition of the existing floor — as weighted inputs feeding one number. |
| `guide-choose-contractor` | /guides/how-to-choose-hardwood-contractor-toronto | `d` | The evaluation as a filter: many quotes in, the ones that survive specific questions out. |
| `guide-white-oak` | /guides/white-oak-flooring-toronto | `p` | White oak grain in three finishes — natural, light stain, dark stain — so the reader sees what the species actually does. |
| `guide-dustless` | /guides/dustless-hardwood-refinishing-toronto | `p` | An occupied house during sanding: containment barrier up, family space clean on the other side of it. |
| `guide-herringbone-parquet` | /guides/herringbone-chevron-parquet-toronto | `d` | The three patterns drawn side by side from directly above, so the difference between herringbone and chevron is unmistakable — herringbone meets at a right angle, chevron is mitred to a point. |

---

## 5 — TIER 4 · Glossary terms · 16 images

24 of 32 terms have no image. These 16 are the ones where a picture does work
prose cannot. The other 8 (`change-order`, `fixed-price`, `moisture-content`,
`relative-humidity`, `hygroscopic`, `belt-sander`, `edger`, `buffer`) are either
commercial or already covered by a paper figure — skip them.

Repo: `apps/web/lib/glossary.ts` · map at `apps/web/app/glossary/[slug]/page.tsx`
Live: `/glossary/<slug>`

| id | term | register | must show | published definition to honour |
| --- | --- | --- | --- | --- |
| `term-anisotropic` | anisotropic | `d` | One board with three arrows of wildly different length — along the grain, across the width, through the thickness. Then twenty boards, each moving a fraction, summing across a floor. | "Length change is minimal; width change is significant and cumulative across a floor." |
| `term-solid-hardwood` | solid-hardwood | `d` | A board cut open: one continuous grain face to underside, with the refinishing depth marked. | "One material all the way through… a wear layer that supports many refinishing cycles." |
| `term-engineered` | engineered-hardwood | `d` | A board cut open: real hardwood face over plies at 90° to each other. | "The surface is real hardwood. The difference is underneath." |
| `term-cross-ply-core` | cross-ply-core | `d` | Why it works: each layer's movement opposed by the one bonded across it. Arrows cancelling. | "Each layer's tendency to move across its own grain is resisted by the layer bonded to it at a right angle." |
| `term-wear-layer` | wear-layer | `d` | Two boards side by side with refinishing cycles marked as depth: solid deep, engineered limited by the layer above the core. | "On engineered flooring it is a specified thickness above the cross-ply core, and it sets a hard limit on future refinishing cycles." |
| `term-nail-down` | nail-down | `d` | Cutaway: cleats angled through the tongue into plywood over joists. | "Requires a substrate that accepts fasteners, which is why it has no application over concrete." |
| `term-glue-down` | glue-down | `d` | Cutaway: ridged trowelled adhesive, full contact, engineered board on slab. | "The standard for engineered flooring over a concrete slab." |
| `term-floating` | floating | `d` | Cutaway showing the floor mechanically independent of the substrate — underlay between, nothing fastening. | "Mechanically independent of what it sits on… moves with a thermal cycle rather than fight it." |
| `term-subfloor` | subfloor | `d` | Three substrates side by side — plywood over joists, concrete slab, slab with radiant tubing — as the thing every later decision follows from. | "The substrate is identified before anything else is decided." |
| `term-radiant-heat` | radiant-heat | `d` | Cutaway with tubing in the slab, floated engineered floor above, heat rising through. | "Engineered construction for dimensional stability under thermal cycling, floated rather than nailed or glued." |
| `term-janka` | janka-hardness | `d` | The five species as a simple scale, with a visual caution that hardness is one axis of several. | Use the Janka numbers in §3c. "A useful number and a poor sole criterion." |
| `term-white-oak` | white-oak | `p` | Wide-plank European white oak, grain and pore structure visible at close range. | "The current aesthetic and resale sovereign in the GTA. That is a market observation, not a claim about performance." |
| `term-progressive-grits` | progressive-grits | `p` | Three abrasives and the three surfaces they leave, in order. | **36 → 60 → 80/100** |
| `term-intercoat-screening` | intercoat-screening | `d` | Abrasion between coats, drawn as a cross-section — light contact, not removal. | "Excessive pressure or dwell burnishes the surface or leaves swirl." |
| `term-planetary-sander` | planetary-sander | `p` | The machine, with its multiple counter-rotating discs visible — that geometry is why it blends. | Refines and blends field and perimeter together. |
| `term-hepa-containment` | hepa-dust-containment | `d` | Two houses in section: one with dust travelling through the whole building, one with it captured at the tool. | "Dust generated during sanding is respirable and travels through the whole building. Cleanup afterwards addresses what settled, not what was breathed." |

---

## 6 — TIER 5 · Social cards for pages that have none · 4 images

1200×630, subject left-of-centre with clear space on the right for an overlaid
headline. Flat vector, no text in the image.

| id | page | must show |
| --- | --- | --- |
| `og-about` | /about | The company as an entity — a monogram-scale mark over a floor section. |
| `og-reviews` | /reviews | Written words as evidence: a review card motif, no stars, no numbers. |
| `og-press` | /press | Publication: a document and a logo lockup. |
| `og-services` | /services | The six services as six simple marks in a grid. |

---

## 7 — What no generated image can replace

`audit/PHOTO_SHOT_LIST.md` is still empty. Every image above is a diagram or an
illustration and is declared as such — none of them claims to be a photograph of
an Ecowoods job, and none ever will, because `kind: 'photograph'` requires a
provenance naming a real shoot.

A real photograph of a real finished floor outranks every render in this
document. It is the one asset that cannot be generated, and the one an AI
assistant evaluating this company would weigh most heavily.

**Shot list worth capturing on the next three jobs:** the subfloor before
anything is laid · meters on a real substrate with real readings · the expansion
gap before the baseboard goes on · the four machines actually in the room ·
containment set up in an occupied house · one finished floor in raking morning
light · a stair run · an inlay or border detail.

---

## 8 — Delivery

Send the `.png` masters, named `<id>.png`, exactly as the id appears above.
Nothing else is needed — the repo handles conversion, manifest entries, static
imports, alt text, captions, the sitemap and the guards.

**Totals: 43 images.** 6 service · 12 paper figures · 5 guides · 16 glossary ·
4 social cards. Plus one regeneration of `framework-hero`.

---

## 9 — Delivered 2026-08-23

All 44 landed and are live. `docs/visual/DIAGRAM_BRIEF.md` remains the standing
specification for anything new.

**On the two sets.** Four archives arrived covering the same 44 ids — `01`/`02`
and `part1`/`part2` — described as different versions of the same image, to be
rotated in the UI. They are not different versions. Downscaled to identical
dimensions and compared pixel-for-pixel, the worst pair differs by **3.16/255
(1.24%)** and the median by well under 1% — resampling noise. `part1`/`part2` is
`01`/`02` at higher resolution: 1600×1074 against 1168×784, and 1600×840 against
1200×630.

The 1600px set was taken, which is what §0 asks for. Crossfading between an image
and a slightly softer copy of itself is not an effect; it reads as a rendering
fault and costs double the bytes. If genuinely alternate renditions are wanted
later — a different composition or season for the same slot — the manifest can
carry variants, and that is worth building when there is something to vary.

Motion shipped instead, and it is documented in `Illustration.tsx`: a scroll-in
reveal on every figure, and a slow Ken Burns on scene imagery only — the two
heroes and the six service photographs. Ken Burns scales inside a fixed frame,
which means it crops, so it is never applied to an explanatory figure. A drifting
axis label or a fifth species leaving frame defeats the picture.

---

## 10 — TIER 6 · Pages that still render nothing · computed 2026-08-23

Fourteen public page files render no image at all. Four of them are index pages
listing items that already own artwork — those were fixed by showing it
(`/papers` and `/guides` now carry thumbnails; `/blog` and `/case-studies` are
the same one-line change once their items have images). The rest need art.

| route | live pages | why it matters |
| --- | --- | --- |
| `/service-areas/[city]` | **32** | The largest gap on the site by page count, and every one is a local-search landing page. One image per area is wrong — a generic stock shot on 32 pages is worse than none. What works: 3–4 shared images keyed to housing stock (pre-war semi, post-war bungalow, condo slab, radiant new-build) selected by the area's `housingNote`. |
| `/service-areas` | 1 | A GTA coverage map, drawn — not a screenshot of anyone's map tiles. |
| `/blog` and `/blog/[slug]` | index + posts | Each article needs one figure. The articles are already written; nothing illustrates them. |
| `/case-studies` and `/case-studies/[slug]` | index + 5 | Blocked on the verification question, not on artwork. |
| `/technical-library` | 1 | The corpus as a structure — papers, guides, glossary, data, and what links to what. |
| `/whats-new` | 1 | A changelog needs no picture. Leave it. |
| `/authority` | 1 | A citation guide for machines. Leave it. |
| `/framework/assess` | 1 | A tool. The scoring interface is the visual. Leave it. |
| `/design` | 1 | The configurator is the visual. Leave it. |
| `/papers` `/guides` | 2 | **Fixed** — thumbnails from the images each item already owned. |

So the honest next order is **4 area-type images** covering 32 pages, **1 GTA
coverage map**, **1 corpus map**, and **one figure per article**. Everything else
on that list is correctly imageless.
