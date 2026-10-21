/**
 * The public/internal boundary for market intelligence.
 *
 * The opportunity model (scores, weights, confidence gate, unsourced inputs
 * and where to obtain them), the expansion order and the content queue are
 * internal working material. They are served only from
 * /api/internal/market-intelligence behind CRON_SECRET. These tests fail if
 * any public surface starts carrying them again.
 *
 * The repository is public: this keeps the deployed endpoints from publishing
 * the material, it does not make the source code confidential.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENDPOINTS, buildManifest } from '@/lib/registry/manifest';
import { buildOpenApi } from '@/lib/registry/openapi';
import * as markets from '@/app/api/v1/markets/route';
import * as corridors from '@/app/api/v1/corridors/route';
import * as opportunity from '@/app/api/v1/opportunity/route';
import * as actions from '@/app/api/v1/actions/route';
import * as internal from '@/app/api/internal/market-intelligence/route';
import { GET as llms } from '@/app/llms.txt/route';
import { GET as llmsFull } from '@/app/llms-full.txt/route';
import { GET as aiTxt } from '@/app/ai.txt/route';

const ORIGIN = 'https://ecowoods.ca';

/** Strategy vocabulary that must never appear on a public surface. */
const MARKERS: RegExp[] = [
  /unsourced_inputs/i,
  /unsourced input/i,
  /obtainable/i,
  /partial_score/i,
  /weighting/i,
  /minimum_confidence/i,
  /content_queue/i,
  /expansion_order/i,
  /expansion_score/i,
  /why_no_page/i,
  /not yet sourced/i,
  /HIGH_PRIORITY|BUILD_AUTHORITY|DOMINATE/,
  /\bFUTURE\b/,
  /\/opportunity\b/,
];

const expectClean = (label: string, text: string) => {
  for (const re of MARKERS) {
    expect(re.test(text), `${label} contains internal-strategy marker ${re}`).toBe(false);
  }
};

const get = (mod: { GET: (r: Request) => Promise<Response> }, path: string, init?: RequestInit) =>
  mod.GET(new Request(`${ORIGIN}${path}`, init));

describe('public surfaces carry no internal market strategy', () => {
  it('/api/v1/markets (all filters)', async () => {
    for (const q of ['', '?corridor=qew-west', '?status=core-active']) {
      const res = await get(markets, `/api/v1/markets${q}`);
      expect(res.status).toBe(200);
      expectClean(`markets${q}`, await res.text());
    }
  });

  it('/api/v1/markets still carries the factual shape', async () => {
    const body = await (await get(markets, '/api/v1/markets')).json();
    expect(body.service_area.length).toBeGreaterThan(0);
    expect(body.markets.length).toBeGreaterThan(0);
    for (const m of body.markets) {
      expect(m.verified_at, m.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof m.operational_statement).toBe('string');
      expect(['corridor-target']).not.toContain(m.status);
    }
    expect(body).not.toHaveProperty('content_queue');
    expect(body).not.toHaveProperty('expansion_order');
  });

  it('/api/v1/corridors lists only confirmed members', async () => {
    const res = await get(corridors, '/api/v1/corridors');
    const body = await res.json();
    expectClean('corridors', JSON.stringify(body));
    for (const c of body.corridors) {
      for (const m of c.members) {
        expect(m.verified_at, m.slug).not.toBeNull();
        for (const d of m.districts) expect(d.verified_at, d.slug).not.toBeNull();
      }
    }
  });

  it('/api/v1/actions', async () => {
    expectClean('actions', await (await get(actions, '/api/v1/actions')).text());
  });

  it('/api/v1/opportunity is a 410 with no model in it', async () => {
    const res = await get(opportunity, '/api/v1/opportunity?market=toronto');
    expect(res.status).toBe(410);
    const text = await res.text();
    expect(text).toContain('/api/v1/markets');
    expect(text).not.toMatch(/score|classification|weights|confidence/i);
  });

  it('manifest, OpenAPI and ENDPOINTS do not list opportunity or the internal route', () => {
    expect(ENDPOINTS.map((e) => e.path)).not.toContain('/opportunity');
    const m = JSON.stringify(buildManifest());
    const o = JSON.stringify(buildOpenApi());
    for (const [label, text] of [['manifest', m], ['openapi', o]] as const) {
      expectClean(label, text);
      expect(text).not.toContain('market-intelligence');
      expect(text).not.toContain('/api/internal');
    }
  });

  it('llms.txt, llms-full.txt and ai.txt', async () => {
    for (const [label, fn] of [['llms.txt', llms], ['llms-full.txt', llmsFull], ['ai.txt', aiTxt]] as const) {
      const text = await (await fn()).text();
      expectClean(label, text);
      expect(text).not.toContain('market-intelligence');
    }
  });
});

describe('/api/internal/market-intelligence', () => {
  const prev = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-for-market-intelligence';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it('rejects anonymous and wrong-secret callers with 401 and no model', async () => {
    for (const init of [undefined, { headers: { authorization: 'Bearer nope' } }, { headers: { authorization: 'test-secret-for-market-intelligence' } }]) {
      const res = await get(internal, '/api/internal/market-intelligence', init);
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
      const text = await res.text();
      expect(text).not.toMatch(/score|weights|unsourced/i);
    }
  });

  it('rejects everyone when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;
    const res = await get(internal, '/api/internal/market-intelligence', { headers: { authorization: 'Bearer undefined' } });
    expect(res.status).toBe(401);
  });

  it('returns the model to an authorised caller, no-store and noindex', async () => {
    const res = await get(internal, '/api/internal/market-intelligence', {
      headers: { authorization: 'Bearer test-secret-for-market-intelligence' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    const body = await res.json();
    expect(body.model.weights.length).toBeGreaterThan(0);
    expect(Array.isArray(body.model.unsourced_inputs)).toBe(true);
    expect(body.markets.length).toBeGreaterThan(0);
    expect(body.markets[0]).toHaveProperty('partial_score');
    expect(body).toHaveProperty('content_queue');
    expect(body).toHaveProperty('expansion_order');
  });
});
