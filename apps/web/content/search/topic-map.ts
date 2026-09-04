/**
 * apps/web/content/search/topic-map.ts — one canonical page per query cluster.
 *
 * WHAT THIS FILE DECIDES
 *
 * For every family of queries this business wants to answer, exactly one URL is
 * the answer. Everything else in the family either supports that URL or
 * redirects to it. That single rule is what the rest of this file is for, and
 * it is the opposite of the instinct it replaces.
 *
 * THE INSTINCT IT REPLACES, STATED PLAINLY
 *
 * The obvious way to "own" thirty-four keyword slugs is to publish thirty-four
 * pages, one per slug. /stairs, /stairs-hardwood, /stairs-flooring,
 * /stairs-toronto, /stairs-sanding, /stairs-hard-wood, /stairs-install. Seven
 * URLs, and there is only one thing to say on them, so they say it seven times
 * in seven slightly different arrangements.
 *
 * That is a doorway-page set. It is named and described in Google Search
 * Central's spam policies —
 *
 *   > Doorway pages are sites or pages created to rank for specific, similar
 *   > search queries. They lead users to intermediate pages that are not as
 *   > useful as the final destination... Multiple domain names or pages
 *   > targeted at specific regions or cities that funnel users to one page.
 *
 * — and the outcome is not "we rank for seven terms instead of one". The
 * outcome is that seven near-identical pages split the internal links, the
 * external links and the crawl budget that one page would have concentrated,
 * Google picks one of them as canonical anyway and ignores the rest, and the
 * site carries a spam-policy signal it did not need to carry. On the retrieval
 * side it is worse: an answer engine deduplicates near-identical documents
 * before it ranks them, so seven thin variants are one weak citation target
 * rather than seven strong ones.
 *
 * A 301 from the variant slug to the canonical page costs nothing, resolves for
 * anyone who types or links the variant, and concentrates every signal on one
 * document instead of splitting it seven ways. It is not the cautious version
 * of the aggressive plan. It is the version that wins, and the doorway set is
 * the version that loses while looking busy.
 *
 * SO: variants live in `ROUTE_ALIASES` and 301 to a canonical. A new page is
 * created only where a cluster has a genuinely distinct intent that no existing
 * page answers. Exactly one such gap existed when this file was written —
 * stairs — and `/hardwood-stairs-toronto` was written to close it.
 *
 * WHAT ELSE READS THIS FILE
 *
 *   · next.config.js          → the 301s, generated from ROUTE_ALIASES
 *   · scripts/verify-topic-map.mjs → every canonical resolves; no cluster
 *                             shares a canonical with a different intent; no
 *                             alias collides with a real route
 *   · audit/ai-prompts.json   → the retrieval benchmark, generated from `queries`
 *   · app/llms.txt            → the preferred-citation-target list
 *
 * The `queries` arrays are SEARCH TARGETS, not claims, and not copy. Nothing
 * here is asserted to appear verbatim on the page — see lib/alpha-keywords.ts
 * for why a guard that checks for the string is a guard that rewards stuffing.
 */
import routeAliases from './route-aliases.json';

/** What the person typing this wants. Decides which page shape answers it. */
export type Intent =
  /** Ready to hire. Wants price, proof, and a way to book. */
  | 'commercial'
  /** Choosing between options. Wants a decision framework. */
  | 'decision'
  /** Diagnosing a problem with a floor they already own. */
  | 'problem'
  /** Wants the mechanism. Wood science, machines, protocol. */
  | 'technical'
  /** Anchored to a place. */
  | 'local'
  /** About the company itself. */
  | 'entity';

