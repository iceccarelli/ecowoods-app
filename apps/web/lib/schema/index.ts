/**
 * Schema system exports — clean public API for the entire structured data layer.
 *
 * This module provides:
 * 1. Root organization schema (injected on every page)
 * 2. Type-safe builders for articles, case studies, products, etc.
 * 3. Utilities for breadcrumbs, FAQs, and dynamic schema generation
 *
 * The layout.tsx imports ROOT_ORGANIZATION_SCHEMA, ROOT_WEBSITE_SCHEMA,
 * and HOMEPAGE_FAQ_SCHEMA and injects them into every page's <head>.
 */

// Types
export type {
  Organization,
  Service,
  Article,
  CaseStudy,
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
  Thing,
  Series,
  LocalBusinessEntity,
  ContactPoint,
  RatingEntity,
  Answer,
  HowTo,
  HowToStep,
  PriceSpecification,
  SchemaBase,
  AreaServed,
  GeoShape,
} from './types';

// Builders
export {
  buildOrganization,
  buildService,
  buildArticle,
  buildCaseStudy,
  buildWebSite,
  buildBreadcrumbList,
  buildFAQPage,
  buildProduct,
  buildAggregateRating,
  type OrganizationConfig,
  type ServiceConfig,
  type ServiceConfig2,
  type ArticleConfig,
  type CaseStudyConfig,
  type ProductConfig,
  type FAQItem,
  type BreadcrumbTrail,
} from './builders';

// Root schemas (injected into every page)
export {
  ROOT_ORG_CONFIG,
  ROOT_ORGANIZATION_SCHEMA,
  ROOT_WEBSITE_SCHEMA,
  HOMEPAGE_BREADCRUMB_SCHEMA,
  HOMEPAGE_FAQ_SCHEMA,
  HOMEPAGE_FAQ_ITEMS,
  ROOT_AGGREGATE_RATING,
  ROOT_SCHEMAS,
} from './root-schema';

// Utilities
export { serializeSchema, serializeSchemas, validateSchema, cleanSchema } from './utils';

// React components
export { SchemaScript, SchemaScripts, articleHead, caseStudyHead, productHead } from './components';

/**
 * Backward compatibility: faqPageSchema function (used in old code)
 */
export function faqPageSchema(items?: any) {
  const { HOMEPAGE_FAQ_SCHEMA } = require('./root-schema');
  return HOMEPAGE_FAQ_SCHEMA;
}
"