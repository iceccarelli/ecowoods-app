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
  services: [\n    {\n      id: 'hardwood-installation',\n      name: 'Hardwood Flooring Installation',\n      description:\n        'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.',\n      priceRange: '$4,000–$15,000',\n      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],\n    },\n    {\n      id: 'floor-refinishing',\n      name: 'Hardwood Floor Refinishing',\n      description: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.',\n      priceRange: '$2,500–$8,000',\n      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],\n    },\n    {\n      id: 'dust-free-sanding',\n      name: 'Dust-Free Floor Sanding',\n      description:\n        'HEPA-sealed containment captures ~99.7% of airborne dust at the source, so most clients stay home during the work.',\n      priceRange: '$2,000–$6,000',\n      areaServed: ['Toronto', 'North York', 'Markham', 'Mississauga'],\n    },\n    {\n      id: 'floor-restoration',\n      name: 'Hardwood Floor Restoration',\n      description: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.',\n      priceRange: '$3,000–$10,000',\n      areaServed: ['Toronto', 'North York', 'Markham'],\n    },\n    {\n      id: 'custom-inlays',\n      name: 'Custom Inlays & Borders',\n      description: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.',\n      priceRange: '$2,000–$12,000',\n      areaServed: ['Toronto'],\n    },\n    {\n      id: 'stair-refinishing',\n      name: 'Stair Refinishing',\n      description: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.',\n      priceRange: '$1,500–$5,000',\n      areaServed: ['Toronto', 'North York', 'Mississauga'],\n    },\n  ],\n  foundingYear: 1998,\n  slogan: \"Toronto's master hardwood flooring artisans\",\n  description:\n    'Premium hardwood flooring in Toronto and the GTA. Installation, refinishing, sanding, custom inlays and dust-free restoration — backed by manufacturer warranties passed through in writing.',\n  logoUrl: `${SITE_URL}/icon-512.png`,\n  ogImageUrl: `${SITE_URL}/og-image.jpg`,\n};\n\n/* ────────────────────────────────────────────────────────────────────────\n * REVIEW AGGREGATE\n * ────────────────────────────────────────────────────────────────────────\n *\n * 348 verified reviews @ 4.9/5 from Google, Houzz, HomeStars combined.\n * NOT embedded in LocalBusiness (see comment in original structured-data.ts).\n * Kept separate for schema.org compliance.\n */\n\nexport const ROOT_AGGREGATE_RATING: AggregateRating = buildAggregateRating(4.9, 348);\n\n/* ────────────────────────────────────────────────────────────────────────\n * HOMEPAGE FAQ\n * ────────────────────────────────────────────────────────────────────────\n */\n\nexport const HOMEPAGE_FAQ_ITEMS: FAQItem[] = [\n  {\n    question: 'Is the estimate really fixed? What about \"unforeseen conditions\"?',\n    answer:\n      'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no \"unforeseen conditions\" to surprise you later. The number on paper is the number on your invoice.',\n  },\n  {\n    question: 'Can we stay in the house during the work?',\n    answer:\n      'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed systems. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.',\n  },\n  {\n    question: 'What warranty comes with the work?',\n    answer:\n      'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — passed through to you in writing, itemized in your contract. If anything in our workmanship isn\\'t right, we come back and make it right.',\n  },\n  {\n    question: 'How long will my project take?',\n    answer:\n      'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.',\n  },\n];\n\n/* ────────────────────────────────────────────────────────────────────────\n * BUILT SCHEMAS (exported for injection into layout)\n * ────────────────────────────────────────────────────────────────────────\n */\n\n/**\n * Root organization schema — injected on every page.\n * This is the entity all other schemas (articles, case studies, products) reference.\n */\nexport const ROOT_ORGANIZATION_SCHEMA: Organization = buildOrganization(ROOT_ORG_CONFIG);\n\n/**\n * Website schema — describes the site as a whole.\n */\nexport const ROOT_WEBSITE_SCHEMA: WebSite = buildWebSite(SITE_URL);\n\n/**\n * Homepage breadcrumb.\n */\nexport const HOMEPAGE_BREADCRUMB_SCHEMA: BreadcrumbList = buildBreadcrumbList([\n  { name: 'Home', url: SITE_URL },\n]);\n\n/**\n * Homepage FAQ schema — eligible for FAQ rich results in Google.\n */\nexport const HOMEPAGE_FAQ_SCHEMA: FAQPage = buildFAQPage(HOMEPAGE_FAQ_ITEMS);\n\n/* ────────────────────────────────────────────────────────────────────────\n * EXPORT ALL SCHEMAS AS ARRAY FOR LAYOUT INJECTION\n * ────────────────────────────────────────────────────────────────────────\n *\n * The layout.tsx renders each of these into <script type=\"application/ld+json\">\n * tags in <head>.\n */\n\nexport const ROOT_SCHEMAS = [\n  ROOT_ORGANIZATION_SCHEMA,\n  ROOT_WEBSITE_SCHEMA,\n  HOMEPAGE_BREADCRUMB_SCHEMA,\n  HOMEPAGE_FAQ_SCHEMA,\n] as const;\n