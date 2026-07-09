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
      logo: 'https://ecowoods.ca/logo.png',
      // Was +1-416-555-9663 — a placeholder that contradicted the (416) 249-1276
      // shown in Header, ChatWidget, the contact block and the AI's
      // get_company_context tool. A phone mismatch inside LocalBusiness markup is
      // exactly the kind of NAP inconsistency that suppresses local pack ranking.
      telephone: '+1-416-249-1276',
      email: 'services@ecowoods.ca',
      priceRange: '$$',
      foundingDate: '1998',
      slogan: "Toronto's master hardwood flooring artisans",
      description: 'Premium hardwood flooring in Toronto and the GTA. Installation, refinishing, sanding, custom inlays and dust-free restoration — backed by a lifetime workmanship warranty.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '32 Norfield Crescent, Toronto, ON',
        addressLocality: 'Toronto',
        addressRegion: 'ON',
        postalCode: 'M3J 3A1',
        addressCountry: 'CA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 43.7796,
        longitude: -79.5072,
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
      sameAs: [
        'https://www.instagram.com/ecowoods.ca',
        'https://www.facebook.com/ecowoodshardwood',
        'https://www.houzz.com/pro/ecowoods',
      ],
    },
  ],
};
