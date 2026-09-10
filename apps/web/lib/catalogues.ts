/**
 * Field catalogues — the manifest.
 *
 * WHAT THESE ARE, AND WHY THEY ARE NOT PAPERS
 *
 * lib/papers.ts carries the technical papers: long-form engineering written to
 * be read on the site, published as HTML because a PDF is close to invisible to
 * a language model. The catalogues are the other half of that argument. They
 * are landscape documents built to be looked at — six pages, photographs, the
 * published bands — and their job is to be the thing a homeowner keeps, prints,
 * or forwards to whoever else has to agree to the work.
 *
 * So the two families are kept apart on purpose. /papers is where the method is
 * argued. /catalogues is where the argument is handed over. Nothing at /papers
 * moves, and no catalogue is presented as a paper.
 *
 * CONTENT RULE — READ THIS BEFORE ADDING A LINE
 *
 * Every field below is a description OF a document that already exists. The
 * purpose lines say what a catalogue covers; they do not restate a figure from
 * inside it. A price, a year count or a review figure typed here would be a
 * second, unsourced copy of a number that lives in content/constants/pricing.ts
 * and @ecowoods/shared/constants — which is precisely the drift class
 * scripts/verify-business-facts.mjs and tests/drift.test.ts exist to stop.
 *
 * The filename is the public identifier. It appears in the URL, in the sitemap,
 * in /llms.txt and in /api/knowledge, and it is what somebody types into a
 * search box six months from now. Renaming one is breaking a published URL.
 */

/** The five families. Order is the reading order on /catalogues. */
export const CATALOGUE_SERIES = [
  {
    id: 'house',
    name: 'House',
    /** What a reader learns from this family, in one line. */
    intent: 'Who the company is, and what it does not do.',
  },
  {
    id: 'service',
    name: 'Service',
    intent: 'One service, from the first measurement to the last coat.',
  },
  {
    id: 'case',
    name: 'Case',
    intent: 'One address, photographed. No stock rooms, no generated interiors.',
  },
  {
    id: 'standard',
    name: 'Standard',
    intent: 'The published specification any quote can be judged against.',
  },
  {
    id: 'decision',
    name: 'Decision',
    intent: 'A question where the choice is still open, and what actually decides it.',
  },
  {
    id: 'market',
    /*
     * The sixth family, and the one that has to be handled most carefully.
     * These read the corridor — what is being specified, what is being sanded
     * off, which species are actually moving — and that is a claim about a
     * market rather than about this company. Both documents say so on their own
     * first pages: 09 describes what is being written into specifications, and
     * 11 states plainly that no mill publishes a Toronto-to-Buffalo unit
     * ranking and that its order comes from quotes, listings and the work this
     * company is asked to do. The Janka figures in 11 are USDA Wood Handbook
     * side hardness at 12% MC — the same table cited on the site — and they are
     * not restated here.
     */
    name: 'Market',
    intent: 'What the corridor is actually specifying and buying, and the physical properties behind it.',
  },
] as const;

export type CatalogueSeriesId = (typeof CATALOGUE_SERIES)[number]['id'];

export type CatalogueLink = {
  href: string;
  /** What the reader gets there. Never the catalogue's own title again. */
  label: string;
};

export type Catalogue = {
  /** Two-digit series number, as printed on the document. */
  id: string;
  /** URL slug fragment for anchors on /catalogues. */
  slug: string;
  /** Filename under public/catalogues/. THE PUBLIC IDENTIFIER — never rename. */
  file: string;
  title: string;
  /** The kicker printed at the head of page one. */
  kicker: string;
  series: CatalogueSeriesId;
  /** One or two sentences. What this document is for. No figures restated. */
  purpose: string;
  /** The HTML page that answers the same question at length. Canonical. */
  related: CatalogueLink[];
  pages: number;
  /** Trim size, printed. Landscape. */
  trim: string;
  /** Publication year of this edition. */
  year: number;
};

/**
 * The eleven published catalogues.
 *
 * `pages` and `trim` are properties of the exported file and are the same for
 * every one of them — they are written per record anyway, because the day a
 * twelfth arrives at a different length, a single shared constant is how the
 * whole index quietly starts lying about it.
 */
