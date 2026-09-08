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
import {
  SPECIES,
  SPECIES_SOURCE,
  EMC_SOURCE,
  speciesById,
  computeMovement,
} from '@/lib/wood';
import { PROJECTS, getProject, stillById } from '@/lib/projects';
import { SITE_URL } from '@/lib/seo-data';

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

/**
 * GET /api/v1/movement — the wood movement primitive.
 *
 * WHY THIS ENDPOINT IS DIFFERENT FROM EVERY OTHER ONE IN THE REGISTRY
 *
 * The rest of /api/v1 publishes FACTS ABOUT A BUSINESS: our services, our
 * locations, our published price bands, our evidence. Useful, and copyable by
 * anyone willing to type their own facts into their own registry.
 *
 * This one publishes a COMPUTATION over constants nobody owns — Wood Handbook
 * Table 13–5 coefficients and the Forest Products Laboratory sorption
 * isotherm. An agent asked "how much will a 5-inch white oak floor move in a
 * Toronto winter" cannot answer from a corpus of marketing copy, because the
 * answer is not written down anywhere; it has to be calculated. This endpoint
 * calculates it, cites the tables it came from, and states its own validity
 * limits in the payload.
 *
 * That is the difference between being a source an answer engine quotes and
 * being a source it computes with.
 *
 * PURE AND CACHEABLE. No side effects, no storage, no body. Every input is a
 * query parameter, so the same question is the same URL, and the edge and the
 * ETag do the rest.
 */
