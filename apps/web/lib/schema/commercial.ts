import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { getServicePages, priceBand } from '@/lib/service-pages';
import { OG_IMAGE_URL } from '@/lib/brand-assets';
import { buildAdministrativeArea } from './builders';
import { SERVICE_REGION, placeForArea } from './root-schema';

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
 * published price band as an Offer, each `provider` the organisation node the
 * rest of the site already hangs from, each `areaServed` every municipality and
 * neighbourhood actually covered.
 *
 * ONE BUSINESS ENTITY, NOT TWO
 *
 * This graph used to close with a `ProfessionalService` node — the legal name,
 * a `#localbusiness` @id of its own, `parentOrganization` pointing at the root
 * — on every commercial page. That is a second business entity per page,
 * joined to the first only by a parent link, and a consumer that follows the
 * link finds the same NAP on both ends and has to guess which is the business.
 * The root `/#organization` node is injected on every page by the layout; the
 * Service nodes already name it as `provider` and `seller`. The catalog that
 * node carried listed the same Service @ids the graph already contains. Both
 * are gone; the graph now has one business in it, and it is the root.
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

  /**
   * Every published area, typed as what it is. Municipalities are City nodes
   * inside the same GTA → Ontario → Canada region the root organisation
   * emits; Toronto neighbourhoods are Place nodes inside the City of Toronto
   * (F-157 — a neighbourhood is not a city, and this file used to say it was).
   */
  const region = buildAdministrativeArea(SERVICE_REGION);
  const areas = SERVICE_AREAS.map((a) => {
    const place = placeForArea(a);
    return place['@type'] === 'City' ? { ...place, containedInPlace: region } : place;
  });

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
        /* The page is about the business and its main entity is the business —
           the root node, by reference. Not a second business node. */
        about: { '@id': `${SITE_URL}/#organization` },
        mainEntity: { '@id': `${SITE_URL}/#organization` },
        /* This was `{ '@id': '/#logo' }` — a reference to a node nothing on the
           site emits, so every consumer resolved it to nothing. The image is
           the one the organisation node already claims, given as a real
           ImageObject. */
        primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE_URL },
      },
      ...services,
    ],
  };
}
