# Ecowoods Before/After Slider Placement Map
**Date:** 2026-09-01  
**Scope:** https://ecowoods.ca + github.com/iceccarelli/ecowoods-app  
**Job:** Identify every place a curtain-slider must live. Do not write the component. Name the images. Ship the comps.

---

## 0. The brutal diagnosis

The live site is an authority engine that forgot the one thing a floor buyer actually does with their eyes.

What exists today:
- Diagrams, cost bands, MVTR figures, 27-criterion framework, 5 case studies, 32 area pages.
- `JobCard` already has `imageSlot` — and it is empty.
- Comment in `apps/web/app/home-client.tsx` lines 557–562: *"No stock photography."*
- Comment in `apps/web/app/components/JobCard.tsx`: *"none of the case studies publishes an image"* and *"when real job photography exists, imageSlot renders it."*
- `EvidenceRail` kicker is already `"Proof, with the numbers"` — text cards, zero photographs.
- `IllustrationPair` cross-fades two *diagrams*. It is not a before/after slider.
- `FloorCatalog` + `public/gallery/*` are species beauty shots (room / detail / lifestyle), not before/after of the same floor.
- There is **no** `BeforeAfterSlider` component, no `/proof` route, no image on any case-study page.

The cream “PROOF / Same maple. Same condo. Different floor.” slider in the attached screenshots is **not on the production homepage** as of this crawl. Production homepage is the dark-walnut hero (“Done Once. Done Right.”). That PROOF block is the correct product. It is not shipped.

Consequence: Google, GPTBot, a Forest Hill owner, and a realtor all read 4,000 words and never *see the floor change*. Competitors with worse engineering and a $49 plugin win the click.

---

## 1. Slider product spec (so every placement is the same object)

One component. Used everywhere. Never a different widget per page.

```
<BeforeAfterSlider
  beforeSrc    beforeAlt
  afterSrc     afterAlt
  kicker       "PROOF"
  headline
  factline     species · neighbourhood · method · occupancy
  ctaHref      ctaLabel
  jobSlug      (optional, links to case study)
/>
```

Interaction:
- Desktop: drag the circular handle. Left = BEFORE, right = AFTER.
- Hover: the handle should invite a 8–12px nudge so the floor “breathes.”
- Mobile: the same drag, thumb-sized handle, 16:10 crop.
- Keyboard: Left/Right arrows move the split.
- Reduced motion: static 50/50 split, no autoplay.
- SEO/AI: both images get real `alt`, a `<figure>` + `<figcaption>`, and ImageObject JSON-LD. Crawlers that cannot drag still get both files.

Hard rule for a slider that does not look fake:
- Identical camera height, focal length, and vanishing point.
- Floor boards must run the same direction.
- Window light from the same side.
- Only the floor (and optional one chair / curtains) changes.

The pairs in `/home/workdir/artifacts/ba-slider-library/` are **design comps**. They are not job photography. Shipping them as “this is the Richmond Hill unit the owner slept in” would break the site’s own verification culture (`verify-job-cards.mjs`, “nobody writes an MVTR figure who did not take it”). Use them to lock layout, crop, and copy. Replace with first-party photos before the slider is labeled as a named job.

---

## 2. Placement inventory — ranked by revenue

Priority: P0 ships this week. P1 this month. P2 when photography exists.

### P0-1. Homepage — new PROOF block
**File:** `apps/web/app/home-client.tsx`  
**Insert:** immediately after `<PricingSection />` and **before** `<JobCardRail />` (current comment `{/* 4 · FIRST-PARTY PROOF */}` around line 557).

Pricing answers “what does it cost.” The slider answers “what do I get.” That is the conversion sandwich.

**Copy already written in the attached screenshots — keep it:**
- Kicker: `PROOF`
- Headline: `Same maple. Same condo. Different floor.`
- Factline: `Occupied Richmond Hill unit, dust-contained sand, waterborne two-component finish. The owner slept there.`
- Instruction: `Drag the slider.`
- CTA: `See the work` → `/case-studies` (or the specific job slug once it exists)

**Images:**
- `01-richmond-hill-maple-condo-BEFORE.jpg`
- `01-richmond-hill-maple-condo-AFTER.jpg`

**Why this pair:** refinishing is the volume product ($4.75–$7.50/sf). Maple is the GTA workhorse. Occupied + dust-contained is the objection that kills quotes.

---

