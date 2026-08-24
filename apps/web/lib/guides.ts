/**
 * Decision guides and reference installations — the manifest.
 *
 * TWO CONTENT TYPES, ONE STRUCTURE
 *
 * A decision guide answers "which of these is right for me?" — the highest
 * commercial-intent question a homeowner asks, and the one nobody in this
 * market answers in public. A reference installation answers "show me the whole
 * thing assembled for my situation" — the artifact an architect or a designer
 * forwards to a client.
 *
 * AWS publishes both, in fixed formats, and they are the two most-shared things
 * it produces. They share a shape here because they are the same object seen
 * from two sides: a decision guide is a reference installation with the choice
 * still open, and a reference installation is a decision guide already resolved
 * for one scenario.
 *
 * CONTENT RULE — READ BEFORE EDITING
 *
 * Every guide carries `sources`, naming the paper slug and section id each
 * claim came from. scripts/verify-framework.mjs resolves all of them against
 * lib/papers.ts and fails the build on any that does not exist. No guide
 * introduces a figure, a threshold or a claim that is not already published at
 * /papers. If the substance is not in a paper yet, the paper is written first —
 * see the same note at the top of lib/framework.ts.
 */

export type GuideKind = 'decision' | 'reference';

export type GuideOption = {
  name: string;
  /** The condition under which this option is the correct one. */
  whenCorrect: string;
  notes?: string[];
};

export type GuideTable = { caption?: string; head: string[]; rows: string[][] };

export type Guide = {
  slug: string;
  kind: GuideKind;
  /** The editorial title. Used on cards, in breadcrumbs and in listings. */
  title: string;
  /**
   * The title as a searcher would phrase it. Rendered as the <title> and the H1
   * where it is set, with `title` retained for cards and breadcrumbs.
   *
   * WHY THIS FIELD EXISTS. Six of these guides answered a high-intent Toronto
   * query in full — nail-down versus glue-down, refinishing sequence, condo
   * slab — under headlines that named neither the service nor the city:
   * "Nail-down, glue-down or floating". The slug carried the keyword, the body
   * carried the answer, and the two strings a search engine weighs most heavily
   * carried neither. This is the fix, and it is a rename rather than a new
   * page on purpose: a second URL targeting a query this one already answers
   * would split the signal between them, which is the opposite of the goal.
   */
  seoTitle?: string;
  /** The question, phrased the way it is actually asked. Used as the H2 and in FAQ schema. */
  question: string;
  /**
   * Long-tail questions this guide genuinely answers, rendered visibly on the
   * page and emitted as FAQPage. Every answer must be derivable from the
   * papers, the glossary or the published constants — these are not written
   * for the schema block, which is the test F-27 set.
   */
  faqs?: { q: string; a: string }[];
  summary: string;
  publishedAt: string;
  readingMinutes: number;
  /** What actually decides the answer, in priority order. */
  criteria?: { name: string; why: string }[];
  options?: GuideOption[];
  table?: GuideTable;
  /** Ordered decision steps. Each is a condition → consequence. */
  decisionTree?: string[];
  /** For reference installations: the assembled specification. */
  spec?: { label: string; value: string }[];
  /** Ordered build sequence. */
  sequence?: string[];
  /** What goes wrong here specifically. */
  watchpoints?: string[];
  recommendation: { text: string; conditions?: string[] };
  sources: { paper: string; section: string }[];
  /** Framework pillar ids this guide bears on. Rendered as cross-links. */
  pillars?: string[];
};

const P_CLIMATE = 'toronto-hardwood-climate-moisture-protocol';
const P_COST = 'hardwood-selection-and-cost-framework-gta';
const P_CRAFT = 'hardwood-refinishing-machines-and-sequence';

