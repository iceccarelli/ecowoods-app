/**
 * Illustration manifest — every image slot on the authority surfaces.
 *
 * WHY THIS IS A MANIFEST AND NOT JUST FILES IN A FOLDER
 *
 * An image on this site is a claim. A cross-section that shows an expansion gap
 * at 12 mm is asserting 12 mm; a photograph implies a job someone did. Loose
 * files in public/ carry neither provenance nor alt text, and nothing stops the
 * wrong one being used in the wrong place.
 *
 * So every slot is declared here with its dimensions, its alt text, what it is
 * allowed to be, and — for anything generated — the exact prompt it came from.
 * The prompt IS the provenance of a generated image, which is why it lives in
 * version control next to the code that renders it.
 *
 * ── THE LINE THAT MUST NOT MOVE ──────────────────────────────────────────
 *
 * `kind: 'photograph'` means a camera pointed at something real. A generated
 * image may be a `diagram` or an `illustration`; it may NEVER be a photograph,
 * and scripts/verify-images.mjs fails the build on any entry that tries.
 *
 * This is not pedantry. The entire corpus is built on the claim that everything
 * here traces to something real, and thirteen guards enforce it. A synthetic
 * image presented as a finished Ecowoods floor is the same defect as a
 * fabricated moisture reading, with worse consequences — it is more persuasive
 * and easier to catch. One reverse-image search ends the authority position
 * this whole architecture exists to build.
 *
 * Diagrams explain. Photographs testify. Generate the first; shoot the second.
 *
 * ── TEXT IN IMAGES ───────────────────────────────────────────────────────
 *
 * None. Every label lives in the HTML beside the image, never inside it:
 * screen readers can read it, translators can translate it, crawlers can index
 * it, and image models cannot misspell it. Each prompt says so explicitly.
 *
 * ── PENDING IS A REAL STATE ──────────────────────────────────────────────
 *
 * `status: 'pending'` means the slot is designed and the file has not arrived.
 * The component renders a labelled placeholder that reserves the exact final
 * dimensions, so layout does not shift when the image lands and no page ever
 * shows a broken image icon. Shipping the slots before the art is deliberate.
 */

export type ImageKind = 'diagram' | 'illustration' | 'photograph';
export type ImageStatus = 'pending' | 'published';

/**
 * The status both helpers stamp on the entries they build.
 *
 * All 28 files are on disk, so this is 'published' and verify-images.mjs
 * asserts every one exists AND matches its declared dimensions.
 *
 * A NEW slot added later must be written as a full object literal with
 * `status: 'pending'` until its file lands — deliberately more work than
 * calling a helper, so the awkward path is the one that ships a placeholder to
 * production.
 */
const DEFAULT_STATUS: ImageStatus = 'published';

export type SiteImage = {
  /** Stable id, used in code. */
  id: string;
  /** Filename under public/illustrations/. Must match the id. */
  file: string;
  kind: ImageKind;
  status: ImageStatus;
  /** Intrinsic size. Required — this is what prevents layout shift. */
  width: number;
  height: number;
  /** Describes the INFORMATION, not the picture. Never "an image of…". */
  alt: string;
  /** Shown under the image. Optional. */
  caption?: string;
  /** The generation prompt. Provenance for anything not photographed. */
  prompt?: string;
  /** Where a photograph came from. Required when kind is photograph. */
  provenance?: string;
  /** The page that explains this image. Makes /library a navigation surface. */
  href?: string;
};

/* Two sizes, so the whole set is visually consistent and every slot is
   predictable: 16:9 for inline explanatory art, 1200x630 for social cards. */

/**
 * Intrinsic size per image, measured from the files on disk.
 *
 * The delivered art was uniformly 1600x900, but the drawing inside it was not —
 * mean fill was 52%, and `failure-cupping` used 21% of its frame. At a fixed
 * 16:9 box that empty margin is rendered as page, so a cross-section displayed
 * at 1000px wide was drawing its content at a fraction of that.
 *
 * Each inline diagram is therefore trimmed to its own content plus a uniform
 * margin, and carries its own true dimensions here. `pillar-substrate` went from
 * 1600x900 at 32% fill to 1647x359 at ~90%: same layout width, roughly two and a
 * half times the drawn detail.
 *
 * The five og-* cards keep 1600x900's sibling 1200x630 exactly, because social
 * platforms require that ratio and will letterbox or crop anything else.
 *
 * scripts/prepare-illustrations.sh produces these files deterministically and
 * verify-images.mjs reads the WebP headers on disk and fails if any file
 * disagrees with the number below it.
 */
/**
 * Where each image is explained.
 *
 * Without this, /library is a gallery — 28 pictures a visitor looks at and then
 * leaves. With it every tile is a door into the page that explains it, and the
 * index becomes the fastest route into the corpus for someone who thinks
 * visually. verify-images.mjs checks each target is a real route.
 */
