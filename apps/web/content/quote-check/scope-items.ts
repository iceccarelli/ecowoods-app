/**
 * content/quote-check/scope-items.ts — the line items that decide whether two
 * hardwood quotes are the same job.
 *
 * WHY THIS FILE CONTAINS NO OPINIONS AND NO PRICES
 *
 * A homeowner holding three quotes is not confused about which number is
 * smallest. They are confused because the three numbers describe three
 * different jobs and nothing on the page says so. $8.50/sq ft that includes
 * subfloor preparation, disposal of the existing floor and four coats is not a
 * higher price than $6.20/sq ft that includes none of them — it is a different
 * scope, and comparing the two as prices is a category error.
 *
 * So this tool does exactly one thing: it takes the numbers the visitor
 * supplies about quotes we have never seen, and reports where the scopes
 * differ. It states no opinion about any company, prices none of the missing
 * items, and produces no ranking.
 *
 * That restraint is not squeamishness, it is the only defensible design:
 *
 *  · Competition Act s.74.01(1)(b) requires adequate and proper testing BEFORE
 *    a performance claim is made. "A quote without moisture readings costs you
 *    $2,000 more on average" is a performance claim we have no test for. Since
 *    Bill C-59 the penalty is the greater of CAD 10M and 3% of worldwide gross
 *    revenue, and since 20 June 2025 a private party can bring it to the
 *    Tribunal directly.
 *  · Naming or characterising a competitor's document invites the disparagement
 *    analysis in Energizer Brands v Gillette 2023 FC 804. We never see the
 *    document and never name anyone.
 *
 * WHERE EACH ITEM COMES FROM — and the guard enforces this
 *
 *   basis: 'published'  the item is one this business has already published as
 *                       belonging in a quote, in /guides/how-to-evaluate-a-
 *                       hardwood-quote. `cite` points at that published page.
 *                       Nothing new is being asserted here.
 *   basis: 'scope'      a neutral line item that plainly changes what is being
 *                       priced — who moves the furniture, who takes the old
 *                       floor away. No claim of any kind: including it is not
 *                       better, excluding it is not worse, it is simply a
 *                       different job.
 *
 * scripts/verify-quote-check.mjs fails if an item carries a dollar figure, a
 * percentage, a comparative adjective, or a 'published' basis whose citation
 * does not resolve to a page this repository actually generates.
 */

export type ScopeBasis = 'published' | 'scope';

export interface ScopeItem {
  /** Stable id. Appears in the API and in anonymous benchmark rows; never renamed. */
  id: string;
  group: 'Before the price' | 'The floor itself' | 'The work' | 'The finish' | 'The paperwork';
  /** What the visitor is asked to look for in the document they are holding. */
  label: string;
  /** Why it changes the scope. Never why one company is better than another. */
  why: string;
  basis: ScopeBasis;
  /** Internal page that already publishes this. Required when basis is 'published'. */
  cite?: string;
  /**
   * True when omitting the item means the two quotes are pricing different
   * work, so their totals cannot be compared at all. False when the item
   * affects certainty rather than scope.
   */
  changesScope: boolean;
}

const Q = '/guides/how-to-evaluate-a-hardwood-quote';
const CLIMATE = '/papers/toronto-hardwood-climate-moisture-protocol';
const MACHINES = '/papers/hardwood-refinishing-machines-and-sequence';
const GRADING = '/papers/hardwood-grading-standards-nhla-nwfa';

