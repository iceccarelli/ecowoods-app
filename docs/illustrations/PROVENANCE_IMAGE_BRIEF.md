# EcoWoods — Provenance Series Image Brief

**To the image-generating agent: this file is your complete brief. Read all of it before generating anything.**

You are producing technical illustrations for a series of papers on **where the hardwood
installed in Toronto homes actually comes from** — the forest, the mill, the grading rules, the
kiln, and what all of it means for a floor that has to be sanded and refinished decades later.

These sit on ecowoods.ca, a site whose entire content strategy rests on one claim: every
published figure traces to something real. Thirteen automated guards enforce it in code. Your
output either passes them or the build fails.

---

## 0. THE RULE THAT ENDS THE PROJECT IF BROKEN

**Nothing you generate may be mistaken for a photograph of a real place, mill, forest or job.**
Every image is classified `diagram` or `illustration` and may NEVER be `photograph` — a build
guard fails on any attempt.

Never depict: a named or identifiable company's mill, equipment livery, or signage; a real
person; a specific forest location presented as a real place; a branded product; a government
document reproduced as if genuine.

**Diagrams explain. Photographs testify. You are generating the first.**

---

## 1. DELIVERABLE

One zip named exactly:

```
ecowoods-illustrations-provenance.zip
```

Structure — one flat folder, no nesting:

```
ecowoods-illustrations-provenance.zip
└── illustrations/
    ├── provenance-forest-to-floor.webp
    ├── provenance-selection-system.webp
    └── … one file per slot in §4
```

- **Format:** WebP. Not PNG, not JPG.
- **Filename:** exactly the slot `id` plus `.webp`. Lowercase, hyphens only, `^[a-z0-9-]+$`.
- **Canvas:** 1600 × 900 px for REGISTER A. 1600 × 1074 px for REGISTER B. §4 names the register.
- No README, no contact sheet, no source files. An extra file in the folder fails the guard.

---

## 2. THE TWO REGISTERS — use the one §4 names, never mix

### REGISTER A — Flat vector diagram (most slots)

Append verbatim to every Register A prompt:

