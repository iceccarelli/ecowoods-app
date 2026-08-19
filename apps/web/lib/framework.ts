/**
 * The EcoWoods Well-Installed Framework — the manifest.
 *
 * WHY THIS EXISTS
 *
 * A whitepaper persuades one reader at a time. A framework changes the terms of
 * every comparison in the market at once. AWS did not win architectural
 * mindshare by writing better documentation than anyone else — it published the
 * Well-Architected Framework, a named and versioned set of pillars with a
 * question set per pillar, and competitors now describe their own systems in
 * that vocabulary. Publishing the standard is different in kind from
 * participating in the comparison.
 *
 * This is the hardwood equivalent: six pillars, twenty-four binary questions,
 * and a self-assessment at /framework/assess that scores ANY contractor's quote
 * — not only ours.
 *
 * CONTENT RULE — READ BEFORE EDITING
 *
 * Nothing in this file is new. Every criterion is drawn from a section of a
 * paper already published at /papers, and carries a `source` naming the paper
 * slug and the section id it came from. scripts/verify-framework.mjs resolves
 * every one of those references against lib/papers.ts and FAILS THE BUILD if a
 * criterion cites a paper or a section that does not exist.
 *
 * That guard is the point. A framework that quietly accumulates unsourced
 * assertions is worth less than no framework at all: it is exactly the kind of
 * document a competitor attacks, and exactly the kind an answer engine learns
 * to discount. If a criterion belongs in the framework and no paper supports it
 * yet, the paper is written first.
 *
 * VERSIONING
 *
 * The version is part of the public contract. Anyone may cite
 * "Well-Installed Framework v1.0, pillar 2, criterion 2.3" and have that mean
 * one fixed thing forever. Adding, removing or rewording a criterion is a minor
 * version bump; changing what a pillar means is a major one. Never edit a
 * criterion in place without moving the version.
 */

export type Severity = 'critical' | 'major' | 'advisory';

export type FrameworkCriterion = {
  /** Stable public id, e.g. "2.3". Cited externally — never renumber in place. */
  id: string;
  /** The question, phrased so a homeowner can ask it of any contractor. */
  question: string;
  /** What physically or commercially fails when the answer is no. */
  risk: string;
  severity: Severity;
  /** Provenance. Verified against lib/papers.ts by scripts/verify-framework.mjs. */
  source: { paper: string; section: string };
};

export type FrameworkPillar = {
  id: string;
  number: number;
  name: string;
  /** One sentence: what this pillar is protecting against. */
  intent: string;
  criteria: FrameworkCriterion[];
};

export const FRAMEWORK_VERSION = '1.0';
export const FRAMEWORK_PUBLISHED_AT = '2026-08-19';
export const FRAMEWORK_NAME = 'The EcoWoods Well-Installed Framework';

const P_CLIMATE = 'toronto-hardwood-climate-moisture-protocol';
const P_COST = 'hardwood-selection-and-cost-framework-gta';
const P_CRAFT = 'hardwood-refinishing-machines-and-sequence';

