/**
 * Schema builders — produce production-grade JSON-LD for all entity types.
 * These functions are the source of truth for what EcoWoods emits to search engines and AI agents.
 */

import { PROFILE_LINKS } from '@ecowoods/shared/constants';
import type {
  Organization,
  Service,
  Article,
  CaseStudy,
  LocalBusinessEntity,
  Thing,
  WebSite,
  BreadcrumbList,
  BreadcrumbItem,
  FAQPage,
  Question,
  Product,
  Offer,
  AggregateRating,
  PostalAddress,
  GeoCoordinates,
  OpeningHoursSpecification,
  AreaServedCity,
  Person,
} from './types';

/* ────────────────────────────────────────────────────────────────────────
 * ROOT ORGANIZATION (LocalBusiness)
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrganizationConfig {
  siteUrl: string;
  name: string;
  legalName: string;
  phone: string;
  email: string;
  address: PostalAddress;
  geo: GeoCoordinates;
  areaServed: AreaServedCity[];
  services: ServiceConfig[];
  foundingYear: number;
  slogan: string;
  description: string;
  logoUrl: string;
  ogImageUrl: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  priceRange?: string;
  areaServed: string[];
}

export function buildOrganization(config: OrganizationConfig): Organization {
  const baseUrl = config.siteUrl.replace(/\/$/, '');

  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${baseUrl}/#organization`,

    // Core identity
    name: config.name,
    legalName: config.legalName,
    url: baseUrl,
    telephone: config.phone,
    email: config.email,
    image: config.ogImageUrl,
    /**
     * F-166. This read `${baseUrl}/icon-512.png` — a hardcoded path that
     * IGNORED the `logoUrl` the caller passes in, two lines after `image`
     * correctly used `config.ogImageUrl`.
     *
     * So F-162 fixed the config and the config was never read. root-schema.ts
     * started deriving logoUrl from an imported file, verify-assets.mjs went
     * green, and the deployed homepage kept serving the same 404 it had served
     * all along. The only thing that noticed was the live check added in the
     * same patch, on its first run against production — which is the entire
     * argument for that file existing.
     *
     * Two fields, one of which honoured its config and one of which did not, is
     * the kind of asymmetry that survives review because both lines look
     * plausible on their own.
     */
    logo: config.logoUrl,

    // Brand voice
    slogan: config.slogan,
    description: config.description,
    foundingDate: String(config.foundingYear),
    priceRange: '$$',

    // Location
    address: config.address,
    geo: config.geo,
    areaServed: config.areaServed,

    // Hours (Mon-Sat 8am-7pm, Sun 10am-4pm)
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '08:00',
        closes: '19:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Sunday',
        opens: '10:00',
        closes: '16:00',
      },
    ] as OpeningHoursSpecification[],

    // Services (nested)
    service: config.services.map((svc) =>
      buildService({
        id: svc.id,
        name: svc.name,
        description: svc.description,
        priceRange: svc.priceRange,
        areaServed: svc.areaServed,
        siteUrl: baseUrl,
      })
    ),

    /**
     * sameAs tells Google which external profiles are THIS entity. A wrong URL
     * here is worse than an omission — it asks Google to resolve your business
     * to a page that is not yours, which undercuts the local-SEO work.
     *
     * Previously hardcoded, and wrong: 'instagram.com/ecowoods.ca' is not the
     * handle in use (the real one is @ecowoodshardwood, matching the
     * ecowoodshardwood.com domain), and the Houzz /pro/ URL was never verified.
     *
     * Now derived from PROFILE_LINKS, so an entry appears here only once its
     * URL has been opened and confirmed. Adding the verified HomeStars profile
     * also links the entity to real reviews.
     */
    sameAs: PROFILE_LINKS.filter((p) => p.href).map((p) => p.href!),
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * SERVICE (nested under Organization)
 * ──────────────────────────────────────────────────────────────────────── */

export interface ServiceConfig2 {
  id: string;
  name: string;
  description: string;
  priceRange?: string;
  areaServed: string[];
  siteUrl: string;
}

