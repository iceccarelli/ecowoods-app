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
};

const DIMS: Record<string, [number, number]> = {
  'concept-acclimation': [1728, 867],
  'concept-edger-halo': [1564, 883],
  'concept-expansion-gap': [1538, 681],
  'concept-mc-differential': [1463, 817],
  'failure-buckling': [1599, 644],
  'failure-crowning': [1636, 314],
  'failure-cupping': [1576, 247],
  'failure-gapping': [1676, 997],
  'guide-evaluate-quote': [1378, 719],
  'guide-method': [1586, 328],
  'guide-ref-condo': [1058, 1044],
  'guide-ref-radiant': [1320, 493],
  'guide-ref-refinish': [1622, 421],
  'guide-solid-vs-engineered': [1371, 683],
  'paper-climate': [1375, 852],
  'paper-craft': [1609, 534],
  'paper-selection': [1442, 705],
  'pillar-accountability': [895, 859],
  'pillar-containment': [1481, 894],
  'pillar-moisture': [1492, 856],
  'pillar-movement': [1514, 856],
  'pillar-specification': [1568, 632],
  'pillar-substrate': [1647, 359],
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
  d(
    'pillar-moisture',
    'Cross-section of a floor assembly with moisture meters reading both the subfloor and the flooring material, and stacked boards acclimating in the room where they will be installed.',
    'Pillar 1 — moisture is measured in both the subfloor and the material, before anything is fastened.',
    'A cutaway side elevation of a room floor. Below: a subfloor layer with a small probe inserted into it. Above and to the side: a neat stack of flooring boards resting in the same room, slightly raised on spacers with visible air gaps between the boards. Two simple round dial instruments, one touching the subfloor and one touching the stacked boards. Show the room outline lightly so it reads as an interior.',
  ),
  d(
    'pillar-substrate',
    'Three floor assemblies side by side — boards nailed into plywood over joists, boards bonded to a concrete slab, and boards floating over a radiant heating layer.',
    'Pillar 2 — the substrate decides the method, not the budget.',
    'Three vertical cutaway stacks side by side, evenly spaced, each showing a different floor assembly in orthographic cross-section. Left: floorboards with fasteners angled into a plywood sheet resting on joists. Centre: floorboards sitting on a bonded adhesive layer over a solid concrete slab, adhesive shown as a fine ridged trowel pattern. Right: floorboards resting loose over an underlay sheet above a slab with evenly spaced heating tubes running through it.',
  ),
  d(
    'pillar-specification',
    'Comparison of a solid hardwood board and an engineered board, the engineered one showing a hardwood wear layer over a cross-laminated core.',
    'Pillar 3 — construction, not appearance, decides what a house can support.',
    'Two thick board cross-sections shown side by side at an angle, cut open to reveal their internal structure. Left board: one single continuous grain running through the full thickness. Right board: a thin top layer of the same grain over three or four thinner plies beneath it, each ply drawn with its grain direction rotated ninety degrees from the one above and below it, so the alternating structure is obvious.',
  ),
  d(
    'pillar-movement',
    'Plan view of a room showing continuous expansion gaps at every wall and around a fixed column and a hearth in the middle of the floor.',
    'Pillar 4 — gaps at every wall and every fixed object, not only at the perimeter.',
    'A flat overhead plan view of a rectangular room floor filled with parallel floorboards. A clear even gap runs along all four walls. Inside the room, a circular column and a rectangular hearth interrupt the floor, and the same even gap runs continuously around both of them. The gaps are drawn as clean empty channels in the copper accent colour.',
  ),
  d(
    'pillar-containment',
    'The four sanding machines in working sequence — belt sander in the open field, edger at the perimeter, planetary sander blending the two, and a buffer for the final pass — with extraction hoses to a sealed collector.',
    'Pillar 5 — four machines, in order, with containment throughout.',
    'A flat overhead plan view of a room floor. Four simplified machine silhouettes shown from above, each in the zone it works: a large rectangular belt machine in the open middle of the room, a small round edger tucked tight against the wall, a wider multi-disc round machine straddling the boundary between the middle and the edge, and a round buffer on already-finished floor. A hose runs from each machine to one sealed drum at the room edge.',
  ),
  d(
    'pillar-accountability',
    'A written estimate document with the moisture readings and a fixed price recorded on it, alongside a signed contract.',
    'Pillar 6 — the readings and the price exist in writing before a deposit.',
    'Two overlapping document sheets shown flat at a slight angle. The upper sheet has a simple table structure drawn as ruled blank rows with a small dial-instrument icon beside two of them and a single boxed figure at the bottom right. The lower sheet shows a horizontal signature stroke near its base. Keep all rows empty and abstract with no readable characters.',
  ),

  /* ── Failure modes and core glossary concepts ──────────────────────── */
  d(
    'failure-cupping',
    'End-grain cross-section of floorboards whose edges have risen higher than their centres, forming shallow troughs across the floor.',
    'Cupping — edges higher than the centre, caused by moisture from below.',
    'End-on cross-section view of four floorboards laid side by side, seen from the end grain. Each board curves so its two outer edges sit noticeably higher than its middle, creating a repeating shallow trough shape across the row. Draw a faint moisture indication rising from beneath the boards as small evenly spaced upward marks with no text.',
  ),
  d(
    'failure-crowning',
    'End-grain cross-section of floorboards whose centres have risen higher than their edges, forming shallow domes.',
    'Crowning — centre higher than the edges, the inverse of cupping.',
    'End-on cross-section view of four floorboards laid side by side, seen from the end grain. Each board curves the opposite way from cupping: the middle of each board sits noticeably higher than its two outer edges, creating a repeating shallow dome shape across the row.',
  ),
  d(
    'failure-gapping',
    'Floorboards in plan view with even seasonal gaps opened between every board.',
    'Seasonal gapping — the floor contracting in dry indoor air.',
    'Overhead plan view of parallel floorboards running across the frame. Between every board there is a consistent narrow open gap of equal width, drawn cleanly in the copper accent so the rhythm of the gaps is the subject.',
  ),
  d(
    'failure-buckling',
    'Cross-section of a floor that has lifted away from the subfloor in a peak because it had nowhere to expand.',
    'Buckling — a floor with no room to expand lifts off the substrate.',
    'Side elevation cross-section of a floor running horizontally. At one point the boards lift dramatically away from the subfloor beneath them, forming a raised tent-like peak, while the boards on either side remain flat and in contact. At the far wall the floor is shown pressed hard against the skirting with no gap.',
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
  d(
    'concept-mc-differential',
    'Two moisture readings compared — one taken in the subfloor and one in the flooring material — shown as two dials side by side.',
    'Moisture differential — the gap between the material and what it is going onto.',
    'Two identical round dial instruments shown large and side by side, each with a needle pointing to a different position on an unmarked scale. Beneath the left dial, a small cross-section of a subfloor. Beneath the right dial, a small cross-section of a flooring board. A simple bracket spans between the two needle positions to indicate the difference. No numbers on the dials.',
  ),
  d(
    'concept-edger-halo',
    'Plan view of a room where the perimeter band sanded by the edger reads differently from the field sanded by the belt machine.',
    'The edger halo — what an unblended perimeter looks like once the finish goes on.',
    'Overhead plan view of a rectangular room floor. The large central field is one flat tone. A continuous band around the entire perimeter, roughly the width of a small machine, is a visibly different tone. The boundary between the two zones is a hard, obvious line all the way round.',
  ),

  /* ── Paper heroes ──────────────────────────────────────────────────── */
  d(
    'paper-climate',
    'A house in cross-section through the seasons, with indoor air drying in winter and humidifying in summer while the floor holds a stable band.',
    'Climate Mastery — why hardwood succeeds or fails in this city.',
    'A single house drawn in simple side-elevation cutaway, centred. Above the roofline, two contrasting weather indications on either side: on the left, angular crystalline forms suggesting cold dry air; on the right, soft rounded forms suggesting humid air. Inside the house, one clean horizontal floor line runs unbroken across the full width, drawn heavier than everything else so it reads as the stable element.',
    'illustration',
  ),
  d(
    'paper-selection',
    'A branching decision path leading from a substrate to the correct product and installation method.',
    'The Intelligent Homeowner’s Decision Framework — the substrate decides.',
    'A clean branching diagram flowing left to right. One starting node on the left splits into two paths, and each of those splits again into two, ending in four terminal nodes on the right. Each node is a simple geometric shape — squares for substrates on the left, board cross-sections for products on the right. Connect them with clean orthogonal lines with rounded corners.',
    'illustration',
  ),
  d(
    'paper-craft',
    'The four refinishing machines arranged in the order they run.',
    'The Craft — four machines, and the order they run in.',
    'Four simplified machine silhouettes in a single horizontal row, evenly spaced, each drawn from a three-quarter side view in flat vector: a large upright belt sander with a long handle, a compact low round edger, a wide round multi-disc machine, and a round buffer with a handle. Draw them at consistent scale relative to each other. A single continuous horizontal baseline runs beneath all four.',
    'illustration',
  ),

  /* ── Guides ────────────────────────────────────────────────────────── */
  d(
    'guide-solid-vs-engineered',
    'A solid board and an engineered board shown end to end for comparison.',
    'Solid or engineered — the construction difference, at the end grain.',
    'Two board ends shown large, side by side and slightly separated, cut to reveal internal structure. Left: continuous single-piece grain through the full thickness. Right: a thin decorative top layer over several thinner cross-banded plies with alternating grain direction. Draw both at identical overall thickness so the internal difference is the only variable.',
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
];

export const getImages = (): SiteImage[] => IMAGES;
export const getImage = (id: string): SiteImage | undefined => IMAGES.find((i) => i.id === id);
export const imagesByStatus = (s: ImageStatus) => IMAGES.filter((i) => i.status === s);
export const IMAGE_DIR = '/illustrations';