export const PILLARS: FrameworkPillar[] = [
  {
    id: 'moisture',
    number: 1,
    name: 'Moisture and acclimation',
    intent:
      'Wood exchanges moisture with the air continuously and moves as it does. This pillar establishes that the movement was measured and planned for before anything was fastened down.',
    criteria: [
      {
        id: '1.1',
        question: 'Was the subfloor moisture content measured, and were the readings written down?',
        risk: 'A floor installed over a wet subfloor will cup, crown, gap or buckle. No warranty language overrides physics.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'moisture-testing' },
      },
      {
        id: '1.2',
        question: 'Was the flooring material itself moisture-tested, separately from the subfloor?',
        risk: 'Every board arrives with its own moisture history. Testing only the subfloor measures half the system.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'moisture-testing' },
      },
      {
        id: '1.3',
        question:
          "Do both readings sit inside the manufacturer's stated acceptable difference between material and subfloor?",
        risk: 'A large moisture differential guarantees dimensional change after installation, regardless of how well the floor was laid.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'moisture-testing' },
      },
      {
        id: '1.4',
        question:
          'Was testing performed twice — at the estimate, and again immediately before installation begins?',
        risk: 'Conditions change between quoting and installation. A single reading months earlier describes a building that no longer exists.',
        severity: 'major',
        source: { paper: P_CLIMATE, section: 'moisture-testing' },
      },
      {
        id: '1.5',
        question:
          'Will the material acclimate for a minimum of 72 hours in the actual conditioned space where it will be installed?',
        risk: 'Acclimating in a garage, a hallway or an unheated room conditions the wood to the wrong environment.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'protocol' },
      },
    ],
  },
  {
    id: 'substrate',
    number: 2,
    name: 'Substrate and method',
    intent:
      'Installation method is determined by what the floor is going onto, not by preference, habit or price. This pillar establishes that the substrate decided the method.',
    criteria: [
      {
        id: '2.1',
        question: 'Was the substrate identified explicitly — plywood over joists, concrete slab, or radiant?',
        risk: 'Every downstream decision depends on this answer. A method chosen before the substrate is known is a guess.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'method-and-substrate' },
      },
      {
        id: '2.2',
        question: 'Does the proposed method match the substrate — nail-down on plywood, glue-down on concrete, floating over radiant or where acoustic separation is required?',
        risk: 'Method mismatched to substrate is the failure that cannot be corrected later without lifting the floor.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'method-and-substrate' },
      },
      {
        id: '2.3',
        question: 'Was the substrate assessed for flatness and condition before the price was fixed?',
        risk: 'Substrate correction discovered mid-job is the single most common source of change orders on a hardwood project.',
        severity: 'major',
        source: { paper: P_COST, section: 'fixed-price' },
      },
      {
        id: '2.4',
        question:
          'If the substrate is concrete, a condominium slab, or radiant heat, was engineered construction specified rather than solid?',
        risk: 'Solid hardwood over concrete or radiant has no cross-ply core to resist seasonal movement. The construction is what provides the stability.',
        severity: 'critical',
        source: { paper: P_COST, section: 'decision-tree' },
      },
    ],
  },
  {
    id: 'specification',
    number: 3,
    name: 'Product specification',
    intent:
      'The correct product is the one that will still look and perform correctly in twenty years. This pillar establishes that the house specified the floor, not the budget.',
    criteria: [
      {
        id: '3.1',
        question:
          'Was the solid-versus-engineered decision explained in terms of the substrate and the climate load, rather than price or preference?',
        risk: 'A product sold on margin instead of specified on physics is a failure with a delay built in.',
        severity: 'critical',
        source: { paper: P_COST, section: 'decision-tree' },
      },
      {
        id: '3.2',
        question:
          'Was species hardness discussed against the actual traffic and household this floor will carry?',
        risk: 'Species selection made on appearance alone produces a floor that looks correct on handover and wears wrong within a few years.',
        severity: 'major',
        source: { paper: P_COST, section: 'species' },
      },
      {
        id: '3.3',
        question:
          'If the home sees large seasonal humidity swings, was that raised as a reason to prefer engineered construction?',
        risk: 'Toronto indoor RH runs from below 25% in winter to above 60% in summer. A product specified without reference to that range was specified for a different city.',
        severity: 'major',
        source: { paper: P_CLIMATE, section: 'climate-reality' },
      },
      {
        id: '3.4',
        question: 'Was the finish system named specifically, rather than described only as "polyurethane"?',
        risk: 'Finish system determines cure time, recoat interval and how the floor is maintained for its whole life. An unnamed system cannot be maintained correctly.',
        severity: 'advisory',
        source: { paper: P_CRAFT, section: 'sequence' },
      },
    ],
  },
  {
    id: 'movement',
    number: 4,
    name: 'Expansion and movement',
    intent:
      'The question is never whether a floor will move. This pillar establishes that room for the movement was designed in rather than discovered later.',
    criteria: [
      {
        id: '4.1',
        question:
          'Are expansion gaps specified at every wall and every fixed object — not only at the perimeter?',
        risk: 'A floor with nowhere to expand will buckle or tent. Fixed objects mid-field are where this is most often missed.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'protocol' },
      },
      {
        id: '4.2',
        question:
          'Was the safe indoor humidity band the floor needs to live in — and who is responsible for maintaining it — stated in writing?',
        risk: 'A floor handed over without a stated operating range has no defensible warranty boundary, in either direction.',
        severity: 'major',
        source: { paper: P_CLIMATE, section: 'climate-reality' },
      },
      {
        id: '4.3',
        question:
          'Were the specific failure modes — cupping, crowning, seasonal gapping, buckling, edge peaking — named and explained rather than dismissed?',
        risk: 'A contractor who will not name the failure modes either does not know them or does not intend to be accountable for them.',
        severity: 'advisory',
        source: { paper: P_CLIMATE, section: 'failure-modes' },
      },
    ],
  },
  {
    id: 'containment',
    number: 5,
    name: 'Dust containment and sequence',
    intent:
      'Sanding and finishing is a sequence of machines, each of which does something the others cannot. This pillar establishes that the sequence was complete and the dust was contained.',
    criteria: [
      {
        id: '5.1',
        question: 'Is HEPA dust containment used throughout the process, not only at final cleanup?',
        risk: 'Dust generated during sanding is respirable and travels through the whole building. Cleanup afterwards addresses what settled, not what was breathed.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'protocol' },
      },
      {
        id: '5.2',
        question:
          'Does the plan include an edger on every perimeter and detail, with grits matching the field?',
        risk: 'A big machine cannot reach a perimeter. Skipping or under-gritting the edger leaves a visible halo around every room that only shows once the finish goes on.',
        severity: 'major',
        source: { paper: P_CRAFT, section: 'edger' },
      },
      {
        id: '5.3',
        question: 'Is a planetary or multi-disc pass included to blend the field into the edges?',
        risk: 'Without a blending pass, the boundary between what the belt sander reached and what the edger reached stays visible for the life of the floor.',
        severity: 'major',
        source: { paper: P_CRAFT, section: 'planetary' },
      },
      {
        id: '5.4',
        question: 'Is intercoat screening between finish coats part of the quoted scope?',
        risk: 'Skipping intercoat screening is invisible on handover day and produces an uneven surface and weaker coat adhesion.',
        severity: 'major',
        source: { paper: P_CRAFT, section: 'sequence' },
      },
      {
        id: '5.5',
        question:
          'Was a cure period stated — distinct from "dry to walk on" — with what may and may not go back on the floor during it?',
        risk: 'Furniture and rugs returned to an uncured finish mark it permanently. Dry and cured are different dates.',
        severity: 'major',
        source: { paper: P_CRAFT, section: 'sequence' },
      },
    ],
  },
  {
    id: 'accountability',
    number: 6,
    name: 'Commercial accountability',
    intent:
      'Every pillar above is only as good as the contract behind it. This pillar establishes that someone is accountable in writing when the floor is five years old.',
    criteria: [
      {
        id: '6.1',
        question:
          'Is the price fixed in writing, with no open-ended "unforeseen conditions" change-order language?',
        risk: 'An open-ended price transfers the cost of the contractor\'s missing due diligence onto the homeowner, after the deposit.',
        severity: 'critical',
        source: { paper: P_COST, section: 'fixed-price' },
      },
      {
        id: '6.2',
        question: 'Will the work be performed by salaried employees rather than day-labour subcontractors?',
        risk: 'A crew that will not be there next season has no stake in how the floor performs next season.',
        severity: 'major',
        source: { paper: P_COST, section: 'installer-checklist' },
      },
      {
        id: '6.3',
        question: 'Is there true lifetime workmanship warranty language in the contract itself?',
        risk: 'A warranty described in conversation and absent from the contract is not a warranty.',
        severity: 'critical',
        source: { paper: P_COST, section: 'installer-checklist' },
      },
      {
        id: '6.4',
        question:
          'Would they refuse the job if the substrate or the conditions were wrong — and have they said so plainly?',
        risk: 'A contractor who will install over any condition is quoting on volume. The willingness to walk away is the only real evidence of a standard.',
        severity: 'critical',
        source: { paper: P_CLIMATE, section: 'what-to-demand' },
      },
      {
        id: '6.5',
        question: 'Were the written moisture readings provided before any deposit was requested?',
        risk: 'Testing after the deposit inverts the incentive: the finding can no longer change the decision.',
        severity: 'major',
        source: { paper: P_CLIMATE, section: 'what-to-demand' },
      },
      {
        id: '6.6',
        question:
          'Are manufacturer warranties passed through in writing, naming the manufacturer and the product?',
        risk: 'A manufacturer warranty that is never registered or documented cannot be claimed against years later.',
        severity: 'advisory',
        source: { paper: P_COST, section: 'installer-checklist' },
      },
    ],
  },
];

