/**
 * lib/registry/locations.ts — location intelligence (Protocol v2, Stage 7).
 *
 * A PROJECTION. Since GEO-001 this file owns no geographic fact: every node is
 * built from content/geo/markets.ts (who is covered, what kind of place it is,
 * what it is part of), content/geo/regions.ts (which region a municipality sits
 * in, and the Southern Ontario places that are named but not covered) and
 * lib/seo-data.ts (which areas have a page). Before GEO-001 it kept its own list
 * of forty-one municipalities with a region each and a default parent of the
 * GTA, and so it reported owner-confirmed markets as "not a published service
 * area" and hung Buffalo, Rochester and four Niagara municipalities from the
 * Greater Toronto Area (docs/GEO_CONTRADICTION_LOG.md GC-002, GC-004, GC-005).
 *
 * Hierarchy: Canada → Ontario → Southern Ontario → GTA / Niagara Region /
 * Waterloo Region → municipality → district / neighbourhood; and United States →
 * New York State → municipality → district. Toronto is a `region` node: the
 * City of Toronto itself has no service-area page, and its published areas are
 * its six former municipalities and seventeen neighbourhoods.
 *
 * The matcher still needs to answer honestly about places the site does not
 * list: a query about London or Kingston resolves to a real place with coverage
 * `assessment` and the estimate action — never to `unknown`, and never to a
 * fabricated "yes, covered".
 */
import { CITIES, NEIGHBOURHOOD_AREAS, DISTRICT_AREAS, SERVICE_AREAS, cityContent } from '@/lib/seo-data';
import { MARKETS, marketBySlug } from '@/content/geo/markets';
import { REGION_NODES, DISCOVERY, regionOf } from '@/content/geo/regions';
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
  /* GEO-001: the eleven municipalities published with this patch. Aliases are
     the communities inside each that a person types instead of its name. */
  whitby: ['brooklin', 'port whitby'],
  oshawa: ['lakeview park', 'oshawa ontario'],
  clarington: ['bowmanville', 'courtice', 'orono'],
  'kawartha-lakes': ['city of kawartha lakes', 'lindsay', 'fenelon falls', 'bobcaygeon'],
  'halton-hills': ['georgetown', 'acton', 'glen williams'],
  caledon: ['bolton', 'caledon east', 'caledon village'],
  innisfil: ['alcona', 'lefroy'],
  guelph: ['guelph ontario'],
  cambridge: ['galt', 'preston', 'hespeler', 'cambridge ontario'],
  kitchener: ['kitchener ontario', 'kitchener on'],
  'port-colborne': ['port colborne'],
  milton: [],
  burlington: ['aldershot', 'millcroft', 'alton village'],
  hamilton: ['hamilton ontario', 'hamilton on', 'city of hamilton', 'the hammer', 'hamilton mountain'],
  grimsby: ['grimsby beach'],
  'st-catharines': ['st catharines', 'saint catharines', 'port dalhousie'],
  'niagara-on-the-lake': ['niagara on the lake', 'notl', 'st davids', 'virgil'],
  'niagara-falls-on': ['niagara falls', 'niagara falls ontario', 'niagara falls on', 'chippawa'],
  barrie: ['allandale', 'painswick'],
  ancaster: ['ancaster village', 'meadowlands'],
  dundas: ['dundas ontario'],
  'stoney-creek': ['stoneycreek', 'winona'],
  waterdown: [],
  beamsville: ['vineland', 'campden'],
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

/** The City of Toronto's own node aliases. */
const TORONTO_ALIASES = ['city of toronto', 'toronto ontario', 'toronto on', 'toronto canada', 'the six', 'tdot', 't.o.', 'to'];

/**
 * The hierarchy, built once, from the fact files.
 *
 * Every market in content/geo/markets.ts becomes exactly one node; every
 * published area is `published`; every region node comes from regions.ts; and
 * every Southern Ontario place that is not a market is `assessment`. A place is
 * never both a market and an assessment node — the second is only built for
 * slugs the first did not claim.
 */
export function buildLocationNodes(): LocationNode[] {
  const nodes: LocationNode[] = REGION_NODES.map((r) => ({
    slug: r.slug,
    name: r.name,
    tier: r.tier as LocationTier,
    coverage: r.coverage,
    parent: r.parent,
    aliases: [...r.aliases],
  }));
  const has = (slug: string) => nodes.some((n) => n.slug === slug);
  const add = (n: LocationNode) => {
    if (!has(n.slug)) nodes.push(n);
  };
  const published = new Set(SERVICE_AREAS.map((a) => a.slug));

  /* Toronto: a region node. Its published areas are the districts and
     neighbourhoods below, each hanging from it. */
  add({ slug: 'toronto', name: 'Toronto', tier: 'municipality', coverage: 'region', parent: 'gta', aliases: TORONTO_ALIASES });

  for (const c of CITIES) {
    const m = marketBySlug(c.slug);
    add({
      slug: c.slug,
      name: c.name,
      tier: 'municipality',
      coverage: 'published',
      parent: regionOf(c.slug, m?.country ?? 'CA'),
      aliases: PUBLISHED_ALIASES[c.slug] ?? [],
    });
  }
  for (const n of NEIGHBOURHOOD_AREAS) {
    add({
      slug: n.slug,
      name: n.name,
      tier: 'neighbourhood',
      coverage: 'published',
      parent: marketBySlug(n.slug)?.partOf ?? 'toronto',
      aliases: PUBLISHED_ALIASES[n.slug] ?? [],
    });
  }
  /* Districts: the six former municipalities of Toronto, and communities inside
     a municipality elsewhere. Each hangs from the municipality the market
     registry says it is part of. */
  for (const d of DISTRICT_AREAS) {
    add({
      slug: d.slug,
      name: d.name,
      tier: 'district',
      coverage: 'published',
      parent: marketBySlug(d.slug)?.partOf ?? slugify(d.partOf),
      aliases: PUBLISHED_ALIASES[d.slug] ?? [],
    });
  }
  /* Any market without a page. None today — every market is published or, for
     Toronto, a region — but a market added tomorrow without a page is still a
     real place with a real parent, not a gap in the hierarchy. */
  for (const m of MARKETS) {
    if (published.has(m.slug)) continue;
    add({
      slug: m.slug,
      name: m.name,
      tier: m.kind === 'district' ? 'district' : 'municipality',
      coverage: 'assessment',
      parent: m.partOf ?? regionOf(m.slug, m.country),
      aliases: [],
    });
  }
  for (const d of DISCOVERY) {
    add({ slug: d.slug, name: d.name, tier: 'municipality', coverage: 'assessment', parent: regionOf(d.slug, 'CA'), aliases: d.aliases ?? [] });
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