export type QueryCluster = {
  id: string;
  intent: Intent;
  /** THE page for this cluster. Exactly one. Must resolve. */
  canonical: string;
  /**
   * Whether `canonical` actually answers this cluster.
   *
   * `covered`  — the page was written for this intent.
   * `gap`      — the nearest existing page is named so the cluster is not
   *              silently unrouted, but nothing on this site was written to
   *              answer it. This is a content backlog entry, and it is recorded
   *              here rather than in a document because this is the file the
   *              guard reads. `pnpm seo:topics` lists every gap on every run.
   *
   * Defaults to `covered` when omitted.
   */
  coverage?: 'covered' | 'gap';
  /** Required when `coverage` is `gap`: what would actually close it. */
  gapNote?: string;
  /** One line: what this cluster is asking, so a reviewer can judge the map. */
  summary: string;
  /** Representative queries. Head terms first. Not copy, not claims. */
  queries: string[];
  /** Pages that strengthen the canonical. Never compete with it. */
  supporting: string[];
};

/* ────────────────────────────────────────────────────────────────────────────
 * SINGLE-WORD AND TWO-WORD CORES
 *
 * "flooring", "sanding", "hardwood", "floor". Listed here because the brief
 * names them, and named here rather than given pages because of what they are:
 * a one-word query has no intent attached to it, which is why the results for
 * it are a national retailer, a Wikipedia article and a shopping carousel. A
 * local contractor does not rank for "flooring" and would not convert on it if
 * it did.
 *
 * What a local contractor CAN do with these terms is be the entity the search
 * engine associates with them in this geography — which is a knowledge-graph
 * problem, not a page problem, and is solved by the Organization/LocalBusiness
 * graph, the sameAs profiles, the Google Business Profile categories and the
 * service @ids. Those exist. A page called /flooring would add nothing to them.
 * ────────────────────────────────────────────────────────────────────────── */
export const SINGLE_WORD_CORES = [
  'hardwood', 'flooring', 'floor', 'wood', 'sanding', 'refinishing', 'installation',
  'stairs', 'oak', 'maple', 'engineered', 'solid', 'dustless', 'HEPA', 'cost',
  'price', 'quote', 'contractor',
] as const;