### P0-2. `/hardwood-floor-refinishing-toronto`
**File:** `apps/web/app/hardwood-floor-refinishing-toronto/page.tsx`  
**Insert:** under the H1 / price CTA, *before* “The whole job, in order.”  
This is the head-term money page. It currently proves method with diagrams (`fig-four-machines-roles`, `concept-edger-halo`). Diagrams do not close a refinish.

Same Richmond Hill maple pair. Secondary slider lower on the page: problems pair (`07-*`) next to “What to look for in someone else’s work.”

Reuse `EvidenceRail` but put the slider *above* the text cards, not instead of them. Numbers stay. Eyes go first.

---

### P0-3. `/hardwood-flooring-toronto`
**File:** `apps/web/app/hardwood-flooring-toronto/page.tsx`  
**Insert:** after “What hardwood flooring costs in Toronto,” before the climate lecture.

Installation is a different story than refinishing. Do not reuse the maple refinish pair here — that trains the buyer to think you only sand.

**Images:**
- `02-forest-hill-walnut-BEFORE-subfloor.jpg`  (plywood + blue tape)
- `02-forest-hill-walnut-AFTER.jpg`

**Copy:**
- Headline: `Same room. Same mantel. Different floor.`
- Factline: `Forest Hill, 8–12" black walnut, oil finish. The substrate was measured before a single board was laid.`
- CTA: `/case-studies/forest-hill-walnut-wide-plank-color-stability`

Alternate pair on the same page if you want two sliders: Distillery slab → white oak (`06-*`).

---

### P0-4. `/services/dust-free-sanding`
**File:** `apps/web/app/services/[slug]/page.tsx` (slug `dust-free-sanding`)  
**Insert:** directly under “What dust-free actually means.”

The page currently has one diagram of a hose and a zip wall. The claim that matters is *the owner slept there.*

**Images:**
- `04-dust-free-occupied-DURING.jpg`   (plastic, HEPA, furniture covered)
- `04-dust-free-occupied-AFTER.jpg`    (same life, finished floor)

**Copy:**
- Headline: `They stayed home. The floor still changed.`
- Factline: `HEPA at the tool. Zip-wall at the opening. Furniture bagged, not removed.`

Note: this pair is a DURING/AFTER, not BEFORE/AFTER. Label the left handle `During`, not `Before`. Honesty is the brand.

---

### P0-5. Case-study pages — `imageSlot` is already wired
**Files:**
- `apps/web/app/components/JobCard.tsx` (`imageSlot`)
- `apps/web/app/case-studies/[slug]/page.tsx`
- `apps/web/app/case-studies/page.tsx`

Five published jobs. Zero photographs.

| Slug | Slider pair to bind | Caption |
|---|---|---|
| `forest-hill-walnut-wide-plank-color-stability` | `02-*` | Wide-plank walnut over an Edwardian shell |
| `distillery-district-victorian-condo` | `06-*` | White oak glue-down over concrete |
| `rosedale-estate-stairs-radiant-heat` | `03-*` | Stairs are the tell |
| `yorkville-loft-basement-conversion-moisture-mitigation` | *needs a basement-slab pair — not generated yet* | MVTR 9.8 → 0.6, then the floor |
| `midtown-townhouse-three-level-transition` | *needs a three-landing pair — not generated yet* | Three substrates, one continuous floor |

Homepage `JobCardRail` (`home-client.tsx` ~563) should render the slider thumbnail (or the AFTER still) on each card the moment `imageSlot` is filled. That is the cheapest win in the repo: the slot exists.

---

### P1-6. `/hardwood-stairs-toronto`
**Insert:** after “What people actually mean: four different jobs, all called stairs.”

**Images:** `03-rosedale-stairs-BEFORE.jpg` / `03-rosedale-stairs-AFTER.jpg`  
**Copy:** `Same flight. Same window. Different stairs.`  
**Factline:** `Quoted per tread, not per square foot. The nosing is where cheap work shows.`

Geometry of this pair drifted (iron balusters vs new oak newel). Recapture with a locked camera before ship. Comp is good enough to design the module.

---

### P1-7. `/realtors`
**Insert:** under the 3-day pre-list recoat narrative, above the scheduling copy.

**Images:** `05-realtor-prelist-BEFORE.jpg` / `05-realtor-prelist-AFTER.jpg`  
**Copy:** `The MLS photo is taken on day three. Not before.`  
**Factline:** `Orange builder stain → natural satin. Photography after the sheen settles.`

This pair also drifted architecturally (patio door changed). Recapture from the BEFORE plate.

---

