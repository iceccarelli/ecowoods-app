/**
 * lib/structured-data.ts — the two page-level JSON-LD builders the
 * service-area pages use: FAQPage and BreadcrumbList.
 *
 * WHAT USED TO BE HERE, AND WHY IT IS NOT
 *
 * This file held `localBusinessSchema` — a full second copy of the business
 * entity under the @id `/#business`, with its own hand-typed areaServed list of
 * ten cities (the site publishes sixteen), its own description, and an
 * OfferCatalog of six service names typed as strings. Nothing imported it. It
 * also held `websiteSchema`, whose publisher pointed at `/#business`, and
 * `serviceAreaBusinessSchema()`, which put a THIRD business node on each of the
 * thirty-two /service-areas pages — "Ecowoods — Rosedale", its own @id, and
 * `parentOrganization: /#business`, an identifier no page on the site ever
 * emitted, because the root organisation has always been `/#organization`.
 *
 * Three business entities, two of them pointing at a fourth that did not
 * exist. Google's guidance and the project's own rule (Stage 4: no duplicate
 * organisations) both say the same thing: one entity, one @id, referenced by
 * everything else. The root node lives in lib/schema/root-schema.ts and the
 * layout injects it on every page. The service-area pages now emit a WebPage
 * node that is `about` that root and a Service node whose `provider` is that
 * root. Nothing here describes the business any more, so nothing here can
 * disagree with the file that does.
 */
import { FAQ_ITEMS, type FaqItem } from './seo-data';

/** FAQPage — eligible for the FAQ rich result. Uses real on-page Q&A. */
export function faqPageSchema(items: FaqItem[] = FAQ_ITEMS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** BreadcrumbList — sitelink breadcrumbs in the SERP. */
export function breadcrumbSchema(trail: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  };
}
