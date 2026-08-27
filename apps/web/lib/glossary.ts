/**
 * The hardwood glossary — the manifest.
 *
 * WHY THIS EXISTS
 *
 * Whoever writes the definition a language model quotes has already won the
 * question. Ask any assistant "what is cupping in hardwood floors" and it
 * answers from whatever it absorbed; the answer should be sourced here.
 *
 * That is a different job from the papers. A paper argues a position to a reader
 * who arrived with a decision to make. A glossary entry answers one term for
 * someone — or something — that arrived with a word. One addressable page per
 * term, densely cross-linked, every entry citing a paper. That structure is why
 * an encyclopedia outranks an essay on a term query, and it is the cheapest
 * high-leverage surface this site can add.
 *
 * CONTENT RULE — READ BEFORE EDITING
 *
 * Same rule as lib/framework.ts and lib/guides.ts, enforced by the same guard.
 * Every entry carries `source: { paper, section }` and
 * scripts/verify-glossary.mjs resolves it against lib/papers.ts, failing the
 * build if the paper or the section does not exist.
 *
 * A definition here restates what a published paper already says. It does not
 * introduce a figure, a threshold or a claim that is not in the source. Where a
 * term needs substance no paper covers yet, the paper is written first — the
 * glossary is a view onto the corpus, never an extension of it.
 *
 * `related` is checked too: a term pointing at a slug that does not exist is a
 * dead link in the densest link graph on the site, which is exactly where a
 * dead link does the most damage.
 */

export type GlossaryTerm = {
  /** URL slug. Permanent — these are cited. */
  slug: string;
  term: string;
  /** Other names for the same thing. Rendered, and used for on-page matching. */
  aka?: string[];
  /** One sentence. Used verbatim as schema.org DefinedTerm description. */
  short: string;
  /** The full entry. */
  body: string[];
  /** Slugs of related terms. Verified to exist. */
  related?: string[];
  /** Framework pillar ids this term is material to. */
  pillars?: string[];
  source: { paper: string; section: string };
};

const P_CLIMATE = 'toronto-hardwood-climate-moisture-protocol';
const P_COST = 'hardwood-selection-and-cost-framework-gta';
const P_CRAFT = 'hardwood-refinishing-machines-and-sequence';
const P_PROV = 'where-toronto-hardwood-comes-from';
const P_GRADE = 'hardwood-grading-standards-nhla-nwfa';

