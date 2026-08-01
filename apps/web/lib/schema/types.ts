/**
 * Schema types — all JSON-LD entity and property definitions.
 * These drive type-safe schema construction across the site.
 */

/* ────────────────────────────────────────────────────────────────────────
 * Core Schema.org types
 * ──────────────────────────────────────────────────────────────────────── */

export interface SchemaBase {
  '@context': 'https://schema.org';
  '@type': string | string[];
  '@id'?: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * PostalAddress
 * ──────────────────────────────────────────────────────────────────────── */

export interface PostalAddress {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * GeoCoordinates & GeoShape
 * ──────────────────────────────────────────────────────────────────────── */

export interface GeoCoordinates {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

export interface GeoShape {
  '@type': 'GeoShape';
  box?: string; // "43.6426,-79.6371 43.8554,-79.0037"
}

/* ────────────────────────────────────────────────────────────────────────
 * Area Served
 * ──────────────────────────────────────────────────────────────────────── */

export interface AreaServedCity {
  '@type': 'City';
  name: string;
  geo?: GeoShape;
}

export type AreaServed = AreaServedCity[];

/* ────────────────────────────────────────────────────────────────────────
 * OpeningHours
 * ──────────────────────────────────────────────────────────────────────── */

export interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string; // "08:00"
  closes: string; // "17:00"
}

/* ────────────────────────────────────────────────────────────────────────
 * Service
 * ──────────────────────────────────────────────────────────────────────── */

export interface Service extends SchemaBase {
  '@type': 'Service';
  '@id': string;
  name: string;
  description: string;
  areaServed: AreaServed | string;
  offers?: Offer[];
  provider?: Organization;
}

export interface Offer extends SchemaBase {
  '@type': 'Offer';
  priceCurrency: string; // "CAD"
  priceRange?: string; // "$2,500–$8,000"
  availability?: string; // "PT10M" (ISO 8601)
  url?: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * Organization / LocalBusiness
 * ──────────────────────────────────────────────────────────────────────── */

export interface Organization extends SchemaBase {
  '@type': 'Organization' | 'LocalBusiness' | ['LocalBusiness', 'HomeAndConstructionBusiness'];
  '@id': string;
  name: string;
  legalName?: string;
  url: string;
  image?: string;
  logo?: string;
  telephone: string;
  email: string;
  description: string;
  slogan?: string;
  foundingDate?: string; // "1998"
  priceRange?: string;
  address: PostalAddress;
  geo: GeoCoordinates;
  areaServed: AreaServed;
  openingHoursSpecification: OpeningHoursSpecification[];
  service?: Service[];
  contactPoint?: ContactPoint[];
  sameAs?: string[];
}

export interface ContactPoint {
  '@type': 'ContactPoint';
  telephone: string;
  contactType: string; // "customer service", "sales", etc.
}

/* ────────────────────────────────────────────────────────────────────────
 * AggregateRating
 * ──────────────────────────────────────────────────────────────────────── */

export interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number;
  ratingCount: number;
  bestRating?: number;
  worstRating?: number;
}

export interface RatingEntity extends SchemaBase {
  '@type': 'Thing' | 'Organization';
  aggregateRating: AggregateRating;
}

/* ────────────────────────────────────────────────────────────────────────
 * WebSite
 * ──────────────────────────────────────────────────────────────────────── */

export interface WebSite extends SchemaBase {
  '@type': 'WebSite';
  '@id': string;
  url: string;
  name: string;
  inLanguage: string;
  publisher: { '@id': string };
}

/* ────────────────────────────────────────────────────────────────────────
 * BreadcrumbList
 * ──────────────────────────────────────────────────────────────────────── */

export interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface BreadcrumbList extends SchemaBase {
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

/* ────────────────────────────────────────────────────────────────────────
 * Article / TechArticle
 * ──────────────────────────────────────────────────────────────────────── */

export interface Person {
  '@type': 'Person';
  name: string;
  title?: string;
  url?: string;
}

export interface Article extends SchemaBase {
  '@type': 'Article' | 'TechArticle' | 'BlogPosting';
  '@id': string;
  headline: string;
  description: string;
  image?: string | string[];
  datePublished: string; // ISO 8601
  dateModified?: string; // ISO 8601
  author: Person | Organization;
  publisher: Organization;
  wordCount?: number;
  timeRequired?: string; // "PT15M"
  articleBody?: string;
  mainEntity?: object;
  mentions?: Thing[];
  isPartOf?: Series;
}

export interface Thing {
  '@type': 'Thing';
  name: string;
  url?: string;
}

export interface Series {
  '@type': 'Series';
  name: string;
  url: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * CaseStudy
 * ──────────────────────────────────────────────────────────────────────── */

export interface CaseStudy extends SchemaBase {
  '@type': 'CaseStudy';
  '@id': string;
  headline: string;
  description: string;
  image?: string[];
  datePublished: string; // ISO 8601
  author: Organization;
  about: LocalBusinessEntity;
  result: Thing;
  mentions: Thing[];
  technicalDetails?: Record<string, unknown>;
}

export interface LocalBusinessEntity {
  '@type': 'LocalBusiness';
  name: string;
  address: PostalAddress;
}

/* ────────────────────────────────────────────────────────────────────────
 * FAQPage
 * ──────────────────────────────────────────────────────────────────────── */

export interface Question {
  '@type': 'Question';
  name: string;
  acceptedAnswer: Answer;
}

export interface Answer {
  '@type': 'Answer';
  text: string;
}

export interface FAQPage extends SchemaBase {
  '@type': 'FAQPage';
  mainEntity: Question[];
}

/* ────────────────────────────────────────────────────────────────────────
 * HowTo (for process articles)
 * ──────────────────────────────────────────────────────────────────────── */

export interface HowToStep {
  '@type': 'HowToStep';
  name: string;
  text: string;
  image?: string;
  url?: string;
}

export interface HowTo {
  '@type': 'HowTo';
  name: string;
  description?: string;
  image?: string;
  step: HowToStep[];
  estimatedCost?: PriceSpecification;
  totalTime?: string; // ISO 8601
}

export interface PriceSpecification {
  '@type': 'PriceSpecification';
  priceCurrency: string;
  price: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * Product (for RaaS offerings)
 * ──────────────────────────────────────────────────────────────────────── */

export interface Product extends SchemaBase {
  '@type': 'Product';
  name: string;
  description: string;
  image?: string | string[];
  brand?: string;
  manufacturer?: Organization;
  offers?: Offer[];
  aggregateRating?: AggregateRating;
  url?: string;
  specifications?: Record<string, unknown>;
}
