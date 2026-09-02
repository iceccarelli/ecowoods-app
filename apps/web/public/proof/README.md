# Ecowoods proof plates

Unzip this archive at the **repository root** (`ecowoods-app/`).

```
unzip ecowoods-proof-plates.zip
```

That writes:

```
apps/web/public/proof/*.webp          ← serve these
apps/web/public/proof/*.jpg           ← masters / Open Graph
apps/web/app/data/proof-plates.ts     ← registry + placement + alt text
PROOF_README.md                       ← this file
```

These are **layout comps** for the before/after slider. Do not caption them as a named occupied job until a crew shoots the same corner. The site’s own rule in `home-client.tsx` is “no stock photography.”

Serve `/proof/*.webp`. Keep `.jpg` for social cards and print.

---

## Where each pair goes

| Plate id | WebP files | Primary routes | Headline |
|---|---|---|---|
| `richmond-hill-maple` | `richmond-hill-maple-before.webp` `richmond-hill-maple-after.webp` | `/` after PricingSection, before JobCardRail · `/hardwood-floor-refinishing-toronto` · `/service-areas/richmond-hill` | Same maple. Same condo. Different floor. |
| `forest-hill-walnut` | `forest-hill-walnut-before.webp` `forest-hill-walnut-after.webp` | `/hardwood-flooring-toronto` · `/case-studies/forest-hill-walnut-wide-plank-color-stability` · `/service-areas/forest-hill` · JobCard `imageSlot` | Same room. Same mantel. Different floor. |
| `rosedale-stairs` | `rosedale-stairs-before.webp` `rosedale-stairs-after.webp` | `/hardwood-stairs-toronto` · `/case-studies/rosedale-estate-stairs-radiant-heat` · `/service-areas/rosedale` | Same flight. Same window. Different stairs. |
| `dust-free-occupied` | `dust-free-occupied-during.webp` `dust-free-occupied-after.webp` | `/services/dust-free-sanding` · `/commercial` | They stayed home. The floor still changed. |
| `realtor-prelist` | `realtor-prelist-before.webp` `realtor-prelist-after.webp` | `/realtors` | The MLS photo is taken on day three. |
| `distillery-loft` | `distillery-loft-before.webp` `distillery-loft-after.webp` | `/case-studies/distillery-district-victorian-condo` · `/service-areas` · `/commercial` | Same loft. Same brick. Different floor. |
| `problems-cupping` | `problems-cupping-before.webp` `problems-cupping-after.webp` | `/hardwood-floor-problems-toronto` only | The gap is climate. The grey is finish. |

Left handle on `dust-free-occupied` is **During**, not Before.

---

## Public URLs after deploy

```
https://ecowoods.ca/proof/richmond-hill-maple-before.webp
https://ecowoods.ca/proof/richmond-hill-maple-after.webp
https://ecowoods.ca/proof/forest-hill-walnut-before.webp
https://ecowoods.ca/proof/forest-hill-walnut-after.webp
https://ecowoods.ca/proof/rosedale-stairs-before.webp
https://ecowoods.ca/proof/rosedale-stairs-after.webp
https://ecowoods.ca/proof/dust-free-occupied-during.webp
https://ecowoods.ca/proof/dust-free-occupied-after.webp
https://ecowoods.ca/proof/realtor-prelist-before.webp
https://ecowoods.ca/proof/realtor-prelist-after.webp
https://ecowoods.ca/proof/distillery-loft-before.webp
https://ecowoods.ca/proof/distillery-loft-after.webp
https://ecowoods.ca/proof/problems-cupping-before.webp
https://ecowoods.ca/proof/problems-cupping-after.webp
```

---

## Code hooks already in the repo

- `apps/web/app/home-client.tsx` ~557 — `{/* 4 · FIRST-PARTY PROOF */}` / `<JobCardRail />`
- `apps/web/app/components/JobCard.tsx` — `imageSlot`
- `apps/web/app/components/EvidenceRail.tsx` — text proof rail; put the slider *above* it
- Do not reuse `IllustrationPair.tsx` (diagram cross-fade)

Import the registry:

```ts
import { PROOF_PLATES, proofSrc } from '../data/proof-plates';
```
