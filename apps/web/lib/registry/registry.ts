/**
 * lib/registry/registry.ts — the entity truth system, projected as primitives
 * (Protocol v2, Stages 3, 4, 8, 9, 10, 11).
 *
 * ONE TRUTH, MANY REPRESENTATIONS. This module does not own a single business
 * fact. It reads:
 *
 *   BUSINESS_NAP, BUSINESS_HOURS, PROFILE_LINKS, REVIEW_EVIDENCE,
 *   GOOGLE_PLACE, HOMESTARS_CANONICAL          packages/shared/constants
 *   PRICE_BANDS                                 content/constants/pricing.ts
 *   SERVICES, CITIES, NEIGHBOURHOOD_AREAS,
 *   CITY_CONTENT, FAQ_ITEMS                     lib/seo-data.ts
 *   SERVICE_PAGES                               lib/service-pages.ts
 *   CLAIMS                                      content/claims.ts
 *   entityAnswers()                             lib/entity-answers.ts
 *   getPapers(), getGuides(), getCaseStudies()  the published corpus
 *
 * and gives each fact a stable id, the page that states it, its source, the
 * date that source was last checked, and a status. HTML, markdown, JSON-LD,
 * llms.txt and /api/v1 are all projections of the same modules, so they cannot
 * disagree without the drift tests noticing.
 *
 * IDs NEVER CHURN. `service:floor-refinishing` is the same node on every
 * surface, in the graph, in citation packs and in the changefeed. Renaming an
 * id is a breaking change to every consumer that stored it.
 */
import {
  BUSINESS_NAP,
  BUSINESS_HOURS,
  BUSINESS_TIMEZONE_NAME,
  PROFILE_LINKS,
  REVIEW_EVIDENCE,
  GOOGLE_PLACE,
  HOMESTARS_CANONICAL,
  yearsInBusiness,
} from '@ecowoods/shared/constants';
import { PRICE_BANDS, PRICE_BANDS_BY_KEY, formatBand, type PriceBand } from '@/content/constants/pricing';
import { PRICE_PROMISE } from '@/lib/pricing';
import { SITE_URL, SERVICES, CITIES, FAQ_ITEMS, cityContent } from '@/lib/seo-data';
import { SERVICE_PAGES, type ServicePage } from '@/lib/service-pages';
import { CLAIMS, type Claim } from '@/content/claims';
import { entityAnswers } from '@/lib/entity-answers';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { LOGO_URL } from '@/lib/brand-assets';
import { SERVICE_ALIASES } from './intents';
import { LOCATION_NODES, hasLocalNotes } from './locations';
import type {
  ActionPrimitive,
  EvidencePrimitive,
  FAQPrimitive,
  GraphEdge,
  LocationPrimitive,
  OrganizationPrimitive,
  PagePrimitive,
  PricePrimitive,
  PrimitiveStatus,
  ReviewPrimitive,
  ServicePrimitive,
  SourcePrimitive,
} from './types';

/* ── registry metadata ──────────────────────────────────────────────────── */

export const REGISTRY_VERSION = '1.0.0';

/**
 * The date the NAP, hours, founding year and price bands were last read on the
 * live canonical host and found identical to the constants. Moves only when a
 * person re-reads production; never a build timestamp.
 */
export const FACTS_VERIFIED_AT = '2026-09-05';

const abs = (p: string) => (p.startsWith('http') ? p : `${SITE_URL}${p}`);

const firstParty = (path: string, name?: string) => ({
  type: 'first_party' as const,
  url: abs(path),
  name: name ?? BUSINESS_NAP.legalName,
  source_id: 'source:ecowoods-ca',
});

const claim = (id: string): Claim | undefined => CLAIMS.find((c) => c.id === id);

const claimStatus = (c?: Claim): PrimitiveStatus =>
  !c ? 'unknown' : c.status === 'unsourced' ? 'unverified' : 'verified';

/** YYYY-MM-DD from anything date-like (MDX front matter arrives as a Date/ISO timestamp). */
const isoDay = (d: unknown): string | undefined => {
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : undefined;
  }
  return undefined;
};

const latestDate = (...dates: (string | undefined)[]): string =>
  dates.filter((d): d is string => Boolean(d)).sort().at(-1) ?? FACTS_VERIFIED_AT;

/* ── ids ────────────────────────────────────────────────────────────────── */

export const ORG_ID = 'org:ecowoods';
export const serviceId = (slug: string) => `service:${slug}`;
export const locationId = (slug: string) => `location:${slug}`;
export const priceId = (key: PriceBand['key']) => `price:${PRICE_KEY_SLUG[key]}`;
export const pageId = (path: string) => `page:${path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '.')}`;
export const faqId = (question: string) =>
  `faq:${question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)}`;