> Flat vector technical illustration, editorial cross-section style. Strictly limited palette:
> warm cream background (#faf6ef), deep walnut brown (#3d2b1f), copper accent (#c87e4f), one
> muted sage (#42704f) only where a second material must be distinguished. Clean 2px linework,
> generous negative space, no gradients, no photorealism, no drop shadows, no perspective
> vanishing point — orthographic or flat side elevation. ABSOLUTELY NO TEXT, NO LABELS, NO
> NUMBERS, NO ARROWS WITH WORDS anywhere in the image. Centred composition with even margins,
> safe for cropping. 16:9.

**Four colours, and that is the whole palette.** Copper marks the one thing the diagram is
about — the stage that fails, the quantity that inverts, the layer that matters. Sage appears
only when a second material must be told apart from the first.

**No text means no text.** Not a unit, not a digit, not a legend, not a watermark. Every label
lives in the HTML beside the image where a screen reader reads it, a translator translates it, a
crawler indexes it, and an image model cannot misspell it. The meaning must survive with zero
characters on the canvas — carry it in geometry, position, colour, repetition and relative size.

**This matters more in this series than any before it.** Several of these diagrams are about
QUANTITIES — growing stock, yield fractions, growth against harvest. You must express those as
*relative lengths and areas*, never as printed numbers. A bar twice as long says "twice" without
a single character. The exact figures live in the caption, sourced and dated.

### REGISTER B — Photorealistic educational render (only where §4 says so)

Append verbatim:

> Photorealistic technical illustration with neutral professional lighting and high micro-detail.
> Real material fidelity — visible wood grain and pores, accurate ray fleck, true end-grain
> structure. Educational callout labels rendered sharply in the image using the exact terminology
> of the accompanying caption, set in clean sans-serif on high-contrast plates. Centred
> composition with even margins. 1600x1074.

Register B is the only place labels may appear inside the picture, and they must use the exact
words from that slot's CAPTION — never your own phrasing. Still generated illustrations, never
photographs.

---

## 3. COMPOSITION RULES THAT AFFECT POST-PROCESSING

Delivered art is automatically trimmed to content and re-bordered before it ships.

1. **Fill the frame.** Target ~85–90% content. A previous batch averaged 52% fill and one image
   used 21% of its canvas — it rendered as a postage stamp inside a full-width box.
2. **No self-applied border, frame, drop shadow or vignette.** A uniform margin is added
   afterward; anything you add is trimmed unpredictably or doubles the margin.
3. **Flat, even `#faf6ef` background, no texture or gradient.** The trim step keys on that exact
   colour; a gradient breaks it.

---

## 4. THE SLOTS

`ID` is the filename. `REGISTER` says which suffix to append. `ALT` and `CAPTION` ship in the
HTML — **do not render them into Register A images**; use them only to understand what the
picture must communicate.

---

### GROUP 1 — The chain from forest to floor

**ID:** `provenance-forest-to-floor` · **REGISTER A**
**ALT:** The seven stages a hardwood floor passes through — standing tree, felled log, sawmill breakdown, kiln, flooring mill, distributor warehouse, and the finished floor in a room — drawn as one continuous left-to-right sequence.
**CAPTION:** Standing tree, log, sawmill, kiln, flooring mill, distributor, installed floor. No single publication describes this chain for Canada end to end; it is reconstructed here from what the manufacturers publish about their own operations.
**PROMPT:** A single continuous left-to-right sequence on a cream ground showing seven stages, each a small clean vignette connected to the next by an unbroken line: a standing broadleaf tree in full crown; the same trunk felled and bucked into a log; a log passing through a saw and opening into flat boards; a stack of boards cross-stickered inside a closed chamber; boards being milled into tongue-and-groove profile; those profiled boards bundled and stacked on a warehouse pallet; and finally a small room interior with the floor laid. Draw the connecting line and the kiln chamber in the copper accent; every vignette in walnut brown.

**ID:** `provenance-vertical-integration` · **REGISTER A**
**ALT:** Two supply chains compared — one where a single company owns the sawmill, the kiln and the flooring plant, and one where the same steps pass between separate unconnected businesses.
**CAPTION:** A vertically integrated producer owns its own sawmill, kilns and finishing lines. The alternative is the same steps distributed across separate businesses, where nobody holds the whole record. The Quebec producers that supply most of the GTA publish the first structure.
**PROMPT:** Two horizontal chains stacked one above the other on a cream ground, each made of the same four linked stages. The upper chain sits entirely inside one continuous enclosing outline, drawn in the copper accent, so it reads as one owner. The lower chain has the identical four stages but each sits inside its own separate small outline with visible gaps between them, drawn in walnut brown. Same stages, different boundaries — the enclosure is the whole point.

**ID:** `provenance-log-breakdown` · **REGISTER A**
**ALT:** One log end shown three ways — plain sawn, rift sawn and quarter sawn — with the growth ring angle at the board face different in each and the yield from each cut pattern visible.
**CAPTION:** How a log is opened decides the grain on the face and how the board moves afterwards. Quarter sawn presents rings near-perpendicular to the face and moves least across its width; plain sawn yields the most boards per log.
**PROMPT:** Three identical circular log end-sections in a row on a cream ground, each with concentric growth rings drawn finely. In the first, the log is divided by parallel horizontal cuts straight across. In the second, cuts radiate at a moderate angle to the rings. In the third, the log is quartered and each quarter cut perpendicular to the rings. Beneath each, show one representative board removed and rotated to display its face grain — broad cathedral arches, a tighter angled figure, and straight parallel lines with visible ray fleck. Draw the growth rings in copper accent, the boards in walnut brown.

**ID:** `provenance-kiln-moisture-journey` · **REGISTER A**
**ALT:** The moisture content of a board tracked from green timber through kiln drying to the manufactured range and then to the range it lives in inside a heated house.
**CAPTION:** Flooring is manufactured at 6% to 9% moisture content (NWFA/NOFMA, April 2018). What happens after that is set by the room: NWFA publishes a service range of 30–50% relative humidity, and Toronto indoor air leaves that range in both directions every year.
**PROMPT:** A horizontal band on a cream ground reading left to right, with a single line tracking downward steeply then flattening. At the left the line begins very high; it descends sharply through a clearly marked enclosed chamber section in the middle; it then runs into a narrow horizontal channel on the right where it oscillates gently up and down without leaving the channel. Above the oscillating section, draw a wider shaded band that the channel sits inside. Draw the chamber and the narrow channel in the copper accent; the tracking line and the outer band in walnut brown.

---

### GROUP 2 — The forest, and how it is cut

**ID:** `provenance-selection-system` · **REGISTER A**
**ALT:** The same stand of trees shown across three successive partial harvests, with mature canopy retained throughout and younger trees establishing beneath it, contrasted with a single clearing harvest.
**CAPTION:** Ontario's tolerant hardwood forests are managed by single-tree selection: periodic partial harvests that keep dense mature cover in perpetuity, with regeneration established under at least 70% residual cover. Residual trees may be retained for multiple cutting cycles totalling 100+ years.
**PROMPT:** A composition in two rows on a cream ground. The upper row shows the same patch of forest at three points in time, left to right: in each, most large trees remain standing with full crowns while a small number are shown removed, and beneath the retained canopy progressively taller young trees appear. The lower row shows the same patch at the same three points where all trees are removed at once in the first panel and the ground is bare, then uniformly small trees appear, then uniformly medium ones. Draw the retained mature canopy in the upper row in the copper accent; everything else walnut brown.

**ID:** `provenance-ontario-hardwood-zone` · **REGISTER A**
**ALT:** A simplified map of Ontario with the southern deciduous and Great Lakes–St. Lawrence forest regions distinguished from the boreal forest to the north, showing where the tolerant hardwoods grow.
**CAPTION:** Ontario's tolerant hardwood forest type covers 2,565,209 hectares, of which 1,215,664 are Crown managed (Forest Resources of Ontario 2021). Its seven principal species are sugar maple, American beech, yellow birch, red oak, white ash, black cherry and basswood.
**PROMPT:** A simplified flat map outline of the province of Ontario on a cream ground, with the Great Lakes shown as clean shapes along the south. Divide the landmass into three broad horizontal bands by boundary line only: a large northern band, a middle band, and a smaller southern band. Fill the middle and southern bands with a fine even hatch in the copper accent; leave the northern band plain walnut brown outline. No place names, no legend, no compass, no scale bar, no lettering of any kind.

**ID:** `provenance-growing-stock-species` · **REGISTER A**
**ALT:** Ontario's growing stock volume for the hardwood species used in flooring, drawn as bars on one common scale so sugar maple's dominance over red oak and ash is visible as length.
**CAPTION:** Ontario gross growing-stock volume: sugar maple 300,361,212 m³; red oak 85,019,702 m³; ash 42,273,003 m³ (Forest Resources of Ontario 2021). White oak, hickory and black walnut are not broken out separately in that inventory.
**PROMPT:** Three horizontal bars stacked vertically against one shared left baseline on a cream ground, drawn strictly to relative length: the top bar is the longest, the second is roughly 28% of the top bar's length, the third roughly 14% of it. Beneath them, draw three short dashed outline bars of indeterminate length that fade out before reaching any endpoint, indicating quantities not published. Draw the longest solid bar in copper accent, the other two solid bars in walnut brown, the dashed outlines in a lighter walnut. No axis, no ticks, no numbers.

**ID:** `provenance-ash-supply-inversion` · **REGISTER A**
**ALT:** Growth set against harvest for six hardwood species, with five showing growth roughly double the harvest and white ash alone showing harvest exceeding growth, and an insect spread pattern drawn beneath it.
**CAPTION:** For five of the six species, annual growth runs roughly double annual harvest. White ash is the exception: 3.3 million m³ grown against 6.9 million m³ harvested (AHEC). Emerald ash borer kills up to 99% of ash trees within 8–10 years, and was first detected at Windsor, Ontario in 2002.
**PROMPT:** Six paired-bar groups in a row on a cream ground. In each group, two vertical bars stand side by side. In the first five groups the left bar is roughly twice the height of the right bar. In the sixth group the relationship is reversed — the right bar is roughly twice the height of the left. Draw the sixth group entirely in the copper accent and the other five in walnut brown. Beneath the sixth group only, draw a small spreading radial pattern of fine lines expanding outward from a single point, in copper.

---

### GROUP 3 — Grading: the rules that decide what arrives

**ID:** `grading-nhla-yield-ladder` · **REGISTER A**
**ALT:** Four boards of the same size showing the fraction of clear defect-free cutting each lumber grade must yield, descending from ten twelfths down to four twelfths.
**CAPTION:** NHLA lumber grades are defined by the fraction of clear cutting a board yields: FAS 83⅓% (10/12), No. 1 Common 66⅔% (8/12), No. 2A Common 50% (6/12), No. 3A Common 33⅓% (4/12). Rules effective 1 January 2023.
**PROMPT:** Four identical horizontal boards stacked vertically on a cream ground, each divided along its length into twelve equal cells by fine lines. In the first board, ten of the twelve cells are filled solid. In the second, eight. In the third, six. In the fourth, four. The filled cells are grouped into contiguous runs rather than scattered. Fill the cells in copper accent and draw the board outlines and cell divisions in walnut brown.

**ID:** `grading-lumber-versus-flooring` · **REGISTER A**
**ALT:** One board passing through two different grading systems and receiving two unrelated grades — one for the lumber it is, one for the flooring it becomes.
**CAPTION:** Hardwood lumber is graded by NHLA on clear-cutting yield. Hardwood flooring is graded separately by NWFA/NOFMA on appearance — and appearance alone, since "all grades are equally strong and serviceable in any application."
**PROMPT:** A single board at the left of a cream ground, from which two separate paths diverge to the right. The upper path passes through a gate shape and ends at a stack of four short bars of descending length. The lower path passes through a different gate shape and ends at four small board faces showing progressively more knots, mineral streak and colour variation but identical size. Draw the two gates in copper accent; the board, paths and endpoints in walnut brown.

**ID:** `grading-flooring-character` · **REGISTER B**
**ALT:** Four oak flooring boards laid side by side showing the progression from a clear heartwood-dominant grade through select, common and character grades, with sapwood, knots, mineral streak and colour variation increasing across the four.
**CAPTION:** NWFA/NOFMA flooring grades describe appearance, not strength. Clear is heartwood-dominant with minimal character; each grade below it admits more sapwood, knots, mineral streak and colour variation. Every one of them is equally strong and serviceable.
**PROMPT:** Photorealistic macro of four finished white oak flooring boards laid tightly side by side, filling the frame, lit evenly from above. The leftmost board is near-uniform heartwood with almost no figure. The second shows slight colour variation and a narrow band of paler sapwood along one edge. The third carries small tight knots, a visible mineral streak and clear colour variation between ends. The fourth carries larger knots, strong colour contrast, pronounced mineral streak and open character. Educational callout labels on clean high-contrast plates identify sapwood, a knot, mineral streak and colour variation on the boards where each first appears.

**ID:** `provenance-sawn-face-macro` · **REGISTER B**
**ALT:** End-grain macro of three oak boards cut plain sawn, rift sawn and quarter sawn, with the growth ring angle to the face different in each and ray fleck visible on the quartered face.
**CAPTION:** The angle of the growth rings to the board face is set at the saw and never changes. Quarter sawn presents rings near-perpendicular to the face and shows medullary ray fleck; plain sawn presents them near-parallel and shows cathedral figure.
**PROMPT:** Photorealistic macro of three white oak board end-sections standing upright side by side on a neutral surface, each roughly the same dimensions, lit to reveal end grain and pore structure. In the first, the growth rings run nearly parallel to the wide face. In the second, the rings meet the face at a moderate angle. In the third, the rings run nearly perpendicular to the face and prominent medullary ray fleck is visible on the adjacent face. Educational callout labels on clean high-contrast plates identify the ring angle in each and the ray fleck on the third.

---

### GROUP 4 — What it means for a floor that must be sanded

**ID:** `provenance-wear-layer-budget` · **REGISTER A**
**ALT:** A solid board and two engineered boards in section, with the material available above the tongue or above the core marked against the thresholds below which a floor can no longer be sanded to bare wood.
**CAPTION:** NWFA's refinishable thresholds for engineered flooring: 3.2 mm wear layer unfinished smooth, 2.5 mm factory-finished smooth. A solid board carries a generational wear layer above the tongue. NWFA notes a sanding removes about 1/32" and declines to state a total number of cycles.
**PROMPT:** Three board sections side by side in flat elevation on a cream ground, all the same overall thickness. The first is one continuous material with a horizontal line partway down marking the tongue, and the material above that line subdivided into many thin equal slices. The second has a distinctly thinner top layer over a visibly cross-laminated core, subdivided into three slices. The third has a top layer thinner still, subdivided into one slice with a hard line immediately beneath it. Draw the slices in copper accent; below each stack draw a short horizontal threshold rule in copper.

**ID:** `species-hardness-ladder` · **REGISTER A**
**ALT:** Six hardwood species ordered by side hardness, drawn as bars on one common scale from black walnut at the softest through red oak, white oak, white ash and hard maple to shagbark hickory at the hardest.
**CAPTION:** Side hardness at 12% moisture content, in pounds-force: shagbark hickory 1,880; hard maple 1,450; white oak 1,360; white ash 1,320; red oak 1,290; black walnut 1,010 (USDA Forest Products Laboratory, Wood Handbook Table 5-3b).
**PROMPT:** Six horizontal bars stacked vertically against one shared left baseline on a cream ground, drawn strictly to relative length in descending order. The longest bar is roughly 1.86 times the length of the shortest; the four middle bars are closely grouped within about 12% of one another and clearly separated from both the longest and the shortest. Draw the longest and the shortest bars in copper accent and the four closely grouped middle bars in walnut brown. Beside each bar, a small circular indentation mark whose diameter scales with the bar length. No axis, no ticks, no numbers.

**ID:** `provenance-moisture-differential-gate` · **REGISTER A**
**ALT:** A meter reading on a subfloor set against a meter reading on the flooring material, with the permitted difference between them shown as a narrow bracket that is wider for strip flooring than for wide plank.
**CAPTION:** NWFA publishes a maximum moisture-content difference between acclimated flooring and subfloor: 4% for solid strip under 3" wide, 2% for wide-width flooring 3" and over. Test at a minimum of 20 locations per 1,000 square feet and average the results.
**PROMPT:** A cutaway floor assembly on a cream ground with a subfloor panel below and flooring boards above it. A small meter device rests on each, with a plain rectangular readout face on both, no characters shown. Between the two readouts draw a vertical bracket. Draw that bracket twice, side by side: once noticeably taller, once noticeably shorter, with a narrow board shown beneath the taller bracket and a wide board beneath the shorter one. Draw both brackets in copper accent, everything else walnut brown.

**ID:** `provenance-certification-chain` · **REGISTER A**
**ALT:** A chain of custody running from a certified forest through each handler to the finished floor, with the certificate travelling alongside the material and one break in the chain shown where the link is not carried forward.
**CAPTION:** As of December 2020, 29 of 39 Ontario forest management units were certified — FSC, SFI, or both. Certification travels with the material through a chain of custody: a break anywhere in that chain and the claim cannot be made at the far end.
**PROMPT:** A horizontal chain of five interlocking links on a cream ground, running left to right, each link containing a small vignette: a stand of trees, a saw, a drying chamber, a warehouse pallet, a finished floor. A continuous second line runs alongside and through every link. In one place near the right, that second line is drawn broken with a clear gap while the chain links themselves continue unbroken. Draw the continuous line and its break in the copper accent; the chain links in walnut brown.

**ID:** `provenance-what-you-should-receive` · **REGISTER B**
**ALT:** The documents that should accompany a hardwood floor delivery — the grade and species on the bundle, the moisture record taken on site, the manufacturer's specification sheet and the written fixed price.
**CAPTION:** What should exist in writing before a deposit: species and grade as supplied, the subfloor and material moisture readings taken on site, the manufacturer's specification for the product, and the price. Documents shown are illustrative examples, not a client's paperwork.
**PROMPT:** A photorealistic overhead scene on a plain neutral surface: a bundled stack of tongue-and-groove hardwood flooring at one edge of the frame with a printed paper band around it, and three printed documents fanned beside it — a record sheet with a short table of two measured values, a manufacturer specification sheet showing a range, and an itemised estimate with a boxed total. A pin-type moisture meter rests across one document. Educational callout labels on clean high-contrast plates identify the bundle band, the moisture record, the specification and the price. All document content generic and illustrative — no real names, no addresses, no company branding.

---

## 5. BEFORE YOU ZIP — self-check

- [ ] Every filename matches a slot `id` exactly, lowercase, hyphens, `.webp`
- [ ] No extra files, no nested folders beyond `illustrations/`
- [ ] Register A: **zero characters on the canvas.** Look again — one stray digit fails the build
- [ ] Register A: only #faf6ef, #3d2b1f, #c87e4f, #42704f
- [ ] Register A quantity diagrams: relative lengths are correct to the ratios stated in the prompt
- [ ] Register B: labels use the exact terminology from that slot's CAPTION
- [ ] Background flat, even #faf6ef, no gradient or texture
- [ ] No identifiable company, mill, person, place, product or government document
- [ ] Nothing could be mistaken for a photograph of a real forest, mill or job
- [ ] Content fills ~85–90% of canvas; no self-applied border, frame or shadow

Deliver: `ecowoods-illustrations-provenance.zip`
