# Proof sliders — placement pack

Unzip this archive at the **repository root** of `ecowoods-app`.

```
unzip ecowoods-slider-pack.zip
```

That writes:

```
apps/web/public/images/sliders/*.jpg
apps/web/public/images/sliders/*.webp
docs/visual/SLIDER_PACK.md          ← this file
```

Every pair is **1920×1280**, 3:2, sRGB. Before and after share the same crop so a comparison handle tracks. Use the `.webp` files on the site. Keep the `.jpg` files as masters.

These frames are **generated illustrations**, not job photographs. Do not register them as `kind: 'photograph'` in `apps/web/lib/images.ts`. Caption the *type of work*. Replace with real job photography when a shoot exists.

Suggested caption pattern:

> Occupied Richmond Hill condo. Same maple strip. Dust-contained sand, waterborne two-component finish. Drag to compare the floor.

---

## File index

| ID | Before | After |
| --- | --- | --- |
| 01 | `01-richmond-hill-maple-condo-before.webp` | `01-richmond-hill-maple-condo-after.webp` |
| 02 | `02-forest-hill-walnut-wideplank-before.webp` | `02-forest-hill-walnut-wideplank-after.webp` |
| 03 | `03-yorkville-loft-moisture-before.webp` | `03-yorkville-loft-moisture-after.webp` |
| 04 | `04-rosedale-stairs-radiant-before.webp` | `04-rosedale-stairs-radiant-after.webp` |
| 05 | `05-midtown-townhouse-continuous-before.webp` | `05-midtown-townhouse-continuous-after.webp` |
| 06 | `06-richmond-hill-builder-oak-before.webp` | `06-richmond-hill-builder-oak-after.webp` |
| 07 | `07-dustfree-occupied-home-before.webp` | `07-dustfree-occupied-home-after.webp` |
| 08 | `08-herringbone-walnut-border-before.webp` | `08-herringbone-walnut-border-after.webp` |

Public URL once deployed:

```
https://ecowoods.ca/images/sliders/<filename>
```

---

## Where each pair goes

Ship order is the column that matters. Three sliders on the three pages that already rank beats sixteen sliders on pages nobody opens.

### P0 — mount first

| Pair | Live route | Insert | Headline | Copy under the handle |
| --- | --- | --- | --- | --- |
| **01** | `/` | New `PROOF` block **above** the existing “Finished work” JobCardRail in `apps/web/app/home-client.tsx` | Same maple. Same condo. Different floor. | Occupied Richmond Hill unit, dust-contained sand, waterborne two-component finish. The owner slept there. Drag the slider. |
| **07** | `/hardwood-floor-refinishing-toronto` | After “Living in the house”, before “Proof, with the numbers” | Same house. Same boards. The owner stayed. | Containment at the opening. Extraction at the tool. Furniture stayed in the next room. |
| **01 + 06** | `/service-areas/richmond-hill` | Under “What we see in Richmond Hill homes.” Page currently has no images. | Same maple. Same condo. Different floor. / Same oak. Same subdivision. Different floor. | Yonge corridor condos use 01. 1990s–2000s oak strip uses 06. |
| **07 + 01** | `/services/dust-free-sanding` and `/services/floor-refinishing` | Hero. IMAGE_BRIEF already flags both service pages as having no images. | Occupied home. Containment up. Floor changed. | Full sand and finish. Waterborne two-component. |
| **02 + 05** | `/hardwood-flooring-toronto` | Inside “Proof, with the numbers” | Same room. New floor. | Forest Hill walnut (02). Midtown continuous maple (05). |
| **02** | `/services/hardwood-installation` | Hero | Substrate first. Then the floor you see. | Wide-plank black walnut over plywood. |
| **04** | `/services/stair-refinishing` and `/hardwood-stairs-toronto` | Hero | Same staircase. Different treads. | Treads, risers and nosings colour-matched to the field. |
| **08** | `/services/custom-inlays` and `/guides/herringbone-chevron-parquet-toronto` | Hero / pattern section | Straight-lay gone. Herringbone kept. | White oak herringbone, walnut border, mitred corners. |
| **06** | `/realtors` | After listing-prep copy | Same house. Listable floor. | Builder-grade oak, sanded and finished for a listing. |

### Case studies — fill the empty `imageSlot`

`apps/web/content/job-cards.ts` leaves `imageSlot` undefined. Point it at the after frame; put the pair on the case-study hero.

| Pair | Case study slug | Route |
| --- | --- | --- |
| 02 | `forest-hill-walnut-wide-plank-color-stability` | `/case-studies/forest-hill-walnut-wide-plank-color-stability` |
| 03 | `yorkville-loft-basement-conversion-moisture-mitigation` | `/case-studies/yorkville-loft-basement-conversion-moisture-mitigation` |
| 05 | `midtown-townhouse-three-level-transition` | `/case-studies/midtown-townhouse-three-level-transition` |
| 04 | `rosedale-estate-stairs-radiant-heat` | `/case-studies/rosedale-estate-stairs-radiant-heat` |
| 03 framing | `distillery-district-victorian-condo` | `/case-studies/distillery-district-victorian-condo` until a white-oak pair is shot |

Pair 01 has no published case study. Write the Richmond Hill occupied-condo job first. Until then it is homepage proof, not a case-study photograph.

### Area pages — inherit, do not invent

| Housing stock | Pair | Example routes |
| --- | --- | --- |
| Yonge / condo corridor | 01 | `/service-areas/richmond-hill`, `north-york`, `vaughan`, `markham`, `downtown-toronto`, `king-west`, `liberty-village` |
| 1990s subdivision oak | 06 | `richmond-hill`, `mississauga`, `brampton`, `ajax`, `pickering`, `newmarket`, `aurora` |
| Estate / Forest Hill stock | 02 + 04 | `forest-hill`, `rosedale`, `lawrence-park` |
| Below-grade / loft | 03 | `yorkville`, `the-annex` |
| Midtown townhouse | 05 | `midtown-toronto`, `davisville-village`, `leaside` |
| Occupied refinish, any city | 07 | any area page + `/guides/dustless-hardwood-refinishing-toronto` |

`/commercial` reuses 01 and 03.

### Do not mount sliders on

`/papers/*`, `/glossary/*`, `/data`, `/framework`, `/library` diagrams. Those pages are engineering. A beauty slider there cheapens the corpus.

---

## Suggested component contract

Not implemented in this pack. When it is built, feed it exactly:

```ts
{
  before: '/images/sliders/01-richmond-hill-maple-condo-before.webp',
  after:  '/images/sliders/01-richmond-hill-maple-condo-after.webp',
  eyebrow: 'PROOF',
  title: 'Same maple. Same condo. Different floor.',
  lede: 'Occupied Richmond Hill unit, dust-contained sand, waterborne two-component finish. The owner slept there.',
  hint: 'Drag the slider.',
  beforeAlt: 'Worn maple strip floor in a Richmond Hill condominium before refinishing.',
  afterAlt: 'The same maple strip floor after a dust-contained sand and waterborne two-component finish.',
}
```

Left = before. Right = after. Handle starts at 50%.

---

## Manifest check

16 frames × 2 formats = 32 files under `apps/web/public/images/sliders/`.

If a build guard requires entries in `apps/web/lib/images.ts`, register each frame as `kind: 'illustration'` with `status: 'published'` and the alt text above. Do not set `kind: 'photograph'`.
