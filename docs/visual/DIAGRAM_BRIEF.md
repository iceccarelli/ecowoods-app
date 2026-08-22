# Image brief — the two registers, and what each one has to satisfy

`apps/web/lib/images.ts` is the manifest. Every image slot on the site is
declared there with its dimensions, alt text, caption and the prompt it came
from, and `scripts/verify-images.mjs` fails the build on a slot that breaks its
own declaration. There are two visual languages, and a new image has to pick one.

## Register 1 — `d(...)`, flat vector diagrams

For anything schematic: cross-sections, plan views, assemblies, decision
structures. `STYLE_SUFFIX` is appended to every prompt automatically:

> Flat vector technical illustration, editorial cross-section style. Strictly
> limited palette: warm cream background (#faf6ef), deep walnut brown (#3d2b1f),
> copper accent (#c87e4f), one muted sage (#42704f) only where a second material
> must be distinguished. Clean 2px linework, generous negative space, no
> gradients, no photorealism, no drop shadows, no perspective vanishing point —
> orthographic or flat side elevation. ABSOLUTELY NO TEXT, NO LABELS, NO NUMBERS,
> NO ARROWS WITH WORDS anywhere in the image. Centred composition with even
> margins, safe for cropping. 16:9.

The no-text rule is enforced on this register: the guard fails a `d` entry whose
prompt does not forbid text.

## Register 2 — `p(...)`, detailed labelled renders

For anything a homeowner has to *see* to believe: a cupped board under raking
light, four machines standing in a real room, meters sitting on a real subfloor,
a decision tree over real interiors. `DETAIL_STYLE_SUFFIX` is appended:

> Photorealistic technical illustration with neutral professional lighting and
> high micro-detail. Real material fidelity — visible wood grain and pores,
> accurate ply structure, true surface deformation under raking light.
> Educational callout labels rendered sharply in the image using the exact
> terminology of the accompanying caption, set in clean sans-serif on
> high-contrast plates. Centred composition with even margins. 1600x1074.

### The two rules that make this register safe

**1. `kind: 'illustration'`, never `'photograph'`.** These are generated. The
manifest says so, the guard enforces it, and no caption anywhere claims one of
them is a photograph of an Ecowoods job. `kind: 'photograph'` requires a
`provenance` naming a real shoot and forbids a generation prompt — that is
reserved for the camera, and `audit/PHOTO_SHOT_LIST.md` is where those live.

**2. Every label inside the picture also exists in the caption.** No fact may
live *only* in pixels. A baked-in label cannot be read by a screen reader,
translated, indexed by a crawler, or quoted by an AI agent — and this site's
whole position is that it is the most machine-readable hardwood resource in the
market. The guard fails any `p` entry whose caption is shorter than 40
characters. Write the caption as the machine-readable copy of the image.

### Numbers in a labelled image

A number rendered into a picture is a published claim that no text guard can
read. Two rules:

- If the site already publishes the figure, use the site's exact figure.
  "Minimum 72-hour acclimation in the actual conditioned space" is published
  (`apps/web/lib/papers.ts:143`) and is safe to label.
- If it does not, the caption must say the value is a worked example. The
  acceptable moisture delta is the clearest case: `papers.ts:104` says *"Both
  readings must sit within the manufacturer's and EcoWoods' acceptable delta"* —
  the number is deliberately not ours to state, so an image showing 8.2% and
  7.4% carries a caption saying those are illustrative.

Never label a certification, a warranty term, a price, or a company statistic
inside an image. Those live in `docs/outreach/CLAIMS_REGISTER.md` and change.

## The six pillars, spelled exactly

From `apps/web/lib/framework.ts`. Any hero or index image that names them must
match, character for character:

1. Moisture and acclimation
2. Substrate and method
3. Product specification
4. Expansion and movement
5. Dust containment and sequence
6. Commercial accountability

`FRAMEWORK_VERSION` is `1.0` and `FRAMEWORK_PUBLISHED_AT` is `2026-08-19`, and
both are rendered from those constants on the page. Do not stamp a version or a
date into artwork — it goes stale the first time either constant changes, and the
page will then show two different answers.

## The mechanical floor — both registers

| check | rule | why |
| --- | --- | --- |
| format | `.webp`, named `<id>.webp` for a manifest id | the manifest is the index |
| long edge | ≥ 1600px | renders up to ~1000 CSS px; this is the retina floor |
| og slots | exactly 1200x630 | the social card specification |
| dimensions | must match `DIMS` in `apps/web/lib/images.ts` | `next/image` reserves space from the manifest; a mismatch reflows the page |
| encoding | WebP quality 82, method 6 | ~150 KB at 1600x1074 for a detailed render |
| alt | ≥ 20 chars, must not open with "image of" / "diagram showing" | a screen reader already says "image" |
| caption | required on `d` and `p`; ≥ 40 chars on `p` | the machine-readable copy of the picture |
| import | regenerate `apps/web/app/data/illustration-images.ts` | `apps/web/public` is not served on this host (F-131) |

Pipeline for a new batch:

```
# place masters, then:
node scripts/gen-illustration-imports.mjs
pnpm verify:images
pnpm verify && pnpm build
```

## Still to generate

The package that established this register lists twelve slots it did not cover.
They should come in the `p(...)` register at 1600px:

- `detail-acclimation-correct-vs-wrong`
- decision cards: nail-glue-floating, evaluate-quote, cost-toronto,
  choose-contractor, white-oak, herringbone-chevron-parquet
- reference installations: condo-concrete, radiant-heat, refinishing-sequence,
  dustless-occupied

## Photographs

Still the one asset no model can produce. `kind: 'photograph'` requires
`provenance` naming a real shoot and forbids a prompt. The shot list is
`audit/PHOTO_SHOT_LIST.md` and it is still empty. A real photograph of a real
Ecowoods floor outranks any render ever generated.