const HREFS: Record<string, string> = {
  'pillar-moisture': '/framework#moisture',
  'pillar-substrate': '/framework#substrate',
  'pillar-specification': '/framework#specification',
  'pillar-movement': '/framework#movement',
  'pillar-containment': '/framework#containment',
  'pillar-accountability': '/framework#accountability',
  'failure-cupping': '/glossary/cupping',
  'failure-crowning': '/glossary/crowning',
  'failure-gapping': '/glossary/seasonal-gapping',
  'failure-buckling': '/glossary/buckling',
  'concept-expansion-gap': '/glossary/expansion-gap',
  'concept-acclimation': '/glossary/acclimation',
  'concept-mc-differential': '/glossary/moisture-differential',
  'concept-edger-halo': '/papers/hardwood-refinishing-machines-and-sequence#edger',
  'paper-climate': '/papers/toronto-hardwood-climate-moisture-protocol',
  'paper-selection': '/papers/hardwood-selection-and-cost-framework-gta',
  'paper-craft': '/papers/hardwood-refinishing-machines-and-sequence',
  'guide-solid-vs-engineered': '/guides/solid-vs-engineered-hardwood-toronto',
  'guide-method': '/guides/nail-down-glue-down-or-floating',
  'guide-evaluate-quote': '/guides/how-to-evaluate-a-hardwood-quote',
  'guide-ref-condo': '/guides/reference-condominium-concrete-slab',
  'guide-ref-radiant': '/guides/reference-radiant-heat-main-floor',
  'guide-ref-refinish': '/guides/reference-refinishing-existing-hardwood',
  'og-framework': '/framework',
  'og-market': '/market',
  'og-glossary': '/glossary',
  'og-standards': '/standards',
  'og-data': '/data',
  'framework-hero': '/framework',
  'resources-hero': '/resources',
  'failure-edge-peaking': '/glossary/edge-peaking',

  /* ── the 43-slot visual build-out (F-181) ─────────────────────────── */
  'service-installation': '/services/hardwood-installation',
  'service-refinishing': '/services/floor-refinishing',
  'service-dust-free': '/services/dust-free-sanding',
  'service-restoration': '/services/floor-restoration',
  'service-inlays': '/services/custom-inlays',
  'service-stairs': '/services/stair-refinishing',
  'fig-climate-rh-bands': '/papers/toronto-hardwood-climate-moisture-protocol#climate-reality',
  'fig-moisture-testing-sequence': '/papers/toronto-hardwood-climate-moisture-protocol#moisture-testing',
  'fig-method-substrate-matrix': '/papers/toronto-hardwood-climate-moisture-protocol#method-and-substrate',
  'fig-protocol-gates': '/papers/toronto-hardwood-climate-moisture-protocol#protocol',
  'fig-failure-cascade': '/papers/toronto-hardwood-climate-moisture-protocol#failure-modes',
  'fig-four-machines-roles': '/papers/hardwood-refinishing-machines-and-sequence#the-four-machines',
  'fig-grit-progression': '/papers/hardwood-refinishing-machines-and-sequence#belt-sander',
  'fig-planetary-blend': '/papers/hardwood-refinishing-machines-and-sequence#planetary',
  'fig-screening-between-coats': '/papers/hardwood-refinishing-machines-and-sequence#buffer',
  'fig-full-sequence-timeline': '/papers/hardwood-refinishing-machines-and-sequence#sequence',
  'fig-installed-cost-bands': '/papers/hardwood-selection-and-cost-framework-gta#installed-cost',
  'fig-species-janka': '/papers/hardwood-selection-and-cost-framework-gta#species',
  'guide-cost-toronto': '/guides/hardwood-flooring-cost-toronto',
  'guide-choose-contractor': '/guides/how-to-choose-hardwood-contractor-toronto',
  'guide-white-oak': '/guides/white-oak-flooring-toronto',
  'guide-dustless': '/guides/dustless-hardwood-refinishing-toronto',
  'guide-herringbone-parquet': '/guides/herringbone-chevron-parquet-toronto',
  'term-anisotropic': '/glossary/anisotropic',
  'term-solid-hardwood': '/glossary/solid-hardwood',
  'term-engineered': '/glossary/engineered-hardwood',
  'term-cross-ply-core': '/glossary/cross-ply-core',
  'term-wear-layer': '/glossary/wear-layer',
  'term-nail-down': '/glossary/nail-down',
  'term-glue-down': '/glossary/glue-down',
  'term-floating': '/glossary/floating',
  'term-subfloor': '/glossary/subfloor',
  'term-radiant-heat': '/glossary/radiant-heat',
  'term-janka': '/glossary/janka-hardness',
  'term-white-oak': '/glossary/white-oak',
  'term-progressive-grits': '/glossary/progressive-grits',
  'term-intercoat-screening': '/glossary/intercoat-screening',
  'term-planetary-sander': '/glossary/planetary-sander',
  'term-hepa-containment': '/glossary/hepa-dust-containment',
  'og-about': '/about',
  'og-reviews': '/reviews',
  'og-press': '/press',
  'og-services': '/services',
};

const DIMS: Record<string, [number, number]> = {
  'service-installation': [1600, 1074],
  'service-refinishing': [1600, 1074],
  'service-dust-free': [1600, 1074],
  'service-restoration': [1600, 1074],
  'service-inlays': [1600, 1074],
  'service-stairs': [1600, 1074],
  'fig-climate-rh-bands': [1600, 1074],
  'fig-moisture-testing-sequence': [1600, 1074],
  'fig-method-substrate-matrix': [1600, 1074],
  'fig-protocol-gates': [1600, 1074],
  'fig-failure-cascade': [1600, 1074],
  'fig-four-machines-roles': [1600, 1074],
  'fig-grit-progression': [1600, 1074],
  'fig-planetary-blend': [1600, 1074],
  'fig-screening-between-coats': [1600, 1074],
  'fig-full-sequence-timeline': [1600, 1074],
  'fig-installed-cost-bands': [1600, 1074],
  'fig-species-janka': [1600, 1074],
  'guide-cost-toronto': [1600, 1074],
  'guide-choose-contractor': [1600, 1074],
  'guide-white-oak': [1600, 1074],
  'guide-dustless': [1600, 1074],
  'guide-herringbone-parquet': [1600, 1074],
  'term-anisotropic': [1600, 1074],
  'term-solid-hardwood': [1600, 1074],
  'term-engineered': [1600, 1074],
  'term-cross-ply-core': [1600, 1074],
  'term-wear-layer': [1600, 1074],
  'term-nail-down': [1600, 1074],
  'term-glue-down': [1600, 1074],
  'term-floating': [1600, 1074],
  'term-subfloor': [1600, 1074],
  'term-radiant-heat': [1600, 1074],
  'term-janka': [1600, 1074],
  'term-white-oak': [1600, 1074],
  'term-progressive-grits': [1600, 1074],
  'term-intercoat-screening': [1600, 1074],
  'term-planetary-sander': [1600, 1074],
  'term-hepa-containment': [1600, 1074],
  'og-about': [1200, 630],
  'og-reviews': [1200, 630],
  'og-press': [1200, 630],
  'og-services': [1200, 630],
  'resources-hero': [1600, 1074],
  'framework-hero': [1600, 1074],
  'failure-edge-peaking': [1600, 1074],
  'concept-acclimation': [1728, 867],
  'concept-edger-halo': [1600, 1074],
  'concept-expansion-gap': [1538, 681],
  'concept-mc-differential': [1600, 1074],
  'failure-buckling': [1600, 1074],
  'failure-crowning': [1600, 1074],
  'failure-cupping': [1600, 1074],
  'failure-gapping': [1600, 1074],
  'guide-evaluate-quote': [1378, 719],
  'guide-method': [1586, 328],
  'guide-ref-condo': [1058, 1044],
  'guide-ref-radiant': [1320, 493],
  'guide-ref-refinish': [1622, 421],
  'guide-solid-vs-engineered': [1600, 1074],
  'paper-climate': [1600, 1074],
  'paper-craft': [1600, 1074],
  'paper-selection': [1442, 705],
  'pillar-accountability': [1600, 1074],
  'pillar-containment': [1600, 1074],
  'pillar-moisture': [1600, 1074],
  'pillar-movement': [1600, 1074],
  'pillar-specification': [1600, 1074],
  'pillar-substrate': [1600, 1074],
};

const W = 1600;
const H = 900;
const OG_W = 1200;
const OG_H = 630;