const PRICE_KEY_SLUG: Record<PriceBand['key'], string> = {
  screenAndRecoat: 'screen-and-recoat',
  fullSandAndFinish: 'full-sand-and-finish',
  newInstall: 'new-install',
};

/** Which service each published band prices. Two bands price refinishing at two intensities. */
export const BAND_SERVICE_SLUG: Record<PriceBand['key'], string> = {
  screenAndRecoat: 'floor-refinishing',
  fullSandAndFinish: 'floor-refinishing',
  newInstall: 'hardwood-installation',
};

const PRICE_CLAIM_ID: Record<PriceBand['key'], string> = {
  screenAndRecoat: 'pricing.screenAndRecoat',
  fullSandAndFinish: 'pricing.fullSandAndFinish',
  newInstall: 'pricing.newInstall',
};

/** What moves each band. Editorial, no figures; the numbers live in the band. */
const PRICE_CONDITIONS: Record<PriceBand['key'], string[]> = {
  screenAndRecoat: [
    'Applies when the existing finish is intact and the wood does not need to be exposed.',
    'Not possible once the finish has worn through to bare wood or the floor has deep scratches, stains or grey boards.',
    'Furniture moving, stairs and transitions are priced separately in the written estimate.',
  ],
  fullSandAndFinish: [
    'Sand to bare wood, optional stain, and finish coats.',
    'Requires enough remaining wear layer to sand; the estimator measures it during the in-home visit.',
    'Species, stain colour, board repairs, stairs and the finish system move the number within the band.',
  ],
  newInstall: [
    'Supply and installation of solid or engineered hardwood.',
    'Species, plank width, pattern (straight-lay, herringbone, chevron), substrate preparation and moisture mitigation move the number within the band.',
    'Removal of existing flooring, levelling and stairs are itemised separately in the written estimate.',
  ],
};

/** Situations where a service is the wrong call, and what to do instead. Editorial, no figures. */
const WRONG_WHEN: Record<string, { situation: string; use_instead: string }[]> = {
  'hardwood-installation': [
    { situation: 'The existing hardwood is structurally sound and only the finish is worn.', use_instead: 'service:floor-refinishing' },
    { situation: 'Only a few boards are damaged and the rest of the floor is fine.', use_instead: 'service:floor-restoration' },
  ],
  'floor-refinishing': [
    { situation: 'The wear layer is too thin to sand again (typical of thin engineered floors or floors sanded several times).', use_instead: 'service:hardwood-installation' },
    { situation: 'Boards are rotten, buckled or water-damaged and must be replaced before any sanding.', use_instead: 'service:floor-restoration' },
    { situation: 'The finish is intact and only dull; a full sand removes wood the floor does not need to lose.', use_instead: 'price:screen-and-recoat' },
  ],
  'dust-free-sanding': [
    { situation: 'The floor needs new boards or structural repair before it can be sanded.', use_instead: 'service:floor-restoration' },
    { situation: 'The floor is not hardwood (laminate, vinyl, tile) — it cannot be sanded.', use_instead: 'unsupported' },
  ],
  'floor-restoration': [
    { situation: 'The floor is uniformly worn with no damaged or missing boards.', use_instead: 'service:floor-refinishing' },
    { situation: 'Damage is so extensive that replacing the floor costs less than saving it; the estimator says so in writing.', use_instead: 'service:hardwood-installation' },
  ],
  'stair-refinishing': [
    { situation: 'Treads are structurally failed or the staircase is being rebuilt.', use_instead: 'requires_assessment' },
  ],
  'custom-inlays': [
    { situation: 'The floor is being refinished only and no new material is going in.', use_instead: 'service:floor-refinishing' },
  ],
};

const RELATED: Record<string, string[]> = {
  'hardwood-installation': ['custom-inlays', 'stair-refinishing', 'floor-refinishing'],
  'floor-refinishing': ['dust-free-sanding', 'stair-refinishing', 'floor-restoration'],
  'dust-free-sanding': ['floor-refinishing', 'stair-refinishing'],
  'floor-restoration': ['floor-refinishing', 'hardwood-installation'],
  'stair-refinishing': ['floor-refinishing', 'dust-free-sanding'],
  'custom-inlays': ['hardwood-installation', 'floor-refinishing'],
};

/* ── organization ───────────────────────────────────────────────────────── */

