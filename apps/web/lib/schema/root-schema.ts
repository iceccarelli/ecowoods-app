/**
 * Root schema configuration — THE SINGLE SOURCE OF TRUTH for EcoWoods' entity graph.
 *
 * This is injected into every page via the layout. All AI agents, crawlers and
 * structured data parsers ingest this to understand:
 * - Who EcoWoods is (LocalBusiness, 25 years old, Toronto)
 * - What they serve (6 core services)
 * - Where they serve (GTA)
 * - How to reach them (phone, email, address)
 *
 * Changes here flow through to all pages automatically.
 * Keep in sync with seo-data.ts (NAP).
 */

import { FAQ_ITEMS, CITIES } from '@/lib/seo-data';
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
 * Update these values to change what EcoWoods emits to the world.
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

export const ROOT_ORG_CONFIG: OrganizationConfig = {
  siteUrl: SITE_URL,
  name: 'Ecowoods Inc.',
  legalName: 'Ecowoods Hardwood Flooring Inc.',
  phone: '+1-647-244-5156',
  email: 'services@ecowoods.ca',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '32 Norfield Crescent',
    addressLocality: 'Toronto',
    addressRegion: 'ON',
    postalCode: 'M9W 1X6',
    addressCountry: 'CA',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 43.72085,
    longitude: -79.57542,
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
      priceRange: '$4,000–$15,000',
      areaServed: GTA,
    },
    {
      id: 'floor-refinishing',
      name: 'Hardwood Floor Refinishing',
      description: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.',
      priceRange: '$2,500–$8,000',
      areaServed: GTA,
    },
    {
      id: 'dust-free-sanding',
      name: 'Dust-Free Floor Sanding',
      description:
        'HEPA-sealed containment captures ~99.7% of airborne dust at the source, so most clients stay home during the work.',
      priceRange: '$2,000–$6,000',
      areaServed: GTA,
    },
    {
      id: 'floor-restoration',
      name: 'Hardwood Floor Restoration',
      description: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.',
      priceRange: '$3,000–$10,000',
      areaServed: GTA,
    },
    {
      id: 'custom-inlays',
      name: 'Custom Inlays & Borders',
      description: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.',
      priceRange: '$2,000–$12,000',
      areaServed: GTA,
    },
    {
      id: 'stair-refinishing',
      name: 'Stair Refinishing',
      description: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.',
      priceRange: '$1,500–$5,000',
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
