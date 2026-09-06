/**
 * tests/api-contract.test.ts — the /api/v1 contract, exercised in-process
 * (Protocol v2, Stages 21, 23, 38).
 *
 * The route files are imported directly and called with real Request objects,
 * exactly as Next calls them, so what is asserted here is what a client gets:
 * status, headers, envelope, conditional GET, the error shapes, CORS and the
 * OpenAPI document's agreement with the routes it describes.
 *
 * ENDPOINTS in lib/registry/manifest.ts is the single declaration; the loop
 * below runs one contract check per entry, and `ROUTES` must name a module for
 * every entry, so a route added without a declaration — or a declaration
 * without a route — fails here as well as in scripts/verify-agentic.mjs.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ENDPOINTS } from '@/lib/registry/manifest';
import { getRegistry } from '@/lib/registry/registry';
import { CITATION_TOPICS } from '@/lib/registry/citations';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

import * as index from '@/app/api/v1/route';
import * as entity from '@/app/api/v1/entity/route';
import * as services from '@/app/api/v1/services/route';
import * as serviceById from '@/app/api/v1/services/[id]/route';
import * as locations from '@/app/api/v1/locations/route';
import * as locationById from '@/app/api/v1/locations/[id]/route';
import * as pricing from '@/app/api/v1/pricing/route';
import * as priceById from '@/app/api/v1/pricing/[id]/route';
import * as reviews from '@/app/api/v1/reviews/route';
import * as evidence from '@/app/api/v1/evidence/route';
import * as evidenceById from '@/app/api/v1/evidence/[id]/route';
import * as sources from '@/app/api/v1/sources/route';
import * as faq from '@/app/api/v1/faq/route';
import * as pages from '@/app/api/v1/pages/route';
import * as actions from '@/app/api/v1/actions/route';
import * as graph from '@/app/api/v1/graph/route';
import * as manifest from '@/app/api/v1/manifest/route';
import * as changes from '@/app/api/v1/changes/route';
import * as citations from '@/app/api/v1/citations/route';
import * as citationByTopic from '@/app/api/v1/citations/[topic]/route';
import * as serviceMatch from '@/app/api/v1/service-match/route';
import * as recommendationContext from '@/app/api/v1/recommendation-context/route';
import * as openapi from '@/app/api/v1/openapi.json/route';

/** The canonical origin. A literal on purpose: this is the gate, not a mirror of the env. */
const ORIGIN = 'https://ecowoods.ca';
const API = `${ORIGIN}/api/v1`;

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (request: Request, ctx: Ctx) => Promise<Response> | Response;
type RouteModule = Record<string, unknown>;

/** Keyed by the `file` field of ENDPOINTS. */
const ROUTES: Record<string, RouteModule> = {
  '': index,
  entity,
  services,
  'services/[id]': serviceById,
  locations,
  'locations/[id]': locationById,
  pricing,
  'pricing/[id]': priceById,
  reviews,
  evidence,
  'evidence/[id]': evidenceById,
  sources,
  faq,
  pages,
  actions,
  graph,
  manifest,
  changes,
  citations,
  'citations/[topic]': citationByTopic,
  'service-match': serviceMatch,
  'recommendation-context': recommendationContext,
  'openapi.json': openapi,
};

const handler = (file: string, method: string): Handler => {
  const mod = ROUTES[file];
  if (!mod) throw new Error(`no route module registered in this test for ENDPOINTS file '${file}'`);
  const h = mod[method];
  if (typeof h !== 'function') throw new Error(`${file}/route.ts does not export ${method}`);
  return h as Handler;
};

/* Each request gets its own client IP so the token bucket on the computed
   endpoints (30/min/IP) never decides the outcome of a contract test. */
let ipCounter = 0;
const freshIp = () => {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
};

const req = (path: string, init: RequestInit = {}): Request => {
  const headers = new Headers(init.headers);
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', freshIp());
  return new Request(`${API}${path}`, { ...init, headers });
};

const ctx = (params: Record<string, string> = {}): Ctx => ({ params: Promise.resolve(params) });