/* ── derived helpers ──────────────────────────────────────────────────────── */

export const allCriteria = (): FrameworkCriterion[] => PILLARS.flatMap((p) => p.criteria);

export const criterionCount = () => allCriteria().length;

export const severityCount = (s: Severity) => allCriteria().filter((c) => c.severity === s).length;

export const pillarById = (id: string) => PILLARS.find((p) => p.id === id);

/**
 * Resolve a criterion's citation to the paper URL.
 *
 * This deliberately does NOT check that the paper exists at runtime, and that
 * is a correctness improvement rather than a shortcut. It used to import
 * getPaper() from ./papers and return null for a missing paper — which broke
 * the production build, because lib/papers.ts reaches for node:fs to decide
 * whether a PDF has been published, and this module is imported by
 * AssessClient.tsx, which is a client component. Webpack followed
 * AssessClient -> framework -> papers -> node:fs and failed. See F-80.
 *
 * The check was redundant anyway. scripts/verify-framework.mjs resolves every
 * citation in this file against lib/papers.ts and fails the build when one does
 * not exist, which is strictly stronger: a broken citation stops the deploy
 * instead of silently rendering as a missing link nobody notices.
 */
export const sourceHref = (c: FrameworkCriterion): string =>
  `/papers/${c.source.paper}#${c.source.section}`;