export const GUIDES: Guide[] = [
  /* ── decision guides ───────────────────────────────────────────────────── */
  {
    slug: 'solid-vs-engineered-hardwood-toronto',
    kind: 'decision',
    title: 'Solid or engineered hardwood',
    seoTitle: 'Solid vs engineered hardwood flooring in Toronto',
    question: 'Should I install solid or engineered hardwood in my Toronto home?',
    summary:
      'The substrate decides this, not the budget and not the preference. This guide walks the same decision tree we use on site, in the order we walk it.',
    publishedAt: '2026-08-19',
    readingMinutes: 5,
    criteria: [
      {
        name: 'The substrate',
        why: 'Plywood over joists, a concrete slab and a radiant assembly impose different constraints. This is decided before anything else is considered.',
      },
      {
        name: 'Seasonal humidity range',
        why: 'Toronto indoor RH runs from below 25% in winter to above 60% in summer. Wider swings favour the more dimensionally stable construction.',
      },
      {
        name: 'Future refinishing cycles',
        why: 'A generational wear layer is the one genuine advantage solid retains — but only where the substrate permits solid at all.',
      },
    ],
    options: [
      {
        name: 'Solid hardwood',
        whenCorrect: 'Plywood subfloor over joists, in a home with a controlled humidity range.',
        notes: [
          'Typically 3/4" (19 mm), with a generational wear layer.',
          'Highly sensitive to relative-humidity swings.',
          'Nail-down installation.',
        ],
      },
      {
        name: 'Engineered hardwood',
        whenCorrect:
          'Concrete slab, condominium, radiant heat, or any home with a wide seasonal humidity range.',
        notes: [
          'A real hardwood wear layer over a 90° cross-ply core.',
          'The cross-ply construction is what provides dimensional stability.',
          'Glue-down over concrete; floating over radiant or where acoustic separation is required.',
        ],
      },
    ],
    table: {
      caption: 'Indoor relative humidity, Toronto residential',
      head: ['Condition', 'Relative humidity'],
      rows: [
        ['Winter indoor low', '18–25% RH'],
        ['Summer indoor high', 'above 60% RH'],
        ['Safe operating band for hardwood', '35–55% RH'],
      ],
    },
    decisionTree: [
      'Is the substrate plywood over joists? → Solid is possible.',
      'Is the substrate concrete, a condominium slab, or radiant? → Engineered is required.',
      'Is the home subject to large seasonal RH swings? → Engineered preferred.',
      'Does the client want maximum future refinishing cycles? → Solid, only if the substrate allows.',
    ],
    faqs: [
      {
        q: 'Why do gaps open between my hardwood boards every winter?',
        a:
          'Because Toronto indoor relative humidity falls to roughly 18–25% in deep winter against a stable band of 35–55%, and wood gives up moisture to the air around it. Some seasonal movement in solid hardwood is normal and is not a defect. It becomes one when the gaps are large, when they do not close again in summer, or when the material was never equalised to the space before it was laid — which is a process failure, not a property of the wood.',
      },
      {
        q: 'What causes hardwood floors to cup in a Toronto home?',
        a:
          'Moisture entering the floor from below — an untested subfloor, a slab without a vapour barrier, or material laid before the two moisture contents were compatible. Cupping is a permanent visible record of that failure, and sanding it flat before the moisture has equalised produces crowning when it finally does. It is one of the five failure modes that follow from skipping moisture testing or acclimation.',
      },
      {
        q: 'Is engineered hardwood real wood?',
        a:
          'Yes. An engineered board is a real hardwood wear layer over a cross-ply core laid at 90 degrees. The cross-ply is what provides dimensional stability; the surface you walk on and refinish is the same species as a solid board. What differs is how many refinishing cycles the wear layer permits, and where the assembly can be installed at all.',
      },
    ],
    recommendation: {
      text: 'Engineered is the correct specification for the majority of Toronto projects. We specify what the house can support, and we do not sell what will fail.',
      conditions: [
        'Solid remains correct over plywood in a humidity-controlled home where maximum refinishing cycles matter.',
        'No budget argument changes the answer when the substrate is concrete or radiant.',
      ],
    },
    sources: [
      { paper: P_COST, section: 'decision-tree' },
      { paper: P_CLIMATE, section: 'solid-vs-engineered' },
      { paper: P_CLIMATE, section: 'climate-reality' },
    ],
    pillars: ['substrate', 'specification'],
  },
  {
    slug: 'nail-down-glue-down-or-floating',
    kind: 'decision',
    title: 'Nail-down, glue-down or floating',
    seoTitle: 'Nail-down, glue-down or floating hardwood installation in Toronto',
    question: 'Which hardwood installation method is correct for my subfloor?',
    summary:
      'Installation method is not a preference and not a sales option. It is determined by the substrate, the product construction, and the climate load the floor will face for decades.',
    publishedAt: '2026-08-19',
    readingMinutes: 4,
    criteria: [
      {
        name: 'What the floor is going onto',
        why: 'Plywood accepts fasteners. Concrete does not. Radiant assemblies constrain both fastening and adhesive choice.',
      },
      {
        name: 'Product construction',
        why: 'Solid and engineered do not accept the same methods. The construction and the substrate must agree before a method is chosen.',
      },
      {
        name: 'Acoustic requirements',
        why: 'Condominium boards commonly impose sound-transmission requirements that the assembly, not the flooring, has to satisfy.',
      },
    ],
    table: {
      head: ['Method', 'When it is correct'],
      rows: [
        ['Nail-down', 'Solid hardwood over plywood'],
        ['Glue-down', 'Engineered over concrete, or in condominiums'],
        ['Floating', 'Engineered over radiant, or where acoustic separation is required'],
      ],
    },
    decisionTree: [
      'Plywood over joists, solid product → nail-down.',
      'Concrete slab or condominium, engineered product → glue-down.',
      'Radiant heat, or an acoustic separation requirement → floating.',
      'Any combination not on this list → the substrate or the product is wrong, not the method.',
    ],
    recommendation: {
      text: 'Match the method to the substrate and the product construction, in that order. A method chosen before the substrate has been identified is a guess with a delay built into it.',
      conditions: [
        'If a contractor proposes a method without naming your substrate, that is criterion 2.1 of the framework failing.',
      ],
    },
    sources: [
      { paper: P_CLIMATE, section: 'method-and-substrate' },
      { paper: P_COST, section: 'decision-tree' },
    ],
    pillars: ['substrate'],
  },
  {
    slug: 'how-to-evaluate-a-hardwood-quote',
    kind: 'decision',
    title: 'How to evaluate a hardwood quote',
    seoTitle: 'How to evaluate a hardwood flooring quote in Toronto',
    question: 'How do I tell a good hardwood flooring quote from a bad one?',
    summary:
      'Six questions that separate a company that has done the diligence from one that intends to discover the problems after your deposit has cleared. Any "no" is a red flag.',
    publishedAt: '2026-08-19',
    readingMinutes: 4,
    criteria: [
      {
        name: 'Was anything measured before the price was set?',
        why: 'A price quoted without moisture readings and a substrate assessment is an estimate of a building nobody has examined.',
      },
      {
        name: 'Is the price closed or open?',
        why: 'Open-ended change-order language transfers the cost of missing diligence onto the homeowner, after commitment.',
      },
      {
        name: 'Who actually performs the work?',
        why: 'A crew that will not be there next season has no stake in how the floor performs next season.',
      },
    ],
    decisionTree: [
      'Do they moisture-test at the free estimate, and document the readings? → If no, stop here.',
      'Do they require a minimum 72-hour acclimation in the actual space? → If no, the warranty is decorative.',
      'Is the price fixed in writing, with no open-ended change-order language? → If no, the quoted number is not the price.',
      'Are the installers salaried employees, or day-labour subcontractors?',
      'Will they refuse the job if the substrate or conditions are wrong?',
      'Is there true lifetime workmanship warranty language in the contract itself?',
    ],
    faqs: [
      {
        q: 'What should a hardwood flooring quote include?',
        a:
          'The moisture readings and the date they were taken, the species, grade and width, the subfloor preparation, the installation method and why, the grit sequence, the finish product and number of coats, stairs and transitions itemised, the schedule, and the workmanship warranty language in the contract itself rather than on a website. A quote missing the moisture readings was priced before anyone knew what the job was.',
      },
      {
        q: 'How do I know if a hardwood contractor uses subcontractors?',
        a:
          'Ask who is on payroll and get the answer in writing. The question matters because a protocol can be requested of a subcontracted crew and required of a salaried one, and because a workmanship warranty is only meaningful from a company that still controls the people whose workmanship it covers when you call.',
      },
    ],
    recommendation: {
      text: 'Run all six against every quote you hold, including ours. The self-assessment scores the full twenty-four-criterion framework and tells you which questions to go back and ask.',
      conditions: [
        'Any company that cannot or will not provide these is optimizing for speed and lowest bid, not for decades of performance.',
      ],
    },
    sources: [
      { paper: P_COST, section: 'installer-checklist' },
      { paper: P_CLIMATE, section: 'what-to-demand' },
      { paper: P_COST, section: 'fixed-price' },
    ],
    pillars: ['accountability', 'moisture'],
  },

  /* ── reference installations ───────────────────────────────────────────── */
  {
    slug: 'reference-condominium-concrete-slab',
    kind: 'reference',
    title: 'Condominium over concrete slab',
    seoTitle: 'Hardwood flooring over a concrete slab in a Toronto condominium',
    question: 'What does a correct hardwood installation over a Toronto condo slab look like, end to end?',
    summary:
      'The most common non-trivial scenario in the GTA: an engineered floor glued to a concrete slab, in a building with acoustic requirements and no forgiving substrate.',
    publishedAt: '2026-08-19',
    readingMinutes: 5,
    spec: [
      { label: 'Substrate', value: 'Concrete slab' },
      { label: 'Product construction', value: 'Engineered — hardwood wear layer over 90° cross-ply core' },
      { label: 'Method', value: 'Glue-down' },
      { label: 'Acclimation', value: 'Minimum 72 hours in the actual conditioned space' },
      { label: 'Moisture testing', value: 'Slab and material, documented, at estimate and again before installation' },
      { label: 'Operating band', value: '35–55% RH' },
      { label: 'Dust containment', value: 'HEPA throughout the process' },
    ],
    sequence: [
      'Moisture-test the slab and the material; document both readings.',
      'Confirm both readings sit inside the acceptable delta before ordering.',
      'Acclimate a minimum of 72 hours in the actual conditioned space.',
      'Assess and correct slab flatness before the price is fixed.',
      'Confirm the building\'s acoustic requirement and how the assembly satisfies it.',
      'Glue-down installation, with expansion gaps at every wall and fixed object.',
      'HEPA containment maintained throughout.',
    ],
    watchpoints: [
      'Solid hardwood over a slab has no cross-ply core to resist seasonal movement. This is the substitution that fails most often.',
      'Slab flatness discovered after the deposit is the single most common source of change orders.',
      'Expansion gaps are missed at fixed objects mid-field far more often than at the perimeter.',
    ],
    recommendation: {
      text: 'Engineered, glued down, over a slab that has been tested and flattened before the price was fixed. Nothing in this scenario is negotiable on budget grounds.',
    },
    sources: [
      { paper: P_CLIMATE, section: 'method-and-substrate' },
      { paper: P_CLIMATE, section: 'protocol' },
      { paper: P_COST, section: 'decision-tree' },
      { paper: P_COST, section: 'fixed-price' },
    ],
    pillars: ['substrate', 'moisture', 'movement'],
  },
  {
    slug: 'reference-radiant-heat-main-floor',
    kind: 'reference',
    title: 'Radiant heat main floor',
    seoTitle: 'Hardwood flooring over radiant heat in Toronto',
    question: 'What does a correct hardwood installation over radiant heat look like, end to end?',
    summary:
      'Radiant assemblies impose a thermal cycle on top of the seasonal one. Product construction and method are both constrained, and neither is a preference.',
    publishedAt: '2026-08-19',
    readingMinutes: 5,
    spec: [
      { label: 'Substrate', value: 'Radiant heat assembly' },
      { label: 'Product construction', value: 'Engineered — required, for dimensional stability under thermal cycling' },
      { label: 'Method', value: 'Floating' },
      { label: 'Acclimation', value: 'Minimum 72 hours in the actual conditioned space' },
      { label: 'Moisture testing', value: 'Substrate and material, documented, twice' },
      { label: 'Operating band', value: '35–55% RH' },
      { label: 'Dust containment', value: 'HEPA throughout the process' },
    ],
    sequence: [
      'Identify the radiant assembly explicitly before any product is proposed.',
      'Moisture-test substrate and material; document both readings.',
      'Acclimate a minimum of 72 hours in the actual conditioned space, with the system at normal operating temperature.',
      'Floating installation, with expansion gaps at every wall and fixed object.',
      'State the safe operating humidity band and who maintains it, in writing, at handover.',
    ],
    watchpoints: [
      'Solid hardwood over radiant is the specification error with the longest delay before it shows.',
      'A floor handed over without a stated operating range has no defensible warranty boundary in either direction.',
      'Thermal cycling compounds the seasonal RH swing rather than replacing it.',
    ],
    faqs: [
      {
        q: 'Can you install hardwood over radiant heat in Toronto?',
        a:
          'Yes, with the assembly specified for it: an engineered construction, a floating or otherwise movement-tolerant installation, and a documented heat-up and cool-down schedule before and after laying. Solid hardwood over radiant is the specification most likely to fail here, because the heat drives a moisture gradient through the board in the same direction the Toronto winter is already pulling.',
      },
      {
        q: 'What surface temperature is safe for hardwood over radiant heat?',
        a:
          'The controlling number is not the water temperature but the temperature at the top of the board, and it is set by the flooring manufacturer for the specific product. An assembly designed without reference to that figure, and without a commissioning schedule that brings the system up gradually, has no warranty boundary in either direction.',
      },
    ],
    recommendation: {
      text: 'Engineered construction, floated, with the humidity operating band and the responsibility for maintaining it written into the handover.',
    },
    sources: [
      { paper: P_CLIMATE, section: 'method-and-substrate' },
      { paper: P_CLIMATE, section: 'climate-reality' },
      { paper: P_CLIMATE, section: 'protocol' },
    ],
    pillars: ['substrate', 'movement', 'specification'],
  },
  {
    slug: 'reference-refinishing-existing-hardwood',
    kind: 'reference',
    title: 'Refinishing an existing hardwood floor',
    seoTitle: 'Hardwood floor sanding and refinishing in Toronto — the machine sequence',
    question: 'What is the correct machine sequence for refinishing a hardwood floor?',
    summary:
      'Four machines, each doing something the others cannot, in an order where every skipped step is a future liability that is invisible on handover day.',
    publishedAt: '2026-08-19',
    readingMinutes: 6,
    spec: [
      { label: 'Machine 1', value: 'Belt floor sander — progressive grits, field only' },
      { label: 'Machine 2', value: 'Floor edger — matching grits, every perimeter and detail' },
      { label: 'Machine 3', value: 'Planetary / multi-disc — refining, blending field into edges' },
      { label: 'Machine 4', value: 'Buffer / screening — final uniform surface and intercoat' },
      { label: 'Dust containment', value: 'HEPA throughout the process' },
    ],
    sequence: [
      'Moisture testing and acclimation — minimum 72 hours in the actual conditioned space.',
      'Belt sander, progressive grits, field only.',
      'Edger, matching grits, on every perimeter and detail.',
      'Planetary / multi-disc, refining and blending field into edges.',
      'Buffer / screening for a final uniform surface.',
      'Vacuum, tack, apply the finish system.',
      'Intercoat screening with the buffer between coats.',
      'Final coat.',
    ],
    watchpoints: [
      'A big machine cannot reach a perimeter. Skipping or under-gritting the edger leaves a visible halo around every room that only appears once the finish goes on.',
      'Without the blending pass, the boundary between what the belt sander reached and what the edger reached stays visible for the life of the floor.',
      'Intercoat screening is invisible on handover day and produces an uneven surface and weaker adhesion when skipped.',
      'Dry to walk on and fully cured are different dates. Furniture returned to an uncured finish marks it permanently.',
    ],
    faqs: [
      {
        q: 'Can I stay in the house while my hardwood floors are refinished?',
        a:
          'Most refinishing clients sleep at home every night of the job. Containment is HEPA-sealed extraction at the machine plus containment at the room, capturing roughly 99.7% of airborne particulate at the source, and the water-based finishes are low-odour and walk-on ready in 2–4 hours.',
      },
      {
        q: 'How long does hardwood floor refinishing take?',
        a:
          'Refinishing is typically 3–5 days for a standard floor; a new installation on 1,000–1,500 sq ft runs 5 to 7 working days including moisture testing, acclimation, installation, then sanding, staining and finishing. The written estimate includes a committed schedule rather than a range.',
      },
      {
        q: 'Should I refinish or replace my hardwood floor?',
        a:
          'Refinish while there is wear layer left to remove and the boards are sound. Replace when the wear layer is spent, when boards are cupped or crowned beyond what a flat sand can correct without going through, or when the substrate underneath is the actual problem. The measurement that settles it is how much material remains above the tongue, and it is taken on site rather than guessed from a photograph.',
      },
    ],
    recommendation: {
      text: 'All four machines, in sequence, with intercoat screening. Equipment is not the difference between companies — the sequence and the discipline to complete it are.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_CRAFT, section: 'the-four-machines' },
      { paper: P_CRAFT, section: 'edger' },
      { paper: P_CRAFT, section: 'planetary' },
      { paper: P_CRAFT, section: 'equipment-is-not-the-moat' },
    ],
    pillars: ['containment'],
  },

  /* ── high-intent Toronto decision guides (cost, contractor, species, pattern) ── */
  {
    slug: 'hardwood-flooring-cost-toronto',
    kind: 'decision',
    title: 'Hardwood flooring cost in Toronto',
    question: 'How much does hardwood flooring cost in Toronto and the GTA?',
    summary:
      'Published installed ranges for new install, full sand and finish, and screen and recoat — and the variables that move a phone range into a fixed written price after the free measure.',
    publishedAt: '2026-08-22',
    readingMinutes: 6,
    criteria: [
      {
        name: 'Service type',
        why: 'Screen and recoat, full sand and finish, and new install are different labour and material stacks. Mixing them produces a meaningless average.',
      },
      {
        name: 'Species and grade',
        why: 'White oak, walnut, maple and hickory do not land at the same installed number. Grade and width move material cost before labour is considered.',
      },
      {
        name: 'Pattern and stairs',
        why: 'Herringbone, chevron and parquet multiply labour and waste. Stairs are a separate line, not a square-footage footnote.',
      },
      {
        name: 'Substrate and moisture',
        why: 'Flatness correction, slab moisture mitigation and acoustic underlayment are scope items discovered on site, which is why the fixed price follows the measure.',
      },
    ],
    table: {
      head: ['Service', 'Typical installed range (CAD / sq ft)', 'What it includes'],
      rows: [
        ['Screen & recoat', '$2.50 – $4.00', 'Abrasion of the existing finish, new top coats — no full sand to bare wood'],
        ['Full sand & finish', '$4.75 – $7.50', 'Sand to bare wood, stain if specified, finish system'],
        ['New hardwood install', '$11 – $18', 'Material and labour for straight-lay install; pattern and stairs extra'],
      ],
    },
    decisionTree: [
      'If the existing finish still has integrity and colour is acceptable → screen and recoat is the honest first evaluation, not a full sand by default.',
      'If colour change, deep wear, or prior poor sanding is the problem → full sand and finish, after depth-above-tongue is confirmed.',
      'If the floor is at the end of its wear layer, wrong species, or wrong construction for the substrate → replacement, priced as new install.',
      'Stairs, transitions, moisture remediation and pattern work are separate lines on the written estimate.',
    ],
    watchpoints: [
      'A phone number without a moisture test is a marketing range, not a price.',
      'Lowest bid that skips substrate language is usually incomplete scope, not a bargain.',
      'Pattern multipliers and stair counts omitted from a quote will reappear as change orders.',
    ],
    faqs: [
      {
        q: 'Why does moisture testing change the price of my hardwood quote?',
        a:
          "Because it changes what the job actually is. Both the subfloor and the material carry a moisture content, and both are measured — at the estimate and again immediately before installation. A quote given before those readings is a guess that gets corrected later at the homeowner's expense, which is the mechanism behind most of the price increases people encounter mid-job.",
      },
      {
        q: 'Why do hardwood quotes in Toronto vary so much for the same floor?',
        a:
          'Because they are usually not the same job. Whether the subfloor is being prepared, whether stairs and transitions are in scope, which grit sequence is run, how many finish coats, and whether the crew is salaried or subcontracted all sit behind a single per-square-foot number. The published bands on this site are for the whole scope, and the framework exists so the differences can be compared item by item rather than by price alone.',
      },
    ],
    recommendation: {
      text: 'Use the published ranges to budget. Book the free in-home measure for the fixed written price. Compare quotes on scope completeness — machines, sequence, moisture protocol, warranties in writing — not on the headline number alone.',
    },
    sources: [
      { paper: P_COST, section: 'installed-cost' },
      { paper: P_COST, section: 'decision-tree' },
      { paper: P_CRAFT, section: 'sequence' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'how-to-choose-hardwood-contractor-toronto',
    kind: 'decision',
    title: 'How to choose a hardwood contractor in Toronto',
    question: 'How do I choose a hardwood flooring contractor in Toronto?',
    summary:
      'A short diligence list for homeowners: who sands the floor, what is measured before the price is written, and which contract terms separate a fixed-price craftsman shop from a lead-broker.',
    publishedAt: '2026-08-22',
    readingMinutes: 5,
    criteria: [
      {
        name: 'Who performs the work',
        why: 'Salaried crews and revolving subcontractors produce different accountability when something needs to be made right months later.',
      },
      {
        name: 'What is measured before the price',
        why: 'Moisture, flatness, wear-layer depth and stair counts belong in the estimate visit. A price without them is incomplete.',
      },
      {
        name: 'What is written in the contract',
        why: 'Manufacturer warranties itemized, fixed price language, and the finish system named are the terms that matter after the cheque clears.',
      },
      {
        name: 'Machine sequence on refinish work',
        why: 'Belt, edger, planetary blending and intercoat screening are a sequence. Skipping a step shows up for the life of the floor.',
      },
    ],
    decisionTree: [
      'Ask who will be on site on sanding day — employees or subcontractors.',
      'Ask whether the estimate includes a moisture reading and, for refinish, a depth check above the tongue.',
      'Ask for the finish system by product name and the manufacturer warranty period in writing.',
      'Ask which machines run, in which order, on a full sand.',
      'Decline quotes that only compete on a low headline number with empty scope.',
    ],
    watchpoints: [
      'Lead-broker sites that auction your phone number are not flooring companies.',
      'Dustless as a word without HEPA-sealed extraction and containment is marketing.',
      'Unforeseen conditions clauses that re-price substrate issues found on day one shift risk back to you.',
    ],
    recommendation: {
      text: 'Choose the contractor who writes a fixed price after measuring the floor you actually have, names the crew model, and itemizes warranties. Use the quote-evaluation guide as the scorecard when two bids look similar on price.',
    },
    sources: [
      { paper: P_COST, section: 'decision-tree' },
      { paper: P_CRAFT, section: 'equipment-is-not-the-moat' },
      { paper: P_CRAFT, section: 'sequence' },
    ],
    pillars: ['specification', 'containment'],
  },
  {
    slug: 'white-oak-flooring-toronto',
    kind: 'decision',
    title: 'White oak flooring in Toronto',
    question: 'Is white oak the right hardwood for a Toronto home?',
    summary:
      'Why white oak dominates contemporary Toronto renovations, how it differs from red oak on tannin and stain behaviour, and when another species is the better specification.',
    publishedAt: '2026-08-22',
    readingMinutes: 5,
    criteria: [
      {
        name: 'Stain and finish target',
        why: 'White oak takes grey, smoked and modern transparent finishes more evenly than red oak because of tannin and pore structure.',
      },
      {
        name: 'Substrate',
        why: 'White oak does not override slab or radiant constraints. Engineered white oak is the usual path over concrete.',
      },
      {
        name: 'Traffic and denting',
        why: 'Janka ~1360 is mid-hard. Hickory is harder; walnut is softer. Species choice is not only aesthetic.',
      },
    ],
    options: [
      {
        name: 'White oak',
        whenCorrect: 'Modern or transitional interiors, even stain uptake, and most GTA renovations where oak is wanted.',
        notes: [
          'Strong default for water-based finish systems.',
          'Available in solid and engineered constructions.',
          'Wide plank shows flatness issues — substrate prep matters more, not less.',
        ],
      },
      {
        name: 'Red oak',
        whenCorrect: 'Heritage match to existing red oak, or a deliberate open-grain traditional look.',
        notes: [
          'More pronounced grain under stain.',
          'Still a valid specification; not an inferior default.',
        ],
      },
      {
        name: 'Walnut or maple',
        whenCorrect: 'When the design target is deep brown (walnut) or bright uniform (maple), not oak grain.',
        notes: [
          'Walnut dents more readily; maple shows impact differently.',
          'Price and lead times differ from commodity oak.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is white oak or red oak better for a Toronto home?',
        a:
          'White oak is more tannin-stable under water-based finishes, takes grey and modern stains more evenly, and is the default for contemporary renovations. Red oak is the heritage Canadian floor with a more open grain. Neither is universally better — substrate, stain target and traffic decide.',
      },
      {
        q: 'Is wide-plank hardwood a good idea in Toronto?',
        a:
          'Wide planks move more across their width than narrow ones, and Toronto indoor humidity swings from roughly 18–25% in winter to above 60% in summer. That does not rule wide plank out; it means the construction has to absorb the movement, which in practice means engineered over most Toronto substrates, and it means the operating humidity band has to be stated and kept.',
      },
    ],
    recommendation: {
      text: 'Default to white oak for contemporary Toronto work when oak is the design intent. Confirm construction (solid vs engineered) from the substrate, not from the species brochure. Match existing red oak with red oak rather than forcing a white-oak patch.',
    },
    sources: [
      { paper: P_COST, section: 'species' },
      { paper: P_CLIMATE, section: 'solid-vs-engineered' },
    ],
    pillars: ['specification', 'movement'],
  },
  {
    slug: 'dustless-hardwood-refinishing-toronto',
    kind: 'reference',
    title: 'Dustless hardwood refinishing in Toronto',
    question: 'What does dustless hardwood refinishing actually mean in an occupied Toronto home?',
    summary:
      'Dustless is a containment and extraction system, not a brand adjective. This guide states what has to be true on site for a refinish to be livable during the work.',
    publishedAt: '2026-08-22',
    readingMinutes: 4,
    criteria: [
      {
        name: 'Extraction at the machine',
        why: 'HEPA-sealed collection at the sander is the primary capture point. Room air filters alone are not a dustless system.',
      },
      {
        name: 'Containment',
        why: 'Plastic and zipper barriers keep fine dust from migrating to rooms that are not in scope.',
      },
      {
        name: 'Finish chemistry',
        why: 'Water-based systems cut odour and return-to-service time compared with solvent-heavy finishes — relevant when the house stays occupied.',
      },
    ],
    sequence: [
      'Isolate the work zone.',
      'Run HEPA-sealed sanding equipment through the grit sequence.',
      'Edge, blend, vacuum between grits.',
      'Apply finish system with intercoat screening as specified.',
      'Release the zone when walk-on times are met — full cure is later.',
    ],
    watchpoints: [
      'Dustless never means zero dust. It means controlled, captured, and contained dust.',
      'Skipping the blending pass leaves a visible perimeter halo after finish.',
      'Walk-on ready is not full cure; early furniture return marks soft finish.',
    ],
    faqs: [
      {
        q: 'Does dust-free hardwood sanding actually work?',
        a:
          'It works to the degree the containment is real. Dustless means HEPA-sealed extraction at the machine and containment at the room, capturing roughly 99.7% of airborne particulate at the source — not a bag on a sander and not a label. The test of a claim is whether the company will say what is sealed, at which machine, and whether you can stay in the house.',
      },
      {
        q: 'Is dust-free sanding more expensive than ordinary sanding?',
        a:
          'Not as a separate line. The published band for a full sand and finish is the same whether or not containment is used, because containment is how the work is done here rather than an upgrade sold on top of it. What moves the price inside the band is area, species, the substrate, stairs and the condition of the existing floor.',
      },
    ],
    recommendation: {
      text: 'Require HEPA-sealed extraction and room containment in the written scope. Stay home if you want to — that is a realistic outcome when the system is real. Treat dustless claims without equipment detail as incomplete.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_CRAFT, section: 'the-four-machines' },
      { paper: P_CRAFT, section: 'sequence' },
    ],
    pillars: ['containment'],
  },
  {
    slug: 'herringbone-chevron-parquet-toronto',
    kind: 'decision',
    title: 'Herringbone, chevron and parquet in Toronto',
    question: 'Should I install herringbone, chevron or parquet in my Toronto home or condo?',
    summary:
      'Pattern floors are a design decision layered on top of the same substrate rules as straight-lay. Labour, waste, and layout control the cost delta — not the species alone.',
    publishedAt: '2026-08-22',
    readingMinutes: 5,
    criteria: [
      {
        name: 'Substrate first',
        why: 'Pattern does not authorize solid over a slab. Engineered on a tested slab remains the condo path.',
      },
      {
        name: 'Layout and waste',
        why: 'Herringbone and chevron generate higher waste factors and longer install times than straight-lay.',
      },
      {
        name: 'Room geometry',
        why: 'Narrow rooms, many doorways and out-of-square walls punish pattern work; the layout has to be controlled from a centreline.',
      },
    ],
    options: [
      {
        name: 'Herringbone',
        whenCorrect: 'Rectangular rooms where a classic patterned field is the design intent and budget includes the labour multiplier.',
        notes: ['Rectangular blocks meet at 90°.', 'Shows substrate flatness clearly.'],
      },
      {
        name: 'Chevron',
        whenCorrect: 'When a continuous V or axis line is wanted; requires precision-cut ends.',
        notes: ['Ends are cut to form the point; material prep is stricter.', 'Higher fabrication demand than herringbone.'],
      },
      {
        name: 'Parquet / modular patterns',
        whenCorrect: 'Feature fields, borders, or heritage restorations where the pattern is part of the architecture.',
        notes: ['Often a feature zone rather than a whole-home field.', 'Matching existing historic parquet is specialist work.'],
      },
    ],
    faqs: [
      {
        q: 'Can herringbone be installed in a Toronto condominium?',
        a:
          "Yes, when the slab moisture, the acoustic assembly and the building's elevator and delivery windows are specified first. Pattern work multiplies labour and waste, but it does not change what the substrate allows: glue-down engineered over a tested slab is the usual condo path whatever the pattern.",
      },
      {
        q: 'What is the difference between herringbone and chevron?',
        a:
          'Herringbone is made of rectangular boards laid at 90 degrees to each other, so the ends meet the sides in a staggered zig-zag. Chevron boards are cut at an angle at both ends so the points meet in a continuous V. Chevron costs more because the cut is part of the material, and it is far less forgiving of an out-of-square room.',
      },
    ],
    recommendation: {
      text: 'Choose the pattern for the room, then confirm the substrate method. Budget a real labour and waste premium. In condos, resolve slab moisture, acoustics and elevator logistics before ordering patterned material.',
    },
    sources: [
      { paper: P_COST, section: 'decision-tree' },
      { paper: P_CLIMATE, section: 'method-and-substrate' },
    ],
    pillars: ['specification'],
  },
];

export const getGuides = (kind?: GuideKind): Guide[] =>
  kind ? GUIDES.filter((g) => g.kind === kind) : GUIDES;

export const getGuide = (slug: string): Guide | undefined => GUIDES.find((g) => g.slug === slug);

export const guidesForPillar = (pillarId: string): Guide[] =>
  GUIDES.filter((g) => g.pillars?.includes(pillarId));
