/**
 * React components for injecting schemas into pages.
 * Use these in route components to add structured data for articles, case studies, etc.
 */

import { ReactNode } from 'react';
import { serializeSchema } from './utils';
import type {
  Article,
  CaseStudy,
  Product,
  BreadcrumbList,
  FAQPage,
} from './types';

/**
 * SchemaScript — inject a single schema into <head>.
 * Use in route metadata or page component.
 */
export function SchemaScript({ schema }: { schema: unknown }): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }}
      key="schema"
    />
  );
}

/**
 * SchemaScripts — inject multiple schemas into <head>.
 */
export function SchemaScripts({ schemas }: { schemas: unknown[] }): ReactNode {
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }}
        />
      ))}
    </>
  );
}

/**
 * ArticleHead — metadata + schema for blog articles.
 * Use in route metadata (generateMetadata in Next.js 13+).
 *
 * Example:
 *   export const metadata = articleHead({ headline: "...", slug: "..." });
 */
export function articleHead(config: {
  headline: string;
  slug: string;
  description: string;
  imageUrl?: string;
  publishedAt: Date;
}) {
  return {
    title: config.headline,
    description: config.description,
    ...(config.imageUrl && {
      openGraph: {
        title: config.headline,
        description: config.description,
        images: [{ url: config.imageUrl }],
      },
    }),
  };
}

/**
 * CaseStudyHead — metadata + schema for case studies.
 */
export function caseStudyHead(config: {
  headline: string;
  slug: string;
  description: string;
  imageUrl?: string;
  location: { city: string; province: string };
}) {
  return {
    title: config.headline,
    description: config.description,
    ...(config.imageUrl && {
      openGraph: {
        title: config.headline,
        description: config.description,
        images: [{ url: config.imageUrl }],
      },
    }),
  };
}

/**
 * ProductHead — metadata + schema for RaaS products.
 */
export function productHead(config: {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
}) {
  return {
    title: config.name,
    description: config.description,
    ...(config.imageUrl && {
      openGraph: {
        title: config.name,
        description: config.description,
        images: [{ url: config.imageUrl }],
      },
    }),
  };
}
