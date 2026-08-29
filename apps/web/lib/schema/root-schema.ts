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

import { FAQ_ITEMS, CITIES } from '@/lib/seo-data';
import { getServicePages, priceBand } from '@/lib/service-pages';
import { LOGO_URL, OG_IMAGE_URL } from '@/lib/brand-assets';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import {
  buildOrganization,
  buildWebSite,
  buildBreadcrumbList,
  buildFAQPage,
  buildAggregateRating,
  type OrganizationConfig,
  type FAQItem,
} from './builders';
import type { Organization, WebSite, BreadcrumbList, FAQPage, AggregateRating } from './types';

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
  email: BUSINESS_NAP.email,
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
  services: [
    {
      id: 'hardwood-installation',
      name: 'Hardwood Flooring Installation',
      description:
        'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.',
      priceRange: servicePriceRange('hardwood-installation'),
      areaServed: GTA,
    },
    {
      id: 'floor-refinishing',
      name: 'Hardwood Floor Refinishing',
      description:
 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.',
      priceRange: servicePriceRange('floor-refinishing'),
      areaServed: GTA,
    },
    {
      id: 'dust-free-sanding',
      name: 'Dust-Free Floor Sanding',
      description:
        'HEPA-sealed containment captures dust at the source rather than after it settles, so most clients stay in the house during the work.',
      priceRange: servicePriceRange('dust-free-sanding'),
      areaServed: GTA,
    },
    {
      id: 'floor-restoration',
      name: 'Hardwood Floor Restoration',
      description:
 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.',
      priceRange: servicePriceRange('floor-restoration'),
      areaServed: GTA,
    },
    {
      id: 'custom-inlays',
      name: 'Custom Inlays & Borders',
      description:
 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.',
      priceRange: servicePriceRange('custom-inlays'),
      areaServed: GTA,
    },
    {
      id: 'stair-refinishing',
      name: 'Stair Refinishing',
      description:
 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.',
      priceRange: servicePriceRange('stair-refinishing'),
      areaServed: GTA,
    },
  ],
  foundingYear: BUSINESS_NAP.foundedYear,
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
 * REVIEW AGGREGATE
 * ────────────────────────────────────────────────────────────────────────
 *
 * 348 verified reviews @ 4.9/5 from Google, Houzz, HomeStars combined.  (facts-allow)
 * NOT embedded in LocalBusiness (see comment in original structured-data.ts).
 * Kept separate for schema.org compliance.
 */

/**
 * ⚠️ DO NOT WIRE THIS INTO ANY EMITTED SCHEMA.
 *
 * The 4.9 / 348 figures it used to carry were not reported by any review
 * platform. Beyond that, Google's structured-data policy prohibits
 * self-serving aggregateRating markup on your own LocalBusiness — see the
 * standing note in lib/structured-data.ts.
 *
 * Kept only so the export does not break; it resolves to null and the value
 * is never rendered. Delete once nothing imports it.
 */
export const ROOT_AGGREGATE_RATING: AggregateRating | null = null;

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
 * the two is a content decision and is recorded in audit/DEFERRED.md Q5.
 * See audit/FINDINGS.md F-28.
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