export function buildOrganization(): OrganizationPrimitive {
  const ids = [
    claim('business.legalName'),
    claim('business.phone'),
    claim('business.address'),
    claim('business.founded'),
  ].filter((c): c is Claim => Boolean(c));
  return {
    id: ORG_ID,
    type: 'Organization',
    data: {
      legal_name: BUSINESS_NAP.legalName,
      name: BUSINESS_NAP.name,
      alternate_names: [...BUSINESS_NAP.alternateNames],
      founded_year: BUSINESS_NAP.foundedYear,
      years_in_business: yearsInBusiness(),
      telephone_e164: BUSINESS_NAP.phoneE164,
      telephone_display: BUSINESS_NAP.phoneDisplay,
      email: BUSINESS_NAP.email,
      address: {
        street: BUSINESS_NAP.address.streetAddress,
        locality: BUSINESS_NAP.address.addressLocality,
        region: BUSINESS_NAP.address.addressRegion,
        postal_code: BUSINESS_NAP.address.postalCode,
        country: BUSINESS_NAP.address.addressCountry,
      },
      geo: { latitude: BUSINESS_NAP.address.latitude, longitude: BUSINESS_NAP.address.longitude },
      hours: BUSINESS_HOURS.map((h) => ({ days: [...h.days], opens: h.opens, closes: h.closes })),
      timezone: BUSINESS_TIMEZONE_NAME,
      service_region: BUSINESS_NAP.region,
      crew_model: claim('workforce.salaried')?.statement ?? 'Salaried crews.',
      price_promise: PRICE_PROMISE,
      same_as: PROFILE_LINKS.filter((p) => p.href).map((p) => p.href as string),
      identifiers: [
        { property: 'google_place_id', value: GOOGLE_PLACE.placeId },
        { property: 'google_cid', value: GOOGLE_PLACE.cid },
        { property: 'google_knowledge_graph_id', value: GOOGLE_PLACE.knowledgeGraphId },
        { property: 'homestars_profile_id', value: HOMESTARS_CANONICAL.profileId },
      ],
      schema_id: `${SITE_URL}/#organization`,
      logo_url: LOGO_URL,
      service_ids: SERVICES.map((s) => serviceId(s.slug)),
      price_ids: PRICE_BANDS.map((b) => priceId(b.key)),
    },
    canonical_url: abs('/about'),
    source: firstParty('/about'),
    provenance: {
      verified_at: latestDate(FACTS_VERIFIED_AT, ...ids.map((c) => c.verifiedAt)),
      method: 'live_read',
      claim_ids: ids.map((c) => c.id),
    },
    status: 'verified',
  };
}

/* ── services ───────────────────────────────────────────────────────────── */

const pageFor = (slug: string): ServicePage | undefined => SERVICE_PAGES.find((p) => p.slug === slug);

export function buildServices(): ServicePrimitive[] {
  return SERVICES.map((s) => {
    const page = pageFor(s.slug);
    const bandKey = page?.pricing;
    const band = bandKey ? PRICE_BANDS_BY_KEY[bandKey] : undefined;
    const aliases = SERVICE_ALIASES.filter((a) => a.service === s.slug).map((a) => a.phrase);
    const evidence = [
      ...(page?.papers ?? []).map((p) => `evidence:paper:${p.paper}`),
      ...(page?.guides ?? []).map((g) => `evidence:guide:${g}`),
    ];
    return {
      id: serviceId(s.slug),
      type: 'Service',
      data: {
        slug: s.slug,
        name: s.name,
        description: s.blurb,
        h1: page?.h1 ?? s.name,
        standfirst: page?.standfirst ?? s.blurb,
        price_id: bandKey ? priceId(bandKey) : null,
        price_band_text: band ? formatBand(band) : null,
        aliases,
        wrong_when: WRONG_WHEN[s.slug] ?? [],
        related_service_ids: (RELATED[s.slug] ?? []).map(serviceId),
        evidence_ids: Array.from(new Set(evidence)),
        page_id: pageId(`/services/${s.slug}`),
        markdown_url: abs(`/services/${s.slug}.md`),
      },
      canonical_url: abs(`/services/${s.slug}`),
      source: firstParty(`/services/${s.slug}`),
      provenance: { verified_at: FACTS_VERIFIED_AT, method: 'published', claim_ids: ['coverage.serviceAreas'] },
      status: 'verified',
    };
  });
}

/* ── locations ──────────────────────────────────────────────────────────── */

export function buildLocations(): LocationPrimitive[] {
  const areaServed = new Set(CITIES.map((c) => c.slug));
  const coverageClaim = claim('coverage.serviceAreas');
  return LOCATION_NODES.map((n) => {
    const cc = n.coverage === 'published' ? cityContent(n.slug) : undefined;
    const published = n.coverage === 'published';
    const path = published ? `/service-areas/${n.slug}` : n.slug === 'gta' || n.slug === 'toronto' ? '/service-areas' : null;
    return {
      id: locationId(n.slug),
      type: 'Location',
      data: {
        slug: n.slug,
        name: n.name,
        tier: n.tier,
        coverage: n.coverage,
        parent_id: n.parent ? locationId(n.parent) : null,
        in_area_served: areaServed.has(n.slug),
        local_notes: cc
          ? { intro: cc.intro, housing_note: cc.housingNote, local_consideration: cc.localConsideration, neighbourhoods: cc.neighbourhoods }
          : null,
        aliases: n.aliases,
        page_id: path ? pageId(path) : null,
        markdown_url: published ? abs(`/service-areas/${n.slug}.md`) : null,
      },
      canonical_url: abs(path ?? '/service-areas'),
      source: firstParty('/service-areas'),
      provenance: {
        verified_at: coverageClaim?.verifiedAt ?? FACTS_VERIFIED_AT,
        method: published ? 'published' : 'derived',
        claim_ids: published ? ['coverage.serviceAreas'] : [],
        note:
          n.coverage === 'assessment'
            ? 'Not a published service area. Work here is assessed per project through the estimate path; do not present as covered.'
            : n.coverage === 'parent'
              ? 'Hierarchy node. The published service area is Toronto and the Greater Toronto Area.'
              : undefined,
      },
      status: published || n.coverage === 'region' ? 'verified' : 'unverified',
    };
  });
}

