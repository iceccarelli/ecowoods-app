/**
 * lib/registry/locations.ts — location intelligence (Protocol v2, Stage 7).
 *
 * Hierarchy: Canada → Ontario → Southern Ontario → GTA → Toronto → districts →
 * published neighbourhoods. The PUBLISHED set is exactly SERVICE_AREAS from
 * lib/seo-data.ts (16 municipalities/districts + 16 Toronto neighbourhoods),
 * every one of which has a /service-areas page. Nothing here adds a
 * municipality to the public list — that is an owner decision (Protocol §23).
 *
 * What this module adds is GEOGRAPHIC KNOWLEDGE the matcher needs to answer
 * honestly about places the site does not list: a query about Hamilton or
 * Barrie resolves to a real place, with coverage `assessment` ("served on
 * assessment, not a published area") and the estimate action — never to
 * `unknown`, and never to a fabricated "yes, covered".
 *
 * The regional parents (GTA, Toronto, Ontario, Southern Ontario) carry
 * coverage `region` / `parent` so "who installs hardwood in the GTA" resolves
 * to the published set rather than to nothing.
 */
import { CITIES, NEIGHBOURHOOD_AREAS, SERVICE_AREAS, cityContent } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import type { LocationCoverage, LocationTier } from './types';

export type LocationNode = {
  slug: string;
  name: string;
  tier: LocationTier;
  coverage: LocationCoverage;
  parent: string | null;
  aliases: string[];
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Toronto's six former municipalities — districts of the city, not peers of Mississauga. */
const TORONTO_DISTRICT_SLUGS = new Set([
  'downtown-toronto', 'north-york', 'etobicoke', 'scarborough', 'east-york', 'york',
]);

/** Aliases for published areas: the strings a person types that are not the page name. */
const PUBLISHED_ALIASES: Record<string, string[]> = {
  'downtown-toronto': ['downtown', 'toronto downtown', 'the core', 'old toronto', 'central toronto'],
  'north-york': ['northyork', 'willowdale', 'don mills', 'york mills', 'bayview village', 'downsview'],
  etobicoke: ['etob', 'the kingsway', 'kingsway', 'islington', 'mimico', 'long branch', 'humber bay', 'alderwood', 'rexdale'],
  scarborough: ['scarboro', 'agincourt', 'guildwood', 'cliffside', 'west hill', 'birch cliff'],
  'east-york': ['eastyork', 'danforth village', 'thorncliffe'],
  york: ['weston', 'mount dennis', 'oakwood village', 'the junction'],
  vaughan: ['woodbridge', 'maple', 'thornhill', 'kleinburg', 'concord'],
  markham: ['unionville', 'thornhill markham', 'cornell', 'markham village'],
  'richmond-hill': ['richmondhill', 'oak ridges'],
  mississauga: ['sauga', 'port credit', 'streetsville', 'erin mills', 'clarkson', 'lorne park', 'cooksville'],
  oakville: ['bronte', 'glen abbey'],
  brampton: ['bramalea', 'springdale'],
  aurora: [],
  newmarket: [],
  pickering: [],
  ajax: [],
  rosedale: ['south rosedale', 'north rosedale', 'moore park'],
  'forest-hill': ['foresthill', 'forest hill village'],
  yorkville: ['bloor-yorkville'],
  leaside: ['bennington heights'],
  'the-annex': ['annex', 'seaton village'],
  'high-park': ['highpark', 'high park north', 'roncesvalles', 'roncy', 'bloor west village'],
  riverdale: ['north riverdale', 'south riverdale', 'playter estates'],
  leslieville: ['leslie ville'],
  'the-beaches': ['the beach', 'beaches', 'beach', 'upper beaches'],
  'lawrence-park': ['lawrencepark', 'bedford park', 'wanless park'],
  cabbagetown: ['cabbage town'],
  swansea: ['swansea village'],
  'davisville-village': ['davisville', 'mount pleasant west'],
  'midtown-toronto': ['midtown', 'yonge and eglinton', 'yonge-eglinton'],
  'king-west': ['king street west', 'king west village'],
  'liberty-village': ['liberty', 'libertyvillage'],
};

/**
 * Real Southern Ontario municipalities WITHOUT a published page. Coverage is
 * `assessment` — a real place the estimate path can assess, never a claim.
 * Name only; no copy is generated for these and no page exists.
 */
const ASSESSMENT_MUNICIPALITIES: { name: string; region: 'gta' | 'southern-ontario'; aliases?: string[] }[] = [
  { name: 'Whitby', region: 'gta' },
  { name: 'Oshawa', region: 'gta' },
  { name: 'Clarington', region: 'gta', aliases: ['bowmanville', 'courtice'] },
  { name: 'Uxbridge', region: 'gta' },
  { name: 'Whitchurch-Stouffville', region: 'gta', aliases: ['stouffville'] },
  { name: 'King', region: 'gta', aliases: ['king city', 'nobleton', 'schomberg'] },
  { name: 'East Gwillimbury', region: 'gta', aliases: ['holland landing', 'mount albert'] },
  { name: 'Georgina', region: 'gta', aliases: ['keswick', 'sutton'] },
  { name: 'Caledon', region: 'gta', aliases: ['bolton'] },
  { name: 'Milton', region: 'gta' },
  { name: 'Burlington', region: 'gta' },
  { name: 'Halton Hills', region: 'gta', aliases: ['georgetown', 'acton'] },
  { name: 'Hamilton', region: 'southern-ontario', aliases: ['ancaster', 'dundas', 'stoney creek', 'waterdown'] },
  { name: 'Guelph', region: 'southern-ontario' },
  { name: 'Kitchener', region: 'southern-ontario' },
  { name: 'Waterloo', region: 'southern-ontario' },
  { name: 'Cambridge', region: 'southern-ontario' },
  { name: 'Barrie', region: 'southern-ontario' },
  { name: 'Innisfil', region: 'southern-ontario', aliases: ['alcona'] },
  { name: 'Bradford West Gwillimbury', region: 'southern-ontario', aliases: ['bradford'] },
  { name: 'Orangeville', region: 'southern-ontario' },
  { name: 'Brantford', region: 'southern-ontario' },
  { name: 'St. Catharines', region: 'southern-ontario', aliases: ['st catharines', 'saint catharines'] },
  { name: 'Niagara Falls', region: 'southern-ontario' },
  { name: 'Niagara-on-the-Lake', region: 'southern-ontario', aliases: ['niagara on the lake', 'notl'] },
  { name: 'Grimsby', region: 'southern-ontario' },
  { name: 'London', region: 'southern-ontario', aliases: ['london ontario', 'london on'] },
  { name: 'Woodstock', region: 'southern-ontario' },
  { name: 'Stratford', region: 'southern-ontario' },
  { name: 'Peterborough', region: 'southern-ontario' },
  { name: 'Cobourg', region: 'southern-ontario' },
  { name: 'Port Hope', region: 'southern-ontario' },
  { name: 'Belleville', region: 'southern-ontario' },
  { name: 'Kingston', region: 'southern-ontario' },
  { name: 'Collingwood', region: 'southern-ontario' },
  { name: 'Wasaga Beach', region: 'southern-ontario' },
  { name: 'Muskoka', region: 'southern-ontario', aliases: ['bracebridge', 'gravenhurst', 'huntsville'] },
  { name: 'Sarnia', region: 'southern-ontario' },
  { name: 'Windsor', region: 'southern-ontario' },
  { name: 'Chatham-Kent', region: 'southern-ontario', aliases: ['chatham'] },
  { name: 'Owen Sound', region: 'southern-ontario' },
];

/** The hierarchy, built once. */
export function buildLocationNodes(): LocationNode[] {
  const nodes: LocationNode[] = [
    { slug: 'canada', name: 'Canada', tier: 'country', coverage: 'parent', parent: null, aliases: ['ca'] },
    { slug: 'ontario', name: 'Ontario', tier: 'province', coverage: 'parent', parent: 'canada', aliases: ['on', 'province of ontario', 'all ontario', 'all of ontario', 'anywhere in ontario', 'everywhere in ontario'] },
    { slug: 'southern-ontario', name: 'Southern Ontario', tier: 'region', coverage: 'assessment', parent: 'ontario', aliases: ['south ontario', 'south of ontario', 'all southern ontario', 'southwestern ontario', 'golden horseshoe', 'greater golden horseshoe', 'all of southern ontario'] },
    { slug: 'gta', name: 'Greater Toronto Area', tier: 'region', coverage: 'region', parent: 'southern-ontario', aliases: ['the gta', 'greater toronto', 'greater toronto area', 'toronto area', 'gta ontario', 'the greater toronto area', 'peel', 'york region', 'durham', 'durham region', 'halton', 'halton region'] },
    { slug: 'toronto', name: 'Toronto', tier: 'municipality', coverage: 'region', parent: 'gta', aliases: ['city of toronto', 'toronto ontario', 'toronto on', 'toronto canada', 'the six', 'tdot', 't.o.', 'to'] },
  ];

  for (const c of CITIES) {
    const isDistrict = TORONTO_DISTRICT_SLUGS.has(c.slug);
    nodes.push({
      slug: c.slug,
      name: c.name,
      tier: isDistrict ? 'district' : 'municipality',
      coverage: 'published',
      parent: isDistrict ? 'toronto' : 'gta',
      aliases: PUBLISHED_ALIASES[c.slug] ?? [],
    });
  }
  for (const n of NEIGHBOURHOOD_AREAS) {
    nodes.push({
      slug: n.slug,
      name: n.name,
      tier: 'neighbourhood',
      coverage: 'published',
      parent: 'toronto',
      aliases: PUBLISHED_ALIASES[n.slug] ?? [],
    });
  }
  for (const m of ASSESSMENT_MUNICIPALITIES) {
    const slug = slugify(m.name);
    if (nodes.some((n) => n.slug === slug)) continue;
    nodes.push({
      slug,
      name: m.name,
      tier: 'municipality',
      coverage: 'assessment',
      parent: m.region,
      aliases: m.aliases ?? [],
    });
  }
  return nodes;
}

export const LOCATION_NODES: LocationNode[] = buildLocationNodes();

export const locationBySlug = (slug: string): LocationNode | undefined =>
  LOCATION_NODES.find((n) => n.slug === slug);

/** Published areas only — the set the entity graph and the sitemap agree on. */
export const publishedLocationSlugs = (): string[] => SERVICE_AREAS.map((c) => c.slug);

/** Whether a published area page adds local information beyond the hub. */
export const hasLocalNotes = (slug: string): boolean => Boolean(cityContent(slug));

/** The locality the showroom sits in, for the "where are you" answer. */
export const HOME_LOCALITY_SLUG = slugify(BUSINESS_NAP.address.addressLocality);

/** Walk up the hierarchy. */
export function ancestorsOf(slug: string): LocationNode[] {
  const out: LocationNode[] = [];
  let cur = locationBySlug(slug);
  while (cur && cur.parent) {
    const p = locationBySlug(cur.parent);
    if (!p) break;
    out.push(p);
    cur = p;
  }
  return out;
}

/** Published descendants of a region node (e.g. gta → all published areas). */
export function publishedWithin(slug: string): LocationNode[] {
  const isWithin = (n: LocationNode): boolean => {
    let cur: LocationNode | undefined = n;
    while (cur) {
      if (cur.slug === slug) return true;
      cur = cur.parent ? locationBySlug(cur.parent) : undefined;
    }
    return false;
  };
  return LOCATION_NODES.filter((n) => n.coverage === 'published' && n.slug !== slug && isWithin(n));
}
