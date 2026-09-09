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

export { assess, indexableMarkets, contentQueue } from './worthiness';
export type { Worthiness } from './worthiness';

import { MARKETS, isOperational, type Market } from '@/content/geo/markets';
import { corridorsFor as corridorsForRaw } from '@/content/geo/corridors';

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

/** Canonical path for a market that has a page. */
export const marketPath = (slug: string): string => `/service-areas/${slug}`;
export const corridorPath = (id: string): string => `/corridors/${id}`;
