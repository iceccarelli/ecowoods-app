/**
 * content/geo/regions.ts — which region each place sits in, and the places the
 * business names without covering.
 *
 * WHY THIS FILE EXISTS (GEO-001)
 *
 * Until GEO-001 these facts lived inside lib/registry/locations.ts — a
 * PROJECTION, which by this repository's own rule owns no fact. The projection
 * kept its own list of forty-one municipalities with a region each, and every
 * published place that was not on that list fell through to a default parent of
 * `'gta'`. So Buffalo, Rochester and Lincoln were all "in the Greater Toronto
 * Area" in the location API, the graph's `within` edges and the matcher, while
 * the market registry said something else. docs/GEO_CONTRADICTION_LOG.md
 * GC-002, GC-004 and GC-005 are the record.
 *
 * Now the region of a place is a fact written once, here, beside the market
 * registry, and nothing has a default. A municipality that is in no region below
 * is a municipality somebody forgot to place — it is not silently put in the GTA.
 *
 * WHAT MAY BE WRITTEN HERE
 *
 * Public administrative geography only: which regional municipality or state a
 * place belongs to. Nothing about Ecowoods. Coverage is decided in markets.ts;
 * this file never says whether a place is served.
 */

/** A region node in the location hierarchy. */
export interface RegionNode {
  slug: string;
  name: string;
  tier: 'country' | 'province' | 'state' | 'region';
  /** The node this one sits inside. Null for a country. */
  parent: string | null;
  /**
   * `parent` — a hierarchy node that is wider than anything the business
   * covers (a country, a province, a state). `region` — a region whose places
   * the business publishes. `assessment` — a region worked per project.
   */
  coverage: 'parent' | 'region' | 'assessment';
  aliases: string[];
}

export const REGION_NODES: RegionNode[] = [
  { slug: 'canada', name: 'Canada', tier: 'country', parent: null, coverage: 'parent', aliases: ['ca'] },
  {
    slug: 'ontario', name: 'Ontario', tier: 'province', parent: 'canada', coverage: 'parent',
    aliases: ['on', 'province of ontario', 'all ontario', 'all of ontario', 'anywhere in ontario', 'everywhere in ontario'],
  },
  {
    slug: 'southern-ontario', name: 'Southern Ontario', tier: 'region', parent: 'ontario', coverage: 'assessment',
    aliases: ['south ontario', 'south of ontario', 'all southern ontario', 'southwestern ontario', 'golden horseshoe', 'greater golden horseshoe', 'all of southern ontario'],
  },
  {
    slug: 'gta', name: 'Greater Toronto Area', tier: 'region', parent: 'southern-ontario', coverage: 'region',
    aliases: ['the gta', 'greater toronto', 'greater toronto area', 'toronto area', 'gta ontario', 'the greater toronto area', 'peel', 'york region', 'durham', 'durham region', 'halton', 'halton region'],
  },
  /*
   * Two regional municipalities outside the GTA, because the corridor runs
   * through them and because each name is a place people search for. Waterloo
   * Region in particular is a REGION — Kitchener, Cambridge and the City of
   * Waterloo sit inside it — and must never be read as the City of Waterloo.
   */
  {
    slug: 'niagara-region', name: 'Niagara Region', tier: 'region', parent: 'southern-ontario', coverage: 'region',
    aliases: ['niagara', 'the niagara region', 'regional municipality of niagara', 'niagara peninsula'],
  },
  {
    slug: 'waterloo-region', name: 'Waterloo Region', tier: 'region', parent: 'southern-ontario', coverage: 'region',
    aliases: ['region of waterloo', 'regional municipality of waterloo', 'waterloo region'],
  },
  { slug: 'united-states', name: 'United States', tier: 'country', parent: null, coverage: 'parent', aliases: ['usa', 'united states of america', 'the united states'] },
  { slug: 'new-york-state', name: 'New York State', tier: 'state', parent: 'united-states', coverage: 'parent', aliases: ['new york state', 'ny state', 'upstate new york', 'western new york', 'wny'] },
];

/**
 * The municipalities of the Greater Toronto Area that appear anywhere in the
 * geography: the City of Toronto and the municipalities of the four regional
 * municipalities around it (Durham, York, Peel, Halton). Public fact.
 */