export const SCOPE_ITEMS: ScopeItem[] = [
  {
    id: 'moisture-readings',
    group: 'Before the price',
    label: 'Moisture readings, with the date they were taken',
    why:
      'A price set before anyone measured the subfloor and the air is a price for a building nobody has examined. If the readings are absent, the quote and any quote that includes them were produced by different processes.',
    basis: 'published',
    cite: CLIMATE,
    changesScope: false,
  },
  {
    id: 'substrate-assessment',
    group: 'Before the price',
    label: 'What the subfloor is, and its condition',
    why:
      'Plywood, plank, and a concrete slab are three different installations with three different material lists. A quote that does not say which one it assumes has not fixed its own scope.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'species-grade-width',
    group: 'The floor itself',
    label: 'Species, grade and board width — all three',
    why:
      'Grade and width move material cost independently of species. #1 Common and Select in the same species are different products at different prices; so are 3¼" and 7" of the same grade.',
    basis: 'published',
    cite: GRADING,
    changesScope: true,
  },
  {
    id: 'quantity',
    group: 'The floor itself',
    label: 'The area being covered, in square feet',
    why:
      'Without it there is no unit price, and two totals for two different areas look like a price difference.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'waste-factor',
    group: 'The floor itself',
    label: 'Whether the material quantity includes a cutting allowance',
    why:
      'Ordering the exact floor area and ordering the floor area plus an allowance are different quantities of the same product. If one quote carries the allowance and another does not, the shortfall is bought later.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'removal-disposal',
    group: 'The work',
    label: 'Removal and disposal of the existing floor',
    why:
      'Someone lifts the old floor and pays to dispose of it. If the quote is silent, it is either included or it is yours — and those are different jobs at the same number.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'subfloor-prep',
    group: 'The work',
    label: 'Subfloor preparation — levelling, fastening, patching',
    why:
      'Flattening and re-fastening a subfloor is labour that either sits in the price or arrives as a change order. It is the single most common difference between two quotes for the same room.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'install-method',
    group: 'The work',
    label: 'The installation method, and the reason for it',
    why:
      'Nail-down, glue-down and floating carry different materials and different labour. A method chosen without a stated reason is a method chosen without the substrate in view.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'acclimation',
    group: 'The work',
    label: 'Acclimation — how long, and in the actual space',
    why:
      'Acclimation is days on the schedule and space in the house. A quote that assumes none and a quote that assumes a week are pricing different projects.',
    basis: 'published',
    cite: CLIMATE,
    changesScope: false,
  },
  {
    id: 'furniture',
    group: 'The work',
    label: 'Who moves the furniture and the appliances',
    why: 'Labour that is either in the price or in your weekend.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'stairs-transitions',
    group: 'The work',
    label: 'Stairs and transitions, itemised separately',
    why:
      'Stairs are priced per unit and transitions per opening; folded into a square-foot rate they are invisible, and a quote that omits them entirely is quoting a smaller job.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'baseboard',
    group: 'The work',
    label: 'Baseboard or quarter-round — removed and reinstalled, or new',
    why: 'Three different line items hide behind the same word, and one of them is carpentry.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'dust-containment',
    group: 'The work',
    label: 'Dust containment and extraction',
    why:
      'Containment is equipment and setup time. It is a real line whether or not it appears as one.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'grit-sequence',
    group: 'The finish',
    label: 'The sanding grit sequence',
    why:
      'The number of passes is the labour. A sequence that skips a grit is a shorter job that shows in the floor under a raking light.',
    basis: 'published',
    cite: MACHINES,
    changesScope: true,
  },
  {
    id: 'finish-product',
    group: 'The finish',
    label: 'The finish product, by name',
    why:
      'Finish is the largest material variable in a refinish and the products differ by several times in cost. "Commercial-grade finish" names nothing.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'coat-count',
    group: 'The finish',
    label: 'How many coats',
    why: 'Each coat is a material quantity and a day. Two coats and four coats are different jobs.',
    basis: 'published',
    cite: Q,
    changesScope: true,
  },
  {
    id: 'stain',
    group: 'The finish',
    label: 'Whether stain is included, and whether a sample will be made on your floor',
    why:
      'Staining adds a day and a material. A sample made on your own boards is additional labour that some quotes carry and some do not.',
    basis: 'scope',
    changesScope: true,
  },
  {
    id: 'schedule',
    group: 'The paperwork',
    label: 'The schedule — start date and working days',
    why:
      'Duration is the part of a quote that collides with the rest of your life, and a quote with no schedule has not committed to one.',
    basis: 'published',
    cite: Q,
    changesScope: false,
  },
  {
    id: 'price-fixed',
    group: 'The paperwork',
    label: 'Whether the price is fixed in writing, with no open-ended change-order clause',
    why:
      'An open-ended change-order clause means the number on the page is a starting number. Comparing it to a fixed number is comparing two different kinds of thing.',
    basis: 'published',
    cite: Q,
    changesScope: false,
  },
  {
    id: 'warranty-in-contract',
    group: 'The paperwork',
    label: 'Workmanship warranty language in the contract itself, not on a website',
    why: 'A warranty that lives only on a website is not part of the agreement you sign.',
    basis: 'published',
    cite: Q,
    changesScope: false,
  },
  {
    id: 'who-performs',
    group: 'The paperwork',
    label: 'Who performs the work — employees or subcontracted crews',
    why:
      'It does not change the material list. It changes who is accountable for the workmanship the warranty covers.',
    basis: 'published',
    cite: Q,
    changesScope: false,
  },
  {
    id: 'condo-logistics',
    group: 'The paperwork',
    label: 'Condominium logistics — elevator booking, hours, deposits',
    why:
      'In a condominium these are scheduled, paid and sometimes refundable. A quote written for a house does not contain them.',
    basis: 'scope',
    changesScope: true,
  },
];

export const SCOPE_GROUPS = [
  'Before the price',
  'The floor itself',
  'The work',
  'The finish',
  'The paperwork',
] as const;
