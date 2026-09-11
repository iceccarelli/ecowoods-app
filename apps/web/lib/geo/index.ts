/**
 * lib/geo — one import surface for the geographic layer.
 *
 * Everything downstream — routes, metadata, schema, sitemap, internal links,
 * the /api/v1 geo endpoints, the AI surfaces and the guards — reads from here.
 * Nothing copies a city array into a component.
 */
export {
  MARKETS,
  marketBySlug,
  marketsInCorridor,
  isOperational,
  OPERATIONAL_STATUSES,
} from '@/content/geo/markets';
export type { Market, MarketStatus, MarketKind } from '@/content/geo/markets';

export { CORRIDORS, corridorById } from '@/content/geo/corridors';
export type { Corridor, CorridorId } from '@/content/geo/corridors';

export { assess, indexableMarkets, contentQueue, expansionScore, expansionOrder } from './worthiness';
export type { Worthiness, ExpansionScore } from './worthiness';

import { MARKETS, isOperational, type Market } from '@/content/geo/markets';
import { corridorsFor as corridorsForRaw, corridorById as corridorByIdRaw } from '@/content/geo/corridors';

/**
 * The markets that may be emitted as service area.
 *
 * Districts are excluded deliberately: Etobicoke is part of Toronto and
 * Ancaster is part of Hamilton, and declaring either a peer City node of the
 * municipality containing it is a factual error in the part of the site a
 * machine reads literally. F-157.
 */
export const serviceAreaMarkets = (): Market[] =>
  MARKETS.filter((x) => isOperational(x) && x.kind === 'municipality');

/**
 * Corridors a market sits on, resolving a district through the municipality it
 * is part of.
 */
export const corridorsFor = (slug: string) =>
  corridorsForRaw(slug, (s) => MARKETS.find((x) => x.slug === s)?.partOf);

/**
 * THE STOPS ON A CORRIDOR, AS THEY ACTUALLY SIT (GEO-002).
 *
 * `Corridor.members` names municipalities and nothing else — a corridor is a
 * drive between municipalities, and a district inherits its membership through
 * `partOf`. Before GEO-002 five districts were typed into `members` beside the
 * cities that contain them (GC-016), so the corridor surfaces showed Stoney
 * Creek as a peer of Hamilton and Kenmore as a peer of Buffalo. Removing them
 * from the fact list without putting them back somewhere true would have cost
 * five internal links and made the corridor pages less useful than they were.
 *
 * So the display is derived instead: each municipality on the route, in travel
 * order, carrying the districts inside it. Publish a district and it appears on
 * its municipality's corridor with no list to update; a district can never
 * appear without its municipality, because it hangs from it here.
 *
 * Nothing here decides whether a place is covered or published. It reads the
 * market registry's own `partOf` and returns structure; the page and the twin
 * apply the worthiness gate to decide what becomes a link.
 */
export interface CorridorStop {
  municipality: Market;
  /** Districts inside it, in registry order. Empty for most municipalities. */
  districts: Market[];
}

export const corridorStops = (id: string): CorridorStop[] => {
  const corridor = corridorByIdRaw(id);
  if (!corridor) return [];
  return corridor.members
    .map((slug) => MARKETS.find((x) => x.slug === slug))
    .filter((m): m is Market => Boolean(m))
    .map((municipality) => ({
      municipality,
      districts: MARKETS.filter((x) => x.kind === 'district' && x.partOf === municipality.slug),
    }));
};

/** Every market on a corridor — municipalities and the districts inside them, flat, in order. */
export const corridorMarkets = (id: string): Market[] =>
  corridorStops(id).flatMap((s) => [s.municipality, ...s.districts]);

/** Canonical path for a market that has a page. */
export const marketPath = (slug: string): string => `/service-areas/${slug}`;
export const corridorPath = (id: string): string => `/corridors/${id}`;

export {
  opportunity,
  opportunityOrder,
  unsourcedInputs,
  MIN_CONFIDENCE,
  type Opportunity,
  type Classification,
} from './opportunity';