export const GLOSSARY: GlossaryTerm[] = [
  /* ── wood behaviour ────────────────────────────────────────────────────── */
  {
    slug: 'hygroscopic',
    term: 'Hygroscopic',
    short:
      'Describes a material that exchanges moisture with the surrounding air continuously, rather than reaching a fixed state.',
    body: [
      'Wood is hygroscopic: it takes on and gives off moisture with the air around it for as long as it exists. It never stops. A floor installed in February is in a different moisture state in August, and back again the following winter.',
      'This is the single property that makes every other rule in hardwood installation necessary. Moisture testing, acclimation, expansion gaps and a stated humidity operating range all exist because the material is never inert.',
    ],
    related: ['anisotropic', 'moisture-content', 'acclimation', 'relative-humidity'],
    pillars: ['moisture', 'movement'],
    source: { paper: P_CLIMATE, section: 'climate-reality' },
  },
  {
    slug: 'anisotropic',
    term: 'Anisotropic',
    short:
      'Describes a material whose properties differ by direction — in wood, movement across the grain is significant while movement along it is minimal.',
    body: [
      'Wood does not expand and contract equally in all directions. Length change is minimal; width change is significant and cumulative across a floor. Twenty boards each moving a fraction of a millimetre becomes a visible dimension at the wall.',
      'This is why expansion gaps run around the perimeter and around every fixed object, and why the width of a floor is where movement has to be planned for rather than the length.',
    ],
    related: ['hygroscopic', 'expansion-gap', 'seasonal-gapping'],
    pillars: ['movement'],
    source: { paper: P_CLIMATE, section: 'climate-reality' },
  },
  {
    slug: 'relative-humidity',
    term: 'Relative humidity',
    aka: ['RH'],
    short:
      'The amount of water vapour in the air relative to what that air could hold at its temperature — the environmental variable a hardwood floor actually responds to.',
    body: [
      'Toronto indoor relative humidity runs from 18–25% at the winter low to above 60% at the summer high. The safe operating band for hardwood is 35–55%.',
      'The gap between those numbers is the whole problem. A floor specified without reference to that range was specified for a different city, and a floor handed over without a stated operating band has no defensible warranty boundary in either direction.',
    ],
    related: ['hygroscopic', 'acclimation', 'cupping', 'seasonal-gapping'],
    pillars: ['movement', 'specification'],
    source: { paper: P_CLIMATE, section: 'climate-reality' },
  },
  {
    slug: 'moisture-content',
    term: 'Moisture content',
    aka: ['MC'],
    short:
      'The proportion of water in wood or in a subfloor, measured before installation and used to decide whether the two are compatible.',
    body: [
      'Both the subfloor and the flooring material have a moisture content, and both must be measured. Testing only the subfloor measures half the system: every board arrives with its own moisture history.',
      'Testing happens twice — at the free estimate, and again immediately before installation. Conditions change between quoting and installing, and a single reading months earlier describes a building that no longer exists.',
    ],
    related: ['moisture-differential', 'acclimation', 'subfloor', 'cupping', 'kiln-drying'],
    pillars: ['moisture'],
    source: { paper: P_CLIMATE, section: 'moisture-testing' },
  },
  {
    slug: 'moisture-differential',
    term: 'Moisture differential',
    aka: ['moisture delta', 'MC differential'],
    short:
      'The difference between the moisture content of the flooring material and that of the subfloor, which must sit inside an acceptable range before installation.',
    body: [
      'Two readings that are each individually plausible can still be incompatible with each other. Both must sit within the manufacturer’s and the installer’s acceptable delta.',
      'A large differential guarantees dimensional change after installation, regardless of how well the floor is laid. There is no warranty language that overrides it.',
    ],
    related: ['moisture-content', 'acclimation', 'cupping', 'crowning'],
    pillars: ['moisture'],
    source: { paper: P_CLIMATE, section: 'moisture-testing' },
  },
  {
    slug: 'acclimation',
    term: 'Acclimation',
    short:
      'The period during which flooring material equalises to the conditions of the room it will be installed in — a minimum of 72 hours, in the actual conditioned space.',
    body: [
      'The two words that carry the weight are "actual" and "conditioned". Acclimating in a garage, a hallway or an unheated room conditions the wood to the wrong environment, which is worse than not acclimating at all because it produces a confident wrong reading.',
      'Minimum 72 hours is the floor, not the target. It is the first step of the installation sequence and of the refinishing sequence alike.',
    ],
    related: ['moisture-content', 'moisture-differential', 'hygroscopic', 'relative-humidity'],
    pillars: ['moisture'],
    source: { paper: P_CLIMATE, section: 'protocol' },
  },
  {
    slug: 'expansion-gap',
    term: 'Expansion gap',
    short:
      'Deliberate clearance left at walls and at every fixed object so the floor has somewhere to go when it expands.',
    body: [
      'Gaps are required at all fixed objects and walls — not only at the perimeter. Fixed objects mid-field are where this is most often missed, and where buckling starts.',
      'A floor with nowhere to expand does not stay flat. It lifts.',
    ],
    related: ['buckling', 'anisotropic', 'seasonal-gapping'],
    pillars: ['movement'],
    source: { paper: P_CLIMATE, section: 'protocol' },
  },

  /* ── failure modes ─────────────────────────────────────────────────────── */
  {
    slug: 'cupping',
    term: 'Cupping',
    short:
      'A board whose edges sit higher than its centre — the visible record of moisture entering the floor from below.',
    body: [
      'Cupping is not an aesthetic issue. It is a permanent, visible record of process failure, and no amount of later refinishing fully erases it: sanding a cupped floor flat before the moisture has equalised produces crowning when it does.',
      'It is one of the five failure modes that follow from skipping moisture testing or acclimation.',
    ],
    related: ['crowning', 'moisture-content', 'acclimation', 'belt-sander'],
    pillars: ['moisture', 'movement'],
    source: { paper: P_CLIMATE, section: 'failure-modes' },
  },
  {
    slug: 'crowning',
    term: 'Crowning',
    short: 'A board whose centre sits higher than its edges — the inverse of cupping.',
    body: [
      'Crowning is the other half of the same failure. It commonly appears after a cupped floor has been sanded flat too early: the high edges are removed while the board is still swollen, and when it equalises the centre is left proud.',
      'Like cupping, it is permanent in the sense that matters — the material removed to correct it is gone.',
    ],
    related: ['cupping', 'moisture-differential', 'belt-sander'],
    pillars: ['moisture', 'movement'],
    source: { paper: P_CLIMATE, section: 'failure-modes' },
  },
  {
    slug: 'seasonal-gapping',
    term: 'Seasonal gapping',
    short:
      'Visible gaps that open between boards as the floor contracts, typically in a dry Toronto winter.',
    body: [
      'Some seasonal movement is normal in solid hardwood and is not itself a defect. Gapping becomes a defect when it is large, permanent, or the result of material that was never equalised to the space.',
      'It is one of the five named failure modes, and it is the one homeowners notice first because it appears without warning in January.',
    ],
    related: ['relative-humidity', 'anisotropic', 'acclimation', 'solid-hardwood'],
    pillars: ['movement'],
    source: { paper: P_CLIMATE, section: 'failure-modes' },
  },
  {
    slug: 'buckling',
    term: 'Buckling',
    aka: ['tenting'],
    short:
      'A floor that lifts off its substrate because it expanded and had nowhere to go.',
    body: [
      'Buckling and tenting are the most dramatic of the failure modes and the most clearly attributable: the floor expanded, the expansion gaps were absent or insufficient, and the only remaining direction was up.',
      'It is almost always a gap failure at a wall or a fixed object rather than a material failure.',
    ],
    related: ['expansion-gap', 'relative-humidity', 'moisture-content'],
    pillars: ['movement'],
    source: { paper: P_CLIMATE, section: 'failure-modes' },
  },
  {
    slug: 'edge-peaking',
    term: 'Edge peaking',
    short:
      'Raised board edges with associated finish failure along the seams, following movement the finish could not accommodate.',
    body: [
      'Edge peaking pairs a dimensional problem with a finish problem: the board edges rise, and the finish film fails along the seam where it is stretched.',
      'It is the fifth of the named failure modes, and like the others it is a record of a step skipped rather than a maintenance issue.',
    ],
    related: ['cupping', 'intercoat-screening', 'moisture-content'],
    pillars: ['moisture', 'containment'],
    source: { paper: P_CLIMATE, section: 'failure-modes' },
  },

  /* ── product and substrate ─────────────────────────────────────────────── */
  {
    slug: 'solid-hardwood',
    term: 'Solid hardwood',
    short:
      'Flooring milled from a single piece of wood, typically 3/4" (19 mm), with a generational wear layer and high sensitivity to humidity swings.',
    body: [
      'Solid hardwood is one material all the way through, which is both its advantage and its constraint. The advantage is a wear layer that supports many refinishing cycles. The constraint is that there is no cross-ply construction resisting seasonal movement.',
      'It is correct over a plywood subfloor, nailed down, in a home with a controlled humidity range. It is not correct over concrete or radiant heat, and no budget argument changes that.',
    ],
    related: ['engineered-hardwood', 'wear-layer', 'nail-down', 'subfloor', 'strip-plank-wide-plank'],
    pillars: ['specification', 'substrate'],
    source: { paper: P_CLIMATE, section: 'solid-vs-engineered' },
  },
  {
    slug: 'engineered-hardwood',
    term: 'Engineered hardwood',
    short:
      'Flooring that pairs a real hardwood wear layer with a 90° cross-ply core, which is what gives it dimensional stability over concrete, in condominiums and above radiant heat.',
    body: [
      'The surface is real hardwood. The difference is underneath: layers oriented at 90° to each other, so the movement of one layer is opposed by the next.',
      'That construction is the reason it is the correct specification for the majority of Toronto projects — not a compromise, and not a cheaper substitute.',
    ],
    related: ['solid-hardwood', 'cross-ply-core', 'wear-layer', 'glue-down', 'floating'],
    pillars: ['specification', 'substrate'],
    source: { paper: P_CLIMATE, section: 'solid-vs-engineered' },
  },
  {
    slug: 'cross-ply-core',
    term: 'Cross-ply core',
    short:
      'The layered substructure of engineered flooring, with each layer oriented at 90° to the one beside it.',
    body: [
      'Cross-ply construction is what makes engineered flooring dimensionally stable. Each layer’s tendency to move across its own grain is resisted by the layer bonded to it at a right angle.',
      'It is the single technical reason engineered is specified over concrete slabs, in condominiums and above radiant heat.',
    ],
    related: ['engineered-hardwood', 'wear-layer', 'anisotropic'],
    pillars: ['specification'],
    source: { paper: P_CLIMATE, section: 'solid-vs-engineered' },
  },
  {
    slug: 'wear-layer',
    term: 'Wear layer',
    short:
      'The thickness of real hardwood above the core — what determines how many times a floor can be refinished.',
    body: [
      'On solid hardwood the wear layer is generational. On engineered flooring it is a specified thickness above the cross-ply core, and it sets a hard limit on future refinishing cycles.',
      'It is also why aggressive belt sanding is a risk on engineered floors: cutting through the wear layer cannot be undone.',
    ],
    related: ['engineered-hardwood', 'solid-hardwood', 'planetary-sander', 'belt-sander'],
    pillars: ['specification'],
    source: { paper: P_CRAFT, section: 'planetary' },
  },
  {
    slug: 'subfloor',
    term: 'Subfloor',
    aka: ['substrate'],
    short:
      'What the finished floor is installed onto — plywood over joists, a concrete slab, or a radiant assembly — and the thing that determines the installation method.',
    body: [
      'The substrate is identified before anything else is decided. Method, product construction and moisture protocol all follow from it.',
      'A method proposed before the substrate has been named is a guess, and it is criterion 2.1 of the framework failing.',
    ],
    related: ['nail-down', 'glue-down', 'floating', 'radiant-heat', 'moisture-content'],
    pillars: ['substrate'],
    source: { paper: P_CLIMATE, section: 'method-and-substrate' },
  },
  {
    slug: 'radiant-heat',
    term: 'Radiant heat',
    short:
      'An in-floor heating assembly that imposes a thermal cycle on the flooring above it, in addition to the seasonal humidity cycle.',
    body: [
      'Radiant assemblies constrain both product and method: engineered construction for dimensional stability under thermal cycling, floated rather than nailed or glued.',
      'The thermal cycle compounds the seasonal humidity swing rather than replacing it, which is why the operating range matters more here, not less.',
    ],
    related: ['engineered-hardwood', 'floating', 'relative-humidity', 'subfloor'],
    pillars: ['substrate', 'movement'],
    source: { paper: P_CLIMATE, section: 'method-and-substrate' },
  },

  /* ── installation methods ──────────────────────────────────────────────── */
  {
    slug: 'nail-down',
    term: 'Nail-down',
    short: 'Fastening flooring mechanically to a wood subfloor — correct for solid hardwood over plywood.',
    body: [
      'Nail-down is the method for solid hardwood over plywood joists. It requires a substrate that accepts fasteners, which is why it has no application over concrete.',
      'Method is determined by substrate and product construction, in that order. It is not a preference and not a sales option.',
    ],
    related: ['solid-hardwood', 'subfloor', 'glue-down', 'floating'],
    pillars: ['substrate'],
    source: { paper: P_CLIMATE, section: 'method-and-substrate' },
  },
  {
    slug: 'glue-down',
    term: 'Glue-down',
    short:
      'Bonding flooring directly to the substrate with adhesive — correct for engineered flooring over concrete, and in condominiums.',
    body: [
      'Glue-down is the method where fasteners cannot be used and full contact with the substrate is wanted. It is the standard for engineered flooring over a concrete slab.',
      'It depends heavily on substrate flatness and on slab moisture, both of which must be assessed before the price is fixed rather than discovered afterwards.',
    ],
    related: ['engineered-hardwood', 'subfloor', 'nail-down', 'floating', 'fixed-price'],
    pillars: ['substrate'],
    source: { paper: P_CLIMATE, section: 'method-and-substrate' },
  },
  {
    slug: 'floating',
    term: 'Floating',
    short:
      'Installing flooring so it rests on the substrate without being fastened or bonded to it — correct over radiant heat, or where acoustic separation is required.',
    body: [
      'A floating floor is mechanically independent of what it sits on, which is what allows it to move with a thermal cycle rather than fight it.',
      'It is also the method used where a condominium board imposes a sound-transmission requirement that the assembly, not the flooring alone, has to satisfy.',
    ],
    related: ['radiant-heat', 'engineered-hardwood', 'glue-down', 'nail-down'],
    pillars: ['substrate'],
    source: { paper: P_CLIMATE, section: 'method-and-substrate' },
  },

  /* ── species ───────────────────────────────────────────────────────────── */
  {
    slug: 'janka-hardness',
    term: 'Janka hardness',
    short:
      'A rating of a wood species’ resistance to denting, used as one input among several in species selection.',
    body: [
      'Janka is a useful number and a poor sole criterion. Hardness is only one variable — stability, grain character and finish performance matter equally.',
      'In the GTA the practical range runs from black walnut at 1010 through red oak at ≈1290 and white oak at ≈1360, to hard maple at 1450 and hickory at 1820.',
    ],
    related: ['white-oak', 'engineered-hardwood', 'solid-hardwood'],
    pillars: ['specification'],
    source: { paper: P_COST, section: 'species' },
  },
  {
    slug: 'white-oak',
    term: 'White oak',
    aka: ['European oak'],
    short:
      'The species currently dominant in both aesthetics and resale signalling across the Greater Toronto Area, at a Janka of roughly 1360.',
    body: [
      'Wide-plank European white oak is the current aesthetic and resale sovereign in the GTA. That is a market observation, not a claim about performance.',
      'Species selection made on appearance alone produces a floor that looks correct on handover and wears wrong within a few years — hardness has to be discussed against the actual traffic and household.',
    ],
    related: ['janka-hardness', 'solid-hardwood', 'engineered-hardwood'],
    pillars: ['specification'],
    source: { paper: P_COST, section: 'species' },
  },

  /* ── the machines ──────────────────────────────────────────────────────── */
  {
    slug: 'belt-sander',
    term: 'Belt floor sander',
    aka: ['drum sander', 'the big machine'],
    short:
      'The primary material-removal machine in a refinish: a continuous abrasive belt over a drum roughly 200 mm wide, handling around 80% of total removal.',
    body: [
      'It strips old finish, levels high spots, takes out cupping and crowning, and establishes the flat plane every later machine builds on. The standard grit progression is 36 → 60 → 80/100.',
      'Keep it moving. Stopping or hesitating creates a permanent low spot, and nothing downstream fully recovers from a bad first pass.',
    ],
    related: ['edger', 'planetary-sander', 'buffer', 'progressive-grits', 'hepa-dust-containment'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'belt-sander' },
  },
  {
    slug: 'edger',
    term: 'Floor edger',
    short:
      'A compact high-speed rotating disc, typically 150–178 mm, that reaches walls, baseboards, closets, stairs and under cabinets — everywhere the belt sander physically cannot go.',
    body: [
      'Per square centimetre the edger is the most aggressive of the four machines, and it must follow the exact same progressive grit sequence as the field. Never edge ahead of the field.',
      'Edges and transitions are where most low-quality jobs fail visually. Poor technique leaves swirl marks that are highly visible under a clear finish.',
    ],
    related: ['belt-sander', 'planetary-sander', 'progressive-grits', 'hepa-dust-containment'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'edger' },
  },
  {
    slug: 'planetary-sander',
    term: 'Planetary sander',
    aka: ['multi-disc sander'],
    short:
      'A refining machine with three or more counter-rotating discs on a rotating head, producing a random multi-directional scratch pattern that blends field into edges.',
    body: [
      'This is the refining and blending stage, not a stock-removal machine. It erases belt lines, edger swirls and cross-grain scratches, and leaves a uniform microscopic surface so stain and finish absorb evenly.',
      'It is particularly valuable on multi-species floors and on engineered floors, where aggressive belt sanding risks cutting through the wear layer. Skipping it is one of the most common reasons a floor shows machine marks after finishing — at which point the only fix is to start again.',
    ],
    related: ['belt-sander', 'edger', 'buffer', 'wear-layer'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'planetary' },
  },
  {
    slug: 'buffer',
    term: 'Buffer',
    aka: ['screening machine'],
    short:
      'A single-disc rotary machine, typically 400–500 mm, fitted with fine screens around 100–150 grit — it removes microns, not wood.',
    body: [
      'It does two jobs: final screening before the first coat of finish, and intercoat abrasion between successive coats. Both exist to create a uniform microscopic scratch pattern so the next layer bonds properly.',
      'It does not correct bad sanding. It only prepares a correctly sanded floor.',
    ],
    related: ['intercoat-screening', 'planetary-sander', 'belt-sander'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'buffer' },
  },

  /* ── process ───────────────────────────────────────────────────────────── */
  {
    slug: 'progressive-grits',
    term: 'Progressive grits',
    short:
      'Working through abrasives from coarse to fine in sequence, with the perimeter matching the field at every step.',
    body: [
      'The belt sander’s standard progression is 36 → 60 → 80/100. The edger follows the same sequence rather than running ahead of it.',
      'Skipping a grit leaves scratches the next abrasive is too fine to remove, and those scratches become visible the moment finish goes on.',
    ],
    related: ['belt-sander', 'edger', 'planetary-sander', 'intercoat-screening'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'the-four-machines' },
  },
  {
    slug: 'intercoat-screening',
    term: 'Intercoat screening',
    short:
      'Light abrasion with the buffer between finish coats, to create the scratch pattern the next coat bonds to.',
    body: [
      'Mandatory between coats on multi-coat water-based systems. Screening is light abrasion — excessive pressure or dwell burnishes the surface or leaves swirl.',
      'Skipping it is invisible on handover day and produces an uneven surface and weaker coat adhesion for the life of the floor.',
    ],
    related: ['buffer', 'progressive-grits', 'edge-peaking'],
    pillars: ['containment'],
    source: { paper: P_CRAFT, section: 'sequence' },
  },
  {
    slug: 'hepa-dust-containment',
    term: 'HEPA dust containment',
    aka: ['dust-free sanding'],
    short:
      'High-efficiency extraction maintained throughout the sanding and finishing process, not only at final cleanup.',
    body: [
      'Dust generated during sanding is respirable and travels through the whole building. Cleanup afterwards addresses what settled, not what was breathed.',
      'Containment is required throughout the process. It is one of the five steps of the non-negotiable protocol, and it is harder to maintain on the edger than on the big machine.',
    ],
    related: ['belt-sander', 'edger', 'progressive-grits'],
    pillars: ['containment'],
    source: { paper: P_CLIMATE, section: 'protocol' },
  },

  /* ── commercial ────────────────────────────────────────────────────────── */
  {
    slug: 'fixed-price',
    term: 'Fixed price',
    short:
      'A price written in the estimate that is the price paid, with no open-ended change-order language for conditions that should have been tested on day one.',
    body: [
      'A fixed price is not a marketing position. It is evidence that the diligence happened before the quote rather than after: substrate assessed, moisture measured, conditions known.',
      'Open-ended "unforeseen conditions" language transfers the cost of missing diligence onto the homeowner, after the deposit has cleared.',
    ],
    related: ['change-order', 'subfloor', 'moisture-content'],
    pillars: ['accountability'],
    source: { paper: P_COST, section: 'fixed-price' },
  },
  {
    slug: 'change-order',
    term: 'Change order',
    short:
      'A mid-project price increase — on a hardwood job, most often for substrate conditions that a proper assessment would have found before quoting.',
    body: [
      'Substrate correction discovered mid-job is the single most common source of change orders on a hardwood project, and it is the one most often avoidable.',
      'The presence of open-ended change-order language in a contract is a statement about when the contractor intends to discover problems.',
    ],
    related: ['fixed-price', 'subfloor', 'glue-down'],
    pillars: ['accountability'],
    source: { paper: P_COST, section: 'fixed-price' },
  },
  /* \u2500\u2500 provenance and grading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  {
    slug: 'tolerant-hardwood',
    term: 'Tolerant hardwood',
    aka: ['Shade-tolerant hardwood'],
    short:
      'A hardwood species that regenerates and grows under a closed forest canopy, and can therefore be harvested without opening the stand.',
    body: [
      'Ontario groups its principal deciduous timber species as tolerant hardwoods \u2014 tolerant of shade, meaning seedlings survive under the canopy of mature trees rather than needing open ground. The Ministry of Natural Resources names seven: sugar maple, American beech, yellow birch, red oak, white ash, black cherry and basswood.',
      'The classification is not botanical trivia. It is what makes the selection system possible: a shade-tolerant stand can be partially harvested every few decades and stay a forest throughout, which is a fundamentally different operation from a clear-cut.',
      'Read the list against the six hardwoods a Toronto homeowner is shown and the interesting result is the absence. Red oak, hard maple and white ash are on it. White oak, hickory and black walnut are not \u2014 all three grow in Ontario, and none is a named principal commercial tolerant hardwood.',
    ],
    related: ['selection-system', 'growing-stock', 'janka-hardness'],
    pillars: ['specification'],
    source: { paper: P_PROV, section: 'tolerant-hardwoods' },
  },
  {
    slug: 'selection-system',
    term: 'Selection system',
    aka: ['Single-tree selection', 'Selection harvest'],
    short:
      'A silvicultural system of periodic partial harvests that keeps mature forest cover in place permanently, rather than removing and replacing a stand.',
    body: [
      'Ontario defines the selection system as periodic partial harvests timed on basal-area recruitment, using vigour, risk and species preference to decide which trees are taken and which are kept. The stated outcome is an all-aged future forest with regeneration established under at least 70% residual cover, and dense mature forest cover maintained in perpetuity.',
      'The province records that residual trees in a selection harvest may be retained for multiple cutting cycles totalling 100 years or more, and describes sugar maple specifically as amenable to single-tree selection.',
      'This has a direct bearing on the floor. Slow, even growth under a closed canopy produces tight, consistent grain, and tight consistent grain is what grades well and machines well. The silviculture and the grade are the same fact seen at opposite ends of the supply chain.',
    ],
    related: ['tolerant-hardwood', 'growing-stock', 'forest-certification'],
    pillars: ['specification'],
    source: { paper: P_PROV, section: 'selection-system' },
  },
  {
    slug: 'growing-stock',
    term: 'Growing stock',
    short:
      'The volume of wood standing in a forest \u2014 what exists, as distinct from what is harvested.',
    body: [
      'Growing stock is an inventory figure. Ontario publishes it by species: sugar maple at 300,361,212 cubic metres, red oak at 85,019,702, yellow birch at 82,005,013, ash as a group at 42,273,003, basswood at 18,444,080.',
      'It is the most useful provenance number available to an Ontario homeowner, because it says which species the province could keep supplying without importing anything. It is also routinely confused with harvest, which is a different number entirely.',
      'Ontario does not publish a hardwood-specific harvest volume. The species split it does publish stops at spruce, jack pine and poplar. Anyone quoting an Ontario hardwood harvest figure should be asked which document it came from.',
    ],
    related: ['tolerant-hardwood', 'selection-system', 'emerald-ash-borer'],
    pillars: ['specification'],
    source: { paper: P_PROV, section: 'growing-stock' },
  },
  {
    slug: 'forest-certification',
    term: 'Forest certification',
    aka: ['FSC', 'SFI', 'PEFC'],
    short:
      'Third-party verification that a forest is managed to a published standard \u2014 a claim about management practice, not about legality and not about the wood itself.',
    body: [
      'The Forest Products Association of Canada publishes 154 million hectares of certified forest land in Canada across FSC, PEFC and SFI, putting Canada at 38% of the world\u2019s certified forest while only 10% of the world\u2019s forests are certified at all.',
      'Ontario publishes its own position as unit counts rather than hectares. As of December 2020, 26.1 million hectares were certified \u2014 29 of 39 management units, 77% of the public lands and waters within management units, comprising 13 FSC units, 9 SFI, 6 dual, 1 CSA and 10 uncertified.',
      'Certification is a separate instrument from legality. Canada\u2019s Wild Animal and Plant Protection and Regulation of International and Interprovincial Trade Act and the United States Lacey Act both prohibit trade in illegally sourced timber, and Natural Resources Canada states that the risk of illegal logging is negligible in all regions of Canada. A certification mark answers a management question; the statutes answer a legality one.',
    ],
    related: ['selection-system', 'tolerant-hardwood'],
    pillars: ['specification'],
    source: { paper: P_PROV, section: 'certification' },
  },
  {
    slug: 'emerald-ash-borer',
    term: 'Emerald ash borer',
    aka: ['EAB', 'Agrilus planipennis'],
    short:
      'An invasive beetle first detected near Detroit and Windsor in 2002 that kills up to 99% of ash trees within eight to ten years of establishing.',
    body: [
      'The Invasive Species Centre records that up to 99% of ash trees are killed by the emerald ash borer within 8 to 10 years of its establishment, and that it was first detected near Detroit, Michigan and Windsor, Ontario in 2002.',
      'The flooring consequence is visible in the inventory. White ash is the only one of the six species used in this market where annual harvest exceeds annual growth \u2014 3.3 million cubic metres grown against 6.9 million harvested, on the American Hardwood Export Council\u2019s figures. Every other species in the set shows growth at roughly double harvest.',
      'That inversion is salvage, not demand. Standing ash is being cut ahead of an insect. A homeowner specifying ash should order the whole floor, the waste allowance and a stored repair allowance in one purchase, because a matching reorder in five years cannot be promised by anyone.',
    ],
    related: ['growing-stock', 'tolerant-hardwood'],
    pillars: ['specification'],
    source: { paper: P_PROV, section: 'ash' },
  },
  {
    slug: 'nhla-grade',
    term: 'NHLA grade',
    aka: ['Lumber grade', 'FAS', 'No. 1 Common'],
    short:
      'A hardwood lumber grade set at the sawmill by how much clear material a board will yield when cut up \u2014 not a statement about a finished floor.',
    body: [
      'The National Hardwood Lumber Association grades lumber on clear-face yield, expressed in twelfths. FAS requires 83-1/3%, or 10/12, from boards 6 inches and wider at 8 to 16 feet. No. 1 Common requires 66-2/3%, or 8/12. No. 2A Common requires 50%. No. 3A Common requires 33-1/3%.',
      'The grade is fixed at the sawmill and never improves. A flooring mill works within it; a finish does not change it.',
      'This is not the grade on a flooring quote. That is an NWFA/NOFMA appearance grade, published by a different body in a separate document with the opposite logic, and the flooring standard does not cross-reference the lumber rules at all.',
    ],
    related: ['clear-face-yield', 'flooring-grade'],
    pillars: ['specification'],
    source: { paper: P_GRADE, section: 'nhla-yield' },
  },
  {
    slug: 'clear-face-yield',
    term: 'Clear-face yield',
    short:
      'The proportion of a board\u2019s face that will produce clear cuttings of a stated minimum size \u2014 the measurement an NHLA lumber grade is built on.',
    body: [
      'Yield is expressed in twelfths because the NHLA rules measure a board in units of twelve. FAS at 10/12 is 83-1/3%; No. 1 Common at 8/12 is 66-2/3%; No. 2A Common at 6/12 is 50%; No. 3A Common at 4/12 is 33-1/3%.',
      'The cutting size is part of the definition and is not optional. FAS requires a minimum cutting of 4 inches by 5 feet, or 3 inches by 7 feet. No. 1 Common accepts 4 by 2 feet or 3 by 3 feet. A board can carry a high proportion of clear face and still fail a grade because the clear areas are too small to cut usefully.',
    ],
    related: ['nhla-grade', 'flooring-grade'],
    pillars: ['specification'],
    source: { paper: P_GRADE, section: 'nhla-yield' },
  },
  {
    slug: 'flooring-grade',
    term: 'Flooring grade',
    aka: ['NWFA grade', 'NOFMA grade', 'Clear, Select, No. 1 Common, No. 2 Common'],
    short:
      'An appearance classification for finished flooring. The standard states outright that all grades are equally strong and serviceable in any application.',
    body: [
      'The NWFA/NOFMA International Standards for Unfinished Solid Wood Flooring, revised April 2018, grade a finished board on how it looks and on nothing else. Its governing sentence is unambiguous: appearance alone determines the grades of hardwood flooring since all grades are equally strong and serviceable in any application.',
      'For oak the ladder runs Clear, Select, No. 1 Common, No. 2 Common, with each grade\u2019s permitted characters published in detail \u2014 Clear still allows up to 3/8 inch of bright sapwood along the full length. For hard maple, beech and birch the top grades are Special Clear and Select & Better, and colour is graded as heavily as defect.',
      'The practical consequence is that choosing No. 2 Common is an aesthetic decision, not a compromise on the floor. The NWFA itself describes it as most desirable where numerous notable character marks and prominent colour contrast are wanted.',
    ],
    related: ['nhla-grade', 'clear-face-yield', 'heartwood', 'sapwood'],
    pillars: ['specification'],
    source: { paper: P_GRADE, section: 'nwfa-appearance' },
  },
  {
    slug: 'heartwood',
    term: 'Heartwood',
    short:
      'The darker, denser inner wood of a tree, no longer conducting sap \u2014 the part most flooring grades are written around.',
    body: [
      'Grades are written in terms of how much heartwood and sapwood a face may carry. NWFA/NOFMA Clear oak is described as a heartwood-dominant product allowing minimal character marks, while Select permits unlimited sound sapwood.',
      'In black walnut the proportion is stated explicitly: No. 1 Common requires heartwood to be a minimum of 25% of the piece. Since walnut is bought almost entirely for the colour of its heartwood, the grade named on a quote materially changes what arrives.',
    ],
    related: ['sapwood', 'flooring-grade'],
    pillars: ['specification'],
    source: { paper: P_GRADE, section: 'nwfa-appearance' },
  },
  {
    slug: 'sapwood',
    term: 'Sapwood',
    short:
      'The paler outer wood of a tree, still conducting sap when the tree was standing. Permitted, limited or required depending on the grade.',
    body: [
      'Sapwood is a grading variable rather than a defect. NWFA/NOFMA Clear oak permits up to 3/8 inch of bright sapwood along the full length of a board, or 1 inch wide for a third of its length; Select permits unlimited sound sapwood.',
      'In hard maple the relationship inverts, because the pale wood is the product. Special Clear hard maple requires 95% sapwood on the face, free from stain, with the heartwood portion nearly white \u2014 a grade that exists to exclude the darker wood other species are graded to include.',
    ],
    related: ['heartwood', 'flooring-grade'],
    pillars: ['specification'],
    source: { paper: P_GRADE, section: 'nwfa-appearance' },
  },
  {
    slug: 'strip-plank-wide-plank',
    term: 'Strip, plank and wide plank',
    short:
      'Board-width categories defined by the flooring standard, not descriptive terms a showroom is free to apply as it likes.',
    body: [
      'The NWFA/NOFMA standard defines them by measurement. Strip is less than 3 inches, or 76.2 mm. Plank is 3 to 5 inches. Wide plank is greater than 5 inches.',
      'The same standard fixes solid flooring thickness at .750 inches \u2014 19.05 mm \u2014 with a tolerance of plus or minus .015 inches, or .38 mm.',
      'Width is not only a look. The permitted moisture differential between flooring and subfloor is tighter for wider boards: no more than 4 percentage points for strip under 3 inches, and no more than 2 for flooring 3 inches or wider.',
    ],
    related: ['flooring-grade', 'moisture-differential', 'solid-hardwood'],
    pillars: ['specification', 'moisture'],
    source: { paper: P_GRADE, section: 'dimensions' },
  },
  {
    slug: 'kiln-drying',
    term: 'Kiln drying',
    short:
      'Controlled drying of sawn boards to a target moisture content before they are milled into flooring.',
    body: [
      'The kiln is the third link in the chain from standing timber to a finished floor, after the forest and the sawmill. The NWFA/NOFMA standard puts manufactured flooring at 6% to 9% moisture content, with a 5% allowance for pieces outside that range up to 12%.',
      'That is a manufacturing specification and not a site condition, and the gap between the two is where most Toronto floor failures live. A board correctly dried to 7% at the mill will still cup if it is laid against an untested subfloor.',
      'Kiln schedules and drying times for Ontario hardwood are not published in any document we could open. Where a supplier states one, ask which document it comes from.',
    ],
    related: ['moisture-content', 'moisture-differential', 'acclimation'],
    pillars: ['moisture'],
    source: { paper: P_PROV, section: 'chain' },
  },
];

export const getTerms = (): GlossaryTerm[] =>
  [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'en'));

export const getTerm = (slug: string): GlossaryTerm | undefined =>
  GLOSSARY.find((t) => t.slug === slug);

/** Terms grouped by first letter, for the A–Z index. */
export function termsByLetter(): { letter: string; terms: GlossaryTerm[] }[] {
  const map = new Map<string, GlossaryTerm[]>();
  for (const t of getTerms()) {
    const l = t.term[0].toUpperCase();
    if (!map.has(l)) map.set(l, []);
    map.get(l)!.push(t);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, terms]) => ({ letter, terms }));
}

/** Everything that links TO this term — the back-link half of the graph. */
export const backlinks = (slug: string): GlossaryTerm[] =>
  GLOSSARY.filter((t) => t.slug !== slug && t.related?.includes(slug));

export const termsForPillar = (pillarId: string): GlossaryTerm[] =>
  GLOSSARY.filter((t) => t.pillars?.includes(pillarId));
