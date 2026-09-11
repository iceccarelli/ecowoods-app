import { SITE_URL } from '@/lib/seo-data';
import { CORRIDORS, corridorStops, corridorMarkets, assess, type Corridor } from '@/lib/geo';
import { placeForMarket } from './root-schema';

/**
 * Structured data for the corridor pages.
 *
 * WHY THIS EXISTS (GEO-002)
 *
 * `/corridors` and its eleven route pages are the only place on this site that
 * answers "who covers the Niagara run" with the actual shape of the answer — a
 * hub, a highway, and the municipalities on it in travel order. They were also
 * the least machine-readable pages the business owned: one BreadcrumbList each
 * and nothing else. A crawler could read that a page existed and that it was
 * called "Niagara Belt", and had to parse a table to learn anything a machine
 * could act on.
 *
 * WHAT IS CLAIMED, AND WHAT IS NOT
 *
 * Two lists, deliberately different, because they answer different questions.
 *
 *   · `itemListElement` is THE DRIVE. Municipalities only, in the order a crew
 *     reaches them, positions 1..n. That is what a corridor is, and a district
 *     is not a stop on it — Stoney Creek is somewhere inside Hamilton, not a
 *     place the truck arrives at separately (GC-016).
 *
 *   · `areaServed` is COVERAGE. Every market on the route, districts included,
 *     whose operational position the owner has confirmed on a date. A market
 *     nobody has confirmed is on the page — with the sentence saying so — and
 *     is not in this list, because `areaServed` is read as a claim.
 *
 * Both are derived. Nothing here can name a place the registry does not carry,
 * put a district beside the city that contains it, or place a New York town in
 * Ontario: every node comes from `placeForMarket`, which is the same hierarchy
 * rule the service-area pages and the organisation node use (GEO-001).
 *
 * No Offer and no price appears here. The bands are Ontario bands in Canadian
 * dollars and three of these routes are American; the corridor pages link to
 * /pricing rather than restating it. scripts/verify-schema-figures.mjs fails
 * the build on a currency literal anywhere in this directory, which is the
 * mechanical half of the same rule.
 */

const ORG = { '@id': `${SITE_URL}/#organization` };
const WEBSITE = { '@id': `${SITE_URL}/#website` };

/** Markets on the route whose coverage the owner has confirmed, as place nodes. */
const confirmedPlaces = (id: string) =>
  corridorMarkets(id)
    .filter((m) => m.operationalTruth.verifiedAt)
    .map((m) => placeForMarket(m.slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

/** One route: the page, the service it offers, and the stops in travel order. */
export function buildCorridorSchema(corridor: Corridor): Record<string, unknown> {
  const url = `${SITE_URL}/corridors/${corridor.id}`;
  const stops = corridorStops(corridor.id);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: `${corridor.name} — ${corridor.route}`,
        description: corridor.summary,
        inLanguage: 'en-CA',
        isPartOf: WEBSITE,
        about: ORG,
        mainEntity: { '@id': `${url}#service` },
        /* The machine edition of this page, declared where a consumer that
           reads JSON-LD but not <head> will still find it. */
        encoding: {
          '@type': 'MediaObject',
          encodingFormat: 'text/markdown',
          contentUrl: `${url}.md`,
        },
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: `Hardwood flooring along the ${corridor.name} route`,
        description: corridor.summary,
        serviceType: 'Hardwood flooring',
        url,
        provider: ORG,
        areaServed: confirmedPlaces(corridor.id),
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#stops`,
        name: `Municipalities on the ${corridor.name} route, in travel order`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: stops.length,
        itemListElement: stops.map((stop, i) => {
          const place = placeForMarket(stop.municipality.slug);
          const worthy = assess(stop.municipality).indexable;
          return {
            '@type': 'ListItem',
            position: i + 1,
            name: stop.municipality.name,
            ...(worthy ? { url: `${SITE_URL}/service-areas/${stop.municipality.slug}` } : {}),
            ...(place ? { item: place } : {}),
          };
        }),
      },
    ],
  };
}

/** The index: every route, as an ordered list a consumer can walk. */
export function buildCorridorsIndexSchema(): Record<string, unknown> {
  const url = `${SITE_URL}/corridors`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name: 'Coverage by corridor — the routes this work is organised along',
    inLanguage: 'en-CA',
    isPartOf: WEBSITE,
    about: ORG,
    encoding: {
      '@type': 'MediaObject',
      encodingFormat: 'text/markdown',
      contentUrl: `${url}.md`,
    },
    mainEntity: {
      '@type': 'ItemList',
      '@id': `${url}#routes`,
      numberOfItems: CORRIDORS.length,
      itemListElement: CORRIDORS.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        description: c.route,
        url: `${url}/${c.id}`,
      })),
    },
  };
}
