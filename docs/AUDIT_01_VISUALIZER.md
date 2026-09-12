# AUDIT #1 — THE AI CAMERA FLOOR FEATURE

**Scope:** every claim the platform makes about seeing a floor in your own room.
**Method:** read the implementation, then execute it. Nothing below is graded
from documentation, a comment, or a page's own prose.
**Baseline:** `main` @ `7614386`.
**Harness:** `apps/web/lib/floor-studio/audit.test.ts` — synthetic rooms with
known ground truth, run through the real `analyseRoom()` and `compositeFloor()`.
It is a characterisation test, not a guard: it pins the two defects below as
numbers, so the day VIS-02 or VIS-03 fixes one, the suite fails and this
document has to be rewritten in the same patch.

```bash
pnpm --filter @ecowoods/web exec vitest run lib/floor-studio/audit.test.ts
```

*(The first version of this harness ran under `node --experimental-strip-types`,
which needs Node ≥ 22.6 and did not run on the machine it was written for.
Evidence nobody can reproduce is not evidence — NAV-03 moved it into the
repository's own vitest.)*

> The instruction this audit was written under: *"Do not assume features exist
> because documentation says they exist. Verify everything from the actual
> implementation."* and *"Do NOT mark something A+ because it is 'good enough.'"*

---

## 0. THE HEADLINE

**The grade is B‑. It is not A+, and saying A+ today would be the exact failure
this repository exists to prevent.**

Three findings carry that grade, and all three are executed rather than argued:

| # | Finding | Class |
|---|---|---|
| **AV-01** | The occlusion mask paints hardwood over people, dogs, jute rugs, wooden furniture legs and stair risers — 6 of 14 tested objects, 100% of their pixels | **BROKEN** |
| **AV-02** | The floor-boundary estimator reports `measured` — its confident label — while losing 72% of the floor, in the single most common room photograph there is (a room with a rug) | **MISLEADING** |
| **AV-03** | The studio has no concept of country. Every figure is CAD, and it is linked from the global header and footer of all **26 New York pages** | **BROKEN** (reopens GC-024) |

Everything else is honest. Much of it is unusually honest — the refusal to
estimate area from a photo, the refusal to generate floors, the single price
source — and that is *why* these three matter: they are the only places where
the system asserts something it cannot support.

---

## 1. CAPABILITY MATRIX

`PASS` works and was executed · `PARTIAL` real but incomplete · `MISSING` not
implemented · `BROKEN` implemented and wrong · `MISLEADING` works but tells the
visitor something untrue · `UNVERIFIED` not testable from here.

### 1.1 Camera

| Capability | Verdict | Evidence |
|---|---|---|
| Live camera access (`getUserMedia`) | **MISSING** | `grep -rn "getUserMedia\|mediaDevices" apps/web packages` → 0 matches |
| Native camera capture | **PASS** | `FloorStudio.tsx:428` — `<input type="file" accept="image/*" capture="environment">`. On a phone this opens the rear camera. On desktop it degrades to a file picker, silently. |
| Front/rear camera selection | **MISSING** | `capture="environment"` is a fixed hint; no device enumeration exists |
| Permission prompt + fallback | **PASS (by construction)** | There is no permission to grant: the OS camera app mediates. Upload is a first-class sibling, not a fallback. `FloorStudio.tsx:414–437` |
| Live preview / live AR | **MISSING** | No `MediaStream`, no `requestAnimationFrame` in the studio. The pipeline is single-frame. |
| Graceful degradation of live AR | **n/a → MISSING** | Nothing to degrade |

**Read this honestly:** the site never claims live AR. `/floor-studio` says
"Upload a photo of your room, or start from a floor". The button says *"Use my
camera"* and it does use the camera. This is a **gap against the brief**, not a
lie to a visitor.

### 1.2 Computer vision

| Capability | Verdict | Evidence |
|---|---|---|
| Semantic segmentation | **MISSING** | No model, no weights, no inference. `grep tensorflow\|onnxruntime\|@mediapipe` → 0 |
| Instance segmentation | **MISSING** | as above |
| Monocular depth estimation | **MISSING** | as above |
| Plane detection | **PARTIAL** | `room.ts:estimateFloorQuad` — a colour-run heuristic from a bottom-centre reference patch, walking upward until the run collapses. Named as a heuristic in its own docblock. |
| Perspective / homography | **PASS** | `render.ts:solveHomography` — eight equations, Gaussian elimination with partial pivoting, degenerate quads return `null` rather than NaN. Exact projective map, not an affine approximation. Covered by `render.test.ts`. |
| Surface-normal estimation | **MISSING** | The plane is assumed flat and level |
| **Occlusion of objects on the floor** | **BROKEN** | See §2 |
| Confidence reporting | **MISLEADING** | See §3 |

### 1.3 Rendering

| Capability | Verdict | Evidence |
|---|---|---|
| Only real, buyable products rendered | **PASS** | `render.ts` docblock and implementation: every board is synthesised from a catalogue record's two pigments + finish tint + sheen. No generative model anywhere in the dependency tree. |
| The room's own light is preserved | **PASS** | `render.ts:489` — each output pixel keeps the luminance ratio of the pixel it replaces against the floor-region mean, clamped to 0.45–1.8 |
| Sheen behaves like sheen | **PASS** | `render.ts:495` — gloss scales with how far above the mean the original pixel was, so satin reads satin and matte reads matte with no extra input |
| **Modifies only the floor** | **BROKEN** | §2 — it modifies whatever shares wood's hue |
| Orientation control | **PARTIAL** | Pattern (straight / diagonal / herringbone / chevron) and a board-scale nudge. There is **no free rotation angle**, so a room whose boards should run toward the window cannot be shown that way. |
| Determinism (a shared link shows the sender's floor) | **PASS** | Texture is a pure function of the configuration id |

### 1.4 Measurement honesty

| Capability | Verdict | Evidence |
|---|---|---|
| Never presents AI-estimated dimensions as measurements of record | **PASS — exemplary** | `room.ts:UNMEASURABLE_FROM_A_PHOTO`. The area is **asked for**, with the reason printed next to the field. The docblock states the principle: *"A single uncalibrated photograph with no reference object of known size cannot yield an area, and every product in this category that claims otherwise is guessing."* |
| Room type asked rather than inferred | **PASS** | same |
| Two area modes | **PASS** | Typed square feet (verify screen) + a slider (studio). Both write one field. |

### 1.5 Price

| Capability | Verdict | Evidence |
|---|---|---|
| Uses the real pricing source, not a duplicate | **PASS** | `catalog.ts:421 priceConfiguration` → `estimateInstalledRangeCad(input, bandForWork(work))` → `content/constants/pricing.ts`. One source, enforced by `verify-pricing-source.mjs`. GC-025, closed in GEO-005. |
| Never called a quote | **PASS** | `FloorStudio.tsx:783` — *"This is a **range, not a quote.**"* on every screen the figure appears |
| Price shown is explainable | **PASS** | The "Why this price?" disclosure names the published band and links to it rather than retyping it |
| **Priced in the visitor's currency** | **BROKEN** | §4 |

### 1.6 Recommendation

| Capability | Verdict | Evidence |
|---|---|---|
| Explainable — no bare score | **PASS** | `match.ts` returns `reasons[]` and `caveats[]`; the UI renders the score *and* its sentences. Page copy: *"A percentage with nothing under it is a number you cannot check."* |
| Ranks over installable configurations only | **PASS** | `incompatibilities()` — fuming needs tannin; herringbone/chevron are cut as blocks |
| Customer override | **PASS** | Four axes, each disabled option carrying `aria-describedby` prose saying *why*, plus draggable/keyboard corners, area, and board scale |
| Auto-repair is disclosed | **PASS** | `FloorStudio.tsx:340` — *"We moved the finish and pattern to keep this a floor we can lay."* |

### 1.7 Save, share, hand off

| Capability | Verdict | Evidence |
|---|---|---|
| Before/after comparison, ≥4 options | **PASS** | `MAX_COMPARE = 5`; split-slider before/after plus a side-by-side list |
| Save (survives reload) | **PASS** | `studio-config.ts:saveStudioDesign` → `localStorage`, 30-day max age |
| Share link | **PASS** | `encodeStudioDesign` → query string; `history.replaceState` keeps the address bar honest |
| Download the image | **PASS** | `pixelsToDataUrl` → `<a download>` |
| **Customer images not exposed publicly** | **PASS — by construction** | There is no upload endpoint. The share link carries the floor, never the room. `decodePhoto` → `analyseRoom` → `compositeFloor` all run on `ImageData` in the tab. |
| Never silently uploads | **PASS** | as above, and stated on the analysing screen |
| Quote handoff, nothing retyped | **PASS** | `estimateHref(design)` carries species, finish, pattern, width, area and room into `/estimate` |

### 1.8 Platform

| Capability | Verdict | Evidence |
|---|---|---|
| Analytics funnel | **PASS** | 10 studio events, typed in `lib/analytics.ts`, from `studio_open` to `studio_estimate_handoff`. No event carries a photograph, a room, or anything about the person. |
| SEO / AEO | **PASS** | `WebApplication` JSON-LD with `featureList` and a `QuoteAction`; breadcrumbs; a markdown twin at `/floor-studio.md`; the whole explanation server-rendered rather than hydrated |
| Security — no keys in the browser | **PASS** | There is no service to hold a key for |
| Accessibility | **PARTIAL** | Corners are real `<button>`s with arrow-key handling and descriptive labels; axes are `<fieldset>/<legend>` with `aria-pressed`; `role="status"`/`aria-live` on the analysing and repair messages. **Not audited:** colour contrast of the canvas overlay, focus visibility on the corner handles, and the fact that the canvas conveys the entire result to a sighted user with only a one-line `aria-label` for everyone else. |
| Performance budget | **UNVERIFIED** | `compositeFloor` is O(width × height) per frame in JS on the main thread, re-run on every axis change and on every comparison pane. No worker, no throttle. Not measured on a real device from here. |
| Observability | **UNVERIFIED** | No error reporting from the studio beyond `setError` into the DOM |
| Tests | **PARTIAL** | ~1,000 lines across `room.test.ts`, `render.test.ts`, `match.test.ts`, `catalog.test.ts`, `studio-config.test.ts`. **No test covers AV-01 or AV-02** — which is exactly why they shipped. |

---

## 2. AV-01 — THE MASK PAINTS OAK OVER PEOPLE

### What the code does

`render.ts:474` is the entire object-protection system:

```ts
const c = chromaOf(r0, g0, b0);
if (Math.hypot(c.u - meanU, c.v - meanV) > tolerance) continue;   // tolerance = 0.075
```

`chromaOf` normalises brightness out and keeps two opponent axes. So the test is:
**"is this pixel a different hue from the average floor?"** There is no
luminance term, no texture term, no edge term, no spatial coherence, no
segmentation. A pixel is protected if and only if its hue differs from wood.

### What that means in a room

Executed against the real `compositeFloor`, 14 objects placed on a known floor
inside an honest quad:

```
OBJECT ON THE FLOOR          in-quad  overwritten     %   VERDICT
grey fabric sofa                1588            0     0.0   PRESERVED
cream/jute area rug             3233         3233   100.0   PAINTED OVER
charcoal rug                    3233            0     0.0   PRESERVED
green plant                     3233            0     0.0   PRESERVED
human leg (skin)                3233         3233   100.0   PAINTED OVER
black cat                       3172            0     0.0   PRESERVED
golden retriever                1893         1893   100.0   PAINTED OVER
white cabinet toe-kick          2865            0     0.0   PRESERVED
oak stair riser                 3233         3233   100.0   PAINTED OVER
pine/oak table leg              3233         3233   100.0   PAINTED OVER
cardboard box                   3233         3233   100.0   PAINTED OVER
navy armchair                   3233            0     0.0   PRESERVED
terracotta pot                  3172            0     0.0   PRESERVED
brass floor lamp base           3085            0     0.0   PRESERVED
```

**6 of 14, every pixel.** The pattern is not random: everything in the
wood-hue family is destroyed, and the wood-hue family includes **human skin**,
**a light-coloured dog**, **a jute or sisal rug**, **wooden furniture legs**,
**oak stair risers** and **cardboard**. Everything outside it survives.

### Why this is BROKEN and not PARTIAL

The renderer's own docblock states the intent:

> *"A sofa leg, a rug, a plant pot inside the quad is not floor and must not be
> painted over… It is a conservative test and it is meant to be — leaving a
> little of the old floor showing looks like a rough edge, while painting oak
> across the cat looks like a toy."*

The implementation does not do what the docblock says. It is conservative
against *colour*, which makes it anti-conservative against the objects most
likely to be standing on a hardwood floor in a hardwood-floor customer's house:
wooden furniture, natural-fibre rugs, a dog, and the homeowner's own feet.

### Additional consequence

`FloorStudio.tsx:625` shows *"A lot of this room is furniture rather than floor"*
when `painted < 0.5`. Because wooden furniture is **painted**, not skipped,
`painted` stays high in exactly the rooms where the warning is most needed. The
safety net is wired to the wrong signal.

---

## 3. AV-02 — "MEASURED" IS ASSERTED WHERE IT IS NOT TRUE

`room.ts` defines two confidence values and explains the choice:

> *"There is no third, confident-sounding value, and there is no percentage: a
> number like '87% confident' is a claim about a distribution nobody estimated."*

That reasoning is correct. The problem is the boundary between the two.

Executed against the real `analyseRoom`, six synthetic rooms with a known
floor plane (true coverage 0.55):

```
SCENE                              confidence   coverage   true    error   label honest?
empty room, oak floor              measured        0.551    0.55      0%    yes
dark walnut floor                  measured        0.551    0.55      0%    yes
with a large pale area rug         measured        0.153    0.55     72%    NO
with a sofa                        measured        0.551    0.55      0%    yes
rug + sofa (a real living room)    measured        0.153    0.55     72%    NO
shot from a doorway (angled)       measured        0.417    0.55     24%    yes
```

The estimator is **excellent on an empty room** and **wrong by 72% the moment
there is a rug on the floor** — because a rug collapses the colour run exactly
the way a wall does, and the algorithm cannot tell the two apart.

`weak` fires only on degeneracies: an image under 8px, a run that never
collapses, a far edge narrower than a fifth of the frame. It does **not** fire
on the common case. So the screen that says *"We found your room"* says
`measured` to a visitor whose floor has been cut to a sixth of its real size.

The corner-drag control is genuinely good and genuinely first-class. But the
copy around it — *"Drag the four corners onto the floor if we got the edge
wrong"* — invites a correction the label has just told the visitor is
unnecessary.

**This is the `MISLEADING` class exactly: it works, and it tells the visitor
something untrue.**

---

## 4. AV-03 — 26 NEW YORK PAGES OPEN A CANADIAN-DOLLAR DOOR

GEO-004 closed GC-024 by establishing that a New York surface shows no CAD
figure and an Ontario surface shows no USD figure. `verify-geo` holds that line
on the pages it knows about.

The studio is not one of them:

```
$ grep -rn "country\|PriceCountry\|bandForCountry" apps/web/lib/floor-studio/ apps/web/app/components/floor-studio/
(no matches)
```

- `catalog.ts:426` — `bandForWork(work)`, with `country` left at its `'CA'` default
- `FloorStudio.tsx:99` — `Intl.NumberFormat('en-CA', { currency: 'CAD' })`, hard-coded
- `FloorStudio.tsx:589` — the budget field is labelled *"optional, CAD"*
- `floor-studio/page.tsx:117` — the `WebApplication` JSON-LD tells machines the
  range is *"in Canadian dollars"*
- `Header.tsx:68` and `SiteFooter.tsx:247` link `/floor-studio` from **every**
  page, which is all 26 US markets: buffalo, amherst, williamsville, clarence,
  cheektowaga, lancaster, west-seneca, tonawanda, kenmore, grand-island,
  orchard-park, hamburg, east-aurora, niagara-falls-ny, lewiston, wheatfield,
  north-tonawanda, lockport, rochester-ny, brighton, pittsford, fairport,
  victor, webster, irondequoit, greece

A homeowner in Amherst reads a USD band on `/service-areas/amherst`, clicks
"See it in your room" in the header, and is quoted in Canadian dollars with no
explanation. **The system states two different versions of one fact.** GC-024 is
reopened as **GC-026**.

`bandForWork(work, country)` already takes the argument. Nothing calls it with
one.

---

## 5. WHAT IS GENUINELY EXCELLENT

Recorded because an audit that only lists faults is not an audit.

1. **The refusal to measure area.** Most of this product category prints
   "approximately 320 sq ft" under a photo. This one refuses, in a docblock that
   explains why, and asks instead — with the reason next to the field.
2. **The refusal to generate.** No diffusion model. Every board rendered is a
   floor that can be bought. The docblock calls the alternative *"a fraud with a
   nice colour palette"*, which is the correct description.
3. **No upload path exists.** Not "we delete it" — there is no endpoint. Privacy
   by construction, with the PIPEDA reasoning written down at `room.ts:29`.
4. **One price source.** `priceConfiguration` delegates; `verify-pricing-source`
   enforces it.
5. **Every disabled control says why.** `aria-describedby` prose on each
   incompatible option, from chemistry and geometry rather than merchandising.
6. **The homography is exact.** Not the affine approximation that makes cheap
   visualisers look like stickers.

---

## 6. GRADE

| Dimension | Grade | Why |
|---|---|---|
| Truthfulness of claims to visitors | **C** | AV-02 asserts confidence it does not have; AV-03 states the wrong currency to 26 markets |
| Truthfulness of claims about capability | **A** | The site never claims segmentation, depth or live AR |
| CV / camera capability vs. the brief | **D** | No live camera, no segmentation, no depth, no normals |
| Rendering fidelity | **B** | Exact perspective and real light; destroyed by AV-01 |
| Pricing integrity | **B** | One source (A) undone by one currency (F) |
| Recommendation explainability | **A** | |
| Privacy | **A+** | Nothing to leak, by construction |
| Save / share / handoff | **A** | |
| Analytics | **A** | |
| SEO / AEO | **A** | |
| Accessibility | **B‑** | Good bones, unaudited canvas |
| Performance | **UNVERIFIED** | |
| Test coverage of the failure modes | **D** | No test covers either defect |
| **OVERALL** | **B‑** | |

**A+ EVERYWHERE is not true today and this audit does not claim it.** The route
to it is AV-01, AV-02 and AV-03 — in that order, one patch each, each with a
guard that fails the build if the defect returns.

---

## 7. THE FIX QUEUE

| Patch | Closes | What it must do |
|---|---|---|
| **VIS-02** | AV-01 | Replace the chroma-only mask with a mask that also uses luminance distance, local texture energy and spatial coherence, and verify it against a fixture set that includes skin, a light dog, jute, and wooden legs. Ship the fixture set as a test. |
| **VIS-03** | AV-02 | Make `measured` mean measured. Cross-check the colour-run horizon against an independent signal (row-wise luminance gradient), and downgrade to `weak` when they disagree. Add the six-scene fixture above as a test with an error budget. |
| **GEO-006** | AV-03 | Give the studio a country. `bandForWork(work, country)` already accepts it; `Intl.NumberFormat` must follow the band's own currency, the JSON-LD must stop saying "Canadian dollars" unconditionally, and `verify-geo` must widen to cover the studio the way it covers the city pages. |

Nothing in this queue lowers a threshold or suppresses a failure. Each one makes
the system able to support a claim it is already making.