export const CATALOGUES: Catalogue[] = [
  {
    id: '01',
    slug: 'company-overview',
    file: 'Ecowoods_01_Company_Overview.pdf',
    title: 'Company Overview',
    kicker: 'Toronto · the house',
    series: 'house',
    purpose:
      'One company, salaried craftsmen and no revolving subcontractors — the six services, the warranty structure that is passed through in writing, and how a fixed price is arrived at after a free in-home measure.',
    related: [{ href: '/about', label: 'About Ecowoods — legal identity, crew model, what we do not do' }],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '02',
    slug: 'dust-free-refinishing',
    file: 'Ecowoods_02_DustFree_Refinishing.pdf',
    title: 'Dust-Free Hardwood Refinishing',
    kicker: 'Refinishing · Toronto & the GTA',
    series: 'service',
    purpose:
      'What dust-free actually means: extraction at each machine, a sealed barrier built at the room and struck every shift, and the four-machine sequence that takes a worn floor back to a finished one.',
    related: [
      { href: '/hardwood-floor-refinishing-toronto', label: 'Hardwood floor refinishing in Toronto' },
      { href: '/guides/dustless-hardwood-refinishing-toronto', label: 'The dustless refinishing guide' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '03',
    slug: 'hardwood-installation',
    file: 'Ecowoods_03_Hardwood_Installation.pdf',
    title: 'New Hardwood, Laid to the House',
    kicker: 'Installation · solid & engineered',
    series: 'service',
    purpose:
      'Why Toronto is a hard room for wood, and how the substrate rather than the budget decides between nail-down, glue-down and floating — with the moisture readings and the acclimation that come before any of them.',
    related: [
      { href: '/hardwood-flooring-toronto', label: 'Hardwood flooring in Toronto' },
      { href: '/guides/nail-down-glue-down-or-floating', label: 'Which installation method, and why' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '04',
    slug: 'stairs-maple-vaughan',
    file: 'Ecowoods_04_Stairs_Maple_Vaughan.pdf',
    title: 'One Stair That Reads As One Floor',
    kicker: 'Stairs · a case from Maple, Vaughan',
    series: 'case',
    purpose:
      'One flight photographed in two chapters — light maple, then the stain — and the four different jobs that are all called stairs. The work is in the nosings, the returns and the rail.',
    related: [
      { href: '/projects/maple-vaughan-curved-stair', label: 'The same flight, photographed — eighteen plates and two chapter films' },
      { href: '/hardwood-stairs-toronto', label: 'Hardwood stairs in Toronto — the four jobs that are all called stairs' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '05',
    slug: 'well-installed-framework',
    file: 'Ecowoods_05_Well_Installed_Framework.pdf',
    title: 'The Well-Installed Framework',
    kicker: 'Standards · the published specification',
    series: 'standard',
    purpose:
      'The framework in the form you can carry into a meeting: the pillars, the criteria, and the ones that are critical. Choosing a contractor is a filter, not a comparison — any critical criterion answered “no” is a defect in the quote.',
    related: [
      { href: '/framework', label: 'The framework in full, with the self-assessment' },
      { href: '/standards', label: 'The external standards this work answers to' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '06',
    slug: 'cost-guide',
    file: 'Ecowoods_06_Cost_Guide_Toronto_Buffalo.pdf',
    title: 'How Much Does Hardwood Cost?',
    kicker: 'The question people actually type',
    series: 'decision',
    purpose:
      'The three published bands, each with a thousand-square-foot worked example, and what a material box price leaves outside it. Not a quote — the number is fixed in writing after the measure.',
    related: [
      { href: '/guides/hardwood-flooring-cost-toronto', label: 'What hardwood flooring costs in Toronto' },
      { href: '/pricing', label: 'The published bands, in full' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '07',
    slug: 'refinish-or-replace',
    file: 'Ecowoods_07_Refinish_or_Replace.pdf',
    title: 'Keep the Wood or Start Again?',
    kicker: 'The second search · refinish vs replace',
    series: 'decision',
    purpose:
      'When the damage is in the coat and when it is in the board — the conditions under which a floor is still refinishable, the ones under which it is not, and the third option between them.',
    related: [
      { href: '/hardwood-floor-refinishing-toronto', label: 'Hardwood floor refinishing in Toronto' },
      { href: '/guides/reference-refinishing-existing-hardwood', label: 'Is the floor already in the house refinishable?' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '08',
    slug: 'solid-or-engineered',
    file: 'Ecowoods_08_Solid_or_Engineered.pdf',
    title: 'Which Wood Belongs In This House?',
    kicker: 'The third search · solid vs engineered',
    series: 'decision',
    purpose:
      'Both are real wood and they are not the same product. Where each one belongs, where it does not, and the one measurement that decides how many refinishes the floor will ever give you.',
    related: [
      { href: '/guides/solid-vs-engineered-hardwood-toronto', label: 'Solid or engineered, for a Toronto house' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '09',
    slug: 'trends-2026-27',
    file: 'Ecowoods_09_Trends_Toronto_Buffalo.pdf',
    title: 'Where the Corridor Is Going',
    /*
     * The document's cover prints "TRENDS · 2026–27". The edition year lives in
     * `year` below, and tests/catalogues.test.ts forbids a four-digit year in
     * the prose fields — correctly: a figure that exists in a structured field
     * and is also typed into a sentence is two copies that drift. The kicker
     * carries the document's own subtitle instead.
     */
    kicker: 'Trends · what is in and what is out',
    series: 'market',
    purpose:
      'What is being specified across the corridor and what is being sanded off: board width, warmth, sheen, pattern, and which construction a given substrate can carry. A read of the market, stated as one — not a claim about this company.',
    related: [
      { href: '/guides/white-oak-flooring-toronto', label: 'White oak in a Toronto house — why it became the default' },
      { href: '/guides/herringbone-chevron-parquet-toronto', label: 'Herringbone and chevron — what the pattern costs in labour' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '10',
    slug: 'machines-and-the-craft',
    file: 'Ecowoods_10_Machines_And_The_Craft.pdf',
    title: 'The Machines That Change a Floor',
    kicker: 'Machines · the kit',
    series: 'standard',
    purpose:
      'The six machine types a hardwood floor actually passes through, what each one is for, and where the dust is captured. It belongs in this family because it is a specification a quote can be judged against: containment at the shoe is a method, not a line item added at the door.',
    related: [
      { href: '/equipment', label: 'Every machine, with the electrical requirement its manufacturer publishes' },
      { href: '/papers/hardwood-refinishing-machines-and-sequence', label: 'The full sequence, and why the order of the grits is the job' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
  {
    id: '11',
    slug: 'corridor-bestsellers',
    file: 'Ecowoods_11_Corridor_Bestsellers.pdf',
    title: 'The Products This Corridor Buys',
    kicker: 'Products · corridor',
    series: 'market',
    purpose:
      'The species in the order they are actually asked for, each with the construction it is usually specified in and its published side hardness. The document states its own basis: no mill publishes a unit ranking for this corridor, so the order comes from quotes, listings and the work requested.',
    related: [
      { href: '/guides/white-oak-flooring-toronto', label: 'White oak — grain, movement, and what it costs to specify' },
      { href: '/guides/red-oak-flooring-toronto', label: 'Red oak — the floor already in most pre-1990 houses' },
    ],
    pages: 6,
    trim: '14 × 10 in',
    year: 2026,
  },
];

/** Public URL of the document. Served from apps/web/public/catalogues/. */
export const catalogueHref = (c: Catalogue): string => `/catalogues/${c.file}`;

/** Reading order: series order first, then the printed number. */
export const getCatalogues = (): Catalogue[] => {
  const rank = new Map(CATALOGUE_SERIES.map((s, i) => [s.id, i]));
  return [...CATALOGUES].sort(
    (a, b) => (rank.get(a.series)! - rank.get(b.series)!) || a.id.localeCompare(b.id),
  );
};

export const getCatalogue = (id: string): Catalogue | undefined =>
  CATALOGUES.find((c) => c.id === id);

export const cataloguesInSeries = (series: CatalogueSeriesId): Catalogue[] =>
  getCatalogues().filter((c) => c.series === series);

/**
 * Is the file actually on disk?
 *
 * The same check lib/papers.ts makes, for the same reason: /api/knowledge,
 * /llms.txt, /ai.txt and the sitemap all advertise these URLs, and an agent
 * that follows a machine surface to a 404 stops trusting the surface. A
 * catalogue that is described in this manifest but missing from public/ is
 * simply not published — the page draws no button and no machine file names it.
 *
 * Resolved at build time on the server. Never called from a client component.
 */
export function catalogueIsPublished(c: Catalogue): boolean {
  try {
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    return existsSync(join(process.cwd(), 'public', 'catalogues', c.file));
  } catch {
    return false;
  }
}

/** Only the catalogues whose file is actually served. */
export const getPublishedCatalogues = (): Catalogue[] =>
  getCatalogues().filter(catalogueIsPublished);

/**
 * WHICH PAGE CARRIES WHICH CATALOGUE.
 *
 * One catalogue on the page that already answers the same question, two at the
 * most. This is the AWS pattern — a whitepaper appears beside the service it
 * documents, not in a slab of eight on every page — and the reason it is a map
 * here rather than eight hand-written imports is that a route which stops
 * existing then fails `pnpm verify:links` at the one place it is declared.
 *
 * A route absent from this map deliberately carries no rail. /papers is absent
 * on purpose: the papers are a different family and their pages stay untouched.
 */
export const CATALOGUE_RAILS: Record<string, string[]> = {
  '/': ['01'],
  '/about': ['01'],
  '/contact': ['01', '06'],
  '/estimate': ['01', '06'],
  '/hardwood-floor-refinishing-toronto': ['02', '07'],
  '/guides/dustless-hardwood-refinishing-toronto': ['02'],
  '/hardwood-flooring-toronto': ['03', '06'],
  '/hardwood-stairs-toronto': ['04'],
  '/framework': ['05'],
  '/standards': ['05'],
  '/guides/hardwood-flooring-cost-toronto': ['06'],
  '/guides/solid-vs-engineered-hardwood-toronto': ['08'],
  '/equipment': ['10'],
  '/guides/white-oak-flooring-toronto': ['11', '09'],
  '/guides/red-oak-flooring-toronto': ['11'],
  '/tools/floor-movement': ['11'],
};

/** The published catalogues this route should carry. Empty when none. */
export const cataloguesForRoute = (route: string): Catalogue[] =>
  (CATALOGUE_RAILS[route] ?? [])
    .map(getCatalogue)
    .filter((c): c is Catalogue => Boolean(c))
    .filter(catalogueIsPublished);
