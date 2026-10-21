/**
 * tests/api-registry-agreement.test.ts
 *
 * /api/v1/* and /api/knowledge against the registries they are derived from,
 * and against the sitemap — the same set seen from the machine side.
 *
 * tests/api-contract.test.ts already walks ENDPOINTS for status, headers, ETag
 * revalidation, OPTIONS and the OpenAPI document. This adds what it does not:
 *
 *   - every collection's ids and counts equal the registry (SERVICES,
 *     SERVICE_AREAS, ALL_PRICE_BANDS, REVIEW_EVIDENCE, CORRIDORS, …);
 *   - every canonical_url / url an endpoint hands out is a sitemap URL (no API
 *     row points at a page that 404s or is not indexable);
 *   - /api/knowledge's meta.counts equal the lengths of the collections it
 *     serves and the sitemap's family counts;
 *   - the ETag is a pure function of the body (stable across calls);
 *   - EVERY [id] route answers an unknown or hostile id with a 404 JSON
 *     envelope that still carries CORS — never a 200, never a 500;
 *   - a public payload never admits to an internal content gap.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { SITE_URL, SERVICES, SERVICE_AREAS, FAQ_ITEMS } from '@/lib/seo-data';
import { ALL_PRICE_BANDS } from '@/content/constants/pricing';
import { REVIEW_EVIDENCE } from '@ecowoods/shared/constants';
import { getRegistry } from '@/lib/registry/registry';
import { ENDPOINTS } from '@/lib/registry/manifest';
import { CITATION_TOPICS } from '@/lib/registry/citations';
import { CORRIDORS } from '@/lib/geo';
import { getGuides } from '@/lib/guides';
import { getPapers } from '@/lib/papers';
import { getTerms } from '@/lib/glossary';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));

import * as servicesRoute from '@/app/api/v1/services/route';
import * as serviceById from '@/app/api/v1/services/[id]/route';
import * as locationsRoute from '@/app/api/v1/locations/route';
import * as locationById from '@/app/api/v1/locations/[id]/route';
import * as pricingRoute from '@/app/api/v1/pricing/route';
import * as priceById from '@/app/api/v1/pricing/[id]/route';
import * as reviewsRoute from '@/app/api/v1/reviews/route';
import * as evidenceRoute from '@/app/api/v1/evidence/route';
import * as evidenceById from '@/app/api/v1/evidence/[id]/route';
import * as pagesRoute from '@/app/api/v1/pages/route';
import * as faqRoute from '@/app/api/v1/faq/route';
import * as corridorsRoute from '@/app/api/v1/corridors/route';
import * as citationByTopic from '@/app/api/v1/citations/[topic]/route';
import * as mediaById from '@/app/api/v1/media/[id]/route';
import * as equipmentById from '@/app/api/v1/equipment/[id]/route';
import * as knowledge from '@/app/api/knowledge/route';

const API = `${SITE_URL}/api/v1`;
let n = 0;
const ip = () => `10.7.${Math.floor(++n / 250)}.${n % 250}`;
const get = (mod: any, path: string, params: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  mod.GET(new Request(`${API}${path}`, { headers: { 'x-forwarded-for': ip(), ...headers } }), { params: Promise.resolve(params) }) as Promise<Response>;

let sitemapPaths = new Set<string>();
const pathOf = (u: string) => new URL(u).pathname.replace(/\/+$/, '') || '/';
const inSitemap = (u: string) => sitemapPaths.has(pathOf(u));

beforeAll(async () => {
  const sitemap = (await import('@/app/sitemap')).default;
  sitemapPaths = new Set((await sitemap()).map((e) => new URL(e.url).pathname.replace(/\/+$/, '') || '/'));
});

describe('/api/v1 collections equal the registries', () => {
  it('/services: exactly the SERVICES registry, each on its own sitemap page', async () => {
    const body = await (await get(servicesRoute, '/services')).json();
    expect(body.items.map((i: any) => i.data.slug).sort()).toEqual(SERVICES.map((s) => s.slug).sort());
    expect(body.meta.count).toBe(SERVICES.length);
    for (const i of body.items) expect(inSitemap(i.canonical_url), i.canonical_url).toBe(true);
  });

  it('/locations: the published locations are exactly SERVICE_AREAS; every one is a sitemap page; none outside it claims a page', async () => {
    const body = await (await get(locationsRoute, '/locations')).json();
    const published = body.items.filter((i: any) => i.data.coverage === 'published');
    expect(published.map((i: any) => i.data.slug).sort()).toEqual(SERVICE_AREAS.map((a) => a.slug).sort());
    for (const i of published) expect(sitemapPaths.has(`/service-areas/${i.data.slug}`), i.id).toBe(true);
    // a location that is not published must not point at an area page of its own
    for (const i of body.items.filter((x: any) => x.data.coverage !== 'published')) {
      // the hierarchy nodes (Canada, Ontario, GTA…) may point at the area HUB, never at an area page of their own
      expect(i.data.page_id === null || i.data.page_id === 'page:service-areas', `${i.id} is ${i.data.coverage} but names page ${i.data.page_id}`).toBe(true);
      expect(sitemapPaths.has(`/service-areas/${i.data.slug}`), `${i.id} is ${i.data.coverage} yet has a sitemap page`).toBe(false);
    }
    // ids are unique
    expect(new Set(body.items.map((i: any) => i.id)).size).toBe(body.items.length);
  });

  it('/pricing: one row per published band with the registry min, max and currency', async () => {
    const body = await (await get(pricingRoute, '/pricing')).json();
    expect(body.items).toHaveLength(ALL_PRICE_BANDS.length);
    const rows = body.items.map((i: any) => `${i.data.currency ?? i.data.band?.currency}:${i.data.min ?? i.data.band?.min}-${i.data.max ?? i.data.band?.max}`).sort();
    expect(rows).toEqual(ALL_PRICE_BANDS.map((b) => `${b.currency}:${b.min}-${b.max}`).sort());
  });

  it('/reviews: exactly REVIEW_EVIDENCE — platform, rating, out_of and count — and nothing invented', async () => {
    const body = await (await get(reviewsRoute, '/reviews')).json();
    expect(body.items).toHaveLength(REVIEW_EVIDENCE.length);
    for (const r of REVIEW_EVIDENCE) {
      const row = body.items.find((i: any) => i.data.platform === r.platform);
      expect(row, r.platform).toBeDefined();
      expect(row.data.rating).toBe(r.rating);
      expect(row.data.out_of).toBe(r.outOf);
      expect(row.data.count).toBe(r.count);
      expect(row.data.read_on).toBe(r.asOf);
    }
  });

  it('/faq: one row per FAQ_ITEMS question is present (the registry may add, never lose)', async () => {
    const body = await (await get(faqRoute, '/faq')).json();
    const text = JSON.stringify(body.items);
    for (const f of FAQ_ITEMS) expect(text.includes(JSON.stringify(f.q).slice(1, -1)), f.q).toBe(true);
  });

  it('/corridors: exactly the CORRIDORS registry', async () => {
    const body = await (await get(corridorsRoute, '/corridors')).json();
    expect(body.meta.count).toBe(CORRIDORS.length);
    expect(body.corridors.map((c: any) => c.id).sort()).toEqual(CORRIDORS.map((c) => c.id).sort());
  });

  it('/pages: every row is a sitemap page, ids are unique, and every area page is listed exactly once', async () => {
    const body = await (await get(pagesRoute, '/pages')).json();
    expect(new Set(body.items.map((i: any) => i.id)).size).toBe(body.items.length);
    // kind 'machine' rows are the machine files themselves (llms.txt, /api/v1), which are not sitemap pages
    const dead = body.items.filter((i: any) => i.data.kind !== 'machine' && !inSitemap(i.canonical_url)).map((i: any) => i.canonical_url);
    expect(dead).toEqual([]);
    const areas = body.items.filter((i: any) => i.data.kind === 'area').map((i: any) => i.data.path).sort();
    expect(areas).toEqual(SERVICE_AREAS.map((a) => `/service-areas/${a.slug}`).sort());
    const services = body.items.filter((i: any) => i.data.kind === 'service').map((i: any) => i.data.path).sort();
    expect(services).toEqual(SERVICES.map((s) => `/services/${s.slug}`).sort());
  });

  it('every evidence canonical_url that is on this origin is a sitemap page or a static file', async () => {
    const body = await (await get(evidenceRoute, '/evidence')).json();
    const bad = body.items.filter((i: any) => i.canonical_url.startsWith(SITE_URL) && !inSitemap(i.canonical_url) && !/\.[a-z0-9]{2,5}$/i.test(i.canonical_url)).map((i: any) => `${i.id} ${i.canonical_url}`);
    expect(bad).toEqual([]);
  });

  it('the registry the routes read agrees with the routes (services, locations, prices counted once)', async () => {
    const reg = await getRegistry();
    expect(reg.services.length).toBe(SERVICES.length);
    expect(reg.prices.length).toBe(ALL_PRICE_BANDS.length);
    expect(reg.locations.filter((l) => l.data.coverage === 'published').length).toBe(SERVICE_AREAS.length);
  });
});

describe('/api/knowledge equals the registries and the sitemap', () => {
  let all: any;
  beforeAll(async () => {
    all = await (await knowledge.GET(new NextRequest(`${SITE_URL}/api/knowledge`))).json();
  });

  it('meta.counts equal the lengths of the collections actually served', () => {
    const c = all.meta.counts;
    expect(c.papers).toBe(all.papers.length);
    expect(c.catalogues).toBe(all.catalogues.length);
    expect(c.guides).toBe(all.guides.length);
    expect(c.glossaryTerms).toBe(all.glossary.length);
    expect(c.figures).toBe(all.figures.length);
    expect(c.changelogEntries).toBe(all.changelog.length);
    expect(c.externalStandards).toBe(all.standards.length);
    expect(c.services).toBe(all.services.length);
    expect(c.locations).toBe(all.locations.length);
    expect(c.priceBands).toBe(all.pricing.length);
    expect(c.commercialPages).toBe(all.commercialPages.length);
    expect(c.caseStudies).toBe(all.caseStudies.length);
    expect(c.frameworkCriteria).toBe(all.framework.criterionCount);
    // every collection the meta advertises exists, and no collection is unadvertised
    expect([...all.meta.collections].sort()).toEqual(Object.keys(all).filter((k) => k !== 'meta').sort());
  });

  it('services, locations and prices are the registries; papers/guides/glossary are the sitemap families', () => {
    expect(all.services.map((s: any) => s.slug).sort()).toEqual(SERVICES.map((s) => s.slug).sort());
    expect(all.locations.map((l: any) => l.slug).sort()).toEqual(SERVICE_AREAS.map((a) => a.slug).sort());
    expect(all.pricing).toHaveLength(ALL_PRICE_BANDS.length);
    const family = (prefix: string) => [...sitemapPaths].filter((p) => p.startsWith(prefix) && p.length > prefix.length).map((p) => p.slice(prefix.length)).sort();
    expect(all.papers.map((p: any) => p.slug).sort()).toEqual(family('/papers/'));
    expect(all.guides.map((g: any) => g.slug).sort()).toEqual(family('/guides/'));
    expect(all.glossary.map((g: any) => g.slug).sort()).toEqual(family('/glossary/'));
    expect(all.papers.map((p: any) => p.slug).sort()).toEqual(getPapers().map((p) => p.slug).sort());
    expect(all.guides.map((g: any) => g.slug).sort()).toEqual(getGuides().map((g) => g.slug).sort());
    expect(all.glossary.map((g: any) => g.slug).sort()).toEqual(getTerms().map((t) => t.slug).sort());
  });

  it('every on-origin url served for a page-shaped collection is a sitemap page', () => {
    const bad: string[] = [];
    for (const key of ['papers', 'guides', 'glossary', 'services', 'locations', 'caseStudies'] as const) {
      for (const item of all[key]) {
        if (typeof item.url === 'string' && item.url.startsWith(SITE_URL) && !inSitemap(item.url)) bad.push(`${key}: ${item.url}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('commercialPages never admits to a content gap in a public payload', () => {
    expect(JSON.stringify(all.commercialPages)).not.toMatch(/"coverage":"gap"|No page on this site was written/);
  });
});

describe('cache contract: stable ETag, honest 304s, CORS on every outcome', () => {
  const COLLECTIONS: [string, any, string][] = [
    ['services', servicesRoute, '/services'],
    ['locations', locationsRoute, '/locations'],
    ['pricing', pricingRoute, '/pricing'],
    ['reviews', reviewsRoute, '/reviews'],
    ['pages', pagesRoute, '/pages'],
    ['corridors', corridorsRoute, '/corridors'],
  ];
  for (const [name, mod, path] of COLLECTIONS) {
    it(`/${name}: the ETag is the same on two calls and a 304 repeats it with CORS`, async () => {
      const a = await get(mod, path);
      const b = await get(mod, path);
      expect(a.headers.get('etag')).toBeTruthy();
      expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
      expect(await a.text()).toBe(await b.text());
      const c = await get(mod, path, {}, { 'if-none-match': a.headers.get('etag')! });
      expect(c.status).toBe(304);
      expect(c.headers.get('etag')).toBe(a.headers.get('etag'));
      expect(c.headers.get('access-control-allow-origin')).toBe('*');
      expect(c.headers.get('cache-control') ?? '').toContain('public');
    });
  }

  it('/api/knowledge: same ETag on two calls; 304 on a match; a changed collection changes the ETag', async () => {
    const r = (qs: string, h: Record<string, string> = {}) => knowledge.GET(new NextRequest(`${SITE_URL}/api/knowledge${qs}`, { headers: h }));
    const a = await r('?collection=pricing');
    const b = await r('?collection=pricing');
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
    const other = await r('?collection=services');
    expect(other.headers.get('etag')).not.toBe(a.headers.get('etag'));
    const c = await r('?collection=pricing', { 'if-none-match': a.headers.get('etag')! });
    expect(c.status).toBe(304);
    expect(c.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('unknown or hostile ids are a 404 JSON envelope, never a 200 or a 500', () => {
  const HOSTILE = ['does-not-exist', '../../etc/passwd', '%00', 'constructor', '__proto__', 'toString', 'x'.repeat(500), 'SERVICE:FLOOR-REFINISHING-NOPE'];
  const ROUTES: [string, any, string][] = [
    ['services/[id]', serviceById, 'id'],
    ['locations/[id]', locationById, 'id'],
    ['pricing/[id]', priceById, 'id'],
    ['evidence/[id]', evidenceById, 'id'],
    ['citations/[topic]', citationByTopic, 'topic'],
    ['media/[id]', mediaById, 'id'],
    ['equipment/[id]', equipmentById, 'id'],
  ];
  for (const [name, mod, param] of ROUTES) {
    it(`${name}: every hostile id → 404 {error:{code:not_found}} with CORS`, async () => {
      for (const id of HOSTILE) {
        const res = await get(mod, `/${name.split('/')[0]}/${encodeURIComponent(id)}`, { [param]: id });
        expect(res.status, `${name} ${id.slice(0, 30)}`).toBe(404);
        expect(res.headers.get('content-type')).toMatch(/^application\/json/);
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
        const body = await res.json();
        expect(body.error?.code, `${name} ${id.slice(0, 30)}`).toBe('not_found');
      }
    });
  }

  it('every ENDPOINTS {id}/{topic} path is covered by the table above', () => {
    const dynamic = ENDPOINTS.filter((e) => /\{(id|topic)\}/.test(e.path)).map((e) => e.file).sort();
    expect(dynamic).toEqual(ROUTES.map(([n]) => n).sort());
  });

  it('a real id round-trips: each registry service resolves 200, with the same ETag as the list row would imply', async () => {
    for (const s of SERVICES) {
      const res = await get(serviceById, `/services/service:${s.slug}`, { id: `service:${s.slug}` });
      expect(res.status, s.slug).toBe(200);
    }
    for (const t of CITATION_TOPICS) {
      const res = await get(citationByTopic, `/citations/${t}`, { topic: t });
      expect(res.status, t).toBe(200);
    }
  });
});