### P1-8. `/hardwood-floor-problems-toronto`
**Insert:** hero, under “Why is my floor cupping, gapping or peeling?”

**Images:** `07-problems-cupping-gapping-BEFORE.jpg` / `07-problems-cupping-gapping-AFTER.jpg`  
**Copy:** `The gap is a climate problem. The grey is a finish problem. Both are solvable.`

This is the only pair that can be a tight board-level crop. Use it as the “detail” slider; do not put a board-macro on the homepage.

---

### P1-9. Service-area pages that already name the housing stock
Do **not** put a unique slider on all 32 pages. That is 64 images and a lie. Put one local slider on the five neighbourhoods that already have a case study, and a shared default on the rest.

| Area page | Slider | Why |
|---|---|---|
| `/service-areas/richmond-hill` | `01-*` maple condo | Copy in the screenshot already says Richmond Hill |
| `/service-areas/forest-hill` | `02-*` walnut | Published case study |
| `/service-areas` index “Proof, with the numbers” | Distillery `06-*` | Page already leads Distillery / concrete |
| `/service-areas/yorkville` | Yorkville pair (not yet generated) | Published case study |
| `/service-areas/rosedale` | `03-*` stairs | Published case study |
| `/service-areas/midtown-toronto` | Midtown pair (not yet generated) | Published case study |
| All other 26 area pages | Reuse `01-*` with caption that does **not** claim that city | “A GTA maple refinish. Dust-contained. Owner stayed home.” |

Richmond Hill page today names Mill Pond / Bayview Hill and has **no photograph**. That is malpractice on a local page.

---

### P1-10. `/commercial` and `/services` index
`/services` lists six services as text cards with price bands. Each card should use the AFTER still as a 4:3 thumb. Only Installation, Refinishing, Dust-Free, and Stairs get a full slider further down.

`/commercial` (condo boards / property managers): Distillery `06-*` plus the dust-free DURING/AFTER. Boards buy containment and schedule, not walnut figure.

---

### P2-11. `/library` Visual library
Page already indexes 234 images. Add a new collection: **Before / After plates**, 7 pairs, each linking to the page that uses the slider. This is what AI crawlers and journalists will quote. File them as:

```
/library#before-after
```

Do not dump comps into `public/gallery/` next to the species beauty shots. New directory:

```
apps/web/public/proof/
  richmond-hill-maple-before.jpg
  richmond-hill-maple-after.jpg
  forest-hill-walnut-before.jpg
  forest-hill-walnut-after.jpg
  rosedale-stairs-before.jpg
  rosedale-stairs-after.jpg
  dust-free-occupied-during.jpg
  dust-free-occupied-after.jpg
  realtor-prelist-before.jpg
  realtor-prelist-after.jpg
  distillery-loft-before.jpg
  distillery-loft-after.jpg
  problems-cupping-before.jpg
  problems-cupping-after.jpg
```

---

### P2-12. Quote form / photo-triage (`/#quote`, `/#photo-triage`)
`home-client.tsx` ~625. When the form switches to “Send 3 photos,” show a tiny 50/50 still of pair `01` as the example of what “after” looks like. Caption: `This is what we do with a tired maple floor.` Do not make this a full drag slider — it fights the form.

---

### P2-13. `/design` floor designer
The configurator shows species / finish / pattern and a price range. It does not show a room. When the user picks White Oak + Satin + Straight Plank, cross-fade the AFTER plate of pair `01` or `06`. This is not a before/after slider. It is the payoff of the configurator.

---

### Do not put sliders here
- `/papers/*`, `/guides/*`, `/framework`, `/glossary`, `/data`, `/authority`, `/standards`  
  These pages sell judgement. A slider turns them into a brochure.
- `/team`, `/about`, `/press`  
  Faces and facts, not floors.
- `/blog` except a dedicated “before and after” article that points back to `/library#before-after`.

---

## 3. Asset library generated this session

All files live in `/home/workdir/artifacts/ba-slider-library/`.

