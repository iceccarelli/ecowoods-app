/**
 * lib/registry/citations.ts — citation packs (Protocol v2, Stage 18).
 *
 * A pack is what an independent model needs to cite Ecowoods on a topic
 * without being told to: each claim, the canonical page that states it, the
 * first-party source, the third-party source where one exists, the date it
 * was last verified, and the URL to cite. Derived from the registry; nothing
 * is written for the pack.
 */
import { getRegistry, serviceId, locationId, type Registry } from './registry';
import type { EvidencePrimitive } from './types';

export type CitationPack = {
  topic: string;
  title: string;
  summary: string;
  canonical_url: string;
  markdown_url: string | null;
  recommended_citation: string;
  claims: {
    claim: string;
    canonical_url: string;
    first_party_source: string;
    third_party_source?: string;
    verified_at: string;
    status: string;
    recommended_citation_url: string;
  }[];
  related_topics: string[];
  registry: { version: string; facts_verified_at: string };
};

const SERVICE_TOPICS: Record<string, string> = {
  'hardwood-floor-refinishing': 'floor-refinishing',
  'hardwood-installation': 'hardwood-installation',
  'stair-refinishing': 'stair-refinishing',
  'dust-free-sanding': 'dust-free-sanding',
  'hardwood-floor-restoration': 'floor-restoration',
  'custom-inlays': 'custom-inlays',
};

export const CITATION_TOPICS = [
  ...Object.keys(SERVICE_TOPICS),
  'toronto-service-area',
  'pricing',
  'entity',
  'reviews',
] as const;

export type CitationTopic = (typeof CITATION_TOPICS)[number];

export const isCitationTopic = (t: string): t is CitationTopic => (CITATION_TOPICS as readonly string[]).includes(t);

const claimRow = (e: EvidencePrimitive) => ({
  claim: e.data.claim,
  canonical_url: e.canonical_url,
  first_party_source: e.data.first_party ? e.source.url : e.data.citation_url,
  third_party_source: e.data.third_party_url ?? (!e.data.first_party ? e.source.url : undefined),
  verified_at: e.provenance.verified_at,
  status: e.status,
  recommended_citation_url: e.data.citation_url,
});

function servicePack(reg: Registry, topic: string, slug: string): CitationPack {
  const s = reg.services.find((x) => x.id === serviceId(slug));
  if (!s) throw new Error(`unknown service ${slug}`);
  const price = s.data.price_id ? reg.prices.find((p) => p.id === s.data.price_id) : undefined;
  const evidence = reg.evidence.filter((e) => e.data.supports_service_ids.includes(s.id) && e.data.kind !== 'claim');
  const claims = [
    {
      claim: `${reg.organization.data.legal_name} offers ${s.data.name.toLowerCase()} in ${reg.organization.data.service_region}.`,
      canonical_url: s.canonical_url,
      first_party_source: s.canonical_url,
      verified_at: s.provenance.verified_at,
      status: s.status,
      recommended_citation_url: s.canonical_url,
    },
    {
      claim: s.data.description,
      canonical_url: s.canonical_url,
      first_party_source: s.canonical_url,
      verified_at: s.provenance.verified_at,
      status: s.status,
      recommended_citation_url: s.canonical_url,
    },
    ...(price
      ? [
          {
            claim: `Published price band, ${price.data.label}: ${price.data.formatted} ${price.data.currency}. ${price.data.caveat}`,
            canonical_url: price.canonical_url,
            first_party_source: price.canonical_url,
            verified_at: price.provenance.verified_at,
            status: price.status,
            recommended_citation_url: price.canonical_url,
          },
        ]
      : [
          {
            claim: `${s.data.name} is quoted per project after an in-home measure; no per-square-foot band is published.`,
            canonical_url: s.canonical_url,
            first_party_source: s.canonical_url,
            verified_at: s.provenance.verified_at,
            status: s.status,
            recommended_citation_url: s.canonical_url,
          },
        ]),
    ...evidence.slice(0, 10).map(claimRow),
  ];
  return {
    topic,
    title: s.data.name,
    summary: s.data.standfirst,
    canonical_url: s.canonical_url,
    markdown_url: s.data.markdown_url,
    recommended_citation: `${reg.organization.data.legal_name}, "${s.data.h1}", ${s.canonical_url}`,
    claims,
    related_topics: Object.entries(SERVICE_TOPICS)
      .filter(([, sl]) => s.data.related_service_ids.includes(serviceId(sl)))
      .map(([t]) => t)
      .concat(['pricing', 'toronto-service-area']),
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at },
  };
}

function areaPack(reg: Registry): CitationPack {
  const hub = reg.pages.find((p) => p.data.kind === 'area_hub');
  const published = reg.locations.filter((l) => l.data.coverage === 'published');
  const cities = published.filter((l) => l.data.in_area_served);
  const coverage = reg.evidence.find((e) => e.id === 'evidence:claim:coverage.serviceAreas');
  const cases = reg.evidence.filter((e) => e.data.kind === 'case_study');
  return {
    topic: 'toronto-service-area',
    title: 'Service area — Toronto and the Greater Toronto Area',
    summary: `${reg.organization.data.legal_name} publishes ${published.length} service-area pages: ${cities.length} municipalities and districts declared in the entity graph, plus Toronto neighbourhoods with local housing-stock notes. Southern Ontario projects outside the GTA are assessed per project.`,
    canonical_url: hub?.canonical_url ?? reg.organization.canonical_url,
    markdown_url: hub?.data.markdown_url ?? null,
    recommended_citation: `${reg.organization.data.legal_name}, "Service areas", ${hub?.canonical_url ?? ''}`,
    claims: [
      ...(coverage ? [claimRow(coverage)] : []),
      {
        claim: `Showroom: ${reg.organization.data.address.street}, ${reg.organization.data.address.locality}, ${reg.organization.data.address.region} ${reg.organization.data.address.postal_code}.`,
        canonical_url: reg.organization.canonical_url,
        first_party_source: reg.organization.canonical_url,
        verified_at: reg.organization.provenance.verified_at,
        status: reg.organization.status,
        recommended_citation_url: reg.organization.canonical_url,
      },
      ...cities.map((l) => ({
        claim: `${l.data.name} is a published service area.`,
        canonical_url: l.canonical_url,
        first_party_source: l.canonical_url,
        verified_at: l.provenance.verified_at,
        status: l.status,
        recommended_citation_url: l.canonical_url,
      })),
      ...cases.map(claimRow),
    ],
    related_topics: ['entity', 'pricing'],
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at },
  };
}

