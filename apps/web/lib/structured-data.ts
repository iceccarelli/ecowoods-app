/**
 * lib/structured-data.ts — the LocalBusiness graph the service-area pages emit.
 *
 * THE SECOND COPY OF THE ENTITY
 *
 * lib/schema/root-schema.ts holds ROOT_ORG_CONFIG, injected site-wide by the
 * layout. This file held a separate LocalBusiness node with its own hand-typed
 * name, legal name, telephone, email, address and geo, rendered on all
 * thirty-two /service-areas pages. Two entity descriptions, five duplicated
 * fields each, no guard comparing them.
 *
 * They agreed. That is not reassuring — it is the state a drift starts from,
 * and this file's own comment records the last one: the telephone here was a
 * placeholder that contradicted the number shown in the header, in the chat
 * widget and in the contact block, on the exact markup that decides local-pack
 * eligibility.
 *
 * Every one of those fields now derives from BUSINESS_NAP. `pnpm seo:claims`
 * fails the build on a NAP literal anywhere outside packages/shared/constants.
 */
export const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
      '@id': 'https://ecowoods.ca/#business',
      name: BUSINESS_NAP.name,
      legalName: BUSINESS_NAP.legalName,
      alternateName: [...BUSINESS_NAP.alternateNames],
      url: 'https://ecowoods.ca',
      // Hardcoded 404s until F-162. See lib/brand-assets.ts.
      image: OG_IMAGE_URL,
      logo: LOGO_URL,
      // Was +1-416-555-9663 — a placeholder that contradicted the (647) 244-5156  (facts-allow)
      // shown in Header, ChatWidget, the contact block and the AI's
      // get_company_context tool. A phone mismatch inside LocalBusiness markup is
      // exactly the kind of NAP inconsistency that suppresses local pack ranking.
      telephone: BUSINESS_NAP.phoneSchema,
      email: BUSINESS_NAP.email,
      priceRange: '$$',
      foundingDate: String(BUSINESS_NAP.foundedYear),
      slogan: "Toronto's master hardwood flooring artisans",
      description: 'Premium hardwood flooring in Toronto and the GTA. Installation, refinishing, sanding, custom inlays and dust-free restoration — backed by manufacturer warranties passed through in writing.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: BUSINESS_NAP.address.streetAddress,
        addressLocality: BUSINESS_NAP.address.addressLocality,
        addressRegion: BUSINESS_NAP.address.addressRegion,
        postalCode: BUSINESS_NAP.address.postalCode,
        addressCountry: BUSINESS_NAP.address.addressCountry,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: BUSINESS_NAP.address.latitude,
        longitude: BUSINESS_NAP.address.longitude,
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
      // P0-7: one hours constant. Derived from BUSINESS_HOURS so schema,
      // header, footer and GBP copy cannot disagree about when the phone is
      // answered.
      openingHoursSpecification: BUSINESS_HOURS.map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [...h.days],
        opens: h.opens,
        closes: h.closes,
      })),
      // ⚠️  aggregateRating REMOVED ON PURPOSE — do not re-add.
      //
      // Google's structured-data policy forbids self-serving review markup: a
      // LocalBusiness may not mark up ratings about *itself* that it collected
      // itself. Shipping it is a documented cause of manual "Spammy structured
      // markup" actions, which cost the rich result AND the local pack.
      //
      // The 4.9 / 348 figure this file used to name is not legitimate anywhere.  (facts-allow)
      // No platform reports it; verify-business-facts.mjs bans the string; and
      // the only place it still renders is a stale deployment on the
      // ecowoods-app.vercel.app alias, which vercel.json now 301s to the
      // canonical host. The real, citable figure is REVIEW_EVIDENCE in
      // packages/shared/constants — HomeStars, with its URL and read date.
      // If Ecowoods wants stars in the SERP, the supported route is
      // third-party aggregators (Google Business Profile, HomeStars, Houzz)
      // emitting it about Ecowoods — which they already do.
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
      // Derived from PROFILE_LINKS — see the note in lib/schema/builders.ts.
      sameAs: PROFILE_LINKS.filter((p) => p.href).map((p) => p.href!),
    },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────
 * Additional JSON-LD builders (added for programmatic SEO).
 * The localBusinessSchema above is unchanged.
 * ──────────────────────────────────────────────────────────────────────── */
import { SITE_URL, BUSINESS, SERVICES, FAQ_ITEMS, type City, type FaqItem } from './seo-data';
import { BUSINESS_NAP, PROFILE_LINKS, BUSINESS_HOURS } from '@ecowoods/shared/constants';
import { LOGO_URL, OG_IMAGE_URL } from '@/lib/brand-assets';

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
