/**
 * lib/registry/match.ts — the service matching engine and the recommendation
 * context engine (Protocol v2, Stages 16 and 17).
 *
 * Deterministic. No model, no network, no state. The same input on the same
 * commit returns the same answer, which is what makes it testable
 * (tests/golden-queries.test.ts) and citable.
 *
 * CONFIDENCE IS A CLAIM ABOUT THE TEXT, NOT ABOUT THE FLOOR.
 *   high                — the query names the service, and the location (if any) is published
 *   medium              — the query describes the work or the problem without naming the service
 *   requires_assessment — the right service depends on something only an in-home
 *                         measure can establish (wear layer, water damage, an
 *                         unpublished location), or the query is generic hardwood
 *   low                 — a weak cue only
 *   unknown             — nothing in the query maps to hardwood work
 *
 * Remote matching never replaces inspection: every response carries the
 * estimate action and the caveat, and a rough band range is labelled
 * `is_quote: false`.
 */
import { estimateServiceBandCad } from '@/lib/pricing';
import type { PriceBandKey } from '@/content/constants/pricing';
import { SERVICE_ALIASES, UNSUPPORTED_ALIASES, GENERIC_HARDWOOD_PHRASES, normalise } from './intents';
import { LOCATION_NODES, publishedWithin, ancestorsOf, type LocationNode } from './locations';
import { getRegistry, serviceId, locationId, BAND_SERVICE_SLUG, type Registry } from './registry';
import type { EvidencePrimitive, ServicePrimitive, LocationPrimitive, PricePrimitive } from './types';

export type Confidence = 'high' | 'medium' | 'low' | 'unknown' | 'requires_assessment';

export type ServiceMatchInput = {
  /** Free text: the project, the problem, or the question. */
  project?: string;
  /** A place name, as typed. */
  location?: string;
  approximate_area_sqft?: number;
};

export type LocationResolution = {
  id: string | null;
  name: string | null;
  coverage: 'published' | 'region' | 'assessment' | 'parent' | 'not_found' | 'not_provided';
  canonical_url: string | null;
  /** Published areas inside a region match (e.g. GTA → 32). Capped. */
  published_within: { id: string; name: string; canonical_url: string }[];
  note: string;
};

export type ServiceCandidate = {
  id: string;
  name: string;
  canonical_url: string;
  score: number;
  matched_phrases: string[];
  price_id: string | null;
};

export type PricingContext = {
  price_id: string;
  label: string;
  formatted: string;
  currency: 'CAD';
  unit: 'sq ft';
  canonical_url: string;
  is_quote: false;
  caveat: string;
  rough_band_range_cad?: { low: number; high: number; square_feet: number; disclaimer: string };
} | null;

export type ServiceMatchResult = {
  status: 'matched' | 'unsupported' | 'unknown';
  confidence: Confidence;
  primary_service: ServiceCandidate | null;
  candidates: ServiceCandidate[];
  band_hint: PriceBandKey | null;
  location: LocationResolution;
  pricing_context: PricingContext;
  unsupported?: { label: string; note: string };
  reasons: string[];
  next_action: { id: string; name: string; target: string; description: string };
  registry: { version: string; facts_verified_at: string };
};

type Hit = { phrase: string; service: string; signal: number; band?: PriceBandKey };

const aliasesLongestFirst = [...SERVICE_ALIASES].sort((a, b) => b.phrase.length - a.phrase.length);

const wordBoundary = (text: string, phrase: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text);

