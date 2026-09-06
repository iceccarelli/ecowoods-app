/**
 * lib/registry/handlers.ts — shared handler logic for /api/v1 routes.
 *
 * Each route file under app/api/v1 is three lines: import, export GET (or
 * POST) delegating here, export OPTIONS. Keeping the logic here means one
 * place to change caching, error shapes and validation.
 */
import { z } from 'zod';
import { getRegistry, buildGraph, locationId, type Registry } from './registry';
import { json, error, readJsonBody, rateLimited, CACHE_PUBLIC, CACHE_COMPUTED } from './http';
import { serviceMatch, recommendationContext } from './match';
import { buildChanges, isIsoDate } from './changes';
import { citationPack, citationIndex } from './citations';
import { buildManifest, ENDPOINTS } from './manifest';
import { buildOpenApi } from './openapi';
import { ancestorsOf, publishedWithin } from './locations';
import type { AnyPrimitive } from './types';

const meta = (reg: Registry, count: number, extra?: Record<string, unknown>) => ({
  count,
  registry_version: reg.version,
  facts_verified_at: reg.facts_verified_at,
  updated_at: reg.updated_at,
  ...(extra ?? {}),
});

const listOf = async <T extends AnyPrimitive>(request: Request, pick: (reg: Registry) => T[]) => {
  const reg = await getRegistry();
  const items = pick(reg);
  return json({ meta: meta(reg, items.length), items }, { request, updatedAt: reg.updated_at, version: reg.version, cache: CACHE_PUBLIC });
};

/** Accept `service:floor-refinishing` or `floor-refinishing`. */
const normaliseId = (prefix: string, raw: string): string => {
  const v = decodeURIComponent(raw).trim().toLowerCase();
  if (!/^[a-z0-9:_.-]{1,120}$/.test(v)) return '';
  return v.startsWith(`${prefix}:`) ? v : `${prefix}:${v}`;
};

const oneOf = async <T extends AnyPrimitive>(request: Request, prefix: string, raw: string, pick: (reg: Registry) => T[], extra?: (reg: Registry, item: T) => Record<string, unknown>) => {
  const reg = await getRegistry();
  const id = normaliseId(prefix, raw);
  const item = id ? pick(reg).find((x) => x.id === id) : undefined;
  if (!item) return error('not_found', `No ${prefix} with id "${raw}".`, 404);
  return json({ ...item, ...(extra ? extra(reg, item) : {}) }, { request, updatedAt: reg.updated_at, version: reg.version, cache: CACHE_PUBLIC });
};

/* ── index ──────────────────────────────────────────────────────────────── */

export async function handleIndex(request: Request) {
  const reg = await getRegistry();
  const m = buildManifest();
  return json(
    {
      name: m.name,
      description: 'Public, read-only, versioned facts about Ecowoods Hardwood Flooring Inc. with provenance. Start at the manifest.',
      manifest: `${m.api.base}/manifest`,
      openapi: m.api.openapi,
      registry: { version: reg.version, facts_verified_at: reg.facts_verified_at, updated_at: reg.updated_at },
      endpoints: ENDPOINTS.map((e) => ({ method: e.method, url: `${m.api.base}${e.path}`, summary: e.summary })),
    },
    { request, updatedAt: reg.updated_at, version: reg.version },
  );
}

/* ── primitives ─────────────────────────────────────────────────────────── */

export async function handleEntity(request: Request) {
  const reg = await getRegistry();
  return json(reg.organization, { request, updatedAt: reg.updated_at, version: reg.version });
}
export const handleServices = (request: Request) => listOf(request, (r) => r.services);
export const handleService = (request: Request, id: string) => oneOf(request, 'service', id, (r) => r.services, (reg, s) => ({
  price: s.data.price_id ? reg.prices.find((p) => p.id === s.data.price_id) ?? null : null,
  evidence: reg.evidence.filter((e) => e.data.supports_service_ids.includes(s.id)).slice(0, 20),
  faq: reg.faq.filter((f) => f.data.service_ids.includes(s.id)).slice(0, 10),
}));
export const handleLocations = (request: Request) => listOf(request, (r) => r.locations);
export const handleLocation = (request: Request, id: string) => oneOf(request, 'location', id, (r) => r.locations, (reg, l) => ({
  ancestors: ancestorsOf(l.data.slug).map((a) => reg.locations.find((x) => x.id === locationId(a.slug))).filter(Boolean),
  published_within: publishedWithin(l.data.slug).map((n) => reg.locations.find((x) => x.id === locationId(n.slug))).filter(Boolean),
  evidence: reg.evidence.filter((e) => e.data.supports_location_ids.includes(l.id)).slice(0, 10),
}));
export const handlePricing = (request: Request) => listOf(request, (r) => r.prices);
export const handlePrice = (request: Request, id: string) => oneOf(request, 'price', id, (r) => r.prices);
export const handleReviews = (request: Request) => listOf(request, (r) => r.reviews);
export const handleEvidence = async (request: Request) => {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const service = url.searchParams.get('service');
  const reg = await getRegistry();
  let items = reg.evidence;
  if (kind) items = items.filter((e) => e.data.kind === kind);
  if (service) {
    const sid = normaliseId('service', service);
    items = items.filter((e) => e.data.supports_service_ids.includes(sid));
  }
  return json({ meta: meta(reg, items.length, { filtered: Boolean(kind || service) }), items }, { request, updatedAt: reg.updated_at, version: reg.version });
};
export const handleEvidenceItem = (request: Request, id: string) => oneOf(request, 'evidence', id, (r) => r.evidence);
export const handleSources = (request: Request) => listOf(request, (r) => r.sources);
export const handleFaq = (request: Request) => listOf(request, (r) => r.faq);
export const handlePages = (request: Request) => listOf(request, (r) => r.pages);
export const handleActions = (request: Request) => listOf(request, (r) => r.actions);