| ID | File | Role | Slider-ready? |
|---|---|---|---|
| 01B | `01-richmond-hill-maple-condo-BEFORE.jpg` | Worn grey maple, empty condo, window left | **Best pair.** Recrop AFTER window to 3-pane to lock geometry. |
| 01A | `01-richmond-hill-maple-condo-AFTER.jpg` | Honey maple, sheer curtains, walnut chair | Flagship homepage / refinish / Richmond Hill |
| 02B | `02-forest-hill-walnut-BEFORE-subfloor.jpg` | Plywood + blue tape + mantel | Strong. AFTER mantel is close. |
| 02A | `02-forest-hill-walnut-AFTER.jpg` | Wide walnut, bench, mantel | Install page + Forest Hill case study |
| 03B | `03-rosedale-stairs-BEFORE.jpg` | Painted worn treads, iron balusters | Comp only — geometry drifted |
| 03A | `03-rosedale-stairs-AFTER.jpg` | White oak treads, new newel | Stairs page + Rosedale case study |
| 04D | `04-dust-free-occupied-DURING.jpg` | Plastic, HEPA, covered sofa | Label left handle `During` |
| 04A | `04-dust-free-occupied-AFTER.jpg` | Lived-in finished maple | Dust-free page |
| 05B | `05-realtor-prelist-BEFORE.jpg` | Orange-red builder oak, slider door | Recapture AFTER from this plate |
| 05A | `05-realtor-prelist-AFTER.jpg` | Light oak listing room | `/realtors` |
| 06B | `06-distillery-loft-BEFORE-slab.jpg` | Brick loft, stained slab | Strong mood |
| 06A | `06-distillery-loft-AFTER-white-oak.jpg` | White oak + lounge chair | Distillery case + commercial |
| 07B | `07-problems-cupping-gapping-BEFORE.jpg` | Grey boards, open seams | Problems page detail slider |
| 07A | `07-problems-cupping-gapping-AFTER.jpg` | Tight honey maple | Same |

Missing plates still required before the case-study set is complete:
1. Yorkville below-grade slab, raw vs red oak + maple accent stripes.
2. Midtown three-level: one frame that shows a stair landing turning from mixed substrates into one continuous floor.
3. Herringbone / chevron AFTER (pattern install is a different buyer).
4. Screen-and-recoat pair (light abrasion, same colour — the $2.50–$4.00 product). Do not use a dramatic colour change for that SKU.

---

## 4. Code hooks already waiting (do not invent new pages)

```
apps/web/app/home-client.tsx          +557   JobCardRail / FIRST-PARTY PROOF
apps/web/app/components/JobCard.tsx   imageSlot
apps/web/app/components/EvidenceRail.tsx
apps/web/app/components/IllustrationPair.tsx   (do NOT reuse — it cross-fades diagrams)
apps/web/app/hardwood-floor-refinishing-toronto/page.tsx
apps/web/app/hardwood-flooring-toronto/page.tsx
apps/web/app/hardwood-stairs-toronto/page.tsx
apps/web/app/hardwood-floor-problems-toronto/
apps/web/app/services/[slug]/page.tsx
apps/web/app/case-studies/[slug]/page.tsx
apps/web/app/service-areas/richmond-hill/
apps/web/app/realtors/
apps/web/app/library/
apps/web/app/commercial/
```

Build a single `BeforeAfterSlider.tsx` next to `IllustrationPair.tsx`. Feed it from a `proof-plates.ts` registry so `verify-images.mjs` can fail the build when a plate is missing — same discipline as illustrations.

---

## 5. How this dominates the niche

Every Toronto floor site has a gallery. Almost none have a drag that keeps the room still and changes only the floor. That is the demo.

The site already has the harder half: published prices, published moisture numbers, salaried-crew claim, 32 area pages. The slider is the missing sensory proof that makes those numbers believable.

Order of operations, Bezos-style:
1. Ship the component once.
2. Put pair 01 on the homepage and the refinish head-term. Measure quote-form starts.
3. Fill `imageSlot` on the three homepage JobCards.
4. Replace comps with real plates from the next three occupied jobs. Same camera height, same corner, before the machines start and after furniture returns.
5. Only then roll sliders onto area pages.

Until step 4, caption every AI plate as a *visualization of the work*, never as a named address. The brand is “checkable.” Do not spend that.

---

## 6. Suggested JSON-LD per slider (for crawlers and agents)

```json
{
  "@type": "ImageObject",
  "name": "Maple refinish — occupied Richmond Hill condo",
  "caption": "Same maple. Same condo. Different floor. Dust-contained sand, waterborne two-component finish.",
  "contentUrl": "https://ecowoods.ca/proof/richmond-hill-maple-after.jpg",
  "thumbnailUrl": "https://ecowoods.ca/proof/richmond-hill-maple-before.jpg",
  "creator": { "@type": "Organization", "name": "Ecowoods Hardwood Flooring Inc." }
}
```

Also add both URLs to `/library` and to `llms.txt` so answer engines can cite the visual, not just the MVTR paragraph.