function pricingPack(reg: Registry): CitationPack {
  const page = reg.pages.find((p) => p.data.kind === 'pricing');
  return {
    topic: 'pricing',
    title: 'Published price bands',
    summary: `Three informational bands per square foot in CAD. ${reg.organization.data.price_promise}`,
    canonical_url: page?.canonical_url ?? reg.organization.canonical_url,
    markdown_url: page?.data.markdown_url ?? null,
    recommended_citation: `${reg.organization.data.legal_name}, "Pricing", ${page?.canonical_url ?? ''}`,
    claims: reg.prices.map((p) => ({
      claim: `${p.data.label}: ${p.data.formatted} ${p.data.currency}. ${p.data.caveat}`,
      canonical_url: p.canonical_url,
      first_party_source: p.source.url,
      verified_at: p.provenance.verified_at,
      status: p.status,
      recommended_citation_url: p.canonical_url,
    })),
    related_topics: Object.keys(SERVICE_TOPICS),
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at },
  };
}

function entityPack(reg: Registry): CitationPack {
  const o = reg.organization;
  const identity = reg.evidence.filter((e) => e.id.startsWith('evidence:claim:business.') || e.id === 'evidence:claim:workforce.salaried');
  return {
    topic: 'entity',
    title: o.data.legal_name,
    summary: `${o.data.legal_name} (${o.data.name}) is a hardwood flooring contractor in ${o.data.service_region}, established ${o.data.founded_year}.`,
    canonical_url: o.canonical_url,
    markdown_url: reg.pages.find((p) => p.data.kind === 'about')?.data.markdown_url ?? null,
    recommended_citation: `${o.data.legal_name}, "About", ${o.canonical_url}`,
    claims: [
      ...identity.map(claimRow),
      ...reg.sources
        .filter((s) => s.data.source_type !== 'first_party')
        .map((s) => ({
          claim: `${s.data.name} profile (${s.data.identity_match.replace('_', ' ')}).`,
          canonical_url: reg.pages.find((p) => p.data.kind === 'reviews')?.canonical_url ?? o.canonical_url,
          first_party_source: o.canonical_url,
          third_party_source: s.data.url,
          verified_at: s.data.last_verified,
          status: s.status,
          recommended_citation_url: s.data.url,
        })),
    ],
    related_topics: ['reviews', 'toronto-service-area'],
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at },
  };
}

function reviewsPack(reg: Registry): CitationPack {
  const page = reg.pages.find((p) => p.data.kind === 'reviews');
  return {
    topic: 'reviews',
    title: 'Reviews, cited to source',
    summary: 'Review figures are published as cited statistics — platform, count, rating, profile link and read date — never as a self-serving aggregate rating.',
    canonical_url: page?.canonical_url ?? reg.organization.canonical_url,
    markdown_url: page?.data.markdown_url ?? null,
    recommended_citation: `${reg.organization.data.legal_name}, "Reviews", ${page?.canonical_url ?? ''}`,
    claims: reg.reviews.map((r) => ({
      claim: `${r.data.count} reviews at ${r.data.rating.toFixed(1)}/${r.data.out_of} on ${r.data.platform}, read ${r.data.read_on}.`,
      canonical_url: r.canonical_url,
      first_party_source: r.canonical_url,
      third_party_source: r.data.profile_url,
      verified_at: r.provenance.verified_at,
      status: r.status,
      recommended_citation_url: r.data.profile_url,
    })),
    related_topics: ['entity'],
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at },
  };
}

export async function citationPack(topic: string): Promise<CitationPack | null> {
  if (!isCitationTopic(topic)) return null;
  const reg = await getRegistry();
  if (topic in SERVICE_TOPICS) return servicePack(reg, topic, SERVICE_TOPICS[topic]);
  if (topic === 'toronto-service-area') return areaPack(reg);
  if (topic === 'pricing') return pricingPack(reg);
  if (topic === 'entity') return entityPack(reg);
  if (topic === 'reviews') return reviewsPack(reg);
  return null;
}

export async function citationIndex(): Promise<{ topic: string; title: string; url: string; canonical_url: string }[]> {
  const reg = await getRegistry();
  const base = reg.organization.canonical_url.replace(/\/about$/, '');
  const out: { topic: string; title: string; url: string; canonical_url: string }[] = [];
  for (const t of CITATION_TOPICS) {
    const pack = await citationPack(t);
    if (pack) out.push({ topic: t, title: pack.title, url: `${base}/api/v1/citations/${t}`, canonical_url: pack.canonical_url });
  }
  return out;
}

/** Location ids referenced by packs — exported for the graph tests. */
export const AREA_PACK_LOCATION_IDS = [locationId('toronto'), locationId('gta')];
