import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { getServicePages, priceBand } from '@/lib/service-pages';

/**
 * Service + Offer schema for the commercial head-term pages.
 *
 * WHY THE OTHER THREE BLOCKS WERE NOT ENOUGH
 *
 * Both commercial pages already emit FAQPage, BreadcrumbList and WebPage. Those
 * describe the page. None of them describes the *transaction*, and the
 * transaction is what a commercial query is about. A retrieval system answering
 * "who installs hardwood in Toronto and what does it cost" is looking for a
 * Service with an areaServed and an Offer — not an article about flooring.
 *
 * So this emits, per page: an `@graph` of Service nodes, each with the real
 * published price band as an Offer, each `providedBy` the organisation node the
 * rest of the site already hangs from, each `areaServed` every municipality and
 * neighbourhood actually covered.
 *
 * PRICES ARE DERIVED, ALWAYS. `priceBand()` reads lib/pricing.ts — the same
 * band the service page renders and the same one the FAQ quotes. A service with
 * no published band gets no Offer rather than an invented one. F-195 is why:
 * five project ranges that existed nowhere else were being handed to Google as
 * structured price data, and scripts/verify-schema-figures.mjs now fails the
 * build on any currency literal in this directory — including this file.
 *
 * There is no aggregateRating and there will not be one. See /reviews.
 */
export type CommercialLandingConfig = {
  /** Absolute URL of the page this graph belongs to. */
  url: string;
  /** Service slugs this page is the commercial surface for, in order. */
  serviceSlugs: string[];
  /** Short description of the page's commercial intent. */
  description: string;
};

export function buildCommercialLandingSchema(
  config: CommercialLandingConfig,
): Record<string, unknown> {
  const pages = getServicePages();
  const areas = SERVICE_AREAS.map((a) => ({
    '@type': 'City' as const,
    name: a.name,
    containedInPlace: {
      '@type': 'AdministrativeArea' as const,
      name: 'Greater Toronto Area, Ontario, Canada',
    },
  }));

  type ServiceNode = Record<string, unknown> & { '@id': string };
  const services: ServiceNode[] = [];
  for (const slug of config.serviceSlugs) {
    const page = pages.find((p) => p.slug === slug);
    if (!page) continue;
    const price = priceBand(page);
    const node: ServiceNode = {
      '@type': 'Service',
      '@id': `${SITE_URL}/services/${slug}#service`,
      name: page.h1 ?? slug,
      description: page.standfirst ?? config.description,
      serviceType: page.h1 ?? slug,
      url: `${SITE_URL}/services/${slug}`,
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: areas,
    };
    /* An Offer only where a band is actually published. A service with no band
       gets no Offer — the absence is the honest signal, and F-195 is why. */
    if (price) {
      node.offers = {
        '@type': 'Offer',
        priceCurrency: 'CAD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          priceCurrency: 'CAD',
          price,
          unitText: 'per square foot',
          valueAddedTaxIncluded: false,
        },
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/services/${slug}`,
        seller: { '@id': `${SITE_URL}/#organization` },
      };
    }
    services.push(node);
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${config.url}#commercial`,
        url: config.url,
        name: config.description,
        inLanguage: 'en-CA',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        primaryImageOfPage: { '@id': `${SITE_URL}/#logo` },
      },
      ...services,
      {
        '@type': 'ProfessionalService',
        '@id': `${config.url}#localbusiness`,
        name: BUSINESS_NAP.legalName,
        url: config.url,
        parentOrganization: { '@id': `${SITE_URL}/#organization` },
        areaServed: areas,
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: config.description,
          itemListElement: services.map((s, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: { '@id': s['@id'] },
          })),
        },
      },
    ],
  };
}