/* ── pricing ────────────────────────────────────────────────────────────── */

export function buildPrices(): PricePrimitive[] {
  return PRICE_BANDS.map((b) => {
    const c = claim(PRICE_CLAIM_ID[b.key]);
    const promise = claim('pricing.fixedInWriting');
    return {
      id: priceId(b.key),
      type: 'Price',
      data: {
        band_key: b.key,
        label: b.label,
        service_id: serviceId(BAND_SERVICE_SLUG[b.key]),
        min: b.min,
        max: b.max,
        currency: b.currency,
        unit: b.unit,
        unit_code: 'FTK',
        formatted: formatBand(b),
        conditions: PRICE_CONDITIONS[b.key],
        caveat: PRICE_PROMISE,
        is_quote: false,
      },
      canonical_url: abs(`/pricing#${PRICE_KEY_SLUG[b.key]}`),
      source: firstParty('/pricing'),
      provenance: {
        verified_at: latestDate(c?.verifiedAt, promise?.verifiedAt),
        method: 'owner_confirmed',
        claim_ids: [PRICE_CLAIM_ID[b.key], 'pricing.fixedInWriting'],
        note: 'Informational range per square foot. The fixed price is written after a free in-home measure; a range is never a quote.',
      },
      status: claimStatus(c),
    };
  });
}

/* ── reviews ────────────────────────────────────────────────────────────── */

const platformSlug = (platform: string) => platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function buildReviews(): ReviewPrimitive[] {
  return REVIEW_EVIDENCE.map((r) => ({
    id: `review:${platformSlug(r.platform)}`,
    type: 'Review',
    data: {
      platform: r.platform,
      profile_url: r.href,
      rating: r.rating,
      out_of: r.outOf,
      count: r.count,
      read_on: r.asOf,
      latest_review_at: r.latestReviewAt ?? null,
      identity_match: 'confirmed',
      published_as: 'cited_statistic',
    },
    canonical_url: abs('/reviews'),
    source: { type: 'review_platform', url: r.href, name: r.platform, source_id: `source:${platformSlug(r.platform)}` },
    provenance: { verified_at: r.asOf, method: 'live_read', claim_ids: r.platform === 'HomeStars' ? ['reviews.homestars'] : [] },
    status: 'verified',
  }));
}

/* ── sources ────────────────────────────────────────────────────────────── */

export function buildSources(): SourcePrimitive[] {
  const reviewReadOn = (platform: string) => REVIEW_EVIDENCE.find((r) => r.platform === platform)?.asOf;
  const out: SourcePrimitive[] = [
    {
      id: 'source:ecowoods-ca',
      type: 'Source',
      data: {
        name: `${BUSINESS_NAP.legalName} — canonical website`,
        url: SITE_URL,
        source_type: 'first_party',
        identity_match: 'confirmed',
        authority_level: 'primary',
        last_verified: FACTS_VERIFIED_AT,
        verification_status: 'verified',
      },
      canonical_url: SITE_URL,
      source: firstParty('/'),
      provenance: { verified_at: FACTS_VERIFIED_AT, method: 'live_read' },
      status: 'verified',
    },
  ];
  for (const p of PROFILE_LINKS) {
    if (!p.href) continue;
    const label = p.label.toLowerCase();
    const isHomestars = label.startsWith('homestars');
    const isGoogle = label.startsWith('google');
    const isSocial = /instagram|facebook|youtube|linkedin|pinterest|tiktok|^x$/.test(label);
    const platform = isHomestars ? 'HomeStars' : isGoogle ? 'Google' : undefined;
    const slug = p.href.includes('2897115')
      ? 'homestars-ecowood'
      : isHomestars
        ? 'homestars'
        : isGoogle
          ? 'google'
          : label.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    out.push({
      id: `source:${slug}`,
      type: 'Source',
      data: {
        name: p.label,
        url: p.href,
        source_type: p.review || isHomestars || isGoogle ? 'review_platform' : isSocial ? 'social_profile' : 'directory',
        identity_match: p.identity ? 'owner_attested' : 'confirmed',
        authority_level: p.review ? 'high' : isSocial ? 'medium' : 'low',
        last_verified: (platform && !p.identity ? reviewReadOn(platform) : undefined) ?? FACTS_VERIFIED_AT,
        verification_status: p.identity ? 'pending_owner_alignment' : 'verified',
        note: p.identity ? 'Name-variant profile, owner-confirmed as the same company; not counted as review evidence.' : undefined,
      },
      canonical_url: abs('/reviews'),
      source: { type: p.review ? 'review_platform' : isSocial ? 'social_profile' : 'directory', url: p.href, name: p.label },
      provenance: { verified_at: (platform && !p.identity ? reviewReadOn(platform) : undefined) ?? FACTS_VERIFIED_AT, method: 'live_read' },
      status: 'verified',
    });
  }
  return out;
}