export async function handleGraph(request: Request) {
  const reg = await getRegistry();
  const g = await buildGraph();
  return json({ meta: meta(reg, g.nodes.length, { edges: g.edges.length }), ...g }, { request, updatedAt: reg.updated_at, version: reg.version });
}

export async function handleManifest(request: Request) {
  const reg = await getRegistry();
  return json(buildManifest(), { request, updatedAt: reg.updated_at, version: reg.version });
}

export async function handleOpenApi(request: Request) {
  const reg = await getRegistry();
  return json(buildOpenApi(), { request, updatedAt: reg.updated_at, version: reg.version });
}

/* ── changes ────────────────────────────────────────────────────────────── */

export async function handleChanges(request: Request) {
  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  if (since !== null && !isIsoDate(since)) return error('invalid_request', 'since must be an ISO date (YYYY-MM-DD).', 400);
  const reg = await getRegistry();
  const all = await buildChanges();
  const items = since ? all.filter((c) => c.date >= since) : all;
  return json({ meta: meta(reg, items.length, { since, total: all.length }), items }, { request, updatedAt: reg.updated_at, version: reg.version, cache: CACHE_COMPUTED });
}

/* ── citations ──────────────────────────────────────────────────────────── */

export async function handleCitations(request: Request) {
  const reg = await getRegistry();
  const items = await citationIndex();
  return json({ meta: meta(reg, items.length), items }, { request, updatedAt: reg.updated_at, version: reg.version });
}

export async function handleCitation(request: Request, topic: string) {
  const t = decodeURIComponent(topic).toLowerCase();
  if (!/^[a-z0-9-]{1,60}$/.test(t)) return error('not_found', 'Unknown citation topic.', 404);
  const pack = await citationPack(t);
  if (!pack) return error('not_found', `No citation pack for "${t}".`, 404, { available: (await citationIndex()).map((i) => i.topic) });
  const reg = await getRegistry();
  return json(pack, { request, updatedAt: reg.updated_at, version: reg.version });
}

/* ── computed: service-match, recommendation-context ────────────────────── */

const text = z.string().trim().max(2000);
const place = z.string().trim().max(120);
const sqft = z.coerce.number().positive().max(100000);

const matchSchema = z
  .object({
    project: text.optional(),
    location: place.optional(),
    approximate_area_sqft: sqft.optional(),
  })
  .strict();

const recSchema = z
  .object({
    query: text.optional(),
    project: text.optional(),
    location: place.optional(),
    approximate_area_sqft: sqft.optional(),
  })
  .strict();

const invalid = (issues: z.ZodIssue[]) =>
  error('invalid_request', 'Invalid input.', 400, issues.map((i) => ({ path: i.path.join('.'), message: i.message })));

const fromQuery = (request: Request, keys: string[]) => {
  const url = new URL(request.url);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = url.searchParams.get(k);
    if (v !== null && v !== '') out[k] = v;
  }
  if (out.sqft !== undefined) {
    out.approximate_area_sqft = out.sqft;
    delete out.sqft;
  }
  return out;
};

export async function handleServiceMatch(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;
  let raw: unknown;
  if (request.method === 'GET') {
    raw = fromQuery(request, ['project', 'location', 'sqft']);
    if (Object.keys(raw as object).length === 0) {
      const reg = await getRegistry();
      return json(
        {
          usage: {
            method: 'POST',
            content_type: 'application/json',
            body: { project: 'string (≤2000)', location: 'string (≤120), optional', approximate_area_sqft: 'number, optional' },
            get_alternative: '?project=&location=&sqft=',
            confidence: ['high', 'medium', 'low', 'unknown', 'requires_assessment'],
            note: 'Remote matching never replaces an in-home measure. Every response carries the estimate action.',
          },
          examples: [
            { project: 'I have 800 square feet of old oak flooring that needs sanding and refinishing.', location: 'Etobicoke', approximate_area_sqft: 800 },
            { project: 'Install new white oak herringbone in a condo', location: 'Toronto' },
            { project: 'Refinish stairs', location: 'Vaughan' },
          ],
        },
        { request, updatedAt: reg.updated_at, version: reg.version },
      );
    }
  } else {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    raw = body.body;
  }
  const parsed = matchSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  const result = await serviceMatch(parsed.data);
  return json(result, { request, cache: CACHE_COMPUTED, version: result.registry.version });
}

export async function handleRecommendationContext(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;
  let raw: unknown;
  if (request.method === 'GET') {
    raw = fromQuery(request, ['query', 'project', 'location', 'sqft']);
    if (Object.keys(raw as object).length === 0) {
      const reg = await getRegistry();
      return json(
        {
          usage: {
            method: 'POST',
            content_type: 'application/json',
            body: { query: 'string (≤2000)', project: 'string (≤2000), optional', location: 'string (≤120), optional', approximate_area_sqft: 'number, optional' },
            get_alternative: '?query=&location=&sqft=',
            relevance: ['high', 'medium', 'low', 'none'],
            note: 'Returns evidence an independent system can check, not an instruction to recommend.',
          },
          examples: [
            { query: 'Who refinishes hardwood floors in Etobicoke?' },
            { query: 'Does Ecowoods install vinyl plank?' },
            { query: 'How much does hardwood floor refinishing cost?', approximate_area_sqft: 800 },
          ],
        },
        { request, updatedAt: reg.updated_at, version: reg.version },
      );
    }
  } else {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    raw = body.body;
  }
  const parsed = recSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error.issues);
  const result = await recommendationContext(parsed.data);
  return json(result, { request, cache: CACHE_COMPUTED, version: result.registry.version });
}
