/**
 * Root schema configuration — THE SINGLE SOURCE OF TRUTH for Ecowoods' entity graph.
 *
 * This is injected into every page via the layout. All AI agents, crawlers and
 * structured data parsers ingest this to understand:
 * - Who Ecowoods is (LocalBusiness, Toronto — the age is derived from
 *   BUSINESS_NAP.foundedYear, never written down)
 * - What they serve (6 core services)
 * - Where they serve (GTA)
 * - How to reach them (phone, email, address)
 *
 * Changes here flow through to all pages automatically.
 * Keep in sync with seo-data.ts (NAP).
 */

import { FAQ_ITEMS, CITIES, SERVICES, NEIGHBOURHOOD_AREAS, type City } from '@/lib/seo-data';
import { PRICE_BANDS, priceSpecification, type PriceBand } from '@/content/constants/pricing';
import { getServicePages, priceBand } from '@/lib/service-pages';
import { LOGO_URL, OG_IMAGE_URL } from '@/lib/brand-assets';
import { BUSINESS_NAP, GOOGLE_PLACE, HOMESTARS_CANONICAL } from '@ecowoods/shared/constants';
import {
  buildOrganization,
  buildWebSite,
  buildBreadcrumbList,
  buildFAQPage,
  type OrganizationConfig,
  type RegionConfig,
  type FAQItem,
} from './builders';
import type {
  Organization,
  WebSite,
  BreadcrumbList,
  FAQPage,
  PropertyValue,
  AreaServedCity,
  AreaServedPlace,
} from './types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

/* ────────────────────────────────────────────────────────────────────────
 * PRIMARY ORGANIZATION CONFIG
 * ────────────────────────────────────────────────────────────────────────
 *
 * This is the root entity that all other schemas reference.
 * Update these values to change what Ecowoods emits to the world.
 */

/**
 * Every area this business publishes a page for, derived rather than typed.
 *
 * Each of the six services used to carry its own hand-written array, and they
 * disagreed: installation and refinishing listed four areas, restoration three,
 * custom inlays exactly one — Toronto. Nothing had decided that inlays stop at
 * the city line; the lists were written at different times and never
 * reconciled. Meanwhile CITIES carries sixteen areas, every one of which has a
 * service-area page, a sitemap entry and a route that returns 200.
 *
 * A proposed patch replaced the four arrays with the same hand-written ten,
 * repeated six times. That fixes today's disagreement and rebuilds the
 * mechanism that caused it. Derived from CITIES, the schema cannot claim
 * coverage that has no page, and cannot omit coverage that does — which is the
 * rule /services/[slug] already follows for exactly the same reason.
 */
const GTA = Array.from(
  new Set([BUSINESS_NAP.address.addressLocality, ...CITIES.map((c) => c.name)]),
);

/**
 * THE PUBLISHED REGION, STRUCTURED.
 *
 * BUSINESS_NAP.region is "Toronto & the GTA" — display copy, not a place name a
 * graph can resolve. This is the same region as three schema.org places,
 * nested: Greater Toronto Area, in Ontario, in Canada. buildOrganization()
 * emits it as the FIRST areaServed node, ahead of the sixteen City nodes
 * derived from CITIES, so a consumer that has never heard of Ajax still reads
 * the geography correctly (§9.6). It names the region the site already
 * publishes and adds no coverage — no municipality joins the list here.
 *
 * lib/schema/commercial.ts nests its City nodes under the same object, so the
 * region is one value on every page. (Not an `areaServed:` array: the City
 * list stays derived from CITIES, and scripts/verify-cities.mjs fails this
 * file on a hand-written one.)
 */
export const SERVICE_REGION: RegionConfig = {
  name: 'Greater Toronto Area',
  province: 'Ontario',
  country: 'Canada',
};

/**
 * The one node a page emits for the area it is about.
 *
 * Sixteen municipalities are City nodes. Sixteen Toronto neighbourhoods are
 * not — F-157 is the record of why — so a page about Rosedale gets a Place
 * inside the City of Toronto, not a City called Rosedale. The service-area
 * pages and the commercial graph both call this, so the distinction is made
 * in one place and the containing city is written once. (It is not derived
 * from the shop's addressLocality on purpose: that the shop is in Toronto and
 * that Rosedale is in Toronto are two facts that happen to agree today.)
 */
const NEIGHBOURHOOD_CITY = 'Toronto';

export function placeForArea(city: City): AreaServedCity | AreaServedPlace {
  const isNeighbourhood = NEIGHBOURHOOD_AREAS.some((n) => n.slug === city.slug);
  return isNeighbourhood
    ? {
        '@type': 'Place',
        name: city.name,
        containedInPlace: { '@type': 'City', name: NEIGHBOURHOOD_CITY },
      }
    : { '@type': 'City', name: city.name };
}

/**
 * KEYED IDENTIFIERS, FROM THE CONSTANTS.
 *
 * The place id, the CID and the HomeStars profile id are how Google and
 * HomeStars themselves identify this business. Emitting them as PropertyValue
 * identifiers lets a resolver join this node to those records by key rather
 * than by matching a name string — which is the join `alternateName` exists
 * to help with, done properly. Each value is read from the constant that the
 * review flywheel and the GBP copy already read; none is typed here.
 */