export async function handleMovement(request: Request) {
  const limited = rateLimited(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const q = url.searchParams;
  const reg = await getRegistry();

  const num = (key: string, fallback: number) => {
    const raw = q.get(key);
    if (raw === null || raw.trim() === '') return fallback;
    const v = Number(raw);
    return Number.isFinite(v) ? v : Number.NaN;
  };

  if (q.get('species') === null && q.size === 0) {
    return json(
      {
        usage: {
          method: 'GET',
          parameters: {
            species: `one of: ${SPECIES.map((s) => s.id).join(', ')}`,
            orientation: 'flatsawn | quartersawn (default flatsawn)',
            width_mm: 'board face width in millimetres (default 127)',
            rh_low: 'the dry extreme, percent RH (default 25)',
            rh_high: 'the damp extreme, percent RH (default 60)',
            temp_c: 'indoor temperature in °C (default 21)',
            run_m: 'width of the run across the boards, metres (optional)',
          },
          example: '/api/v1/movement?species=white-oak&width_mm=127&orientation=flatsawn&rh_low=25&rh_high=60',
          note: 'Solid wood only. Engineered flooring is deliberately not modelled: its cross-ply core is designed to defeat this calculation.',
        },
        species: SPECIES.map((s) => ({
          id: s.id,
          label: s.label,
          table_name: s.tableName,
          c_radial: s.cRadial,
          c_tangential: s.cTangential,
          commercial_group: s.commercialGroup,
        })),
        sources: { coefficients: SPECIES_SOURCE, moisture_model: EMC_SOURCE },
      },
      { request, updatedAt: reg.updated_at, version: reg.version },
    );
  }

  const species = speciesById(q.get('species') ?? 'white-oak');
  if (!species) {
    return error(
      'not_found',
      `Unknown species. Published species: ${SPECIES.map((s) => s.id).join(', ')}.`,
      404,
    );
  }

  const orientationRaw = (q.get('orientation') ?? 'flatsawn').toLowerCase();
  if (orientationRaw !== 'flatsawn' && orientationRaw !== 'quartersawn') {
    return error('invalid_request', "orientation must be 'flatsawn' or 'quartersawn'.", 400);
  }

  const widthMm = num('width_mm', 127);
  const rhLow = num('rh_low', 25);
  const rhHigh = num('rh_high', 60);
  const tempC = num('temp_c', 21);
  const runRaw = q.get('run_m');
  const runWidthM = runRaw === null || runRaw.trim() === '' ? undefined : Number(runRaw);

  const result = computeMovement({
    species,
    orientation: orientationRaw,
    boardWidthMm: widthMm,
    runWidthM: Number.isFinite(runWidthM ?? Number.NaN) ? runWidthM : undefined,
    tempC,
    rhLowPct: rhLow,
    rhHighPct: rhHigh,
  });

  if (!result) {
    return error(
      'invalid_request',
      'Could not compute. Check that width_mm is positive, rh_low is below rh_high, and both humidity values are between 0 and 100.',
      400,
    );
  }

  return json(
    {
      input: {
        species: species.id,
        species_label: species.label,
        orientation: orientationRaw,
        board_width_mm: widthMm,
        run_width_m: runWidthM ?? null,
        temp_c: tempC,
        rh_low_pct: rhLow,
        rh_high_pct: rhHigh,
      },
      coefficient_used: orientationRaw === 'quartersawn' ? species.cRadial : species.cTangential,
      moisture_content: {
        at_rh_low_pct: Number(result.emcLowPct.toFixed(2)),
        at_rh_high_pct: Number(result.emcHighPct.toFixed(2)),
        swing_points: Number(result.mcSwingPct.toFixed(2)),
      },
      movement: {
        per_board_mm: Number(result.boardMovementMm.toFixed(3)),
        per_board_pct_of_width: Number(result.boardMovementPctOfWidth.toFixed(3)),
        boards_across_run: result.boardsAcrossRun,
        across_run_mm: result.runMovementMm === null ? null : Number(result.runMovementMm.toFixed(2)),
        flatsawn_to_quartersawn_ratio: Number(result.orientationRatio.toFixed(3)),
      },
      validity: {
        within_coefficient_range: result.withinCoefficientRange,
        within_moisture_model_range: result.withinEmcRange,
        caveats: result.caveats,
      },
      is_quote: false,
      disclaimer:
        'Unrestrained dimensional change in solid wood. A fastened floor distributes this movement unevenly, so the run total is the amount the installation has to absorb rather than the gap that appears at any one seam. Not a quote and not a substitute for measuring the material.',
      sources: { coefficients: SPECIES_SOURCE, moisture_model: EMC_SOURCE },
    },
    { request, cache: CACHE_COMPUTED, version: reg.version },
  );
}

/**
 * GET /api/v1/media — the second front door.
 *
 * WHY MEDIA IS AN API AND NOT JUST A PAGE
 *
 * A photograph on a page is reachable by a person with a browser. The same
 * photograph in a JSON document with an absolute URL is reachable by the
 * mobile app, by a partner's site, by a syndication feed, and by an answer
 * engine deciding whether this business has ever actually done the work it
 * describes. The page and the API are the same facts through two doors, and
 * the second one costs one route file.
 *
 * ABSOLUTE URLs, ALWAYS. A consumer of this document is by definition not on
 * this origin, so a relative path is a broken link with extra steps.
 *
 * WHAT IT WILL NOT CARRY. No street address, because the record does not have
 * one and is not going to acquire one through the API. No square footage, no
 * moisture readings and no price, because those are not in the record either —
 * `limits` states that explicitly rather than leaving a consumer to infer it
 * from missing keys, since a missing key reads as an oversight and a stated
 * limit reads as a decision.
 */
export async function handleMediaIndex(request: Request) {
  const reg = await getRegistry();
  return json(
    {
      count: PROJECTS.length,
      note: 'Photographic records of completed work. Each carries stills and chapter films with absolute URLs. These are photographs, not engineering case studies — see /api/v1/evidence for the measured material.',
      projects: PROJECTS.map((p) => ({
        id: p.slug,
        title: p.title,
        location: p.location,
        stills: p.stills.filter((s) => s.role === 'interior').length,
        films: p.films.length,
        canonical_page: `${SITE_URL}/projects/${p.slug}`,
        self: `${SITE_URL}/api/v1/media/${p.slug}`,
      })),
    },
    { request, updatedAt: reg.updated_at, version: reg.version },
  );
}

export async function handleMediaProject(request: Request, id: string) {
  const project = getProject(id);
  if (!project) {
    return error('not_found', `No project with id "${id}". List them at ${SITE_URL}/api/v1/media.`, 404);
  }
  const reg = await getRegistry();
  const abs = (path: string) => `${SITE_URL}${path}`;

  return json(
    {
      id: project.slug,
      title: project.title,
      location: project.location,
      summary: project.summary,
      /* Said out loud rather than left as absent keys. */
      limits: project.limits,
      chapters: project.chapters.map((c) => ({
        id: `ch${c.id}`,
        label: c.label,
        note: c.note,
        stills: project.stills
          .filter((s) => s.chapter === c.id)
          .sort((a, b) => a.order - b.order)
          .map((s) => ({
            id: s.id,
            order: s.order,
            role: s.role,
            alt: s.alt,
            kind: s.kind,
            width: s.width,
            height: s.height,
            src: { webp_1920x1080: abs(s.src) },
          })),
        films: project.films
          .filter((f) => f.chapter === c.id)
          .map((f) => ({
            id: f.id,
            title: f.title,
            aspect: f.aspect,
            width: f.width,
            height: f.height,
            src: abs(f.src),
            poster: abs(stillById(project, f.posterStillId)?.src ?? ''),
          })),
      })),
      pairs: project.pairs.map((p) => ({
        id: p.id,
        anchor: p.anchor,
        before: abs(stillById(project, p.beforeStillId)?.src ?? ''),
        after: abs(stillById(project, p.afterStillId)?.src ?? ''),
        note: 'Not a locked-tripod pair. Shown side by side rather than wiped, because the camera moved between visits.',
      })),
      canonical_page: `${SITE_URL}/projects/${project.slug}`,
      licence: 'Photographs are © Ecowoods Hardwood Flooring Inc. Cite the canonical page.',
    },
    { request, cache: CACHE_PUBLIC, version: reg.version },
  );
}