/**
 * Scoring. Deliberately simple and deliberately harsh on the criticals: a floor
 * is not "83% installed correctly". Any single critical answered "no" means the
 * quote has an unresolved defect, and the verdict says so regardless of the
 * total.
 */
export type Answer = 'yes' | 'no' | 'unsure';

export const WEIGHT: Record<Severity, number> = { critical: 3, major: 2, advisory: 1 };

export function score(answers: Record<string, Answer>) {
  const criteria = allCriteria();
  let earned = 0;
  let possible = 0;
  const failedCritical: FrameworkCriterion[] = [];
  const unanswered: FrameworkCriterion[] = [];

  for (const c of criteria) {
    const w = WEIGHT[c.severity];
    possible += w;
    const a = answers[c.id];
    if (a === 'yes') earned += w;
    else if (a === 'no' && c.severity === 'critical') failedCritical.push(c);
    else if (a === undefined) unanswered.push(c);
    // "unsure" earns nothing and is not a failure — it is a question to go back and ask.
  }

  const pct = possible === 0 ? 0 : Math.round((earned / possible) * 100);
  const verdict: 'incomplete' | 'defect' | 'weak' | 'sound' | 'strong' =
    unanswered.length > criteria.length / 2
      ? 'incomplete'
      : failedCritical.length > 0
        ? 'defect'
        : pct >= 90
          ? 'strong'
          : pct >= 70
            ? 'sound'
            : 'weak';

  return { earned, possible, pct, failedCritical, unanswered, verdict };
}

export function pillarScore(pillar: FrameworkPillar, answers: Record<string, Answer>) {
  let earned = 0;
  let possible = 0;
  for (const c of pillar.criteria) {
    const w = WEIGHT[c.severity];
    possible += w;
    if (answers[c.id] === 'yes') earned += w;
  }
  return { earned, possible, pct: possible === 0 ? 0 : Math.round((earned / possible) * 100) };
}