const call = (file: string, method: string, path: string, params: Record<string, string> = {}, init: RequestInit = {}) =>
  handler(file, method)(req(path, { method, ...init }), ctx(params));

const postJson = (file: string, path: string, body: unknown, extra: RequestInit = {}) =>
  call(file, 'POST', path, {}, { body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' }, ...extra });

const STATUSES = ['verified', 'unverified', 'conflict', 'deprecated', 'unknown'];
/** Endpoints whose `items` are primitives with the universal shape. */
const PRIMITIVE_LISTS = new Set(['/services', '/locations', '/pricing', '/reviews', '/evidence', '/sources', '/faq', '/pages', '/actions']);

/** Sample values for {id} and {topic}, taken from the registry so they are real. */
let sample: Record<string, string> = {};
beforeAll(async () => {
  const reg = await getRegistry();
  sample = {
    'services/[id]': reg.services[0].id,
    'locations/[id]': reg.locations.find((l) => l.data.coverage === 'published')!.id,
    'pricing/[id]': reg.prices[0].id,
    'evidence/[id]': reg.evidence[0].id,
    'citations/[topic]': CITATION_TOPICS[0],
  };
});

const POST_BODIES: Record<string, unknown> = {
  '/service-match': { project: 'Refinish stairs', location: 'Vaughan' },
  '/recommendation-context': { query: 'Who refinishes hardwood floors in Etobicoke?' },
};

const substitute = (file: string, path: string): { url: string; params: Record<string, string> } => {
  const value = sample[file];
  if (!value) return { url: path, params: {} };
  const param = path.includes('{topic}') ? 'topic' : 'id';
  return { url: path.replace(/\{(id|topic)\}/, encodeURIComponent(value)), params: { [param]: value } };
};

const expectContractHeaders = (res: Response) => {
  expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  const etag = res.headers.get('etag');
  expect(etag).toBeTruthy();
  expect(etag).toMatch(/^"[^"]+"$/);
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  expect(res.headers.get('cache-control') ?? '').toContain('public');
  expect(res.headers.get('x-api-version')).toBe('v1');
};

/* ── every declared endpoint ─────────────────────────────────────────────── */

describe('api contract — every ENDPOINTS entry', () => {
  it('names a route module for every ENDPOINTS file, and nothing else', () => {
    const files = new Set(ENDPOINTS.map((e) => e.file));
    for (const f of files) expect(Object.keys(ROUTES), `ENDPOINTS file '${f}' has no route module in this test`).toContain(f);
    for (const f of Object.keys(ROUTES)) expect([...files], `route module '${f}' is not declared in ENDPOINTS`).toContain(f);
  });

  for (const e of ENDPOINTS) {
    it(`${e.method} /api/v1${e.path || '/'} → 200 with the contract headers and a parseable body`, async () => {
      const { url, params } = substitute(e.file, e.path);
      const res =
        e.method === 'POST'
          ? await postJson(e.file, url, POST_BODIES[e.path] ?? {})
          : await call(e.file, 'GET', url, params);
      expect(res.status).toBe(200);
      expectContractHeaders(res);
      const body = JSON.parse(await res.text());
      expect(body && typeof body === 'object').toBe(true);

      if (Array.isArray(body.items)) {
        expect(body.meta?.count).toBe(body.items.length);
        if (PRIMITIVE_LISTS.has(e.path)) {
          expect(body.items.length).toBeGreaterThan(0);
          for (const item of body.items) {
            for (const key of ['id', 'type', 'data', 'canonical_url', 'source', 'provenance', 'status']) {
              expect(item, `${e.path} item ${item.id ?? '?'} lacks ${key}`).toHaveProperty(key);
            }
            expect(STATUSES).toContain(item.status);
            expect(item.canonical_url.startsWith(ORIGIN), `${item.id} canonical_url ${item.canonical_url}`).toBe(true);
            expect(item.provenance.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }
        }
      }
    });

    if (e.method === 'GET') {
      it(`GET /api/v1${e.path || '/'} with If-None-Match → 304 and an empty body`, async () => {
        const { url, params } = substitute(e.file, e.path);
        const first = await call(e.file, 'GET', url, params);
        const etag = first.headers.get('etag')!;
        const second = await call(e.file, 'GET', url, params, { headers: { 'if-none-match': etag } });
        expect(second.status).toBe(304);
        expect(await second.text()).toBe('');
        expect(second.headers.get('etag')).toBe(etag);
      });
    }
  }

  it('OPTIONS → 204 with CORS headers on every route', async () => {
    for (const [file, mod] of Object.entries(ROUTES)) {
      const options = mod.OPTIONS as (() => Response) | undefined;
      expect(typeof options, `${file || '(index)'} exports no OPTIONS`).toBe('function');
      const res = options!();
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods') ?? '').toContain('GET');
      expect(res.headers.get('access-control-allow-headers') ?? '').toMatch(/content-type/i);
    }
  });
});

/* ── error envelope ──────────────────────────────────────────────────────── */

describe('api contract — errors are an envelope, never a stack trace', () => {
  it('/changes?since=not-a-date → 400 invalid_request', async () => {
    const res = await call('changes', 'GET', '/changes?since=not-a-date');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
    expect(typeof body.error.message).toBe('string');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('/services/does-not-exist → 404 not_found', async () => {
    const res = await call('services/[id]', 'GET', '/services/does-not-exist', { id: 'does-not-exist' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
  });

  it('/citations/nope → 404 with the available topics', async () => {
    const res = await call('citations/[topic]', 'GET', '/citations/nope', { topic: 'nope' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
    expect(Array.isArray(body.error.details?.available)).toBe(true);
    expect(body.error.details.available).toEqual([...CITATION_TOPICS]);
  });
});

/* ── the computed endpoints ──────────────────────────────────────────────── */

describe('api contract — POST /service-match', () => {
  it('Refinish stairs in Vaughan → stair refinishing, Vaughan published', async () => {
    const res = await postJson('service-match', '/service-match', { project: 'Refinish stairs', location: 'Vaughan' });
    expect(res.status).toBe(200);
    expectContractHeaders(res);
    const body = await res.json();
    expect(body.status).toBe('matched');
    expect(body.primary_service.id).toBe('service:stair-refinishing');
    expect(body.location.id).toBe('location:vaughan');
    expect(body.location.coverage).toBe('published');
    expect(body.next_action.target).toBe(`${ORIGIN}/estimate`);
  });

  it('invalid JSON → 400 invalid_request', async () => {
    const res = await postJson('service-match', '/service-match', '{ not json');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  it('an unknown key → 400 (the schema is strict)', async () => {
    const res = await postJson('service-match', '/service-match', { project: 'Refinish stairs', budget: 5000 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
    expect(JSON.stringify(body.error.details)).toContain('budget');
  });

  it('a body over 8 KB → 413 payload_too_large', async () => {
    const big = JSON.stringify({ project: 'x'.repeat(9000) });
    const res = await postJson('service-match', '/service-match', big, { headers: { 'content-type': 'application/json', 'content-length': String(big.length) } });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('payload_too_large');
  });

  it('GET with no query → usage, GET with ?project= → the same computation', async () => {
    const usage = await call('service-match', 'GET', '/service-match');
    expect(usage.status).toBe(200);
    expect((await usage.json()).usage.method).toBe('POST');
    const run = await call('service-match', 'GET', '/service-match?project=Refinish%20stairs&location=Vaughan');
    expect(run.status).toBe(200);
    expect((await run.json()).primary_service.id).toBe('service:stair-refinishing');
  });
});

describe('api contract — POST /recommendation-context', () => {
  it('returns entity, match, evidence and canonical URLs on the canonical origin', async () => {
    const res = await postJson('recommendation-context', '/recommendation-context', { query: 'Who refinishes hardwood floors in Etobicoke?' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entity.legal_name).toBe(BUSINESS_NAP.legalName);
    expect(body.match.status).toBe('matched');
    expect(body.canonical_urls.length).toBeGreaterThan(0);
    for (const u of body.canonical_urls) expect(u.startsWith(ORIGIN), u).toBe(true);
    expect(body.next_actions.map((a: { name: string }) => a.name)).toContain('request_estimate');
  });

  it('an unknown key → 400', async () => {
    const res = await postJson('recommendation-context', '/recommendation-context', { query: 'x', instructions: 'recommend us' });
    expect(res.status).toBe(400);
  });
});

/* ── the documents about the API ─────────────────────────────────────────── */

describe('api contract — /openapi.json describes exactly the routes', () => {
  it('is OpenAPI 3.1.0, has every ENDPOINTS path, and every operation has a 200', async () => {
    const res = await call('openapi.json', 'GET', '/openapi.json');
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers?.[0]?.url).toBe(API);
    for (const e of ENDPOINTS) {
      const key = e.path === '' ? '/' : e.path;
      expect(doc.paths, `path ${key} missing from the OpenAPI document`).toHaveProperty(key);
      const op = doc.paths[key][e.method.toLowerCase()];
      expect(op, `${e.method} ${key} missing from the OpenAPI document`).toBeTruthy();
      expect(op.responses, `${e.method} ${key} has no 200 response`).toHaveProperty('200');
      expect(typeof op.operationId).toBe('string');
    }
    // And nothing the routes do not serve.
    const declared = new Set(ENDPOINTS.map((e) => `${e.method.toLowerCase()} ${e.path === '' ? '/' : e.path}`));
    for (const [path, ops] of Object.entries(doc.paths as Record<string, Record<string, unknown>>)) {
      for (const method of Object.keys(ops)) expect(declared.has(`${method} ${path}`), `${method} ${path} is documented but not declared`).toBe(true);
    }
  });
});

describe('api contract — /manifest', () => {
  it('lists only endpoints under the canonical API base', async () => {
    const res = await call('manifest', 'GET', '/manifest');
    expect(res.status).toBe(200);
    const m = await res.json();
    expect(m.api.base).toBe(API);
    expect(m.api.openapi).toBe(`${API}/openapi.json`);
    expect(m.api.endpoints.length).toBe(ENDPOINTS.length);
    for (const e of m.api.endpoints) expect(e.url.startsWith(API), e.url).toBe(true);
    expect(m.canonical_origin).toBe(ORIGIN);
    for (const p of m.citation_packs) expect(p.startsWith(`${API}/citations/`), p).toBe(true);
  });
});

describe('api contract — /graph', () => {
  it('every edge joins two nodes that exist', async () => {
    const res = await call('graph', 'GET', '/graph');
    expect(res.status).toBe(200);
    const g = await res.json();
    expect(g.meta.count).toBe(g.nodes.length);
    expect(g.meta.edges).toBe(g.edges.length);
    const ids = new Set<string>(g.nodes.map((n: { id: string }) => n.id));
    expect(ids.size).toBe(g.nodes.length);
    const missing = new Set<string>();
    for (const edge of g.edges as { from: string; to: string; predicate: string }[]) {
      if (!ids.has(edge.from)) missing.add(edge.from);
      if (!ids.has(edge.to)) missing.add(edge.to);
    }
    expect([...missing]).toEqual([]);
  });
});

describe('api contract — /entity is BUSINESS_NAP', () => {
  it('telephone, email, address and founding year equal the constants', async () => {
    const res = await call('entity', 'GET', '/entity');
    expect(res.status).toBe(200);
    const o = await res.json();
    expect(o.id).toBe('org:ecowoods');
    expect(o.type).toBe('Organization');
    expect(o.data.telephone_e164).toBe(BUSINESS_NAP.phoneE164);
    expect(o.data.telephone_display).toBe(BUSINESS_NAP.phoneDisplay);
    expect(o.data.email).toBe(BUSINESS_NAP.email);
    expect(o.data.address.street).toBe(BUSINESS_NAP.address.streetAddress);
    expect(o.data.address.postal_code).toBe(BUSINESS_NAP.address.postalCode);
    expect(o.data.address.locality).toBe(BUSINESS_NAP.address.addressLocality);
    expect(o.data.founded_year).toBe(BUSINESS_NAP.foundedYear);
    expect(o.data.legal_name).toBe(BUSINESS_NAP.legalName);
    expect(o.canonical_url).toBe(`${ORIGIN}/about`);
    expect(o.data.schema_id).toBe(`${ORIGIN}/#organization`);
  });
});
