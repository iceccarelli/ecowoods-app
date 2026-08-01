/**
 * Schema builders — produce production-grade JSON-LD for all entity types.
 * These functions are the source of truth for what EcoWoods emits to search engines and AI agents.
 */

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
    logo: `${baseUrl}/icon-512.png`,

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

    // Social profiles
    sameAs: [
      'https://www.instagram.com/ecowoods.ca',
      'https://www.facebook.com/ecowoodshardwood',
      'https://www.houzz.com/pro/ecowoods',
    ],
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
    areaServed: config.areaServed,
    ...(config.priceRange && {
      offers: [
        {
          '@context': 'https://schema.org',
          '@type': 'Offer',
          priceCurrency: 'CAD',
          priceRange: config.priceRange,
          availability: 'PT10M', // 10 minutes response time estimate
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
  location: {
    address?: string;
    city: string;
    province: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
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
      name: config.author?.name || 'Mark Carelli',
      ...(config.author?.title && { title: config.author.title }),
    } as Person,
    about: {
      '@type': 'LocalBusiness',
      name: `${config.projectType || 'Residential'} Project — ${config.location.city}, ${config.location.province}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: config.location.city,
        addressRegion: config.location.province,
        addressCountry: 'CA',
        streetAddress: config.location.address || '',
        postalCode: '',
      },
    } as LocalBusinessEntity,
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
    ...(config.ratingValue &&
      config.ratingCount && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: config.ratingValue,
          ratingCount: config.ratingCount,
          bestRating: 5,
          worstRating: 1,
        } as AggregateRating,
      }),
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