/* ── evidence ───────────────────────────────────────────────────────────── */

const SERVICE_TOPIC_HINTS: Record<string, RegExp> = {
  'hardwood-installation': /install|engineered|solid|slab|concrete|acclimat|moisture|subfloor|species|selection|cost/i,
  'floor-refinishing': /refinish|sand|finish|machine|sequence|grit|screen|recoat/i,
  'dust-free-sanding': /dust|hepa|contain/i,
  'floor-restoration': /restor|repair|water|cupp|crown|failure/i,
  'stair-refinishing': /stair|tread|riser|nosing|edger/i,
  'custom-inlays': /inlay|border|medallion|pattern|herringbone|chevron/i,
};

const servicesForText = (text: string): string[] =>
  Object.entries(SERVICE_TOPIC_HINTS)
    .filter(([, re]) => re.test(text))
    .map(([slug]) => serviceId(slug));


/** pricing.<bandKey> claims support the service that band prices; the written-price promise supports every service. */
const pricingClaimServices = (claimIdValue: string): string[] | null => {
  if (!claimIdValue.startsWith('pricing.')) return null;
  const key = claimIdValue.slice('pricing.'.length) as PriceBand['key'];
  if (key in BAND_SERVICE_SLUG) return [serviceId(BAND_SERVICE_SLUG[key])];
  return SERVICES.map((s) => serviceId(s.slug));
};

