export const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
      '@id': 'https://ecowoods.ca/#business',
      name: 'Ecowoods Hardwood Flooring',
      legalName: 'Ecowoods Hardwood Flooring Inc.',
      url: 'https://ecowoods.ca',
      image: 'https://ecowoods.ca/og-image.jpg',
      logo: 'https://ecowoods.ca/icon-512.png',
      // Was +1-416-555-9663 — a placeholder that contradicted the (416) 249-1276
      // shown in Header, ChatWidget, the contact block and the AI's
      // get_company_context tool. A phone mismatch inside LocalBusiness markup is
      // exactly the kind of NAP inconsistency that suppresses local pack ranking.
      telephone: '+1-416-249-1276',
      email: 'services@ecowoods.ca',
      priceRange: '$$',
      foundingDate: '1998',
      slogan: "Toronto's master hardwood flooring artisans",
      description: 'Premium hardwood flooring in Toronto and the GTA. Installation, refinishing, sanding, custom inlays and dust-free restoration — backed by manufacturer warranties passed through in writing.',
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
        { '@type': 'City', name: 'Vaughan' },
        { '@type': 'City', name: 'Markham' },
        { '@type': 'City', name: 'Richmond Hill' },
        { '@type': 'City', name: 'Mississauga' },
        { '@type': 'City', name: 'Oakville' },
        { '@type': 'City', name: 'Brampton' },
      ],
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
      ],
      // ⚠️  aggregateRating REMOVED ON PURPOSE — do not re-add.
      //
      // Google's structured-data policy forbids self-serving review markup: a
      // LocalBusiness may not mark up ratings about *itself* that it collected
      // itself. Shipping it is a documented cause of manual "Spammy structured
      // markup" actions, which cost the rich result AND the local pack.
      //
      // The 4.9 / 348 figure is legitimate on-page copy. It is not legitimate
      // JSON-LD. If EcoWoods wants stars in the SERP, the supported route is
      // third-party aggregators (Google Business Profile, HomeStars, Houzz)
      // emitting it about EcoWoods — which they already do.
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Hardwood Flooring Services',
        itemListElement: [
          'Hardwood Flooring Installation',
          'Hardwood Floor Refinishing',
          'Dust-Free Floor Sanding',
          'Hardwood Floor Restoration',
          'Custom Inlays & Borders',
          'Stair Refinishing',
        ].map((name) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name, areaServed: 'Toronto & GTA' },
        })),
      },
      sameAs: [
        'https://www.instagram.com/ecowoods.ca',
        'https://www.facebook.com/ecowoodshardwood',
        'https://www.houzz.com/pro/ecowoods',
      ],
    },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
 * Additional JSON-LD builders (added for programmatic SEO).
 * The localBusinessSchema above is unchanged.
 * ──────────────────────────────────────────────────────────────────────── */
import { SITE_URL, BUSINESS, SERVICES, FAQ_ITEMS, type City, type FaqItem } from './seo-data';

/** WebSite entity — helps Google understand the site + name. */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: BUSINESS.name,
  inLanguage: 'en-CA',
  publisher: { '@id': `${SITE_URL}/#business` },
};

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

/** Per-city LocalBusiness — same NAP, areaServed narrowed to the one city. */
export function serviceAreaBusinessSchema(city: City) {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${SITE_URL}/service-areas/${city.slug}#business`,
    name: `${BUSINESS.name} — ${city.name}`,
    url: `${SITE_URL}/service-areas/${city.slug}`,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    parentOrganization: { '@id': `${SITE_URL}/#business` },
    areaServed: { '@type': 'City', name: city.name },
    makesOffer: SERVICES.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.name, areaServed: city.name },
    })),
  };
}