/** Shared style contract. Every prompt ends with this, so 28 images read as one set. */
export const STYLE_SUFFIX =
  'Flat vector technical illustration, editorial cross-section style. Strictly limited palette: warm cream background (#faf6ef), deep walnut brown (#3d2b1f), copper accent (#c87e4f), one muted sage (#42704f) only where a second material must be distinguished. Clean 2px linework, generous negative space, no gradients, no photorealism, no drop shadows, no perspective vanishing point — orthographic or flat side elevation. ABSOLUTELY NO TEXT, NO LABELS, NO NUMBERS, NO ARROWS WITH WORDS anywhere in the image. Centred composition with even margins, safe for cropping. 16:9.';

export const OG_STYLE_SUFFIX =
  'Flat vector editorial illustration. Warm cream background (#faf6ef), deep walnut brown (#3d2b1f), copper accent (#c87e4f). Clean linework, generous negative space, no gradients, no photorealism. ABSOLUTELY NO TEXT, NO LETTERING, NO NUMBERS anywhere. Subject placed left-of-centre with clear empty space on the right for an overlaid headline. 1200x630.';

/**
 * The second visual language.
 *
 * STYLE_SUFFIX above describes the flat vector diagrams: no photorealism, no
 * text, four colours. This one describes the detailed educational renders that
 * carry their own labels — a deliberate, separate register for the concepts a
 * homeowner has to *see* to believe (a cupped board under raking light, four
 * machines in a real room, meters on a real subfloor).
 *
 * Two rules make the two languages coexist rather than collide:
 *
 *   1. `kind: 'illustration'`, never 'photograph'. These are generated. The
 *      manifest says so, the guard enforces it, and no caption on this site
 *      claims any of them is a photograph of an Ecowoods job.
 *   2. Every label baked into the picture is ALSO rendered in the HTML caption
 *      and alt text beside it, so nothing in an image is the only place a fact
 *      lives. Screen readers, translators and crawlers lose nothing.
 */
export const DETAIL_STYLE_SUFFIX =
  'Photorealistic technical illustration with neutral professional lighting and high micro-detail. Real material fidelity — visible wood grain and pores, accurate ply structure, true surface deformation under raking light. Educational callout labels rendered sharply in the image using the exact terminology of the accompanying caption, set in clean sans-serif on high-contrast plates. Centred composition with even margins. 1600x1074.';

/**
 * `p` is `d` for the detailed register: same manifest shape, always an
 * illustration, and it appends DETAIL_STYLE_SUFFIX instead of STYLE_SUFFIX.
 */
const p = (id: string, alt: string, caption: string, prompt: string): SiteImage => ({
  id,
  file: `${id}.webp`,
  kind: 'illustration',
  status: DEFAULT_STATUS,
  width: DIMS[id]?.[0] ?? W,
  height: DIMS[id]?.[1] ?? H,
  alt,
  caption,
  href: HREFS[id],
  prompt: `${prompt} ${DETAIL_STYLE_SUFFIX}`,
});

const d = (
  id: string,
  alt: string,
  caption: string,
  prompt: string,
  kind: ImageKind = 'diagram',
): SiteImage => ({
  id,
  file: `${id}.webp`,
  kind,
  status: DEFAULT_STATUS,
  width: DIMS[id]?.[0] ?? W,
  height: DIMS[id]?.[1] ?? H,
  alt,
  caption,
  href: HREFS[id],
  prompt: `${prompt} ${STYLE_SUFFIX}`,
});

const og = (id: string, alt: string, prompt: string): SiteImage => ({
  id,
  file: `${id}.webp`,
  kind: 'illustration',
  status: DEFAULT_STATUS,
  width: OG_W,
  height: OG_H,
  alt,
  href: HREFS[id],
  prompt: `${prompt} ${OG_STYLE_SUFFIX}`,
});