export const CLUSTERS: QueryCluster[] = [
  {
    id: 'commercial-property',
    intent: 'commercial',
    canonical: '/commercial',
    summary:
      'Not a homeowner. A condo board, a property manager or a commercial tenant, whose questions are scheduling, insurance and a price a board can approve.',
    queries: [
      'commercial hardwood flooring Toronto',
      'condo corridor floor refinishing Toronto',
      'property manager flooring contractor Toronto',
      'condo board hardwood flooring',
      'commercial floor refinishing GTA',
      'after hours floor sanding Toronto',
      'hardwood flooring certificate of insurance Toronto',
      'unit turnover floor recoat Toronto',
      'lobby floor refinishing Toronto',
      'amenity room hardwood Toronto',
      'HOA flooring contractor Ontario',
      'commercial flooring contractor near me',
    ],
    supporting: [
      '/services/floor-refinishing',
      '/services/dust-free-sanding',
      '/framework',
      '/case-studies',
    ],
  },
  {
    id: 'realtor-prelist',
    intent: 'commercial',
    canonical: '/realtors',
    summary:
      'An agent or a seller with a listing date. Wants the floor to photograph well, on a schedule, for a price known in advance.',
    queries: [
      'floor refinishing before selling house Toronto',
      'pre list floor recoat Toronto',
      'should I refinish floors before selling',
      'realtor flooring contractor Toronto',
      'screen and recoat before listing',
      'quick floor refresh before sale Toronto',
      'do hardwood floors increase home value Toronto',
      'floor recoat three days Toronto',
      'staging hardwood floors Toronto',
    ],
    supporting: [
      '/services/floor-refinishing',
      '/guides/hardwood-flooring-cost-toronto',
      '/case-studies',
    ],
  },
  {
    id: 'hardwood-flooring-toronto',
    intent: 'commercial',
    canonical: '/hardwood-flooring-toronto',
    summary:
      'The head term. Who should I hire for hardwood in Toronto, and what will it cost.',
    queries: [
      'hardwood flooring Toronto',
      'Toronto hardwood flooring',
      'flooring hardwood Toronto',
      'hard wood flooring Toronto',
      'hardwood floors Toronto',
      'hardwood flooring GTA',
      'hardwood flooring company Toronto',
      'hardwood flooring contractors Toronto',
      'best hardwood flooring Toronto',
      'wood flooring Toronto',
      'wood floors Toronto',
      'who installs hardwood floors in Toronto',
      'hardwood floorring Toronto',
      'hardwod flooring Toronto',
      'hardwood flooring near me',
      'home renovation floors Toronto',
      'fixed price flooring contractors Toronto',
      'salaried craftsmen flooring Toronto',
    ],
    supporting: [
      '/services/hardwood-installation',
      '/framework',
      '/reviews',
      '/team',
      '/service-areas',
    ],
  },
  {
    id: 'refinishing-toronto',
    intent: 'commercial',
    canonical: '/hardwood-floor-refinishing-toronto',
    summary:
      'An existing floor, brought back. Includes the sanding and finishing language.',
    queries: [
      'hardwood floor refinishing Toronto',
      'Toronto hardwood refinishing',
      'floor refinishing Toronto',
      'floor sanding Toronto',
      'hardwood floor sanding Toronto',
      'refinish hardwood floors Toronto',
      'floor sanding near me',
      'wood floor restoration GTA',
      'how much does it cost to refinish hardwood floors Toronto',
      'how long does hardwood refinishing take',
      'refinish or replace hardwood',
      'sanding and finishing hardwood floors Toronto',
    ],
    supporting: [
      '/services/floor-refinishing',
      '/services/dust-free-sanding',
      '/services/floor-restoration',
      '/guides/reference-refinishing-existing-hardwood',
      '/papers/hardwood-refinishing-machines-and-sequence',
    ],
  },
  {
    id: 'stairs',
    intent: 'commercial',
    canonical: '/hardwood-stairs-toronto',
    summary:
      'Stairs, as their own job. Priced per tread rather than per square foot, ' +
      'and the detail that gives a refinish away.',
    queries: [
      'hardwood stairs Toronto',
      'stairs hardwood Toronto',
      'hardwood stairs refinishing Toronto',
      'stair refinishing Toronto',
      'stair sanding Toronto',
      'stairs flooring Toronto',
      'hardwood stairs installation Toronto',
      'stairs finishing Toronto',
      'hard wood stairs Toronto',
      'how much do hardwood stairs cost Toronto',
      'refinish stairs to match floor',
      'oak stair treads Toronto',
      'stair nosing hardwood',
      'carpet to hardwood stairs Toronto',
    ],
    supporting: [
      '/services/stair-refinishing',
      '/hardwood-flooring-toronto',
      '/hardwood-floor-refinishing-toronto',
      '/case-studies/rosedale-estate-stairs-radiant-heat',
      '/framework',
    ],
  },
  {
    id: 'dust-free-sanding',
    intent: 'commercial',
    canonical: '/services/dust-free-sanding',
    summary: 'Can I stay in the house. Containment, and what the word "dustless" means.',
    queries: [
      'dust free sanding Toronto',
      'dustless hardwood floor refinishing Toronto',
      'dustless sanding Toronto',
      'HEPA sanding Toronto',
      'dust free floor refinishing GTA',
      'can I stay home during floor sanding',
      'how dusty is floor sanding',
      'dust control during renovation Toronto',
      'best dustless sanding company GTA',
    ],
    supporting: [
      '/hardwood-floor-refinishing-toronto',
      '/guides/dustless-hardwood-refinishing-toronto',
      '/blog/dust-free-sanding-hepa-extraction-explained',
    ],
  },
  {
    id: 'installation',
    intent: 'commercial',
    canonical: '/services/hardwood-installation',
    summary: 'New floor going in. Method decided by substrate, priced per square foot.',
    queries: [
      'hardwood floor installation Toronto',
      'hardwood installation Toronto',
      'Toronto hardwood install',
      'hardwood floor installers Toronto',
      'solid hardwood installation Toronto',
      'engineered hardwood installation Toronto',
      'hardwood over concrete Toronto',
      'nail down vs glue down hardwood',
      'how long does hardwood installation take',
    ],
    supporting: [
      '/hardwood-flooring-toronto',
      '/guides/nail-down-glue-down-or-floating',
      '/guides/reference-condominium-concrete-slab',
      '/papers/toronto-hardwood-climate-moisture-protocol',
    ],
  },
  {
    id: 'cost',
    intent: 'commercial',
    canonical: '/guides/hardwood-flooring-cost-toronto',
    summary: 'What it costs and what moves the number inside the band.',
    queries: [
      'hardwood flooring cost Toronto',
      'hardwood floor cost per square foot Toronto',
      'how much is hardwood flooring Toronto',
      'floor refinishing cost Toronto',
      'hardwood installation price Toronto',
      'cost to sand and refinish hardwood floors',
      'hardwood flooring quote Toronto',
    ],
    supporting: [
      '/hardwood-flooring-toronto',
      '/hardwood-floor-refinishing-toronto',
      '/market',
      '/framework/assess',
    ],
  },
  {
    id: 'solid-vs-engineered',
    intent: 'decision',
    canonical: '/guides/solid-vs-engineered-hardwood-toronto',
    summary: 'Which construction, and why the substrate decides rather than the budget.',
    queries: [
      'solid vs engineered hardwood Toronto',
      'engineered vs solid hardwood',
      'is engineered hardwood real wood',
      'is engineered better for condo Toronto',
      'engineered hardwood condo Toronto',
      'best hardwood for concrete slab condo',
      'radiant heat hardwood Toronto',
    ],
    supporting: [
      '/guides/reference-condominium-concrete-slab',
      '/guides/reference-radiant-heat-main-floor',
      '/papers/hardwood-selection-and-cost-framework-gta',
      '/services/hardwood-installation',
    ],
  },
  {
    id: 'white-oak',
    intent: 'decision',
    canonical: '/guides/white-oak-flooring-toronto',
    summary: 'Species selection, anchored on the one people ask for by name.',
    queries: [
      'white oak flooring Toronto',
      'white oak vs red oak',
      'wide plank white oak Toronto',
      'best hardwood species Toronto',
      'maple vs oak flooring',
    ],
    supporting: [
      '/blog/white-oak-vs-red-oak-tannin-behavior',
      '/blog/species-comparison-matrix-toronto-renovations',
      '/papers/hardwood-selection-and-cost-framework-gta',
      /* The five species dossiers sit UNDER this canonical rather than beside
         it, and that is a deliberate refusal to add five more clusters. This
         cluster already owns "white oak vs red oak", "maple vs oak flooring"
         and "best hardwood species Toronto"; a red-oak cluster claiming the
         same queries is split intent, which this guard exists to prevent and
         which search engines resolve by ranking neither page. Depth beneath one
         canonical beats five canonicals competing with each other. */
      '/guides/red-oak-flooring-toronto',
      '/guides/hard-maple-flooring-toronto',
      '/guides/white-ash-flooring-toronto',
      '/guides/hickory-flooring-toronto',
      '/guides/black-walnut-flooring-toronto',
      '/papers/where-toronto-hardwood-comes-from',
      '/papers/hardwood-grading-standards-nhla-nwfa',
    ],
  },
  {
    id: 'floor-problems',
    intent: 'problem',
    canonical: '/hardwood-floor-problems-toronto',
    summary:
      'A floor that is already misbehaving. Cupping, gapping, crowning, buckling ' +
      'and edge peeling are five symptoms of one mechanism — moisture — which is ' +
      'why one page answers all of them.',
    queries: [
      'hardwood floor cupping Toronto',
      'why is my hardwood floor cupping',
      'gaps in hardwood floor winter',
      'gaps between floorboards Toronto',
      'hardwood floor crowning',
      'hardwood floor buckling',
      'hardwood floor lifting off subfloor',
      'finish peeling on hardwood floor',
      'can a cupped floor be sanded flat',
      'refinish or replace hardwood floor',
      'is floor cupping covered by insurance',
      'humidity hardwood floors Toronto',
      'water damaged hardwood floor Toronto',
      'hardwood floor repair Toronto',
      'wood floor restoration GTA',
    ],
    supporting: [
      '/glossary/cupping',
      '/glossary/crowning',
      '/glossary/seasonal-gapping',
      '/papers/toronto-hardwood-climate-moisture-protocol',
      '/services/floor-restoration',
      '/services/floor-refinishing',
      '/guides/how-to-evaluate-a-hardwood-quote',
    ],
  },
  {
    id: 'choosing-a-contractor',
    intent: 'decision',
    canonical: '/framework',
    summary:
      'How to judge any quote, including ours. The comparison instrument the ' +
      'commercial pages all point back to.',
    queries: [
      'how to choose a hardwood flooring contractor Toronto',
      'how to evaluate a hardwood quote',
      'what should a hardwood flooring quote include',
      'questions to ask a flooring contractor',
      'what warranty do hardwood installers give',
      'do flooring companies use subcontractors',
      'compare hardwood flooring quotes Toronto',
    ],
    supporting: [
      '/framework/assess',
      '/guides/how-to-evaluate-a-hardwood-quote',
      '/guides/how-to-choose-hardwood-contractor-toronto',
      '/team',
      '/reviews',
    ],
  },
  {
    id: 'entity',
    intent: 'entity',
    canonical: '/about',
    summary: 'Who Ecowoods is: legal name, NAP, founding year, services, price bands and sourced review figures.',
    queries: [
      'Ecowoods hardwood flooring',
      'Ecowoods Toronto reviews',
      'is Ecowoods reputable',
      'Ecowoods hardwood phone number',
      'ecowoodshardwood.com',
    ],
    supporting: ['/reviews', '/team', '/press', '/authority'],
  },
  {
    id: 'local',
    intent: 'local',
    canonical: '/service-areas',
    summary:
      'Place-anchored queries. Each area page carries its own housing stock and ' +
      'substrate reality; the index is canonical for the un-anchored version.',
    queries: [
      'hardwood flooring Etobicoke',
      'hardwood flooring Mississauga',
      'hardwood flooring North York',
      'hardwood flooring Vaughan',
      'hardwood flooring Rosedale',
      'hardwood floor refinishing Scarborough',
      'flooring contractor near me Toronto',
    ],
    supporting: ['/hardwood-flooring-toronto', '/case-studies'],
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * ROUTE ALIASES — every variant slug, 301'd to the cluster canonical.
 *
 * Read the file header before adding to this list. A slug goes here when it is
 * a WORDING of an existing intent. It gets a page instead when it is a
 * DIFFERENT intent that no canonical answers — and that is a rare event, not a
 * routine one.
 *
 * 308 rather than 307 and 301 rather than 302: permanent, because the whole
 * point is to tell a crawler that the variant is not a separate document.
 * Next's `permanent: true` emits 308, which preserves the method and which
 * Google treats identically to 301 for canonicalisation.
 * ────────────────────────────────────────────────────────────────────────── */
/**
 * Variant slug → canonical route, read from `route-aliases.json`.
 *
 * The data lives in JSON, not here, because next.config.js is a CommonJS file
 * that cannot import TypeScript — and a hand-copied second table in the config
 * is precisely the drift this repository builds guards to prevent. Both sides
 * read the same file.
 */
export const ROUTE_ALIASES: Record<string, string> = routeAliases.aliases;

export const clusterById = (id: string): QueryCluster | undefined =>
  CLUSTERS.find((c) => c.id === id);

export const clusterForRoute = (route: string): QueryCluster | undefined =>
  CLUSTERS.find((c) => c.canonical === route);

/** Every canonical URL in the map. What verify-topic-map.mjs resolves. */
export const CANONICALS = (): string[] => [...new Set(CLUSTERS.map((c) => c.canonical))];

/** Every query in the map, deduplicated. Feeds the retrieval benchmark. */
export const ALL_QUERIES = (): string[] =>
  [...new Set(CLUSTERS.flatMap((c) => c.queries))].sort();