export const GTA_MUNICIPALITIES: ReadonlySet<string> = new Set([
  'toronto',
  /* Peel */ 'mississauga', 'brampton', 'caledon',
  /* York */ 'vaughan', 'markham', 'richmond-hill', 'aurora', 'newmarket', 'king',
  'whitchurch-stouffville', 'east-gwillimbury', 'georgina',
  /* Durham */ 'pickering', 'ajax', 'whitby', 'oshawa', 'clarington', 'uxbridge',
  /* Halton */ 'oakville', 'burlington', 'milton', 'halton-hills',
]);

/** Municipalities inside a regional municipality outside the GTA that has a node above. */
const REGIONAL_MUNICIPALITY: Record<string, string> = {
  grimsby: 'niagara-region', lincoln: 'niagara-region', 'st-catharines': 'niagara-region',
  thorold: 'niagara-region', welland: 'niagara-region', 'niagara-on-the-lake': 'niagara-region',
  'niagara-falls-on': 'niagara-region', 'port-colborne': 'niagara-region', 'fort-erie': 'niagara-region',
  kitchener: 'waterloo-region', cambridge: 'waterloo-region', waterloo: 'waterloo-region',
};

/**
 * The region node a MUNICIPALITY hangs from. Districts and neighbourhoods hang
 * from their municipality (`partOf`) and never reach this function.
 *
 * Every New York municipality is in New York State; every Ontario one is in the
 * GTA, a regional node above, or Southern Ontario. There is no default: an
 * Ontario municipality this file has not placed returns Southern Ontario, which
 * is true of every Ontario place in the model, and never the GTA.
 */
export function regionOf(slug: string, country: 'CA' | 'US'): string {
  if (country === 'US') return 'new-york-state';
  if (GTA_MUNICIPALITIES.has(slug)) return 'gta';
  return REGIONAL_MUNICIPALITY[slug] ?? 'southern-ontario';
}

/**
 * Real Southern Ontario municipalities that are NOT markets: named, reachable,
 * assessed per project through the estimate path, and never claimed as covered.
 * The DISCOVERY_ONLY category of docs/GEO_SOURCE_MAP.md §7.
 *
 * Moved here from lib/registry/locations.ts in GEO-001. That list also carried
 * eighteen municipalities the market registry had confirmed as covered, and the
 * location API reported them as "not a published service area … do not present
 * as covered" beside a confirmation date (GC-002). A place is in this list or in
 * markets.ts, never both; the location projection enforces it by construction.
 */
export const DISCOVERY: { slug: string; name: string; aliases?: string[] }[] = [
  { slug: 'uxbridge', name: 'Uxbridge' },
  { slug: 'whitchurch-stouffville', name: 'Whitchurch-Stouffville', aliases: ['stouffville'] },
  { slug: 'east-gwillimbury', name: 'East Gwillimbury', aliases: ['holland landing', 'mount albert'] },
  { slug: 'georgina', name: 'Georgina', aliases: ['keswick', 'sutton'] },
  /* The City of Waterloo — a municipality inside Waterloo Region, beside Kitchener. Not the region. */
  { slug: 'waterloo', name: 'Waterloo', aliases: ['city of waterloo', 'waterloo ontario', 'waterloo on', 'uptown waterloo'] },
  { slug: 'bradford-west-gwillimbury', name: 'Bradford West Gwillimbury', aliases: ['bradford'] },
  { slug: 'orangeville', name: 'Orangeville' },
  { slug: 'brantford', name: 'Brantford' },
  { slug: 'london', name: 'London', aliases: ['london ontario', 'london on'] },
  { slug: 'woodstock', name: 'Woodstock' },
  { slug: 'stratford', name: 'Stratford' },
  { slug: 'peterborough', name: 'Peterborough' },
  { slug: 'cobourg', name: 'Cobourg' },
  { slug: 'port-hope', name: 'Port Hope' },
  { slug: 'belleville', name: 'Belleville' },
  { slug: 'kingston', name: 'Kingston' },
  { slug: 'collingwood', name: 'Collingwood' },
  { slug: 'wasaga-beach', name: 'Wasaga Beach' },
  { slug: 'muskoka', name: 'Muskoka', aliases: ['bracebridge', 'gravenhurst', 'huntsville'] },
  { slug: 'sarnia', name: 'Sarnia' },
  { slug: 'windsor', name: 'Windsor' },
  { slug: 'chatham-kent', name: 'Chatham-Kent', aliases: ['chatham'] },
  { slug: 'owen-sound', name: 'Owen Sound' },
];