export const IMAGES: SiteImage[] = [
  /* ── Framework pillars ─────────────────────────────────────────────── */
  p(
    'pillar-moisture',
    'Two digital moisture meters on a floor assembly — one reading 8.2 percent in the subfloor, one reading 7.4 percent in the flooring material — with boards acclimating on the finished floor of the conditioned room behind them.',
    'Pillar 1 — Moisture and acclimation: both sides of the system are measured, and the material spends a minimum of 72 hours in the actual conditioned space. The meter values shown are a worked example; the acceptable difference between them is the manufacturer\'s and ours, and it is written into the estimate.',
    'Two digital pin-type moisture meters photographed on a partly installed floor in a finished living room. The left meter sits on an exposed plywood subfloor panel with its LCD reading 8.2% MC; the right meter sits on an oak board with its LCD reading 7.4% MC. Behind them, a cross-stacked bundle of oak flooring boards acclimates on the finished floor with a sofa and a window beyond. Callout plates label the subfloor reading, the material reading, the 72-hour acclimation in conditioned space, and the bracket between the two readings.',
  ),
  p(
    'pillar-substrate',
    'Three floor assemblies cut open side by side — solid boards nailed into plywood over joists, engineered boards glued to a concrete slab, and engineered boards floating over radiant heating tubes.',
    'Pillar 2 — Substrate and method: the thing underneath decides how the floor is fastened. Plywood over joists takes nail-down solid; a slab takes glue-down engineered; radiant heat takes a floating engineered assembly.',
    'Three photorealistic cutaway floor assemblies side by side, each sliced open to show every layer. Left: solid oak strips with cleats angled through the tongue into plywood sheathing over floor joists. Centre: engineered boards bedded in a ridged trowelled adhesive layer on a concrete slab. Right: engineered boards floating on a foam underlay above a slab with radiant tubing embedded in it. Callout plates name each assembly and its fastening method.',
  ),
  p(
    'pillar-specification',
    'Extreme close-up of a solid three-quarter-inch oak board beside an engineered board cut open to show a hardwood wear layer over a cross-laminated core.',
    'Pillar 3 — Product specification: construction decides performance, not appearance. A solid board is one piece of wood through its whole thickness; an engineered board is a real hardwood wear layer over plies laid at ninety degrees to each other.',
    'Macro photograph of two board end-sections standing side by side on a neutral surface. Left: a solid 3/4 inch white oak board, one continuous grain from face to underside, open pores visible. Right: an engineered board of the same thickness with a distinct hardwood wear layer on top over four to five thinner plies, each ply\'s grain running perpendicular to the one above it. Callout plates identify the wear layer, the cross-ply core, and the two thicknesses.',
  ),
  p(
    'pillar-movement',
    'Plan view of a Toronto living room floor with a continuous half-inch expansion gap at every wall and running unbroken around a structural column and a fireplace hearth.',
    'Pillar 4 — Expansion and movement: the gap goes at every wall and every fixed object in the room, not only around the perimeter. Half an inch, roughly 12 mm, hidden under the baseboard and never filled.',
    'Overhead plan view of a furnished living room floor laid in oak, rendered photorealistically. A clean continuous expansion gap runs along all four walls, and the same gap runs unbroken around a round structural column and a rectangular fireplace hearth in the middle of the floor. Dimension callouts mark the gap width at a wall, at the column and at the hearth.',
  ),
  p(
    'pillar-containment',
    'Four sanding machines shown in working sequence in one room — belt sander in the open field, edger tight to the baseboard, planetary sander blending the two, buffer on the final pass — each with a hose running to a sealed HEPA collector.',
    'Pillar 5 — Dust containment and sequence: four machines, in that order, every one of them hosed to a sealed collector. Skipping the planetary sander is what leaves the halo where the edger stopped.',
    'A wide interior view of a room mid-refinish with four professional sanding machines positioned where each one works: a large belt sander in the open field, a compact edger tight against the baseboard, a multi-disc planetary sander straddling the boundary between them, and a buffer on already-finished floor. Flexible extraction hoses run from all four to one sealed HEPA dust collector at the room edge. Numbered callout plates give the machine name and its place in the sequence.',
  ),
  p(
    'pillar-accountability',
    'A printed fixed-price estimate on a desk showing the recorded subfloor and material moisture readings, the scope and the total, beside a signed contract.',
    'Pillar 6 — Commercial accountability: the readings and the price exist in writing, signed, before any deposit changes hands. The document shown is an illustrative example, not a client\'s estimate.',
    'A photorealistic desk scene: a printed multi-page fixed-price estimate lying flat, with a legible section headed moisture readings showing a subfloor value and a material value, a scope list beneath it, and a boxed total at the foot. A signed contract page overlaps it at an angle with a pen resting on the signature line. Callout plates mark the recorded readings, the fixed price, and the signature.',
  ),

  /* ── Failure modes and core glossary concepts ──────────────────────── */
  p(
    'failure-cupping',
    'Oak floorboards under raking light whose edges have risen higher than their centres, forming shallow troughs across the floor.',
    'Cupping — edges higher than the centre. It means moisture reached the floor from below, and it is the failure a subfloor reading is taken to prevent.',
    'Close raking-light photograph of finished oak floorboards deformed so that each board\'s two long edges sit higher than its centre, creating a repeating trough across the row. Low side lighting exaggerates the profile. A callout plate names the defect and a small end-section inset shows the curve direction.',
  ),
  p(
    'failure-crowning',
    'Oak floorboards under raking light whose centres have risen higher than their edges, forming shallow domes across the floor.',
    'Crowning — centre higher than the edges. The inverse of cupping, and usually what happens when a cupped floor is sanded flat before it has finished drying.',
    'Close raking-light photograph of finished oak floorboards deformed so that each board\'s centre sits higher than its two long edges, creating a repeating dome across the row. A callout plate names the defect and a small end-section inset shows the curve direction, opposite to cupping.',
  ),
  p(
    'failure-gapping',
    'Finished oak floorboards with even dark gaps opened between every board after a dry Toronto winter.',
    'Seasonal gapping — the floor contracting in dry indoor air. Even gaps that close again in summer are movement; uneven gaps that never close are a specification or moisture problem.',
    'Overhead photograph of a finished oak floor in winter light with a consistent narrow dark gap opened between every board. The gaps are even and repeating rather than random. A callout plate names the defect and notes that the gaps close again as indoor humidity rises.',
  ),
  p(
    'failure-buckling',
    'A hardwood floor lifted clear of its subfloor in a raised peak, boards tented against each other because there was nowhere left to expand.',
    'Buckling and tenting — a floor with no room to expand lifts off the substrate. It is the end state of a missing or filled expansion gap.',
    'Photograph of a finished oak floor in a room where a run of boards has lifted dramatically off the subfloor into a raised tent, boards pressed hard against each other at the peak while the floor on either side remains flat. At the far wall the boards are shown jammed tight against the baseboard with no gap. A callout plate names the defect and marks the absent expansion gap.',
  ),
  d(
    'concept-expansion-gap',
    'Detail cross-section at a wall showing the gap left between the last floorboard and the wall, concealed beneath the baseboard.',
    'The expansion gap — left at the wall, hidden by the baseboard, never filled.',
    'A close detail cross-section where a floor meets a wall. The last floorboard stops short of the wall leaving a clear open vertical channel. A baseboard sits against the wall and overhangs that channel from above without touching the floor, so the gap is covered but not blocked. Draw the open channel in the copper accent.',
  ),
  d(
    'concept-acclimation',
    'Flooring boards stacked with spacers between layers in a finished room, air circulating around them.',
    'Acclimation — the material equalising in the room it will live in.',
    'A neat cross-stacked pile of flooring boards in the middle of an empty finished interior, with thin spacer sticks separating each layer so air passes through the whole stack. Show the room with a window and a radiator lightly outlined so it reads as a conditioned living space rather than a warehouse.',
  ),
  p(
    'concept-mc-differential',
    'Two digital moisture meters side by side, one reading 8.2 percent on a subfloor and one reading 7.4 percent on a flooring board, with the difference between them marked.',
    'Moisture differential — the distance between what the material reads and what it is going onto. Both readings go in writing; the acceptable difference is the manufacturer\'s and ours. The values shown are a worked example.',
    'Two digital pin-type moisture meters photographed side by side on a work surface, the left one resting on a plywood subfloor offcut with its LCD reading 8.2% MC, the right one on an oak flooring board with its LCD reading 7.4% MC. A bracket callout spans the two displays and labels the difference between them.',
  ),
  p(
    'concept-edger-halo',
    'Circular swirl marks and a tonal halo in the finished floor along the baseboard, where the edger\'s work was never blended into the field.',
    'Swirl marks and the edger halo — what a skipped planetary pass looks like once the finish goes on. It is invisible on bare wood and permanent under coating.',
    'Close photograph of a finished oak floor at the junction with a white baseboard. A band roughly the width of a small machine runs along the wall, carrying visible circular swirl scratches and reading a different tone from the field beyond it, with a hard boundary between the two zones. A callout plate names the defect and marks the unblended boundary.',
  ),

  /* ── Paper heroes ──────────────────────────────────────────────────── */
  p(
    'paper-climate',
    'Chart of Toronto indoor relative humidity across the year — winter falling to 18 to 25 percent, summer rising above 60 percent, with the 35 to 55 percent band that hardwood is stable in marked across the middle.',
    'Climate mastery — Toronto\'s indoor air spends much of the year outside the band hardwood is stable in. Every moisture decision on this site exists because of this chart.',
    'A photorealistic data panel showing indoor relative humidity across a Toronto year as a curve running from a deep winter trough to a summer peak. A horizontal shaded band across the middle marks the range in which hardwood is dimensionally stable. Callout plates label the winter trough, the summer peak, and the stable band, and a small board cross-section beside the curve shows the floor\'s response at each extreme.',
  ),
  d(
    'paper-selection',
    'A branching decision path leading from a substrate to the correct product and installation method.',
    'The Intelligent Homeowner’s Decision Framework — the substrate decides.',
    'A clean branching diagram flowing left to right. One starting node on the left splits into two paths, and each of those splits again into two, ending in four terminal nodes on the right. Each node is a simple geometric shape — squares for substrates on the left, board cross-sections for products on the right. Connect them with clean orthogonal lines with rounded corners.',
    'illustration',
  ),
  p(
    'paper-craft',
    'Four sanding machines arranged left to right in working order with their grit progression marked — belt sander at 36 grit, edger, planetary sander, and buffer at 80 to 100 grit.',
    'The craft — four machines in sequence, each with its grit. The order is not a preference; each machine removes what the one before it could not reach.',
    'Four professional floor sanding machines photographed in a row left to right against a neutral studio background in their working order: belt sander, edger, planetary sander, buffer. Beneath each machine a callout plate names it and gives its grit stage, running 36 through 60 to 80 and 100 across the row.',
  ),

  /* ── Guides ────────────────────────────────────────────────────────── */
  p(
    'guide-solid-vs-engineered',
    'Decision tree branching from the substrate — plywood over joists allows solid, concrete slab or radiant heat requires engineered, and wide seasonal humidity swings favour engineered.',
    'Solid or engineered? The substrate and the climate decide, not the price list. Plywood over joists opens both doors; a slab, a condo or radiant heat closes one of them.',
    'A photorealistic decision tree laid over three small room vignettes. The root node asks what the subfloor is. One branch leads to plywood over joists and a house interior, ending at solid hardwood. A second branch leads to a concrete slab and a condo interior, ending at engineered. A third branch leads to radiant heating and ends at engineered. A fourth consideration node covers wide seasonal humidity swings and also ends at engineered. Each node carries a short label.',
  ),
  d(
    'guide-method',
    'Three fixing methods shown as three small cross-sections — fastened, bonded, and floating.',
    'Nail-down, glue-down or floating — matched to what is underneath.',
    'Three small square cross-section vignettes in a horizontal row. Left: a board with an angled fastener driven through its tongue into the sheet below. Centre: a board sitting on a ridged adhesive bed bonded to a solid slab. Right: a board resting on a thin continuous underlay sheet with a visible free space concept at the wall edge, not mechanically attached.',
  ),
  d(
    'guide-evaluate-quote',
    'A checklist of six items beside a written estimate, some checked and some not.',
    'How to evaluate a quote — six questions, any "no" is a red flag.',
    'A vertical list of six identical empty checkbox squares running down the left, each followed by a blank ruled line where text would go. Four boxes carry a clean check mark, two carry a cross. To the right, a single document sheet outline. Keep every line blank and abstract with no readable characters.',
    'illustration',
  ),
  d(
    'guide-ref-condo',
    'Cross-section of an engineered floor bonded to a concrete condominium slab with an acoustic layer.',
    'Condominium over slab — engineered, bonded, with the acoustic layer.',
    'A detailed vertical cutaway stack, drawn tall and centred, with clearly separated layers from bottom to top: a thick solid concrete slab, a thin acoustic mat, a ridged adhesive bed, and engineered floorboards showing their cross-banded core. At the left edge the stack meets a wall with a clear expansion channel and a baseboard overhanging it.',
  ),
  d(
    'guide-ref-radiant',
    'Cross-section of an engineered floor floating over a radiant heating assembly.',
    'Radiant main floor — engineered, floated, over the heating layer.',
    'A detailed vertical cutaway stack, drawn tall and centred: a base slab with evenly spaced circular heating tube sections embedded in it, a thin underlay sheet above, then engineered floorboards showing their cross-banded core resting loose on top. Draw gentle evenly spaced upward indications from the tubes through the stack to suggest heat rising, using short marks and no arrows with words.',
  ),
  d(
    'guide-ref-refinish',
    'A floor part-way through refinishing, half worn and half freshly cut, with the machine sequence implied.',
    'Refinishing — the sequence, from worn surface to final coat.',
    'A single floor surface seen at a low angle running from left to right across the frame, divided into four vertical bands that progress from left to right: heavily worn and scratched, coarsely cut, finely refined, and finally smooth and even. Keep the board lines continuous through all four bands so it reads as one floor at four stages.',
    'illustration',
  ),

  /* ── Social cards ──────────────────────────────────────────────────── */
  og(
    'og-framework',
    'The Well-Installed Framework — six pillars supporting a floor line.',
    'Six simple vertical columns of equal width standing in a row, supporting one continuous horizontal floor line above them. The columns are drawn in walnut brown, the floor line in copper and heavier than everything else.',
  ),
  og(
    'og-market',
    'Cost inputs — three lines moving independently beneath a floor.',
    'Three simple line-graph traces of different shapes running horizontally across the lower half of the frame, each at a different level and each moving independently. Above them, one clean horizontal floor-board line drawn heavier in copper. Keep the traces abstract with no axes, no gridlines and no values.',
  ),
  og(
    'og-glossary',
    'The glossary — a grid of small technical symbols.',
    'An evenly spaced grid of small simple technical symbols on a plain background: a board cross-section, a moisture dial, a cupped board profile, an expansion gap detail, a stack of acclimating boards, a fastener at an angle. Six to eight symbols total, all at the same scale and weight, arranged with generous even spacing.',
  ),
  og(
    'og-standards',
    'The standards register — stacked document references beside a floor detail.',
    'Three simple document sheet outlines stacked with a slight offset so all three edges are visible, positioned left of centre. Beside them at the same scale, one small floor cross-section detail. Keep all document surfaces blank with no ruled lines and no characters.',
  ),
  og(
    'og-data',
    'Data and figures — a simple bar series beside a range band.',
    'On the left, four horizontal bars of differing lengths stacked vertically with even spacing. On the right, one wider soft-filled horizontal band with two shorter solid bars positioned above and below it at different horizontal offsets. Entirely abstract, no axes, no gridlines, no values.',
  ),

  /* ── Detailed register: heroes and one added failure mode ────────── */
  p(
    'framework-hero',
    'Overview of the six pillars of the EcoWoods Well-Installed Framework, arranged around a cutaway floor assembly with the Toronto skyline behind it.',
    'The six pillars of the Well-Installed Framework. Each one is a question a correctly installed floor can answer, and the pillar names in the panels below are the authoritative wording.',
    'A wide hero composition with a cutaway hardwood floor assembly centred in the foreground showing boards, subfloor and joists, and the Toronto skyline across the water behind it. Six labelled medallion icons arranged three to a side, each naming one pillar of the framework and carrying a one-line summary beneath it.',
  ),
  p(
    'resources-hero',
    'Finished hardwood floor in a Toronto living room with the three technical overlays that govern it — moisture, expansion and machine sequence — drawn across the scene.',
    'The resources hub — the science that decides whether a floor lasts, gathered in one place.',
    'A wide hero composition of a bright Toronto living room with a finished oak floor, overlaid with three restrained technical graphics: a moisture reading on the subfloor, an expansion gap dimension at the wall, and a sanding machine sequence across the field. Each overlay carries a short label.',
  ),
  p(
    'failure-edge-peaking',
    'Floorboard edges raised above the board faces with the finish cracked and lifting along every seam.',
    'Edge peaking — the board edges rise and the finish splits along the seams. It follows moisture cycling, and unlike cupping it takes the coating with it.',
    'Close raking-light photograph of a finished oak floor where the long edges of each board have risen proud of the board face and the finish has cracked and lifted along the seams, with flakes visible at the edges. A callout plate names the defect and a small inset section shows the raised edge profile.',
  ),

  /* ── Service pages ─────────────────────────────────────────────────── */
  p(
    'service-installation',
    'A room mid-installation: boards going down over a prepared substrate, the next bundle staged, spacers holding the perimeter gap open at the wall.',
    'Installation in progress — the substrate is prepared and measured before the first board is fastened, and the perimeter gap is held open by spacers until the baseboard covers it.',
    'A photorealistic interior mid-installation. Oak boards being laid over a prepared plywood substrate, a staged bundle of flooring alongside, spacers visible holding an even gap at the wall. Work in progress rather than a finished showroom.',
  ),
  p(
    'service-refinishing',
    'One hardwood floor photographed half stripped to raw wood and half finished, with the boundary between the two states running through the frame.',
    'Refinishing — the same boards, both states. Everything to the left of the line is the floor that was already there; everything to the right is what it becomes without replacing a plank.',
    'A single oak floor photographed so that half is sanded to raw wood and half carries a finished coat, with a hard boundary running through the middle of the frame. Raking light so both surfaces read distinctly.',
  ),
  p(
    'service-dust-free',
    'A sander connected by hose to a sealed collector, with a zip-wall barrier at the doorway and furnished rooms visible beyond it.',
    'Dust containment is a system, not a vacuum: extraction at the tool, a sealed collector, and a barrier at the opening — which is what makes it possible to live in the house while the work happens.',
    'A room being sanded with a professional machine hosed to a sealed HEPA collector, a zip-wall dust barrier across the doorway, and a clean furnished room visible through it.',
  ),
  p(
    'service-restoration',
    'A damaged original hardwood floor with replacement boards woven into the surrounding grain so the repaired section is difficult to locate.',
    'Restoration rather than replacement — boards are woven into the existing run and the grain and colour are matched, so a repair reads as part of the original floor.',
    'A photorealistic close view of an older hardwood floor where several replacement boards have been woven into the existing run, grain and tone matched, the repair almost invisible.',
  ),
  p(
    'service-inlays',
    'A custom border detail photographed at an angle: a mitred corner in contrasting species with tight joinery visible at the seams.',
    'Inlays and borders are joinery, not decoration. The corner is where the work shows — a mitre that stays tight through a season of movement is the whole test.',
    'A photorealistic angled close-up of a hardwood floor border: contrasting species mitred at a corner, joints tight, grain direction deliberate.',
  ),
  p(
    'service-stairs',
    'A staircase mid-refinish with treads sanded to raw wood, risers masked, and the nosings cut sharp.',
    'Stairs are where hand work shows. Every tread is an edge, a nosing and a return, and none of it can be done by a machine that levels a floor.',
    'A photorealistic staircase mid-refinish: treads sanded to raw wood, risers masked off, sharp nosing profiles, hand tools resting on a tread.',
  ),

  /* ── Technical paper figures ─────────────────────────────────────────────────── */
  p(
    'fig-climate-rh-bands',
    'Indoor relative humidity across a Toronto year, with the winter low, the summer high and the band in which hardwood is dimensionally stable marked across the middle.',
    'Toronto indoor air spends much of the year outside the range hardwood is stable in: 18–25% RH in deep winter, above 60% in summer, against a safe operating band of 35–55%. Every moisture decision on this site follows from this chart.',
    'A photorealistic data panel: indoor relative humidity across a Toronto year as a curve from a winter trough to a summer peak, with a shaded band marking the stable range and callout plates on each.',
  ),
  p(
    'fig-moisture-testing-sequence',
    'The order moisture readings are taken — subfloor first, then the flooring material, then both written onto a record sheet.',
    'The order is the point: the subfloor is read first, the material second, and both go in writing before any deposit changes hands. The acceptable difference between them is the manufacturer\'s and ours.',
    'Two pin-type moisture meters photographed in sequence on a partly installed floor, one on the subfloor and one on a board, with a printed record sheet and pen alongside. Callout plates number the steps.',
  ),
  d(
    'fig-method-substrate-matrix',
    'Three floor assemblies cut open side by side, each pairing one substrate with the fastening method that is correct for it.',
    'The substrate decides the method. Nail-down is for solid over plywood; glue-down for engineered over concrete or in a condominium; floating for engineered over radiant heat, or where acoustic separation is required.',
    'Three orthographic cutaway assemblies side by side: solid boards cleated into plywood over joists, engineered boards bedded in ridged adhesive on a slab, and engineered boards floating on underlay above a slab with radiant tubing.',
  ),
  d(
    'fig-protocol-gates',
    'The installation protocol drawn as a row of gates, each one a point where work stops until a condition has been met.',
    'The protocol is a series of gates rather than a checklist — work does not proceed past one until its condition is met. Moisture testing is the first gate, and it sits before any deposit.',
    'A flat vector sequence of gate forms along a horizontal line, each gate closed until a condition is satisfied, with a droplet motif at the first gate to mark moisture testing.',
  ),
  d(
    'fig-failure-cascade',
    'One skipped moisture step on the left branching into the five named failure modes on the right — cupping, crowning, gapping, buckling and edge peaking.',
    'The five failure modes are not five separate risks. They are five outcomes of the same omission, and which one appears depends on where the moisture came from and when.',
    'A flat vector branching diagram: a single droplet node on the left, five branches to the right, each ending in a board cross-section showing one deformation — edges up, centre up, separated, tented, edges raised.',
  ),
  p(
    'fig-four-machines-roles',
    'The four floor machines in working order, each labelled with the part of the job it does.',
    'Four machines, in this order. The belt sander levels the open field, the edger reaches walls and closets, the planetary sander blends the two together, and the buffer prepares the surface and abrades between coats.',
    'Four professional floor machines photographed in a row in working order against a neutral background, each with a callout plate naming it and stating what it does.',
  ),
  p(
    'fig-grit-progression',
    'Three abrasive grades shown beside the three surfaces they leave, in working order from coarsest to finest.',
    'The belt sander\'s progression is 36 to 60 to 80/100, and the edger follows the same sequence rather than running ahead of it. Skipping a grade leaves scratches the next grade cannot remove.',
    'Three abrasive samples photographed in a row, coarse to fine, each above the wood surface it produces, with callout plates giving the grit number.',
  ),
  d(
    'fig-planetary-blend',
    'Overhead plan of a room showing the belt-sanded field, the edged perimeter band, and the planetary machine working the boundary between them.',
    'The planetary sander exists to erase a line. The belt machine leaves a field, the edger leaves a band, and without a pass that blends the two the boundary appears as a halo once the finish goes on.',
    'A flat vector overhead plan view of a rectangular room floor with a large central field, a narrower perimeter band in a second tone, and a round multi-disc machine straddling the boundary between them.',
  ),
  d(
    'fig-screening-between-coats',
    'Cross-section through a finish build showing light abrasion between coats rather than removal of them.',
    'Screening between coats is abrasion, not sanding. It gives the next coat something to key into; excessive pressure or dwell burnishes the surface or leaves swirl.',
    'A flat vector magnified cross-section of a finish build on wood: coat, a light abrasion pass shown as fine texture, then the next coat keying into it.',
  ),
  d(
    'fig-full-sequence-timeline',
    'The complete refinishing sequence drawn along one horizontal line, machine by machine and coat by coat.',
    'The whole job as one line: machines in order, then coats with abrasion between them. Nothing here is optional and nothing here can be reordered.',
    'A flat vector horizontal sequence of machine silhouettes followed by finish-coat marks with abrasion passes between them, all on a single timeline rule.',
  ),
  d(
    'fig-installed-cost-bands',
    'Five scopes of hardwood work drawn as bands on a single cost axis so their ranges can be compared directly.',
    'Five scopes on one axis. A screen and recoat and a full sand and finish are different jobs at different prices, and a quote that does not say which one it is for cannot be compared to anything.',
    'A flat vector chart with five horizontal bands of differing length on a shared axis, each band a stacked cross-section of a floor assembly rather than a plain bar.',
  ),
  p(
    'fig-species-janka',
    'Five hardwood species photographed side by side in order of Janka hardness, each labelled with its rating.',
    'White oak ≈1360, hard maple 1450, northern red oak ≈1290, hickory 1820, black walnut 1010. Janka is a useful number and a poor sole criterion — stability, grain character and finish performance matter equally.',
    'Five hardwood blocks photographed side by side on a neutral surface with real grain and pore structure visible, ordered by hardness, each with a callout plate naming the species and its Janka value.',
  ),

  /* ── Decision guides ─────────────────────────────────────────────────── */
  d(
    'guide-cost-toronto',
    'The inputs that move a hardwood quote — area, species, substrate, stairs and the condition of the existing floor — feeding into a single figure.',
    'A quote is not one number, it is five inputs. Area, species, substrate, stairs and the state of what is already there each move it, and a quote that names none of them is not a quote.',
    'A flat vector diagram of five weighted inputs converging on a single output node, each input drawn as a small motif — a room outline, a board, a substrate section, a stair, a worn floor.',
  ),
  d(
    'guide-choose-contractor',
    'Several quotes entering a filter of specific questions, with only the ones that survive continuing through.',
    'Choosing a contractor is a filter, not a comparison. The questions that matter are answerable in one sentence, and the quotes that cannot answer them are the ones the price was hiding.',
    'A flat vector funnel diagram: several document forms entering at the wide end, passing a series of question gates, fewer emerging at the narrow end.',
  ),
  p(
    'guide-white-oak',
    'White oak shown in three finishes side by side — natural, light stain and dark stain — with the same grain running through all three.',
    'The same board in three finishes. White oak takes stain evenly because of its closed grain, which is a large part of why it is the current default in the GTA — a market observation, not a performance claim.',
    'Three wide-plank white oak samples photographed side by side under identical light, one natural, one light stain, one dark stain, grain and pore structure clearly visible in each.',
  ),
  p(
    'guide-dustless',
    'An occupied house during sanding: a containment barrier sealing the work area, with a clean lived-in room on the other side of it.',
    'Dustless does not mean no dust. It means the dust is captured where it is made and stays behind a barrier, which is what makes it possible to sleep in the house while the floors are done.',
    'A photorealistic view through a sealed zip-wall barrier: sanding underway on one side, a clean furnished living space with toys or books on the other.',
  ),
  d(
    'guide-herringbone-parquet',
    'Herringbone, chevron and parquet drawn from directly above, side by side, so the difference in how the boards meet is unmistakable.',
    'Herringbone meets at a right angle with each board\'s end against its neighbour\'s side. Chevron is mitred so the boards meet point to point in a continuous V. Parquet is a repeating block. They are three different jobs to install.',
    'A flat vector overhead plan showing three floor patterns side by side at identical scale: herringbone, chevron and a square parquet block, drawn so the joint geometry of each is explicit.',
  ),

  /* ── Glossary terms ─────────────────────────────────────────────────── */
  d(
    'term-anisotropic',
    'A single board with three movement arrows of very different lengths, above twenty boards each moving slightly and summing across a floor.',
    'Wood does not move equally in all directions. Length change is minimal, width change is significant, and twenty boards each moving a fraction of a millimetre add up to a floor that has moved.',
    'A flat vector diagram: one board in elevation with three arrows of very different lengths along its length, width and thickness; below, a grid of twenty boards each with a small arrow, the sum implied.',
  ),
  d(
    'term-solid-hardwood',
    'A solid board cut open to show one continuous grain from face to underside, with the depth available for refinishing marked.',
    'One material all the way through. The advantage is a wear layer that supports many refinishing cycles; the constraint is that it moves as one piece with the moisture around it.',
    'A flat vector cutaway of a single solid hardwood board with continuous grain through its full thickness and a bracket marking the depth available above the tongue.',
  ),
  d(
    'term-engineered',
    'An engineered board cut open to show a real hardwood face over plies laid at ninety degrees to one another.',
    'The surface is real hardwood. The difference is underneath: layers oriented at ninety degrees to each other, so the movement of one is opposed by the next.',
    'A flat vector cutaway of an engineered board: a hardwood wear layer over four thinner plies, each ply\'s grain drawn rotated ninety degrees from the one above.',
  ),
  d(
    'term-cross-ply-core',
    'Cross-ply layers with opposing movement arrows that cancel each other out.',
    'Each layer\'s tendency to move across its own grain is resisted by the layer bonded to it at a right angle. That opposition is the whole mechanism of dimensional stability.',
    'A flat vector exploded view of a cross-ply core, each layer carrying a movement arrow perpendicular to the layer above and below, the opposing pairs visually cancelling.',
  ),
  d(
    'term-wear-layer',
    'A solid board and an engineered board side by side, each marked with the refinishing depth available above the point where it can no longer be sanded.',
    'On solid hardwood the wear layer is generational. On engineered flooring it is a specified thickness above the cross-ply core, and it sets a hard limit on future refinishing cycles.',
    'A flat vector comparison of two board cross-sections side by side, each with a bracket marking usable depth — deep on the solid board, limited above the core on the engineered one.',
  ),
  d(
    'term-nail-down',
    'Cleats driven at an angle through the tongue of a solid board into plywood sheathing over joists.',
    'The method for solid hardwood over plywood. It requires a substrate that accepts fasteners, which is why it has no application over concrete.',
    'A flat vector cutaway showing solid boards with cleats angled through the tongue into plywood sheathing carried on joists.',
  ),
  d(
    'term-glue-down',
    'An engineered board bedded into a ridged trowelled adhesive layer in full contact with a concrete slab.',
    'The method where fasteners cannot be used and full contact with the substrate is wanted. It is the standard for engineered flooring over a concrete slab.',
    'A flat vector cutaway showing an engineered board pressed into a ridged trowelled adhesive bed on a concrete slab, adhesive ridges drawn distinctly.',
  ),
  d(
    'term-floating',
    'A floor assembly resting on underlay with nothing fastening it to the substrate beneath.',
    'A floating floor is mechanically independent of what it sits on, which is what allows it to move with a thermal cycle rather than fight it.',
    'A flat vector cutaway of boards resting on a thin underlay above a slab, with a visible separation and no fasteners or adhesive anywhere in the assembly.',
  ),
  d(
    'term-subfloor',
    'Three substrates side by side — plywood over joists, a concrete slab, and a slab with radiant tubing — as the starting point every later decision follows from.',
    'The substrate is identified before anything else is decided. Method, product construction and moisture protocol all follow from it.',
    'A flat vector row of three substrate cross-sections at identical scale: plywood on joists, a plain concrete slab, and a slab with embedded radiant tubing.',
  ),
  d(
    'term-radiant-heat',
    'Radiant tubing embedded in a slab with a floating engineered floor above it and heat rising through the assembly.',
    'Radiant assemblies constrain both product and method: engineered construction for dimensional stability under thermal cycling, floated rather than nailed or glued.',
    'A flat vector cutaway of a slab with embedded radiant tubing, an underlay layer, and floating engineered boards above, with rising heat indicated as evenly spaced upward marks.',
  ),
  d(
    'term-janka',
    'Five species drawn as blocks of increasing height on a hardness scale, with a balance beneath indicating that hardness is only one of several criteria.',
    'Janka is a useful number and a poor sole criterion. Hardness is only one variable — stability, grain character and finish performance matter equally.',
    'A flat vector chart of five wood blocks of increasing height along a scale, with a small balance or scale motif beneath to indicate the trade-off against other criteria.',
  ),
  p(
    'term-white-oak',
    'Wide-plank European white oak photographed close, with grain and pore structure clearly visible.',
    'Wide-plank European white oak is the current aesthetic and resale sovereign in the GTA. That is a market observation, not a claim about performance.',
    'A macro photograph of wide-plank European white oak showing its closed grain and ray fleck under even neutral light.',
  ),
  p(
    'term-progressive-grits',
    'Three abrasive grades and the three surfaces they leave, shown in working order.',
    'The belt sander\'s standard progression is 36 to 60 to 80/100. The edger follows the same sequence rather than running ahead of it.',
    'Three abrasive samples with the surface each leaves shown directly beneath, in working order, with callout plates giving the grit numbers.',
  ),
  d(
    'term-intercoat-screening',
    'Light abrasion between two finish coats shown in magnified cross-section as texture rather than removal.',
    'Mandatory between coats on multi-coat water-based systems. Screening is light abrasion — excessive pressure or dwell burnishes the surface or leaves swirl.',
    'A flat vector magnified cross-section of a coat, a fine abrasion texture across its surface, and the next coat keying into that texture.',
  ),
  p(
    'term-planetary-sander',
    'A planetary sander with its multiple counter-rotating discs visible from beneath.',
    'The counter-rotating discs are why it blends rather than cuts a direction. It is the machine that erases the boundary between the belt-sanded field and the edged perimeter.',
    'A photorealistic planetary floor sander shown from a low angle with its multiple counter-rotating discs visible beneath the housing.',
  ),
  d(
    'term-hepa-containment',
    'Two houses drawn in section — one with sanding dust travelling through the whole building, one with it captured at the tool.',
    'Dust generated during sanding is respirable and travels through the whole building. Cleanup afterwards addresses what settled, not what was breathed.',
    'A flat vector comparison of two house sections side by side: in the first, fine particles distributed through every room; in the second, particles captured at the machine and contained behind a barrier.',
  ),

  /* ── Open Graph cards for the newer surfaces ───────────────────── */
  og(
    'og-about',
    'The Ecowoods monogram over a section through a hardwood floor assembly.',
    'A monogram-scale mark set over a simple cross-section of a hardwood floor assembly, subject left-of-centre.',
  ),
  og(
    'og-reviews',
    'Written customer reviews represented as stacked cards of text, with no stars and no ratings shown.',
    'Stacked card forms suggesting written reviews, subject left-of-centre, no stars and no numerals anywhere.',
  ),
  og(
    'og-press',
    'A printed document beside a logo lockup, suggesting material prepared for publication.',
    'A document sheet beside a simple logo lockup form, subject left-of-centre.',
  ),
  og(
    'og-services',
    'Six simple marks in a grid, one for each service the company offers.',
    'Six simple geometric marks arranged in a grid, subject left-of-centre.',
  ),
];

export const getImages = (): SiteImage[] => IMAGES;
export const getImage = (id: string): SiteImage | undefined => IMAGES.find((i) => i.id === id);
export const imagesByStatus = (s: ImageStatus) => IMAGES.filter((i) => i.status === s);
export const IMAGE_DIR = '/illustrations';