const IDENTIFIERS: PropertyValue[] = [
  { '@type': 'PropertyValue', propertyID: 'google_place_id', value: GOOGLE_PLACE.placeId },
  { '@type': 'PropertyValue', propertyID: 'google_cid', value: GOOGLE_PLACE.cid },
  { '@type': 'PropertyValue', propertyID: 'homestars_profile_id', value: HOMESTARS_CANONICAL.profileId },
];


/**
 * PRICE RANGES ARE DERIVED, AND FIVE INVENTED ONES WERE REMOVED.
 *
 * This block used to carry `priceRange: '$4,000–$15,000'` and four more like
 * it — project totals that appear nowhere else on this site, are derived from
 * nothing, and were being handed to Google as structured price data for the
 * business. Nobody could check them, including us. That is the exact class of
 * unsourced figure the whole project exists to eliminate, and it is worse in
 * schema than on a page: a visitor can weigh a number in context, a machine
 * quotes it.
 *
 * The published bands are per square foot and live in lib/pricing.ts. A project
 * total would need an area assumption this site does not publish, so it is not
 * published here either. `servicePriceRange()` reads the same band the service
 * page renders, and returns undefined where no band is published rather than
 * inventing one.
 *
 * scripts/verify-schema-figures.mjs fails the build on a currency amount or a
 * percentage typed as a literal anywhere in the schema layer.
 */
const servicePriceRange = (slug: string): string | undefined => {
  const page = getServicePages().find((p) => p.slug === slug);
  return page ? priceBand(page) : undefined;
};

/**
 * THE PUBLISHED BANDS AS AN OfferCatalog.
 *
 * Three Offers, one per band in content/constants/pricing.ts — min, max,
 * currency and the FTK unit code all come out of priceSpecification(), so no
 * price is originated here and scripts/verify-schema-figures.mjs stays green.
 *
 * `itemOffered` is an @id REFERENCE to the Service node the organization
 * already emits (which /services/[slug] also renders), never a copy: the band
 * name a machine reads in this catalog is the same name a person reads on the
 * pricing cards, and the service it prices is the same node the rest of the
 * graph points at. Screen & Recoat and Full Sand & Finish both price
 * floor-refinishing — two published intensities of the same service.
 *
 * lib/registry/registry.ts exports the same three-entry map. It is repeated
 * here rather than imported because the registry is server-only — its module
 * graph reaches the case-study loader and node:fs — and this schema layer is
 * a set of synchronous constants with no Node builtin behind it, which is what
 * lets scripts/verify-client-boundary.mjs keep it importable from anywhere.
 */
const BAND_SERVICE_SLUG: Record<PriceBand['key'], string> = {
  screenAndRecoat: 'floor-refinishing',
  fullSandAndFinish: 'floor-refinishing',
  newInstall: 'hardwood-installation',
};