export function buildService(config: ServiceConfig2): Service {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${config.siteUrl}/services/${config.id}#service`,
    name: config.name,
    description: config.description,
    areaServed: config.areaServed.map((name) => ({ '@type': 'City' as const, name })),
    ...(config.priceRange && {
      offers: [
        {
          '@context': 'https://schema.org',
          '@type': 'Offer',
          priceCurrency: 'CAD',
          priceRange: config.priceRange,
          /**
           * F-147. This read `availability: 'PT10M'` with the comment "10
           * minutes response time estimate". `availability` takes an
           * ItemAvailability enum — InStock, OutOfStock, PreOrder. 'PT10M' is
           * an ISO 8601 duration, which is a valid value for a completely
           * different property, so the field parsed as a string and was
           * silently discarded by every consumer. Six Offer nodes carried it.
           *
           * A response-time estimate is not a schema.org availability and this
           * business has published no service-level commitment to put there, so
           * the intended meaning is dropped rather than relocated into a
           * property it would also be wrong in.
           */
          availability: 'https://schema.org/InStock',
        },
      ] as Offer[],
    }),
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * ARTICLE (TechArticle for technical content)
 * ──────────────────────────────────────────────────────────────────────── */

export interface ArticleConfig {
  id: string; // slug
  headline: string;
  description: string;
  content?: string;
  author: {
    name: string;
    title?: string;
  };
  publishedAt: Date;
  modifiedAt?: Date;
  wordCount?: number;
  readingTimeMinutes?: number;
  imageUrl?: string;
  imageAltText?: string;
  siteUrl: string;
  organizationId?: string;
  topics?: string[];
  relatedArticles?: string[];
}

export function buildArticle(config: ArticleConfig): Article {
  const baseUrl = config.siteUrl.replace(/\/$/, '');
  const articleUrl = `${baseUrl}/blog/${config.id}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${articleUrl}#article`,
    headline: config.headline,
    description: config.description,
    url: articleUrl,
    ...(config.imageUrl && { image: config.imageUrl }),
    datePublished: config.publishedAt.toISOString(),
    ...(config.modifiedAt && { dateModified: config.modifiedAt.toISOString() }),
    author: {
      '@type': 'Person',
      name: config.author.name,
      ...(config.author.title && { title: config.author.title }),
    } as Person,
    publisher: {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'Ecowoods',
    },
    ...(config.wordCount && { wordCount: config.wordCount }),
    ...(config.readingTimeMinutes && {
      timeRequired: `PT${config.readingTimeMinutes}M`,
    }),
    ...(config.content && { articleBody: config.content }),
    ...(config.topics && config.topics.length > 0 && {
      mentions: config.topics.map((topic) => ({
        '@type': 'Thing',
        name: topic,
      })),
    }),
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * CASE STUDY
 * ──────────────────────────────────────────────────────────────────────── */

export interface CaseStudyChallenge {
  title: string;
  description: string;
  impact: string;
}

export interface CaseStudyResult {
  metric: string;
  value: string | number;
  unit?: string;
  context?: string;
}

export interface CaseStudyConfig {
  id: string; // slug
  headline: string;
  description: string;
  content?: string | React.ReactNode;
  /** Neighbourhood resolution and no finer — see F-176 and case-study-types.ts. */
  location: {
    neighbourhood?: string;
    city: string;
    province: string;
  };
  projectType?: string;
  projectDate?: Date;
  squareFootage?: number;
  woodSpecies?: string | string[];
  finishType?: string;
  challenges?: CaseStudyChallenge[];
  solution?: string;
  results?: CaseStudyResult[];
  testimonial?: {
    quote: string;
    attribution: string;
  };
  author?: {
    name: string;
    title?: string;
  };
  publishedAt: Date;
  modifiedAt?: Date;
  wordCount?: number;
  imageUrl?: string;
  siteUrl: string;
  topics?: string[];
  relatedArticles?: string[];
}

export function buildCaseStudy(config: CaseStudyConfig): CaseStudy {
  const baseUrl = config.siteUrl.replace(/\/$/, '');
  const caseStudyUrl = `${baseUrl}/case-studies/${config.id}`;

  // Format wood species for mentions
  const woodSpeciesArray = Array.isArray(config.woodSpecies)
    ? config.woodSpecies
    : config.woodSpecies
      ? [config.woodSpecies]
      : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'CaseStudy',
    '@id': `${caseStudyUrl}#study`,
    headline: config.headline,
    description: config.description,
    url: caseStudyUrl,
    ...(config.imageUrl && { image: config.imageUrl }),
    datePublished: config.publishedAt.toISOString(),
    ...(config.modifiedAt && { dateModified: config.modifiedAt.toISOString() }),
    author: {
      '@type': 'Person',
      name: config.author?.name || 'Ecowoods',
      ...(config.author?.title && { title: config.author.title }),
    } as Person,
    /*
     * The project's location, at neighbourhood resolution.
     *
     * This block used to emit `streetAddress: config.location.address` — which
     * meant the street address of a private Toronto residence was being handed
     * to every crawler as machine-readable PostalAddress data, not merely left
     * in a frontmatter field nobody rendered. Removed 2026-08-22 (F-176).
     *
     * It is also `Place`, not `LocalBusiness`. The subject of a residential case
     * study is a house, and typing a client's home as a business was wrong on
     * its own terms — it invited the graph to resolve a private address as a
     * commercial entity.
     */
    about: {
      '@type': 'Place',
      name: `${config.projectType || 'Residential'} project — ${config.location.neighbourhood || config.location.city}, ${config.location.city}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: config.location.neighbourhood || config.location.city,
        addressRegion: config.location.province,
        addressCountry: 'CA',
      },
    },
    result: {
      '@type': 'Thing',
      name: 'Project Completion',
      description: config.solution || 'Successful project completion',
    } as Thing,
    mentions: [
      ...woodSpeciesArray.map((species) => ({
        '@type': 'Thing',
        name: `${species} Hardwood`,
      })),
      ...(config.finishType ? [{ '@type': 'Thing', name: config.finishType }] : []),
      ...(config.topics?.map((topic) => ({
        '@type': 'Thing',
        name: topic,
      })) ?? []),
    ] as Thing[],
    technicalDetails: {
      projectType: config.projectType,
      projectDate: config.projectDate?.toISOString(),
      squareFootage: config.squareFootage,
      woodSpecies: woodSpeciesArray,
      finishType: config.finishType,
      challenges: config.challenges,
      results: config.results,
      testimonial: config.testimonial,
      wordCount: config.wordCount,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * WEBSITE
 * ──────────────────────────────────────────────────────────────────────── */

export function buildWebSite(siteUrl: string, siteName: string = 'Ecowoods'): WebSite {
  const baseUrl = siteUrl.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: siteName,
    inLanguage: 'en-CA',
    publisher: { '@id': `${baseUrl}/#organization` },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * BREADCRUMB LIST
 * ──────────────────────────────────────────────────────────────────────── */

export interface BreadcrumbTrail {
  name: string;
  url: string;
}

export function buildBreadcrumbList(trail: BreadcrumbTrail[]): BreadcrumbList {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })) as BreadcrumbItem[],
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * FAQ PAGE
 * ──────────────────────────────────────────────────────────────────────── */

export interface FAQItem {
  question: string;
  answer: string;
}

export function buildFAQPage(items: FAQItem[]): FAQPage {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })) as Question[],
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * PRODUCT (for RaaS offerings like FloorForge)
 * ──────────────────────────────────────────────────────────────────────── */

