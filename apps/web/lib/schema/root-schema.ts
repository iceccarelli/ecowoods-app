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
  areaServed: [
    { '@type': 'City', name: 'Toronto' },
    { '@type': 'City', name: 'North York' },
    { '@type': 'City', name: 'Etobicoke' },
    { '@type': 'City', name: 'Scarborough' },
    { '@type': 'City', name: 'East York' },
    { '@type': 'City', name: 'York' },
    { '@type': 'City', name: 'Vaughan' },
    { '@type': 'City', name: 'Markham' },
    { '@type': 'City', name: 'Richmond Hill' },
    { '@type': 'City', name: 'Mississauga' },
    { '@type': 'City', name: 'Oakville' },
    { '@type': 'City', name: 'Brampton' },
    { '@type': 'City', name: 'Aurora' },
    { '@type': 'City', name: 'Newmarket' },
    { '@type': 'City', name: 'Pickering' },
    { '@type': 'City', name: 'Ajax' },
  ],
  services: [
    {
      id: 'hardwood-installation',
      name: 'Hardwood Flooring Installation',
      description:
        'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.',
      priceRange: '$4,000–$15,000',
      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],
    },
    {
      id: 'floor-refinishing',
      name: 'Hardwood Floor Refinishing',
      description: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.',
      priceRange: '$2,500–$8,000',
      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],
    },
    {
      id: 'dust-free-sanding',
      name: 'Dust-Free Floor Sanding',
      description:
        'HEPA-sealed containment captures ~99.7% of airborne dust at the source, so most clients stay home during the work.',
      priceRange: '$2,000–$6,000',
      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],
    },
    {
      id: 'floor-restoration',
      name: 'Hardwood Floor Restoration',
      description: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.',
      priceRange: '$3,000–$10,000',
      areaServed: ['Toronto', 'North York', 'Markham'],
    },
    {
      id: 'custom-inlays',
      name: 'Custom Inlays & Borders',
      description: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.',
      priceRange: '$2,000–$12,000',
      areaServed: ['Toronto'],
    },
    {
      id: 'stair-refinishing',
      name: 'Stair Refinishing',
      description: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.',
      priceRange: '$1,500–$5,000',
      areaServed: ['Toronto', 'North York', 'Mississauga'],
    },
  ],
  foundingYear: 1998,
  slogan: "Toronto's master hardwood flooring artisans",
  description:
    'Premium hardwood flooring in Toronto and the GTA. Installation, refinishing, sanding, custom inlays and dust-free restoration — backed by manufacturer warranties passed through in writing.',
  logoUrl: `${SITE_URL}/icon-512.png`,
  ogImageUrl: `${SITE_URL}/og-image.jpg`,
};

/* ────────────────────────────────────────────────────────────────────────
 * REVIEW AGGREGATE
 * ────────────────────────────────────────────────────────────────────────
 *
 * 348 verified reviews @ 4.9/5 from Google, Houzz, HomeStars combined.
 * NOT embedded in LocalBusiness (see comment in original structured-data.ts).
 * Kept separate for schema.org compliance.
 */

export const ROOT_AGGREGATE_RATING: AggregateRating = buildAggregateRating(4.9, 348);

/* ────────────────────────────────────────────────────────────────────────
 * HOMEPAGE FAQ
 * ────────────────────────────────────────────────────────────────────────
 */

export const HOMEPAGE_FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Is the estimate really fixed? What about "unforeseen conditions"?',
    answer:
      'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no "unforeseen conditions" to surprise you later. The number on paper is the number on your invoice.',
  },
  {
    question: 'Can we stay in the house during the work?',
    answer:
      'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed systems. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.',
  },
  {
    question: 'What warranty comes with the work?',
    answer:
      'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — passed through to you in writing, itemized in your contract. If anything in our workmanship isn\'t right, we come back and make it right.',
  },
  {
    question: 'How long will my project take?',
    answer:
      'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.',
  },
];

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