const BAND_OFFER_CATALOG = {
  '@type': 'OfferCatalog' as const,
  name: 'Hardwood flooring — published price bands',
  itemListElement: PRICE_BANDS.map((band) => ({
    '@context': 'https://schema.org' as const,
    '@type': 'Offer' as const,
    name: band.label,
    priceCurrency: band.currency,
    priceSpecification: priceSpecification(band),
    itemOffered: { '@id': `${SITE_URL}/services/${BAND_SERVICE_SLUG[band.key]}#service` },
    areaServed: GTA.map((name) => ({ '@type': 'City' as const, name })),
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/services/${BAND_SERVICE_SLUG[band.key]}`,
  })),
};

/**
 * THE ENTITY, DERIVED.
 *
 * Every field below was a string literal. They all agreed with
 * BUSINESS_NAP — which is the dangerous state, not the safe one: a second
 * copy that agrees looks exactly like a single source of truth right up to the
 * day someone changes one of them. And this is the object a search engine reads
 * to decide WHO this business is. lib/structured-data.ts held a third copy of
 * the same five fields, on the thirty-two service-area pages. Both now derive.
 *
 * `pnpm seo:claims` fails the build on a NAP literal anywhere outside
 * packages/shared/constants.
 */
export const ROOT_ORG_CONFIG: OrganizationConfig = {
  siteUrl: SITE_URL,
  name: BUSINESS_NAP.name,
  legalName: BUSINESS_NAP.legalName,
  alternateName: [...BUSINESS_NAP.alternateNames],
  phone: BUSINESS_NAP.phoneSchema,
  phoneHref: BUSINESS_NAP.phoneHref,
  email: BUSINESS_NAP.email,
  // The QuoteAction target (§17). Built from SITE_URL, never a typed host.
  estimateUrl: `${SITE_URL}/estimate`,
  identifiers: IDENTIFIERS,
  region: SERVICE_REGION,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS_NAP.address.streetAddress,
    addressLocality: BUSINESS_NAP.address.addressLocality,
    addressRegion: BUSINESS_NAP.address.addressRegion,
    postalCode: BUSINESS_NAP.address.postalCode,
    addressCountry: BUSINESS_NAP.address.addressCountry,
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: BUSINESS_NAP.address.latitude,
    longitude: BUSINESS_NAP.address.longitude,
  },
  // Derived, like the per-service lists below. This block was sixteen
  // hand-typed City nodes that happened to agree with CITIES today; the
  // per-service lists were four hand-typed nodes that did not. One source.
  areaServed: GTA.map((name) => ({ '@type': 'City' as const, name })),
  /**
   * THE SERVICES, DERIVED FROM THE TEXT A VISITOR READS.
   *
   * This was six hand-typed objects — a second copy of SERVICES in
   * lib/seo-data.ts, which is the array the service-area pages, /services and
   * llms.txt render. The copies had already drifted: the dust-free-sanding
   * description here said "HEPA-sealed containment captures dust at the source
   * rather than after it settles, so most clients stay in the house", while the
   * visible card said "HEPA-sealed extraction at the machine and containment at
   * the room, so most clients stay home". Neither is wrong. Both being published
   * is — JSON-LD that says something different from the page it sits on is the
   * one class of schema error a validator cannot see and a crawler penalises.
   *
   * Now `description` IS `blurb`: the string a machine reads for a service is,
   * byte for byte, the string a person reads on the card. The @id pattern
   * (/services/<slug>#service) is unchanged and still checked by
   * scripts/verify-services.mjs against the route tree.
   */
  services: SERVICES.map((s) => ({
    id: s.slug,
    name: s.name,
    description: s.blurb,
    priceRange: servicePriceRange(s.slug),
    areaServed: GTA,
  })),
  foundingYear: BUSINESS_NAP.foundedYear,
  offerCatalog: BAND_OFFER_CATALOG,
  slogan: "Toronto's master hardwood flooring artisans",
  description:
    'Custom hardwood floor installation and dust-free refinishing in Toronto and the GTA. Fixed written estimates; manufacturer warranties passed through in writing.',
  // Both of these used to be hand-written paths into apps/web/public, and both
  // returned 404 in production for the life of the project. See F-162 and
  // lib/brand-assets.ts — the URLs are now derived from imported files, so a
  // missing one fails the build instead of the Knowledge Panel.
  logoUrl: LOGO_URL,
  ogImageUrl: OG_IMAGE_URL,
};

/* ────────────────────────────────────────────────────────────────────────
 * REVIEWS
 * ────────────────────────────────────────────────────────────────────────
 *
 * Review figures are cited to source (REVIEW_EVIDENCE in
 * packages/shared/constants) on /reviews, /llms.txt and /ai.txt with a link
 * and a read date. The organisation node carries no self-serving
 * aggregateRating, per Google's structured-data policy.
 */

/* ────────────────────────────────────────────────────────────────────────
 * HOMEPAGE FAQ
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * Homepage FAQ, derived from the single source in lib/seo-data.ts.
 *
 * This was a verbatim second copy of FAQ_ITEMS — byte-identical, verified by
 * comparison before it was removed, so this is a de-duplication and not a
 * content change. A third copy still lives in app/home-client.tsx as the
 * VISIBLE text, and its wording has already drifted from this one; reconciling
 * the two is a content decision.
 */
export const HOMEPAGE_FAQ_ITEMS: FAQItem[] = FAQ_ITEMS.map((f) => ({
  question: f.q,
  answer: f.a,
}));

/* ────────────────────────────────────────────────────────────────────────
 * BUILT SCHEMAS (exported for injection into layout)
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * Root organization schema — injected on every page.
 * This is the entity all other schemas (articles, case studies, products) reference.
 */
export const ROOT_ORGANIZATION_SCHEMA: Organization = buildOrganization(ROOT_ORG_CONFIG);

/**
 * Website schema — describes the site as a whole.
 */
export const ROOT_WEBSITE_SCHEMA: WebSite = buildWebSite(SITE_URL);

/**
 * Homepage breadcrumb.
 */
export const HOMEPAGE_BREADCRUMB_SCHEMA: BreadcrumbList = buildBreadcrumbList([
  { name: 'Home', url: SITE_URL },
]);

/**
 * Homepage FAQ schema — eligible for FAQ rich results in Google.
 */
export const HOMEPAGE_FAQ_SCHEMA: FAQPage = buildFAQPage(HOMEPAGE_FAQ_ITEMS);

/* ────────────────────────────────────────────────────────────────────────
 * EXPORT ALL SCHEMAS AS ARRAY FOR LAYOUT INJECTION
 * ────────────────────────────────────────────────────────────────────────
 *
 * The layout.tsx renders each of these into <script type="application/ld+json">
 * tags in <head>.
 */

export const ROOT_SCHEMAS = [
  ROOT_ORGANIZATION_SCHEMA,
  ROOT_WEBSITE_SCHEMA,
  HOMEPAGE_BREADCRUMB_SCHEMA,
  HOMEPAGE_FAQ_SCHEMA,
] as const;