export async function buildEvidence(): Promise<EvidencePrimitive[]> {
  const out: EvidencePrimitive[] = [];

  // Claims the business publishes for machines, each with its own source and date.
  for (const c of CLAIMS) {
    if (!c.allowedContexts.includes('machine')) continue;
    out.push({
      id: `evidence:claim:${c.id}`,
      type: 'Evidence',
      data: {
        kind: 'claim',
        claim: c.statement,
        first_party: true,
        supports_service_ids: pricingClaimServices(c.id) ?? servicesForText(c.statement),
        supports_location_ids: c.id === 'coverage.serviceAreas' ? [locationId('gta'), locationId('toronto')] : [],
        citation_url: c.id.startsWith('pricing.') ? abs('/pricing') : c.id.startsWith('reviews.') ? abs('/reviews') : abs('/about'),
        third_party_url: c.id === 'reviews.homestars' ? HOMESTARS_CANONICAL.reviewsUrl : undefined,
        value: c.value,
      },
      canonical_url: c.id.startsWith('pricing.') ? abs('/pricing') : c.id.startsWith('reviews.') ? abs('/reviews') : abs('/about'),
      source: { type: c.id === 'reviews.homestars' ? 'review_platform' : 'first_party', url: c.id === 'reviews.homestars' ? HOMESTARS_CANONICAL.reviewsUrl : abs('/about'), name: c.source },
      provenance: { verified_at: c.verifiedAt, method: c.status === 'derived' ? 'derived' : 'owner_confirmed', claim_ids: [c.id], note: c.note },
      status: claimStatus(c),
    });
  }

  // Case studies: first-party measurements. The moat.
  for (const cs of await getCaseStudies()) {
    const text = `${cs.title} ${cs.description} ${(cs.topics ?? []).join(' ')}`;
    const locSlug = cs.location?.neighbourhood
      ? cs.location.neighbourhood.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : undefined;
    const loc = LOCATION_NODES.find((n) => n.slug === locSlug);
    out.push({
      id: `evidence:case-study:${cs.slug}`,
      type: 'Evidence',
      data: {
        kind: 'case_study',
        claim: cs.description,
        first_party: true,
        supports_service_ids: servicesForText(text),
        supports_location_ids: [loc ? locationId(loc.slug) : locationId('toronto')],
        citation_url: abs(`/case-studies/${cs.slug}`),
        published_at: isoDay(cs.publishedAt) ?? FACTS_VERIFIED_AT,
        value: cs.squareFootage ? `${cs.squareFootage} sq ft, ${cs.woodSpecies ?? 'hardwood'}` : undefined,
      },
      canonical_url: abs(`/case-studies/${cs.slug}`),
      source: firstParty(`/case-studies/${cs.slug}`),
      provenance: { verified_at: isoDay(cs.publishedAt) ?? FACTS_VERIFIED_AT, method: 'published', note: 'First-party measured job. Figures are the site’s own readings, not an independent audit.' },
      status: 'verified',
    });
  }

  // Papers: the method, sourced.
  for (const p of getPapers()) {
    out.push({
      id: `evidence:paper:${p.slug}`,
      type: 'Evidence',
      data: {
        kind: 'paper',
        claim: p.abstract,
        first_party: true,
        supports_service_ids: servicesForText(`${p.title} ${p.subtitle} ${p.topics.join(' ')}`),
        supports_location_ids: [locationId('toronto')],
        citation_url: abs(`/papers/${p.slug}`),
        published_at: isoDay(p.publishedAt) ?? FACTS_VERIFIED_AT,
      },
      canonical_url: abs(`/papers/${p.slug}`),
      source: firstParty(`/papers/${p.slug}`),
      provenance: { verified_at: isoDay(p.publishedAt) ?? FACTS_VERIFIED_AT, method: 'published' },
      status: 'verified',
    });
  }

  // Guides: the published position on a decision.
  for (const g of getGuides()) {
    out.push({
      id: `evidence:guide:${g.slug}`,
      type: 'Evidence',
      data: {
        kind: 'guide',
        claim: g.question,
        first_party: true,
        supports_service_ids: servicesForText(`${g.title} ${g.question} ${g.slug}`),
        supports_location_ids: [locationId('toronto')],
        citation_url: abs(`/guides/${g.slug}`),
      },
      canonical_url: abs(`/guides/${g.slug}`),
      source: firstParty(`/guides/${g.slug}`),
      provenance: { verified_at: FACTS_VERIFIED_AT, method: 'published' },
      status: 'verified',
    });
  }

  // Third-party review evidence, cited to source.
  for (const r of buildReviews()) {
    out.push({
      id: `evidence:review:${platformSlug(r.data.platform)}`,
      type: 'Evidence',
      data: {
        kind: 'review',
        claim: `${r.data.count} reviews at ${r.data.rating.toFixed(1)}/${r.data.out_of} on ${r.data.platform}, read ${r.data.read_on}.`,
        first_party: false,
        supports_service_ids: SERVICES.map((s) => serviceId(s.slug)),
        supports_location_ids: [locationId('toronto'), locationId('gta')],
        citation_url: abs('/reviews'),
        third_party_url: r.data.profile_url,
        value: `${r.data.rating}/${r.data.out_of} (${r.data.count})`,
      },
      canonical_url: abs('/reviews'),
      source: r.source,
      provenance: r.provenance,
      status: 'verified',
    });
  }

  return out;
}

/* ── FAQ ────────────────────────────────────────────────────────────────── */

export function buildFaq(): FAQPrimitive[] {
  const out: FAQPrimitive[] = FAQ_ITEMS.map((f) => ({
    id: faqId(f.q),
    type: 'FAQ',
    data: {
      question: f.q,
      answer: f.a,
      visible_on: [abs('/service-areas'), abs('/hardwood-flooring-toronto')],
      service_ids: servicesForText(`${f.q} ${f.a}`),
    },
    canonical_url: abs('/hardwood-flooring-toronto#faq'),
    source: firstParty('/hardwood-flooring-toronto'),
    provenance: { verified_at: FACTS_VERIFIED_AT, method: 'published' },
    status: 'verified',
  }));
  for (const a of entityAnswers()) {
    out.push({
      id: faqId(a.q).replace(/^faq:/, 'answer:'),
      type: 'FAQ',
      data: {
        question: a.q,
        answer: a.a,
        visible_on: [abs('/about')],
        service_ids: servicesForText(`${a.q} ${a.a}`),
        href: a.href ? abs(a.href) : undefined,
      },
      canonical_url: abs('/about#answers'),
      source: firstParty('/about'),
      provenance: { verified_at: FACTS_VERIFIED_AT, method: 'derived' },
      status: 'verified',
    });
  }
  return out;
}

/* ── pages ──────────────────────────────────────────────────────────────── */

type PageSeed = { path: string; title: string; kind: PagePrimitive['data']['kind']; md?: string | null; fragments?: string[]; p0?: boolean };

