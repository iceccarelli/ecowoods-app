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

import {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBandBare as bandBare,
} from '@/content/constants/pricing';

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
const P_PROV = 'where-toronto-hardwood-comes-from';
const P_GRADE = 'hardwood-grading-standards-nhla-nwfa';

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
          'Most refinishing clients sleep at home every night of the job. Containment is HEPA-sealed extraction at the machine plus containment at the room. We publish no room-capture percentage because we have not measured one on a job. The water-based finishes are low-odour and walk-on ready in 2–4 hours.',
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
        ['Screen & recoat', bandBare(SCREEN_RECOAT), 'Abrasion of the existing finish, new top coats — no full sand to bare wood'],
        ['Full sand & finish', bandBare(FULL_SAND_FINISH), 'Sand to bare wood, stain if specified, finish system'],
        ['New hardwood install', bandBare(NEW_INSTALL), 'Material and labour for straight-lay install; pattern and stairs extra'],
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
          'It works to the degree the containment is real. Dustless means HEPA-sealed extraction at the machine and containment at the room — not a bag on a sander and not a label. We publish no room-capture percentage, because a filter’s certified rating and the fraction of dust actually captured in your hallway are two different numbers, and this industry quotes the first as if it were the second. The test of a claim is whether the company will say what is sealed, at which machine, and whether you can stay in the house.',
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
  /* ── species dossiers ──────────────────────────────────────────────────── */
  /*
   * WHY THESE ARE `reference` AND NOT CASE STUDIES
   *
   * The obvious way to add five more case studies is to write five more case
   * studies. We did not, and the reason is worth recording where the next
   * person will find it.
   *
   * The five case studies on this site are real jobs with measured pre-work
   * readings. Five invented ones would read identically, satisfy every guard in
   * this repository — because the guards check consistency, not truth — and be
   * indistinguishable to a reader from the real ones, which is precisely what
   * makes them corrosive. A fabricated case study does not merely add a lie; it
   * withdraws the credit the true ones had earned.
   *
   * So these are case studies of the MATERIAL. Every figure below is sourced to
   * a document a government, a standards body or the manufacturer itself
   * published, cited in the paper each guide draws from. They answer the same
   * commercial question a case study answers — "what happens if I choose this?"
   * — from evidence that can be checked.
   */
  {
    slug: 'red-oak-flooring-toronto',
    kind: 'reference',
    title: 'Red oak',
    seoTitle: 'Red oak hardwood flooring in Toronto — supply, grades and what to specify',
    question: 'Is red oak the right hardwood floor for a Toronto home?',
    summary:
      'Red oak is one of the seven principal tolerant hardwoods the Government of Ontario names, it is the second-largest hardwood growing stock in the province, and it is the species most Toronto homes already have. This dossier sets out what is actually published about its supply, its hardness and the grades it is sold in.',
    publishedAt: '2026-08-27',
    readingMinutes: 6,
    spec: [
      { label: 'Botanical name', value: 'Quercus rubra' },
      { label: 'Side hardness, 12% MC', value: '1,290 lbf (USDA Forest Products Laboratory, Wood Handbook Table 5-3b)' },
      { label: 'Ontario range', value: 'East of Lake Superior and across Central and Southern Ontario (Ontario Tree Atlas)' },
      { label: 'Ontario status', value: 'One of the seven principal tolerant hardwoods named by the Ministry of Natural Resources' },
      { label: 'Ontario growing stock', value: '85,019,702 m³ (Forest Resources of Ontario 2021)' },
      { label: 'US growing stock', value: '17.9% of the US total, 2.62 billion m³ (American Hardwood Export Council)' },
      { label: 'US annual growth against harvest', value: '60.6 million m³ grown against 31.9 million m³ harvested per year' },
      { label: 'Flooring grades published', value: 'Clear, Select, No. 1 Common, No. 2 Common (NWFA/NOFMA oak rules)' },
    ],
    table: {
      caption: 'What each NWFA/NOFMA oak grade permits, as published',
      head: ['Grade', 'Permits'],
      rows: [
        ['Clear', 'Heartwood-dominant, minimal character. Up to 3/8" bright sapwood along the full length, small burls, fine pin worm holes, tight checks.'],
        ['Select', 'Unlimited sound sapwood, one small tight knot per 3 ft, slightly open checks, machine burns to 1/4" wide.'],
        ['No. 1 Common', 'Open characters — checks and knot holes — that are sound and fillable. Excludes broken knots over 1/2".'],
        ['No. 2 Common', 'Sound natural forest variation and manufacturing imperfections. The NWFA calls it most desirable where prominent character is wanted.'],
      ],
    },
    watchpoints: [
      'Red oak and white oak are different woods and are routinely quoted as "oak". Red oak is 1,290 lbf against white oak at 1,360; the grain is more open and it takes stain differently. Ask for the botanical name on the quote.',
      'A very common claim — that red oak historically dominates Ontario housing stock — has no source we could find. We looked hard, found only unattributed blog content, and do not publish it. Neither should anyone quoting it to you.',
      'Ontario publishes growing stock, not hardwood harvest. Nobody can tell you what share of Toronto red oak flooring is Ontario-grown, because that number is not published by anyone.',
    ],
    faqs: [
      {
        q: 'Is red oak harder than white oak?',
        a: 'No. The USDA Forest Products Laboratory publishes red oak at 1,290 lbf side hardness at 12% moisture content and white oak at 1,360 lbf. The difference is real but modest, and it is not the reason to choose between them — grain openness, colour and how each takes a stain matter more in a finished floor.',
      },
      {
        q: 'Is red oak flooring sustainable?',
        a: 'On the published inventory, red oak grows considerably faster than it is cut: the American Hardwood Export Council records 60.6 million cubic metres of annual growth against 31.9 million cubic metres of annual harvest across the US resource, and Ontario holds a further 85,019,702 cubic metres of standing red oak. That is a statement about the resource, not about any individual supply chain — for that, ask who milled the boards.',
      },
      {
        q: 'What grade of red oak flooring should I buy?',
        a: 'Grade is an appearance decision, not a durability one: the NWFA/NOFMA standard states that all grades are equally strong and serviceable in any application. Clear gives a near-uniform heartwood face, Select allows sapwood and small tight knots, and No. 1 and No. 2 Common carry progressively more character. Choose the look, then require the grade by name on the quote.',
      },
    ],
    recommendation: {
      text: 'Red oak is the correct default for matching or extending an existing Toronto hardwood floor, and a sound choice on its own merits. Specify the botanical species and the NWFA/NOFMA grade in writing; both are free to ask for and neither is usually offered.',
      conditions: [
        'If the floor is being matched to existing boards, red oak is very often what is already there — confirm by inspection, not by assumption.',
        'If a whiter, tighter grain is wanted, white oak is the comparison to make, and it is a different guide.',
      ],
    },
    sources: [
      { paper: P_PROV, section: 'tolerant-hardwoods' },
      { paper: P_PROV, section: 'growing-stock' },
      { paper: P_PROV, section: 'ash' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'hard-maple-flooring-toronto',
    kind: 'reference',
    title: 'Hard maple',
    seoTitle: 'Hard maple hardwood flooring in Toronto — supply, grades and what to specify',
    question: 'Is hard maple the right hardwood floor for a Toronto home?',
    summary:
      'Sugar maple is the largest hardwood growing stock in Ontario by a wide margin, the province describes it as the most common tree in the Great Lakes–St. Lawrence and Deciduous Forest regions, and it is the one flooring species Ontario explicitly says is amenable to single-tree selection. It is also the least forgiving species on the finishing bench.',
    publishedAt: '2026-08-27',
    readingMinutes: 6,
    spec: [
      { label: 'Botanical name', value: 'Acer saccharum (sugar maple)' },
      { label: 'Side hardness, 12% MC', value: '1,450 lbf (USDA Forest Products Laboratory, Wood Handbook Table 5-3b)' },
      { label: 'Ontario range', value: 'Central, Southern and parts of Northwestern Ontario (Ontario Tree Atlas)' },
      { label: 'Ontario status', value: 'Principal tolerant hardwood; roughly 3% of Ontario’s managed forest' },
      { label: 'Ontario growing stock', value: '300,361,212 m³ — the largest of any Ontario flooring hardwood' },
      { label: 'Silviculture', value: 'Ontario states it is amenable to the single-tree selection silvicultural system' },
      { label: 'US growing stock', value: '6.5% of the US total, 955.4 million m³ (American Hardwood Export Council)' },
      { label: 'US annual growth against harvest', value: '19.1 million m³ grown against 10.2 million m³ harvested per year' },
      { label: 'Flooring grades published', value: 'Special Clear, Select & Better, No. 1 Common, No. 2 Common (NWFA/NOFMA hard maple, beech and birch rules)' },
    ],
    table: {
      caption: 'NWFA/NOFMA hard maple, beech and birch grades',
      head: ['Grade', 'Permits'],
      rows: [
        ['Special Clear', 'Requires 95% sapwood on the face, free from stain, with the heartwood portion nearly white.'],
        ['Select & Better', 'A nearly defect-free face with natural colour variation permitted. Occasional pin knots to 1/8" diameter, dark green or black spots to 1/4" × 3", bird’s eyes and small burls.'],
        ['No. 1 Common', 'Distinct colour variation, numerous streaks, stained sapwood, sound tight knots away from edges and ends, checks to 3".'],
        ['No. 2 Common', 'Must provide serviceable flooring with firm wood. Excludes knot holes over 3/8" diameter, unsound knots, shake, heart checks and badly split ends.'],
      ],
    },
    watchpoints: [
      'Maple is a closed-grain, pale wood, and that is exactly why it punishes sanding errors. A drum mark or an edger halo that hides in oak is visible across a maple floor in raking light. This is the species where the machine sequence and the operator matter most.',
      'Maple grades are graded on colour as much as on defect. Select & Better admits natural colour variation; if a uniform white floor is the goal, Special Clear is the grade that says so, and it costs accordingly.',
      'Site-applied stain on maple is a specialist operation. Its density resists penetration and blotches readily; a supplier who agrees to stain maple without discussing conditioning has not done it often.',
    ],
    faqs: [
      {
        q: 'Is maple harder than oak?',
        a: 'Yes. The USDA Forest Products Laboratory publishes hard maple at 1,450 lbf side hardness at 12% moisture content, against white oak at 1,360 and red oak at 1,290. It is the second-hardest of the six species commonly installed in this market, behind hickory at 1,880.',
      },
      {
        q: 'Is maple flooring Canadian?',
        a: 'Sugar maple is the largest hardwood growing stock in Ontario at 300,361,212 cubic metres, and the vertically integrated flooring manufacturers serving the GTA — Mercier, Lauzon, Preverco, Mirage, Wickham — all operate their own Quebec sawmills. Domestic supply demonstrably exists. What no source publishes is the share of maple flooring sold in Ontario that is domestically milled, so we do not state one.',
      },
      {
        q: 'Why does my maple floor look blotchy after staining?',
        a: 'Maple is dense and closed-grain, so stain sits unevenly on it unless the floor is conditioned first and the sanding sequence has left a genuinely uniform surface. Blotching on maple is usually a process record rather than a material defect, and it is the reason many specifications keep maple clear-finished.',
      },
    ],
    recommendation: {
      text: 'Hard maple is the right specification for a bright, contemporary, high-traffic floor where the client accepts a pale palette. It is the wrong specification for a project that wants a rich stain and is hiring on price, because maple is the species where a cheap sanding job shows.',
      conditions: [
        'Specify the grade by name — Special Clear and Select & Better are different floors at different prices.',
        'If a stain is planned, require the conditioning step in writing before the quote is accepted.',
      ],
    },
    sources: [
      { paper: P_PROV, section: 'growing-stock' },
      { paper: P_PROV, section: 'selection-system' },
      { paper: P_PROV, section: 'manufacturing' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
    ],
    pillars: ['specification', 'containment'],
  },
  {
    slug: 'white-ash-flooring-toronto',
    kind: 'reference',
    title: 'White ash',
    seoTitle: 'White ash hardwood flooring in Toronto — the supply problem nobody mentions',
    question: 'Should I choose white ash flooring in Toronto, given the emerald ash borer?',
    summary:
      'Ash is a hard, pale, beautifully grained floor, and it is the only one of the six species used in this market being cut faster than it grows. That is not a demand story. It is an insect, first detected at Windsor in 2002, and any honest ash specification has to start there.',
    publishedAt: '2026-08-27',
    readingMinutes: 6,
    spec: [
      { label: 'Botanical name', value: 'Fraxinus americana' },
      { label: 'Side hardness, 12% MC', value: '1,320 lbf (USDA Forest Products Laboratory, Wood Handbook Table 5-3b)' },
      { label: 'Ontario range', value: 'Throughout Southern Ontario and north to Lake Nipissing and Sault Ste. Marie (Ontario Tree Atlas)' },
      { label: 'Ontario status', value: 'One of the seven principal tolerant hardwoods named by the Ministry of Natural Resources' },
      { label: 'Ontario growing stock', value: '42,273,003 m³ for ash as a group (Forest Resources of Ontario 2021)' },
      { label: 'US growing stock', value: '4.5% of the US total, 657.8 million m³ (American Hardwood Export Council)' },
      { label: 'US annual growth against harvest', value: '3.3 million m³ grown against 6.9 million m³ harvested per year — the only inversion among the six' },
      { label: 'Principal supply pressure', value: 'Emerald ash borer, first detected near Detroit and Windsor in 2002; up to 99% of ash trees killed within 8 to 10 years of establishment' },
      { label: 'Flooring grades published', value: 'Clear, Select, No. 1 Common, No. 2 Common (NWFA/NOFMA ash rules)' },
    ],
    table: {
      caption: 'Annual growth against annual harvest, US hardwood resource (American Hardwood Export Council)',
      head: ['Species', 'Annual growth', 'Annual harvest'],
      rows: [
        ['Red oak', '60.6 million m³', '31.9 million m³'],
        ['White oak', '40.1 million m³', '20.1 million m³'],
        ['Hard maple', '19.1 million m³', '10.2 million m³'],
        ['Hickory', '14.6 million m³', '6.0 million m³'],
        ['Black walnut', '4.8 million m³', '1.9 million m³'],
        ['White ash', '3.3 million m³', '6.9 million m³'],
      ],
    },
    watchpoints: [
      'Plan the whole floor, including waste and a future repair allowance, in one order. Ash is the species where a reorder two years later is least likely to match, and least likely to be available at all.',
      'Salvage harvesting ahead of an insect changes what reaches the mill. Expect more colour variation batch to batch than in oak, and require the grade in writing rather than trusting a sample board.',
      'Ash is frequently offered as a cheaper alternative to white oak. On hardness that is defensible — 1,320 against 1,360 lbf. On supply security it is not, and the difference should be disclosed before the deposit, not after.',
    ],
    faqs: [
      {
        q: 'Is ash flooring a bad choice because of the emerald ash borer?',
        a: 'Not bad — constrained, and honestly so. Ash performs well as a floor at 1,320 lbf side hardness with an open, expressive grain. What has changed is supply: the American Hardwood Export Council records US white ash growth at 3.3 million cubic metres a year against 6.9 million harvested, the only inversion among the six species used in this market, and the Invasive Species Centre records that up to 99% of ash trees are killed within eight to ten years of the borer establishing. Specify it knowing that, and order the whole job at once.',
      },
      {
        q: 'Will I be able to match my ash floor in five years?',
        a: 'Nobody can promise that, and anyone who does is guessing. The published inventory is contracting rather than growing, and the colour of salvaged material varies. The practical answer is to buy the repair allowance with the original order and store it in the house, acclimated to the same conditions as the floor.',
      },
      {
        q: 'Is ash harder than oak?',
        a: 'It sits between the two oaks. The USDA Forest Products Laboratory publishes white ash at 1,320 lbf side hardness at 12% moisture content, red oak at 1,290 and white oak at 1,360. On hardness alone the three are near-equivalent; the differences that matter in a finished floor are grain, colour and availability.',
      },
    ],
    recommendation: {
      text: 'Ash is a legitimate specification for a client who wants an open, pale grain and is told the supply position before they commit. It is not a specification to make on price alone, and it is not one to phase across two orders.',
      conditions: [
        'Order the entire floor, the waste allowance and a stored repair allowance in a single purchase.',
        'If the project will certainly extend in a later phase, specify a species with a growing inventory instead.',
      ],
    },
    sources: [
      { paper: P_PROV, section: 'ash' },
      { paper: P_PROV, section: 'tolerant-hardwoods' },
      { paper: P_PROV, section: 'growing-stock' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'hickory-flooring-toronto',
    kind: 'reference',
    title: 'Hickory',
    seoTitle: 'Hickory hardwood flooring in Toronto — the hardest floor on the shelf',
    question: 'Is hickory flooring worth it in a Toronto home?',
    summary:
      'Hickory is the hardest species commonly sold as flooring in this market at 1,880 lbf, and the most visually dramatic — the colour range within a single board is the point of it, not a defect. It is also the species where the grading conversation matters most, because "hickory" covers a group rather than one wood.',
    publishedAt: '2026-08-27',
    readingMinutes: 5,
    spec: [
      { label: 'Botanical name', value: 'Carya ovata (shagbark hickory) and related species in the group' },
      { label: 'Side hardness, 12% MC', value: '1,880 lbf for shagbark hickory — the hardest of the six (USDA Forest Products Laboratory, Wood Handbook Table 5-3b)' },
      { label: 'Ontario range', value: 'Southern Ontario, including along the St. Lawrence River and into Quebec (Ontario Tree Atlas)' },
      { label: 'Ontario commercial status', value: 'Not among the seven principal tolerant hardwoods named by the Ministry of Natural Resources, and not a separate line in the 2021 growing-stock table' },
      { label: 'US growing stock', value: '5.1% of the US total, 742.3 million m³ (American Hardwood Export Council)' },
      { label: 'US annual growth against harvest', value: '14.6 million m³ grown against 6.0 million m³ harvested per year' },
      { label: 'Milled in Ontario', value: 'Superior Flooring / Herwynen Sawmill, Rockwood, Ontario, lists hickory among its five species' },
      { label: 'Flooring grades published', value: 'Special Clear, Select, No. 1 Common, No. 2 Common (NWFA/NOFMA hickory-pecan rules)' },
    ],
    watchpoints: [
      'The American Hardwood Export Council declines to publish a single hardness figure for hickory, noting that mechanical properties vary within the group. The 1,880 lbf figure is specifically shagbark. A board sold as "hickory" is not guaranteed to be that species.',
      'Hickory’s colour range within one board — pale sapwood against dark heartwood — is its defining character. Clients who have only seen a single sample board are frequently surprised by the assembled floor. Show a laid-out area, not a plank.',
      'It is hard on tooling and hard on the sanding sequence. A refinishing quote priced as though it were oak is a quote that has not read the species.',
    ],
    faqs: [
      {
        q: 'Is hickory the hardest hardwood flooring?',
        a: 'Among the species commonly installed in the Greater Toronto Area, yes. The USDA Forest Products Laboratory publishes shagbark hickory at 1,880 lbf side hardness at 12% moisture content, against hard maple at 1,450, white oak at 1,360, white ash at 1,320, red oak at 1,290 and black walnut at 1,010. Note that the American Hardwood Export Council publishes no single figure for hickory because properties vary within the group.',
      },
      {
        q: 'Is hickory flooring too busy for a small room?',
        a: 'That is an aesthetic judgement, and it depends on grade rather than species. The NWFA/NOFMA hickory-pecan rules publish a Special Clear grade for a far more uniform face, alongside Select, No. 1 Common and No. 2 Common with progressively more colour contrast. Specify the grade rather than arguing about the species.',
      },
      {
        q: 'Can hickory be sourced in Ontario?',
        a: 'Shagbark hickory grows in Southern Ontario according to the province’s own tree atlas, and Superior Flooring at Rockwood, Ontario lists hickory among the five species it mills. What Ontario does not publish is whether hickory is commercially harvested in the province at any scale — it is not among the seven principal tolerant hardwoods and does not appear as a separate line in the growing-stock inventory. We treat that as evidence of non-prominence, not evidence of zero harvest.',
      },
    ],
    recommendation: {
      text: 'Hickory is the right specification where maximum dent resistance and strong visual character are both wanted — a busy family floor, a rural or transitional interior, a rental that has to survive tenants. It is the wrong specification where a quiet, uniform floor is the goal, unless the Special Clear grade is being bought deliberately.',
      conditions: [
        'View a laid-out area before ordering, never a single board.',
        'Confirm the grade in writing; the character range between Special Clear and No. 2 Common is larger in hickory than in any other species here.',
      ],
    },
    sources: [
      { paper: P_PROV, section: 'tolerant-hardwoods' },
      { paper: P_PROV, section: 'manufacturing' },
      { paper: P_PROV, section: 'not-published' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'black-walnut-flooring-toronto',
    kind: 'reference',
    title: 'Black walnut',
    seoTitle: 'Black walnut hardwood flooring in Toronto — the scarcest floor in the market',
    question: 'Is black walnut flooring a good idea in a Toronto home?',
    summary:
      'Walnut is the softest of the six species used in this market at 1,010 lbf and the scarcest by a wide margin — one percent of the US hardwood growing stock. Both facts are the specification. It is a beautiful floor bought with its limits understood, or an expensive disappointment bought without them.',
    publishedAt: '2026-08-27',
    readingMinutes: 5,
    spec: [
      { label: 'Botanical name', value: 'Juglans nigra' },
      { label: 'Side hardness, 12% MC', value: '1,010 lbf — the softest of the six (USDA Forest Products Laboratory, Wood Handbook Table 5-3b)' },
      { label: 'Ontario range', value: 'Common in moist, low-lying areas in Southwestern Ontario, often planted north and east of its range (Ontario Tree Atlas)' },
      { label: 'Ontario commercial status', value: 'Not among the seven principal tolerant hardwoods; Ontario lists its wood use as high quality furniture and veneer' },
      { label: 'US growing stock', value: '1.0% of the US total, 139.3 million m³ — the scarcest of the six (American Hardwood Export Council)' },
      { label: 'US annual growth against harvest', value: '4.8 million m³ grown against 1.9 million m³ harvested per year' },
      { label: 'Flooring grades published', value: 'Clear, Select, No. 1 Common, No. 2 Common (NWFA/NOFMA black walnut rules); No. 1 Common requires heartwood to be a minimum of 25% of the piece' },
    ],
    watchpoints: [
      'At 1,010 lbf, walnut dents. That is not a defect and it is not a reason to avoid it — it is a reason to be explicit about it before the floor is bought, particularly in a household with dogs, chairs on hard castors or a piano.',
      'Ontario names walnut’s wood use as furniture and veneer, not flooring. The species is present in the province; the flooring supply is a different market, and the volume behind it is one percent of the US growing stock.',
      'Walnut’s heartwood is what people are buying. The NWFA/NOFMA rules set a minimum heartwood proportion only at No. 1 Common and below — at 25% of the piece — so the grade named on the quote materially changes what arrives.',
    ],
    faqs: [
      {
        q: 'Does black walnut flooring dent easily?',
        a: 'More easily than any other species commonly sold here. The USDA Forest Products Laboratory publishes black walnut at 1,010 lbf side hardness at 12% moisture content, against hickory at 1,880 and hard maple at 1,450. It is a floor chosen for its colour and depth, and it should be specified with that trade-off stated out loud.',
      },
      {
        q: 'Why is walnut flooring so expensive?',
        a: 'Scarcity, on the published inventory. The American Hardwood Export Council records black walnut at 1.0% of the US hardwood growing stock — 139.3 million cubic metres against red oak’s 2.62 billion — with an annual harvest of 1.9 million cubic metres. It is the smallest resource of the six by an order of magnitude, and price follows.',
      },
      {
        q: 'Is walnut flooring sustainable?',
        a: 'On the published resource figures, black walnut grows faster than it is cut: 4.8 million cubic metres of annual growth against 1.9 million harvested. Scarcity here is a matter of how little exists, not of overcutting. As with every species, the resource figure says nothing about an individual supply chain — for that, ask who milled it.',
      },
    ],
    recommendation: {
      text: 'Walnut is the correct specification where colour and depth outrank dent resistance and the client has heard the hardness number before choosing. Engineered walnut over a stable core is frequently the better assembly, because the wear layer is the part that has to be walnut.',
      conditions: [
        'State the 1,010 lbf hardness figure in the proposal, in writing, before the deposit.',
        'For a high-traffic household, compare against white oak at 1,360 lbf in the same finish before deciding.',
      ],
    },
    sources: [
      { paper: P_PROV, section: 'tolerant-hardwoods' },
      { paper: P_PROV, section: 'ash' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
    ],
    pillars: ['specification'],
  },

  /* ── colour matching & finish identification ───────────────────────────── */
  {
    slug: 'color-identification-existing-hardwood-finish',
    kind: 'decision',
    title: 'Colour identification of an existing finish',
    seoTitle: 'What finish is on my hardwood floor? Identifying it before any colour match',
    question: 'What finish is actually on my existing hardwood floor, and why does it matter before matching anything to it?',
    summary:
      'Every colour-matching job starts the same way, on site: identifying the species, the stain (if any) and the finish system already on the floor, before a single sample board is mixed. Guessing at this step is the most common reason a "matched" board looks wrong once it is coated.',
    publishedAt: '2026-09-18',
    readingMinutes: 5,
    criteria: [
      {
        name: 'Species and grain first',
        why: 'Colour reads differently on open-grain oak than on closed-grain maple or walnut. Confirming the species is the first check, before any stain or finish is assessed — see the species and undertone guide.',
      },
      {
        name: 'Film finish or penetrating finish',
        why: 'A surface film (polyurethane, either oil- or water-based) sits on top of the wood and can be screened and recoated. A penetrating oil finish (a hardwax oil or a Swedish-style finish) has no film to abrade the same way, and is refreshed differently.',
      },
      {
        name: 'Age and UV exposure',
        why: 'Oil-based finishes amber and continue to amber with age and sunlight; water-based finishes stay close to their original clarity. A floor that reads "warm and honey-toned" today may not be the colour it was installed at — see the ambering watchpoint below.',
      },
      {
        name: 'Where the light falls',
        why: 'The same board reads differently under a south-facing window, under LED pot lights, and in a windowless hallway. Identification happens under the room\'s own lighting, not under a single work light.',
      },
    ],
    decisionTree: [
      'Is there a visible film that can be scraped with a fingernail at a worn edge (a threshold, a stair nosing)? → Film finish: polyurethane or varnish, oil- or water-based.',
      'Does the surface feel like it sits in the wood rather than on it, with no flaking film? → Likely a penetrating oil or hardwax-oil finish.',
      'Is the tone noticeably warmer/more amber than the species\' natural colour, especially compared with an area that has been under a rug? → Oil-based finish, ambered with age and UV.',
      'Does colour and sheen stay consistent between a covered area and an exposed area? → Water-based finish, or a floor young enough that ambering has not shown yet.',
    ],
    faqs: [
      {
        q: 'How can I tell if my hardwood floor has an oil-based or water-based finish?',
        a:
          'Pull back a rug or a piece of furniture that has sat in place for years and compare that protected patch to the exposed floor around it. An oil-based finish will have ambered — gone warmer and more amber — in the exposed area while the protected patch stays close to the original tone. A water-based finish shows much less of that shift. This is a site observation, not a lab test, and it is the first thing we check before proposing any colour match.',
      },
      {
        q: 'Why does it matter what finish is already on my floor before matching new work to it?',
        a:
          'Because the matching stain and finish system have to be compatible with what is there, and because the target colour is not the colour of a fresh sample chip — it is the colour of a floor that has already ambered for years under its finish. Matching to the wrong reference produces a patch that looks correct on day one and wrong within a season, once the new area starts ageing at a different rate than the old one.',
      },
    ],
    recommendation: {
      text: 'Identify species, finish type and approximate age on site before any stain is proposed. This is the first step on every colour-matching job we run, whether the target is a stair, a patch of new hardwood, or a full sand and recoat.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_CLIMATE, section: 'protocol' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'stain-matching-existing-hardwood-floor-toronto',
    kind: 'decision',
    title: 'Stain matching to an existing hardwood floor',
    seoTitle: 'Matching a new stain to an existing hardwood floor in Toronto',
    question: 'How do you match a new stain to an existing hardwood floor that has already aged?',
    summary:
      'A stain sample and an aged floor are two different colours by the time the job happens. Matching them is a process of building a sample against the actual floor, in the actual room, not choosing a can off a shelf.',
    publishedAt: '2026-09-18',
    readingMinutes: 5,
    criteria: [
      {
        name: 'The target is the aged floor, not a factory sample',
        why: 'A stain chip is mixed once and photographed under studio light. The floor it is being matched to has years of UV exposure and wear behind it. The match is built against the real board, in the room.',
      },
      {
        name: 'Species and grain of the new material',
        why: 'The same stain reads differently on white oak than on red oak, and differently again on a tighter or more open grain within the same species — see the species and undertone guide.',
      },
      {
        name: 'Number of coats and sheen level',
        why: 'Sheen changes how a colour is perceived under the same lighting. Matching stain colour without also matching sheen produces two areas that read as different floors even when the pigment is close.',
      },
      {
        name: 'Sign-off in the room, not in the shop',
        why: 'Toronto condo lighting in particular — mixed daylight and LED colour temperatures — can make two genuinely close stains look mismatched or a true match look off. See sample boards, on-site trials and sign-off.',
      },
    ],
    decisionTree: [
      'Confirm the existing finish is identified (see colour identification of an existing finish).',
      'Mix a working sample against a cut-off of the new material, on site.',
      'Apply the sample to a scrap board and place it directly against the existing floor, under the room\'s actual light.',
      'Adjust and re-test before committing to the full area — never mix once and commit.',
      'Sign off in daylight and again under the room\'s evening lighting before finish coats begin.',
    ],
    faqs: [
      {
        q: 'Can you match a new stain exactly to my existing hardwood floor?',
        a:
          'Close enough that the transition reads as one floor, in the light the room actually has — that is the honest target, and it is what a sample-board process is for. An exact chemical match is not realistic, because the existing floor has aged under its finish for years and a fresh stain has not. What we commit to is a match confirmed on your floor, under your lighting, before any coats are applied to the real area.',
      },
      {
        q: 'Why does the same stain look different in different rooms?',
        a:
          'Light temperature changes how pigment reads. A stain that looks correct under daylight from a window can look warmer or cooler under LED pot lights, which is common in renovated Toronto condos. That is why sample boards are checked in the actual room and, where practical, at more than one time of day, rather than approved once under a single light source.',
      },
    ],
    recommendation: {
      text: 'Build the match against the real, aged floor with a sample board tested in the room\'s own lighting, and get sign-off before any finish coat goes on the full area. A shop-mixed sample approved off site is the most common reason a match fails at handover.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_COST, section: 'species' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'matching-new-hardwood-to-old-toronto',
    kind: 'decision',
    title: 'Matching new hardwood to old',
    seoTitle: 'Matching new hardwood to an existing floor — patch, extension or room-to-room',
    question: 'How do you match new hardwood boards into an existing floor for a patch, an extension, or a room-to-room transition?',
    summary:
      'A patch, a room addition and a whole-floor extension are three different problems that all start with the same question: is the existing floor still made, and if not, what is the closest honest substitute.',
    publishedAt: '2026-09-18',
    readingMinutes: 5,
    criteria: [
      {
        name: 'Species and board width',
        why: 'The new material has to match the existing species and dimension — see solid vs engineered and the dimensional definitions in the grading standard (strip, plank, wide plank are defined widths, not marketing terms).',
      },
      {
        name: 'Grain direction and pattern',
        why: 'A patch laid against the grain, or a herringbone field extended without re-establishing the centreline, reads as wrong even in an identical stain.',
      },
      {
        name: 'How much the existing floor has aged',
        why: 'New boards are the colour of new wood. The existing floor has ambered under its finish for years. The stain match accounts for that gap — see stain matching to an existing floor — and in some cases a wider blending zone is the only honest way to hide the seam.',
      },
      {
        name: 'Whether a full sand of the transition zone is required',
        why: 'Feathering new boards into old under a single sanding and finishing pass, across the whole affected area, is what actually hides the seam. Finishing only the new boards and butting them to the old finish is the most common cause of a visible line.',
      },
    ],
    decisionTree: [
      'Is the existing product (species, width, construction) still available? → Order it and proceed to a stain match.',
      'Is it discontinued? → Source the closest species/width match and disclose the substitution before ordering — do not silently substitute.',
      'Is the transition a single room-to-room threshold? → A transition strip is often the honest answer rather than a forced match.',
      'Is the transition mid-field (a patch, an extension into the same room)? → Feather and blend the sanding and finishing pass across old and new together, not board-by-board.',
    ],
    watchpoints: [
      'Grain direction is checked before boards are cut, not after they are down.',
      'A patch finished on its own and butted to the existing finish is visible from across the room, even in a perfect stain match.',
      'A discontinued product is a real constraint. The honest options are a close substitute, disclosed, or a transition detail — not a claim that an unavailable product was matched.',
    ],
    faqs: [
      {
        q: 'Can you match new hardwood flooring to an existing floor that is no longer made?',
        a:
          'Sometimes exactly, if the mill still runs that species, width and construction. When it does not, the honest options are the closest available substitute — disclosed as a substitute, not sold as an exact match — or a deliberate transition detail at the boundary, such as a threshold or a change of direction, rather than forcing a seam that will read as wrong under close light.',
      },
      {
        q: 'Do you have to sand the whole room to blend new hardwood into old?',
        a:
          'Usually the transition zone, not necessarily the whole room. New boards feathered and finished separately from the existing floor almost always show a line at the seam, because sanding sequence and finish coats build up slightly differently board to board. Sanding and finishing the old and new material together across the affected zone, in one pass, is what actually removes the seam.',
      },
    ],
    recommendation: {
      text: 'Confirm the existing product is available before committing to an exact match; disclose any substitution. Feather and finish the transition zone in one pass rather than butting a separately finished patch against the old floor.',
    },
    sources: [
      { paper: P_GRADE, section: 'dimensions' },
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_CLIMATE, section: 'solid-vs-engineered' },
    ],
    pillars: ['specification', 'movement'],
  },
  {
    slug: 'stair-railing-trim-color-matching-toronto',
    kind: 'reference',
    title: 'Stair, railing and trim colour matching',
    seoTitle: 'Matching stairs, railings and trim to your hardwood floor in Toronto',
    question: 'How do stairs, railings and trim get colour-matched to a hardwood floor?',
    summary:
      'Stairs, railings and trim are usually a different wood species, a different grain orientation, and a different wear pattern than the floor they sit beside. Matching them is a separate discipline from matching two floor boards, not a smaller version of it.',
    publishedAt: '2026-09-18',
    readingMinutes: 5,
    spec: [
      { label: 'Scope', value: 'Stair treads, risers, stringers, handrails, newel posts and balusters, matched or coordinated to the adjoining floor' },
      { label: 'Why it differs from a floor match', value: 'Treads and railings are frequently a harder species (oak, maple) regardless of the field floor species, and railings are often a different wood entirely (e.g. a stained hardwood rail over a painted spindle)' },
      { label: 'Wear pattern', value: 'A stair tread wears and is touched far more than a floor board; a railing is handled constantly. Both age and colour-shift faster than the surrounding floor' },
      { label: 'Sequence', value: 'Colour-identify the floor first (see colour identification of an existing finish), then build the stain sample against a cut-off of the actual stair or rail species' },
    ],
    sequence: [
      'Identify the floor\'s existing finish and stain.',
      'Confirm the species of the stair treads, stringers and railing — often not the same species as the field floor.',
      'Build a stain sample on a cut-off of the stair/rail material, checked against the floor at the top and bottom of the stair run.',
      'Refinish stairs and railings using the machine sequence appropriate to their much smaller, more detailed surfaces — hand and detail work carries more of the job than on an open floor.',
      'Sign off the match at the stair itself, in its own lighting, not against a sample carried from another room.',
    ],
    watchpoints: [
      'A rail and a tread are touched constantly and will show wear and colour change faster than the floor. A match signed off on day one can visibly diverge within a year or two if the finish system is not suited to high-touch surfaces.',
      'Painted balusters against a stained rail and stringer is a common, legitimate combination — the colour match applies only to the stained wood elements, not to painted trim.',
      'Stairs are priced and scoped as their own line, not as a square-footage extension of the floor — see how to evaluate a hardwood quote.',
    ],
    faqs: [
      {
        q: 'Do my stairs have to be the exact same wood as my hardwood floor?',
        a:
          'No. Stair treads and railings are very often a different, harder species than the field floor regardless of what the floor is, because stairs take a different kind of wear. What matters is that the finished colour reads as coordinated with the floor at the top and bottom of the run, which is a stain-matching exercise, not a requirement that the wood itself be identical.',
      },
      {
        q: 'Why do my stairs look a different colour than my floor even though they were "matched"?',
        a:
          'Stairs and railings are handled constantly and typically wear and colour-shift faster than an open floor under the same finish. A match that was correct at handover can visibly diverge over time for that reason. It is also common for the stair species to differ from the floor species, which changes how the same stain reads even when it is applied correctly.',
      },
    ],
    recommendation: {
      text: 'Treat stair and railing colour matching as its own step: confirm species, build the sample against the actual stair material, and sign off at the stair. Francisco Oller, owner of Ecowoods Inc. and its lead craftsman, leads this work on our jobs.',
    },
    sources: [
      { paper: P_CRAFT, section: 'edger' },
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_COST, section: 'installer-checklist' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'door-woodwork-finish-coordination-toronto',
    kind: 'reference',
    title: 'Door and interior woodwork finish coordination',
    seoTitle: 'Coordinating doors and interior woodwork finish with your hardwood floor',
    question: 'How do interior doors and woodwork get their finish coordinated with a hardwood floor?',
    summary:
      'A door slab, a door frame and interior trim are usually painted or finished separately from the floor, and often in a different material entirely (MDF, poplar, or a painted softwood). Coordinating them with a hardwood floor is about the finish reading as intentional together, not about matching wood to wood.',
    publishedAt: '2026-09-18',
    readingMinutes: 4,
    criteria: [
      {
        name: 'Painted trim vs a stained hardwood element',
        why: 'Most interior doors, frames and baseboards in Toronto homes are painted MDF or softwood, not stained hardwood. Coordination here means choosing an undertone (warm vs cool, the paint\'s own undertone) that sits well against the floor\'s stain — it is a colour-harmony decision, not a wood-species match.',
      },
      {
        name: 'A genuinely stained wood door or trim element',
        why: 'Where trim or a door is real hardwood and stained rather than painted, the same stain-matching process used for a floor patch applies — build the sample against the actual trim material, in the room.',
      },
      {
        name: 'Where the two meet',
        why: 'A stair nosing, a threshold, or a baseboard sitting directly on the floor is the point where a mismatch is most visible, because the two surfaces are seen together in the same glance.',
      },
    ],
    decisionTree: [
      'Is the door/trim painted? → Coordinate paint undertone to the floor\'s stain; this is a colour-harmony choice, not a wood match.',
      'Is the door/trim stained hardwood? → Build a stain sample against the actual trim material, following the same process as a floor stain match.',
      'Does the trim sit directly against the floor (baseboard, nosing, threshold)? → Prioritise the match at that contact line above anywhere else in the room.',
    ],
    faqs: [
      {
        q: 'Do interior doors need to be the same wood as the hardwood floor?',
        a:
          'No, and in most Toronto homes they are not — interior doors, frames and trim are commonly painted MDF or softwood rather than the floor\'s hardwood species. Coordination there is about choosing a paint undertone that sits well beside the floor\'s stain, which is a colour-harmony decision rather than a wood-matching one.',
      },
      {
        q: 'What if my trim is real stained wood, not painted?',
        a:
          'Then it is matched the same way a floor patch is matched: identify the existing finish, build a stain sample against a cut-off of the actual trim material, and sign off in the room\'s own light before committing to the full run.',
      },
    ],
    recommendation: {
      text: 'Treat painted trim as a colour-harmony decision against the floor\'s stain, and treat genuinely stained wood trim as its own stain-matching job using the same process as a floor patch. Prioritise the contact line — baseboards, nosings, thresholds — where floor and trim are seen together.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_COST, section: 'species' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'when-color-match-fails-full-sand-vs-replace',
    kind: 'decision',
    title: 'When colour match fails: full sand and refinish vs replace',
    seoTitle: 'When a colour match fails: full sand and refinish, or replace the floor?',
    question: 'What happens when a hardwood colour match cannot be made to work — do you refinish the whole floor, or replace it?',
    summary:
      'A spot match sometimes cannot be made to disappear — the existing finish is too worn, too ambered, or too far gone for a patch to blend. This guide sets out how that decision actually gets made, and what each path costs against the published bands.',
    publishedAt: '2026-09-18',
    readingMinutes: 5,
    criteria: [
      {
        name: 'How much wear layer remains',
        why: 'A full sand and refinish is only possible while there is wood left above the tongue to remove. If the wear layer is spent, refinishing is not an option regardless of how the colour problem is framed — see refinish or replace in the refinishing reference guide.',
      },
      {
        name: 'How large the mismatched area is',
        why: 'A single board or a small patch is usually still worth a targeted feather-and-blend attempt. A mismatch spanning a large area of a room is usually more honestly solved by a full sand of that room.',
      },
      {
        name: 'Whether the finish is worn as well as mismatched',
        why: 'If the existing finish is also due for renewal on its own schedule, a full sand and finish addresses both problems in one job rather than solving colour and leaving wear unaddressed.',
      },
    ],
    table: {
      caption: 'Cost path by scope, published installed ranges',
      head: ['Path', 'Typical range', 'What it solves'],
      rows: [
        ['Spot match / feather-blend', bandBare(SCREEN_RECOAT), 'A small mismatched area, existing finish still sound'],
        ['Full sand & finish (affected room)', bandBare(FULL_SAND_FINISH), 'Colour mismatch across a larger area, or finish also due for renewal'],
        ['Replace (new hardwood install)', bandBare(NEW_INSTALL), 'Wear layer spent, boards damaged beyond sanding, or product discontinued with no honest substitute'],
      ],
    },
    decisionTree: [
      'Is the mismatch small and the existing finish still sound? → Attempt a feathered spot match first.',
      'Does the spot match fail to blend under the room\'s actual lighting? → Full sand and finish of the affected room.',
      'Is there wear layer left to remove? → Full sand and finish remains available.',
      'Is the wear layer spent, or the boards damaged beyond what sanding can correct? → Replacement, priced as new install.',
    ],
    faqs: [
      {
        q: 'Why did the colour match on my floor patch not work?',
        a:
          'The most common reasons are an existing finish that has ambered more than the sample accounted for, a mismatch large enough that even a close stain reads as a distinct patch under the room\'s light, or a species/grain difference that was not caught before the new boards went down. When a spot match does not blend, the honest next step is usually a full sand and finish of the affected room rather than a second attempt at the same patch.',
      },
      {
        q: 'How do I know if I should refinish my whole floor instead of just fixing a patch?',
        a:
          'Once a patch has failed to blend, or the existing finish is worn enough that it was due for renewal anyway, a full sand and finish of the room solves both problems in one pass instead of layering a second repair on top of the first. Replacement only enters the conversation when the wear layer is spent or the boards are damaged beyond what sanding corrects — that is a different guide.',
      },
    ],
    recommendation: {
      text: 'Try a feathered spot match first where the existing finish is sound and the area is small. Move to a full sand and finish of the room once a spot match fails to blend, or once the existing finish is due for renewal regardless. Reserve replacement for a spent wear layer or damage sanding cannot correct.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_COST, section: 'installed-cost' },
      { paper: P_GRADE, section: 'engineered' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'sample-boards-on-site-trials-sign-off',
    kind: 'decision',
    title: 'Sample boards, on-site trials, and sign-off before coats',
    seoTitle: 'Sample boards and sign-off before staining — the process, and why Toronto condo lighting matters',
    question: 'Why does a colour match get tested with a sample board on site, and what does sign-off actually involve?',
    summary:
      'A stain is approved on the actual floor, in the actual room, before it is committed to the full area — not on a shop sample under a single light. This guide sets out why that step exists and what condo lighting specifically does to a colour decision.',
    publishedAt: '2026-09-18',
    readingMinutes: 4,
    criteria: [
      {
        name: 'The sample is built on the real material',
        why: 'A cut-off of the actual species and board — not a generic species sample — is what gets stained and checked, because grain and porosity vary board to board within a species.',
      },
      {
        name: 'The sample is placed against the target, in the room',
        why: 'A sample carried from room to room, or approved in a workshop, is being judged under different light than the floor it needs to match.',
      },
      {
        name: 'Toronto condo lighting specifically',
        why: 'Many renovated GTA condos mix daylight with LED pot lighting at a cooler colour temperature than older incandescent fixtures. A stain that reads correctly under daylight from a window wall can shift under that lighting, and vice versa.',
      },
      {
        name: 'Sign-off happens before finish coats, not after',
        why: 'The stain colour is confirmed and approved before the finish system is applied on top of it, because finish coats (especially oil-based systems) themselves shift colour and cannot be un-applied.',
      },
    ],
    sequence: [
      'Identify the existing finish and target colour on site.',
      'Cut a sample from the actual material being installed or refinished.',
      'Apply the candidate stain and place the sample against the existing floor, in the room.',
      'Check under the room\'s daylight and, where the room has both, its evening/artificial lighting.',
      'Adjust the mix if needed and repeat before any commitment to the full area.',
      'Sign off in writing before finish coats begin.',
    ],
    watchpoints: [
      'A sample approved under a single work light and not checked against the room\'s own lighting is the most common avoidable cause of a mismatch discovered after the coats are on.',
      'Oil-based finish coats amber the stain underneath as they are applied and continue to amber afterward — sign-off accounts for that expected shift, it does not chase a colour that will not hold.',
      'A rushed schedule that skips the on-site trial step is trading a documented sign-off for a guess.',
    ],
    faqs: [
      {
        q: 'Why do I need to approve a sample board before my floor is stained?',
        a:
          'Because the sample confirms the stain against the actual material and the actual room\'s lighting before the decision is irreversible. A colour that looks right on a generic chip, or in a different room, is not confirmation — species, grain and light all change how a stain reads, which is why the check happens on site, on your material, before any coats go on.',
      },
      {
        q: 'Why does my floor colour look different in different rooms of my condo?',
        a:
          'Toronto condos frequently mix daylight through large windows with LED pot lighting at a different colour temperature, and the two can make the same stain read warmer or cooler depending on which light dominates in a given room. That is exactly why sign-off happens in the room the work is actually being done in, checked under more than one light where the room has more than one.',
      },
    ],
    recommendation: {
      text: 'Never approve a stain match off a sample viewed outside the actual room. Check it under the room\'s own daylight and artificial light, sign off in writing, and only then move to finish coats.',
    },
    sources: [
      { paper: P_CRAFT, section: 'sequence' },
      { paper: P_CLIMATE, section: 'protocol' },
    ],
    pillars: ['specification'],
  },
  {
    slug: 'species-undertone-guide-color-matching-toronto',
    kind: 'reference',
    title: 'Species and undertone guide for colour matching',
    seoTitle: 'Hardwood species undertone guide for colour matching in Toronto',
    question: 'How does hardwood species change what a colour match actually looks like?',
    summary:
      'Oak, maple, walnut, hickory and ash do not take the same stain the same way, because grain, porosity and natural colour differ by species. This guide reuses the published species facts from our species dossiers — it does not invent hardness numbers or grading claims beyond what those dossiers already state.',
    publishedAt: '2026-09-18',
    readingMinutes: 6,
    table: {
      caption: 'Species colour and grain character, as published in the species dossiers',
      head: ['Species', 'Natural character relevant to colour matching'],
      rows: [
        ['White oak', 'Even stain uptake; the default for grey, smoked and modern transparent finishes — see white oak flooring in Toronto'],
        ['Red oak', 'More pronounced open grain under stain; the common heritage match for existing Toronto floors — see red oak'],
        ['Hard maple', 'Closed-grain and pale; dense wood that resists penetration and can blotch without conditioning — see hard maple'],
        ['White ash', 'Open, expressive grain, similar hardness range to the oaks — see white ash'],
        ['Hickory', 'Wide natural colour range within a single board (pale sapwood against dark heartwood) — its defining character, not a defect — see hickory'],
        ['Black walnut', 'Naturally deep brown heartwood; the softest of the species commonly sold here — see black walnut'],
      ],
    },
    criteria: [
      {
        name: 'Open grain vs closed grain',
        why: 'Open-grain species (oak, ash, hickory) take stain differently than closed-grain species (maple), which is why the same stain can look correct on one and blotchy on the other.',
      },
      {
        name: 'Natural colour before any stain',
        why: 'Walnut starts dark; maple starts pale; the two oaks and ash sit in a similar mid-range naturally. Matching new material to old starts from the species\' own colour, not only the stain on top of it.',
      },
      {
        name: 'Whether the existing floor is even still identifiable by species',
        why: 'Confirm the species of the existing floor before assuming a stain alone explains its colour — see colour identification of an existing finish.',
      },
    ],
    recommendation: {
      text: 'Start a colour match from the species\' own natural character, not only from a stain chip. If the existing floor\'s species is uncertain, confirm it before proposing a match — a stain cannot make one species behave like another.',
      conditions: [
        'Reuse the published dossiers on each species for grain and colour character rather than re-deriving figures.',
        'No hardness (Janka) figure or grade claim is used here beyond what each species dossier already publishes.',
      ],
    },
    sources: [
      { paper: P_COST, section: 'species' },
      { paper: P_GRADE, section: 'nwfa-appearance' },
      { paper: P_PROV, section: 'growing-stock' },
    ],
    pillars: ['specification'],
  },
];

export const getGuides = (kind?: GuideKind): Guide[] =>
  kind ? GUIDES.filter((g) => g.kind === kind) : GUIDES;

export const getGuide = (slug: string): Guide | undefined => GUIDES.find((g) => g.slug === slug);

export const guidesForPillar = (pillarId: string): Guide[] =>
  GUIDES.filter((g) => g.pillars?.includes(pillarId));