export interface ProductConfig {
  id: string; // slug
  name: string;
  description: string;
  imageUrl?: string;
  offers: Array<{
    name: string;
    price: number;
    currency: string;
    pricingModel: 'daily' | 'monthly' | 'one-time';
  }>;
  siteUrl: string;
  ratingValue?: number;
  ratingCount?: number;
}

export function buildProduct(config: ProductConfig): Product {
  const baseUrl = config.siteUrl.replace(/\/$/, '');

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${baseUrl}/products/${config.id}#product`,
    name: config.name,
    description: config.description,
    url: `${baseUrl}/products/${config.id}`,
    ...(config.imageUrl && { image: config.imageUrl }),
    manufacturer: {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'Ecowoods',
    },
    offers: config.offers.map((offer) => ({
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: offer.name,
      price: String(offer.price),
      priceCurrency: offer.currency,
      availability:
        offer.pricingModel === 'daily'
          ? 'PT24H'
          : offer.pricingModel === 'monthly'
            ? 'PT30D'
            : 'P1Y',
    })) as Offer[],
    /*
     * There is no aggregateRating here, and the branch that used to build one
     * was removed on 2026-08-22 (F-175).
     *
     * It was dormant — nothing in the app passed `ratingValue` — which is
     * exactly what made it dangerous. It sat behind a truthy check, so the day
     * anyone added a rating to a product config, this file would have started
     * emitting a self-serving AggregateRating on a service business: the
     * ineligible construct Google names explicitly, in the one part of the
     * codebase nobody would think to re-read.
     *
     * Third-party review figures are cited on /reviews with their source and a
     * read date. If first-party reviews are ever collected here — written by
     * real customers, on this site, unfiltered — that is a different feature and
     * deserves to be built deliberately rather than switched on by a field name.
     */
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * WEBPAGE WITH ITEMLIST (for Technical Library, collection pages)
 * ──────────────────────────────────────────────────────────────────────── */

export interface WebPageCollectionItem {
  '@type': 'TechArticle' | 'CaseStudy';
  headline: string;
  url: string;
  description: string;
  datePublished: string | Date;
}

export interface WebPageCollectionConfig {
  title: string;
  description: string;
  url: string;
  items: WebPageCollectionItem[];
}

export function buildWebPageSchema(config: WebPageCollectionConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: config.title,
    description: config.description,
    url: config.url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: config.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.headline,
        url: item.url,
        description: item.description,
        datePublished: item.datePublished instanceof Date
          ? item.datePublished.toISOString()
          : item.datePublished,
      })),
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * AGGREGATE RATING (for company-wide review score)
 * ──────────────────────────────────────────────────────────────────────── */

export function buildAggregateRating(ratingValue: number, ratingCount: number): AggregateRating {
  return {
    '@type': 'AggregateRating',
    ratingValue,
    ratingCount,
    bestRating: 5,
    worstRating: 1,
  };
}