export function buildPages(): PagePrimitive[] {
  const seeds: PageSeed[] = [
    { path: '/', title: 'Home', kind: 'home', md: '/index.md', fragments: ['services', 'quote', 'faq', 'areas', 'reviews', 'process'], p0: true },
    { path: '/about', title: 'About Ecowoods', kind: 'about', md: '/about.md', fragments: ['identity', 'answers', 'verify'], p0: true },
    { path: '/services', title: 'Services', kind: 'service_hub', md: '/services.md', fragments: [], p0: true },
    ...SERVICES.map((s) => ({
      path: `/services/${s.slug}`,
      title: s.name,
      kind: 'service' as const,
      md: `/services/${s.slug}.md`,
      fragments: ['what', 'wrong-service', 'process', 'price', 'related', 'evidence', 'faq', 'estimate'],
      p0: true,
    })),
    { path: '/pricing', title: 'Pricing', kind: 'pricing', md: '/pricing.md', fragments: PRICE_BANDS.map((b) => PRICE_KEY_SLUG[b.key]).concat(['conditions', 'fixed-price', 'estimate']), p0: true },
    { path: '/service-areas', title: 'Service areas', kind: 'area_hub', md: '/service-areas.md', fragments: ['what-changes', 'what-does-not'], p0: true },
    ...LOCATION_NODES.filter((n) => n.coverage === 'published').map((n) => ({
      path: `/service-areas/${n.slug}`,
      title: n.name,
      kind: 'area' as const,
      md: `/service-areas/${n.slug}.md`,
      fragments: hasLocalNotes(n.slug) ? ['local', 'housing', 'services'] : ['services'],
      p0: false,
    })),
    { path: '/estimate', title: 'Request an estimate', kind: 'estimate', md: '/estimate.md', fragments: ['form', 'steps', 'call'], p0: true },
    { path: '/contact', title: 'Contact', kind: 'contact', md: '/contact.md', fragments: ['phone', 'email', 'showroom', 'hours'], p0: true },
    { path: '/reviews', title: 'Reviews', kind: 'reviews', md: '/reviews.md', fragments: ['homestars', 'google'], p0: true },
    { path: '/hardwood-flooring-toronto', title: 'Hardwood flooring in Toronto', kind: 'commercial', md: '/hardwood-flooring-toronto.md', fragments: ['pricing', 'faq'], p0: true },
    { path: '/hardwood-floor-refinishing-toronto', title: 'Hardwood floor refinishing in Toronto', kind: 'commercial', md: '/hardwood-floor-refinishing-toronto.md', fragments: ['pricing', 'faq'], p0: true },
    { path: '/hardwood-stairs-toronto', title: 'Hardwood stairs in Toronto', kind: 'commercial', md: '/hardwood-stairs-toronto.md', fragments: ['pricing', 'faq'], p0: true },
    { path: '/case-studies', title: 'Case studies', kind: 'evidence', md: null, fragments: [], p0: false },
    { path: '/data', title: 'Data and figures', kind: 'evidence', md: null, fragments: [], p0: false },
    { path: '/authority', title: 'Authority and citation guide', kind: 'evidence', md: null, fragments: [], p0: false },
    { path: '/llms.txt', title: 'llms.txt', kind: 'machine', md: null, fragments: [], p0: false },
    { path: '/api/v1', title: 'Agentic primitives API', kind: 'machine', md: null, fragments: [], p0: false },
  ];
  return seeds.map((s) => ({
    id: pageId(s.path),
    type: 'Page',
    data: {
      path: s.path,
      title: s.title,
      kind: s.kind,
      markdown_url: s.md ? abs(s.md) : null,
      fragments: s.fragments ?? [],
      p0: Boolean(s.p0),
    },
    canonical_url: abs(s.path),
    source: firstParty(s.path),
    provenance: { verified_at: FACTS_VERIFIED_AT, method: 'published' },
    status: 'verified',
  }));
}

/* ── actions ────────────────────────────────────────────────────────────── */

export function buildActions(): ActionPrimitive[] {
  const verified = { verified_at: FACTS_VERIFIED_AT, method: 'live_read' as const };
  return [
    {
      id: 'action:request_estimate',
      type: 'Action',
      data: {
        name: 'request_estimate',
        schema_type: 'QuoteAction',
        target: abs('/estimate'),
        method: 'GET',
        description: 'Request a free in-home measure and a fixed written price.',
        outcome: 'A senior estimator visits, moisture-tests the floor and subfloor, and the written estimate follows with a committed schedule.',
      },
      canonical_url: abs('/estimate'),
      source: firstParty('/estimate'),
      provenance: verified,
      status: 'verified',
    },
    {
      id: 'action:call',
      type: 'Action',
      data: {
        name: 'call',
        schema_type: 'CommunicateAction',
        target: BUSINESS_NAP.phoneHref,
        method: 'tel',
        description: `Call ${BUSINESS_NAP.name}.`,
        outcome: 'Speak to the office during published hours.',
      },
      canonical_url: abs('/contact#phone'),
      source: firstParty('/contact'),
      provenance: verified,
      status: 'verified',
    },
    {
      id: 'action:email',
      type: 'Action',
      data: {
        name: 'email',
        schema_type: 'CommunicateAction',
        target: `mailto:${BUSINESS_NAP.email}`,
        method: 'mailto',
        description: `Email ${BUSINESS_NAP.name}.`,
        outcome: 'A written reply from the office.',
      },
      canonical_url: abs('/contact#email'),
      source: firstParty('/contact'),
      provenance: verified,
      status: 'verified',
    },
    {
      id: 'action:book_measure',
      type: 'Action',
      data: {
        name: 'book_measure',
        schema_type: 'ReserveAction',
        target: abs('/estimate#form'),
        method: 'POST',
        description: 'Book the in-home measure through the estimate form.',
        outcome: 'A confirmed measure appointment; the fixed written price follows the visit.',
      },
      canonical_url: abs('/estimate#form'),
      source: firstParty('/estimate'),
      provenance: verified,
      status: 'verified',
    },
  ];
}