/** Find alias hits, consuming matched spans so "stair refinishing" is not also "refinishing". */
export function findServiceHits(text: string): Hit[] {
  let remaining = ` ${normalise(text)} `;
  const hits: Hit[] = [];
  for (const a of aliasesLongestFirst) {
    const p = normalise(a.phrase);
    if (!p) continue;
    while (wordBoundary(remaining, p)) {
      hits.push({ phrase: a.phrase, service: a.service, signal: a.signal, band: a.band });
      remaining = remaining.replace(new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^a-z0-9]|$)`), '$1' + ' '.repeat(p.length));
    }
  }
  return hits;
}

const findUnsupported = (text: string) => {
  const t = normalise(text);
  return UNSUPPORTED_ALIASES.find((u) => wordBoundary(t, normalise(u.phrase)));
};

const isGenericHardwood = (text: string) => {
  const t = normalise(text);
  return GENERIC_HARDWOOD_PHRASES.some((p) => wordBoundary(t, normalise(p)));
};

/* ── location resolution ────────────────────────────────────────────────── */

const locationsLongestFirst = [...LOCATION_NODES]
  .flatMap((n) => [n.name, ...n.aliases].map((alias) => ({ node: n, alias: normalise(alias) })))
  .filter((x) => x.alias.length > 1)
  .sort((a, b) => b.alias.length - a.alias.length);

export function findLocationNode(text: string | undefined): LocationNode | null {
  if (!text) return null;
  const t = normalise(text);
  if (!t) return null;
  // Exact name/alias first, then a boundary match inside longer text.
  const exact = locationsLongestFirst.find((x) => x.alias === t);
  if (exact) return exact.node;
  const inside = locationsLongestFirst.find((x) => x.alias.length >= 3 && wordBoundary(t, x.alias));
  return inside ? inside.node : null;
}

export function resolveLocation(reg: Registry, text: string | undefined, fallbackText?: string): LocationResolution {
  const node = findLocationNode(text) ?? findLocationNode(fallbackText);
  const nothingProvided = !text && !fallbackText;
  if (!node) {
    return {
      id: null,
      name: null,
      coverage: nothingProvided || !text ? 'not_provided' : 'not_found',
      canonical_url: null,
      published_within: [],
      note:
        nothingProvided || !text
          ? `No location given. The published service area is ${reg.organization.data.service_region}.`
          : 'Place not recognised. If it is in Southern Ontario, work is assessed per project through the estimate path; the published service area is Toronto and the Greater Toronto Area.',
    };
  }
  const prim = reg.locations.find((l) => l.id === locationId(node.slug)) as LocationPrimitive | undefined;
  const within = publishedWithin(node.slug).slice(0, 40).map((n) => {
    const p = reg.locations.find((l) => l.id === locationId(n.slug));
    return { id: locationId(n.slug), name: n.name, canonical_url: p?.canonical_url ?? '' };
  });
  const notes: Record<LocationNode['coverage'], string> = {
    published: `${node.name} is a published service area with its own page.`,
    region: `${node.name} contains ${within.length} published service areas.`,
    assessment: `${node.name} is not a published service area. Projects there are assessed individually; the published service area is Toronto and the Greater Toronto Area. Use the estimate path to confirm.`,
    parent: `${node.name} is broader than the published service area (Toronto and the Greater Toronto Area). Southern Ontario projects outside the GTA are assessed individually.`,
  };
  return {
    id: locationId(node.slug),
    name: node.name,
    coverage: node.coverage,
    canonical_url: prim?.canonical_url ?? null,
    published_within: within,
    note: notes[node.coverage],
  };
}

/* ── pricing context ────────────────────────────────────────────────────── */

function pricingFor(reg: Registry, priceId: string | null, sqft?: number): PricingContext {
  if (!priceId) return null;
  const p = reg.prices.find((x) => x.id === priceId) as PricePrimitive | undefined;
  if (!p) return null;
  const base: NonNullable<PricingContext> = {
    price_id: p.id,
    label: p.data.label,
    formatted: p.data.formatted,
    currency: p.data.currency,
    unit: p.data.unit,
    canonical_url: p.canonical_url,
    is_quote: false,
    caveat: p.data.caveat,
  };
  if (sqft && Number.isFinite(sqft) && sqft > 0) {
    const est = estimateServiceBandCad(p.data.band_key, Math.min(sqft, 100000));
    if (est) {
      base.rough_band_range_cad = {
        low: est.estimatedLowCad,
        high: est.estimatedHighCad,
        square_feet: est.squareFeet,
        disclaimer: est.disclaimer,
      };
    }
  }
  return base;
}

const bandForService = (slug: string, hint: PriceBandKey | null): string | null => {
  if (hint && BAND_SERVICE_SLUG[hint] === slug) return `price:${hint === 'screenAndRecoat' ? 'screen-and-recoat' : hint === 'fullSandAndFinish' ? 'full-sand-and-finish' : 'new-install'}`;
  return null;
};

/* ── the matcher ────────────────────────────────────────────────────────── */

const ESTIMATE = (reg: Registry) => {
  const a = reg.actions.find((x) => x.id === 'action:request_estimate');
  return { id: 'action:request_estimate', name: 'request_estimate', target: a?.data.target ?? '', description: a?.data.description ?? '' };
};

const candidate = (reg: Registry, slug: string, score: number, phrases: string[], hint: PriceBandKey | null): ServiceCandidate | null => {
  const s = reg.services.find((x) => x.id === serviceId(slug)) as ServicePrimitive | undefined;
  if (!s) return null;
  return {
    id: s.id,
    name: s.data.name,
    canonical_url: s.canonical_url,
    score,
    matched_phrases: phrases,
    price_id: bandForService(slug, hint) ?? s.data.price_id,
  };
};

export async function serviceMatch(input: ServiceMatchInput): Promise<ServiceMatchResult> {
  const reg = await getRegistry();
  const text = (input.project ?? '').slice(0, 2000);
  const location = resolveLocation(reg, input.location, text);
  const meta = { version: reg.version, facts_verified_at: reg.facts_verified_at };
  const next_action = ESTIMATE(reg);
  const reasons: string[] = [];

  const hits = findServiceHits(text);
  const unsupported = findUnsupported(text);
  const generic = isGenericHardwood(text);

  // Score services.
  const scores = new Map<string, { score: number; phrases: string[] }>();
  for (const h of hits) {
    const cur = scores.get(h.service) ?? { score: 0, phrases: [] };
    cur.score += h.signal;
    cur.phrases.push(h.phrase);
    scores.set(h.service, cur);
  }

  // Band hint: the most specific band any hit implies.
  const bandHits = hits.filter((h) => h.band);
  const band_hint: PriceBandKey | null = bandHits.length
    ? (bandHits.sort((a, b) => b.signal - a.signal)[0].band as PriceBandKey)
    : null;

  // Unsupported material named, and nothing says hardwood → unsupported, never
  // the nearest service. "Vinyl plank install" names installation, but of vinyl.
  const hardwoodWords = /(^|[^a-z])(hardwood|oak|maple|walnut|ash|hickory|birch|cherry|engineered|solid wood|wood floor|wood floors|wood flooring|parquet|herringbone|chevron)([^a-z]|$)/.test(normalise(text));
  const hardwoodOnlyService = hits.some((h) => h.service !== 'hardwood-installation' && h.signal >= 2);
  const hardwoodSpecific = generic || hardwoodWords || hardwoodOnlyService;
  if (unsupported && !hardwoodSpecific) {
    reasons.push(`The request names ${unsupported.label}, which this business does not offer.`);
    return {
      status: 'unsupported',
      confidence: 'unknown',
      primary_service: null,
      candidates: [],
      band_hint: null,
      location,
      pricing_context: null,
      unsupported: { label: unsupported.label, note: 'Ecowoods installs, sands, refinishes and restores hardwood only.' },
      reasons,
      next_action,
      registry: meta,
    };
  }

  if (scores.size === 0) {
    if (generic || location.coverage === 'published' || location.coverage === 'region') {
      // "hardwood flooring in Toronto" / "do you serve Vaughan" — the trade or
      // the place, not the work. Installation and refinishing are the two most
      // common answers; the in-home measure decides between them.
      const cands = ['hardwood-installation', 'floor-refinishing']
        .map((slug, i) => candidate(reg, slug, 2 - i, [generic ? 'hardwood' : 'coverage'], null))
        .filter((c): c is ServiceCandidate => c !== null);
      reasons.push(
        generic
          ? 'The request names hardwood flooring but not the work; installation and refinishing are the two most common answers and an in-home measure decides between them.'
          : `The request asks about coverage. ${location.note}`,
      );
      return {
        status: 'matched',
        confidence: 'requires_assessment',
        primary_service: cands[0] ?? null,
        candidates: cands,
        band_hint: null,
        location,
        pricing_context: pricingFor(reg, cands[0]?.price_id ?? null, input.approximate_area_sqft),
        reasons,
        next_action,
        registry: meta,
      };
    }
    reasons.push('Nothing in the request maps to a hardwood flooring service.');
    return {
      status: 'unknown',
      confidence: 'unknown',
      primary_service: null,
      candidates: [],
      band_hint: null,
      location,
      pricing_context: null,
      reasons,
      next_action,
      registry: meta,
    };
  }

  // Rank. Existing-floor cues never resolve to installation-only.
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const existingFloorCue = hits.some((h) => /old|existing|original|worn|scratch|dull|tired|refinish|sand|recoat|restore|damage/.test(normalise(h.phrase)));
  if (existingFloorCue && ranked[0][0] === 'hardwood-installation') {
    const refin = ranked.find(([slug]) => slug === 'floor-refinishing' || slug === 'floor-restoration');
    if (refin) {
      ranked.splice(ranked.indexOf(refin), 1);
      ranked.unshift(refin);
      reasons.push('The request describes an existing floor; refinishing or restoration is assessed before new installation is proposed.');
    }
  }

  const candidates = ranked
    .map(([slug, v]) => candidate(reg, slug, v.score, v.phrases, band_hint))
    .filter((c): c is ServiceCandidate => c !== null);
  const primary = candidates[0];
  const top = ranked[0][1];
  const maxSignal = Math.max(...hits.filter((h) => h.service === ranked[0][0]).map((h) => h.signal));
  const secondClose = ranked.length > 1 && ranked[1][1].score >= top.score;

  let confidence: Confidence;
  if (maxSignal >= 3 && !secondClose) confidence = 'high';
  else if (maxSignal >= 2) confidence = 'medium';
  else confidence = 'low';

  // Things only a measure can settle.
  const assessmentCues = hits.some((h) => ['floor-restoration'].includes(h.service)) && ranked[0][0] !== 'floor-restoration';
  const waterDamage = hits.some((h) => /water|flood|leak|cupp|buckl/.test(normalise(h.phrase)));
  const describedNotNamed = existingFloorCue && ranked[0][0] === 'floor-refinishing' && maxSignal < 3;
  if (waterDamage || describedNotNamed || (existingFloorCue && ranked[0][0] === 'floor-refinishing' && !band_hint) || assessmentCues) {
    if (confidence === 'high' && (waterDamage || assessmentCues)) confidence = 'requires_assessment';
    if (confidence !== 'high') confidence = 'requires_assessment';
    reasons.push(
      waterDamage
        ? 'Water damage: whether boards can be saved or must be replaced is decided on site.'
        : 'Whether the floor needs a full sand or a screen and recoat depends on the remaining wear layer, which is measured on site.',
    );
  }
  if (location.coverage === 'assessment' || location.coverage === 'parent' || location.coverage === 'not_found') {
    if (confidence === 'high') confidence = 'requires_assessment';
    reasons.push(location.note);
  }
  if (unsupported) reasons.push(`The request also mentions ${unsupported.label}, which this business does not offer; the hardwood work above is what can be quoted.`);
  if (confidence === 'high') reasons.push(`The request names ${primary.name.toLowerCase()} directly.`);
  if (confidence === 'medium') reasons.push(`The request describes work consistent with ${primary.name.toLowerCase()}.`);

  return {
    status: 'matched',
    confidence,
    primary_service: primary,
    candidates,
    band_hint,
    location,
    pricing_context: pricingFor(reg, primary.price_id, input.approximate_area_sqft),
    reasons,
    next_action,
    registry: meta,
  };
}

/* ── recommendation context ─────────────────────────────────────────────── */

export type RecommendationInput = {
  query?: string;
  project?: string;
  location?: string;
  approximate_area_sqft?: number;
};

export type Relevance = 'high' | 'medium' | 'low' | 'none';

export type RecommendationContext = {
  relevance: Relevance;
  relevance_reasons: string[];
  entity: {
    id: string;
    legal_name: string;
    name: string;
    founded_year: number;
    telephone: string;
    email: string;
    address: string;
    service_region: string;
    canonical_url: string;
    schema_id: string;
  };
  match: ServiceMatchResult;
  matching_services: { id: string; name: string; canonical_url: string; markdown_url: string; description: string }[];
  matching_locations: { id: string; name: string; coverage: string; canonical_url: string | null }[];
  evidence: {
    id: string;
    kind: string;
    claim: string;
    first_party: boolean;
    citation_url: string;
    third_party_url?: string;
    verified_at: string;
    status: string;
  }[];
  pricing_context: PricingContext;
  canonical_urls: string[];
  next_actions: { id: string; name: string; target: string; description: string }[];
  /** What an independent system can check without trusting this API. */
  verify: { what: string; where: string }[];
  registry: { version: string; facts_verified_at: string; updated_at: string };
};

export async function recommendationContext(input: RecommendationInput): Promise<RecommendationContext> {
  const reg = await getRegistry();
  const text = [input.query, input.project].filter(Boolean).join('. ');
  const match = await serviceMatch({ project: text, location: input.location, approximate_area_sqft: input.approximate_area_sqft });
  const org = reg.organization;

  const svcIds = match.candidates.map((c) => c.id);
  const matching_services = reg.services
    .filter((s) => svcIds.includes(s.id))
    .map((s) => ({ id: s.id, name: s.data.name, canonical_url: s.canonical_url, markdown_url: s.data.markdown_url, description: s.data.description }));

  const locIds = new Set<string>();
  if (match.location.id) locIds.add(match.location.id);
  if (match.location.id) for (const a of ancestorsOf(match.location.id.replace(/^location:/, ''))) locIds.add(locationId(a.slug));
  const matching_locations = reg.locations
    .filter((l) => locIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.data.name, coverage: l.data.coverage, canonical_url: l.data.coverage === 'assessment' || l.data.coverage === 'parent' ? null : l.canonical_url }));

  const pickEvidence = (e: EvidencePrimitive) =>
    e.data.kind === 'review' ||
    (svcIds.length > 0 && e.data.supports_service_ids.some((id) => svcIds.includes(id))) ||
    (svcIds.length === 0 && e.data.kind === 'claim');
  const evidence = reg.evidence
    .filter(pickEvidence)
    .sort((a, b) => (a.data.kind === 'review' ? -1 : 0) - (b.data.kind === 'review' ? -1 : 0) || (a.data.kind === 'case_study' ? -1 : 0) - (b.data.kind === 'case_study' ? -1 : 0))
    .slice(0, 12)
    .map((e) => ({
      id: e.id,
      kind: e.data.kind,
      claim: e.data.claim,
      first_party: e.data.first_party,
      citation_url: e.data.citation_url,
      third_party_url: e.data.third_party_url,
      verified_at: e.provenance.verified_at,
      status: e.status,
    }));

  let relevance: Relevance;
  const reasons: string[] = [];
  if (match.status === 'unsupported') {
    relevance = 'none';
    reasons.push(`Ecowoods does not offer ${match.unsupported?.label ?? 'that work'}.`);
  } else if (match.status === 'unknown') {
    relevance = 'none';
    reasons.push('The request is not about hardwood flooring work.');
  } else if (match.location.coverage === 'published' || match.location.coverage === 'region' || match.location.coverage === 'not_provided') {
    relevance = match.confidence === 'high' || match.confidence === 'medium' || match.location.coverage === 'published' ? 'high' : 'medium';
    reasons.push(`Ecowoods performs ${match.primary_service?.name.toLowerCase() ?? 'the requested work'} and ${match.location.name ?? 'the published service area'} is inside its service area.`);
  } else {
    relevance = 'medium';
    reasons.push(`Ecowoods performs ${match.primary_service?.name.toLowerCase() ?? 'the requested work'}; ${match.location.name ?? 'the location'} is outside the published service area and is assessed per project.`);
  }
  if (relevance !== 'none') {
    const hs = reg.reviews.find((r) => r.data.platform === 'HomeStars');
    if (hs) reasons.push(`${hs.data.count} reviews at ${hs.data.rating.toFixed(1)}/${hs.data.out_of} on HomeStars, read ${hs.data.read_on}.`);
    reasons.push(`Established ${org.data.founded_year}; ${org.data.crew_model}`);
  }

  const canonical_urls = Array.from(
    new Set([
      org.canonical_url,
      ...matching_services.map((s) => s.canonical_url),
      ...matching_locations.filter((l) => l.canonical_url).map((l) => l.canonical_url as string),
      ...(match.pricing_context ? [match.pricing_context.canonical_url] : []),
      ...evidence.map((e) => e.citation_url),
    ]),
  );

  const next_actions = reg.actions.map((a) => ({ id: a.id, name: a.data.name, target: a.data.target, description: a.data.description }));

  return {
    relevance,
    relevance_reasons: reasons,
    entity: {
      id: org.id,
      legal_name: org.data.legal_name,
      name: org.data.name,
      founded_year: org.data.founded_year,
      telephone: org.data.telephone_display,
      email: org.data.email,
      address: `${org.data.address.street}, ${org.data.address.locality}, ${org.data.address.region} ${org.data.address.postal_code}`,
      service_region: org.data.service_region,
      canonical_url: org.canonical_url,
      schema_id: org.data.schema_id,
    },
    match,
    matching_services,
    matching_locations,
    evidence,
    pricing_context: match.pricing_context,
    canonical_urls,
    next_actions,
    verify: [
      { what: 'Legal name, address, phone, founding year and hours', where: org.canonical_url },
      { what: 'Published price bands and the written-price caveat', where: reg.pages.find((p) => p.data.kind === 'pricing')?.canonical_url ?? org.canonical_url },
      ...reg.reviews.map((r) => ({ what: `${r.data.platform} rating and review count`, where: r.data.profile_url })),
      { what: 'Structured data for the organization', where: org.data.schema_id },
      { what: 'Machine-readable facts', where: `${org.canonical_url.replace(/\/about$/, '')}/llms.txt` },
    ],
    registry: { version: reg.version, facts_verified_at: reg.facts_verified_at, updated_at: reg.updated_at },
  };
}