/* ── graph ──────────────────────────────────────────────────────────────── */

export async function buildGraph(): Promise<{ nodes: { id: string; type: string; canonical_url: string }[]; edges: GraphEdge[] }> {
  const org = buildOrganization();
  const services = buildServices();
  const locations = buildLocations();
  const prices = buildPrices();
  const reviews = buildReviews();
  const sources = buildSources();
  const evidence = await buildEvidence();
  const faq = buildFaq();
  const pages = buildPages();
  const actions = buildActions();

  const nodes = [org, ...services, ...locations, ...prices, ...reviews, ...sources, ...evidence, ...faq, ...pages, ...actions].map((p) => ({
    id: p.id,
    type: p.type,
    canonical_url: p.canonical_url,
  }));

  const edges: GraphEdge[] = [];
  for (const s of services) edges.push({ from: org.id, predicate: 'offers', to: s.id });
  for (const l of locations) {
    if (l.data.coverage === 'published') edges.push({ from: org.id, predicate: 'serves', to: l.id });
    if (l.data.parent_id) edges.push({ from: l.id, predicate: 'within', to: l.data.parent_id });
  }
  for (const p of prices) {
    edges.push({ from: org.id, predicate: 'hasPrice', to: p.id });
    edges.push({ from: p.data.service_id, predicate: 'hasPrice', to: p.id });
  }
  for (const e of evidence) {
    for (const sid of e.data.supports_service_ids) edges.push({ from: sid, predicate: 'supportedBy', to: e.id });
    if (e.data.supports_service_ids.length === 0) edges.push({ from: org.id, predicate: 'supportedBy', to: e.id });
  }
  for (const src of sources) edges.push({ from: org.id, predicate: 'hasSource', to: src.id });
  for (const r of reviews) edges.push({ from: org.id, predicate: 'supportedBy', to: r.id });
  for (const pg of pages) edges.push({ from: org.id, predicate: 'hasPage', to: pg.id });
  for (const s of services) {
    edges.push({ from: s.id, predicate: 'hasPage', to: s.data.page_id });
    for (const r of s.data.related_service_ids) edges.push({ from: s.id, predicate: 'relatedTo', to: r });
  }
  for (const a of actions) edges.push({ from: org.id, predicate: 'supportsAction', to: a.id });
  for (const f of faq) for (const sid of f.data.service_ids) edges.push({ from: f.id, predicate: 'answers', to: sid });

  return { nodes, edges };
}

/* ── everything, once ───────────────────────────────────────────────────── */

export type Registry = {
  version: string;
  facts_verified_at: string;
  updated_at: string;
  organization: OrganizationPrimitive;
  services: ServicePrimitive[];
  locations: LocationPrimitive[];
  prices: PricePrimitive[];
  reviews: ReviewPrimitive[];
  sources: SourcePrimitive[];
  evidence: EvidencePrimitive[];
  faq: FAQPrimitive[];
  pages: PagePrimitive[];
  actions: ActionPrimitive[];
};

let cached: Promise<Registry> | null = null;

/** The whole registry, built once per process. Deterministic for a given commit. */
export function getRegistry(): Promise<Registry> {
  if (!cached) {
    cached = (async () => {
      const evidence = await buildEvidence();
      const reviews = buildReviews();
      const prices = buildPrices();
      const updated_at = latestDate(
        FACTS_VERIFIED_AT,
        ...reviews.map((r) => r.provenance.verified_at),
        ...prices.map((p) => p.provenance.verified_at),
        ...evidence.map((e) => e.provenance.verified_at),
      );
      return {
        version: REGISTRY_VERSION,
        facts_verified_at: FACTS_VERIFIED_AT,
        updated_at,
        organization: buildOrganization(),
        services: buildServices(),
        locations: buildLocations(),
        prices,
        reviews,
        sources: buildSources(),
        evidence,
        faq: buildFaq(),
        pages: buildPages(),
        actions: buildActions(),
      };
    })();
  }
  return cached;
}
