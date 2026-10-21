/**
 * tests/geo-data-provenance.test.ts
 *
 * 1. The sourced geo dataset (content/geo/sourced-facts.json) is provenance-complete,
 *    and the validator rejects every kind of bad entry.
 * 2. No internal-strategy marker leaks into rendered /service-areas pages (body and
 *    JSON-LD), llms.txt, llms-full.txt or /api/knowledge.
 *
 * Title/description uniqueness and sitemap/canonical parity live in
 * area-pages-integrity.test.ts and are not repeated here.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  redirect: () => { throw new Error('NEXT_REDIRECT'); },
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated', update: async () => null }),
  signIn: async () => undefined,
  signOut: async () => undefined,
  SessionProvider: ({ children }: any) => children,
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}));
vi.mock('next/image', () => ({
  default: (p: any) => {
    const { src, alt, priority, fill, placeholder, blurDataURL, quality, ...rest } = p;
    return require('react').createElement('img', { src: typeof src === 'string' ? src : src?.src, alt, ...rest });
  },
}));

import { renderPage } from './helpers/render-jsonld';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { validateFacts } from '../../../scripts/geo-lib.mjs';

const dataset = JSON.parse(readFileSync(path.resolve(__dirname, '../content/geo/sourced-facts.json'), 'utf8'));

const good = {
  id: 'x', marketSlug: 'toronto', metric: 'population', value: 1, unit: 'persons', referencePeriod: '2021',
  source: { name: 'n', url: 'https://example.org/t' }, retrievedAt: '2026-01-01', tableId: '1', normalization: 'as published',
};

describe('sourced geo dataset provenance', () => {
  it('the committed dataset validates', () => {
    expect(validateFacts(dataset)).toEqual([]);
  });

  it('accepts a complete fact', () => {
    expect(validateFacts({ schema: 1, facts: [good] })).toEqual([]);
  });

  it.each([
    ['missing source url', { source: { name: 'n', url: '' } }],
    ['http source', { source: { name: 'n', url: 'http://x.org' } }],
    ['missing source name', { source: { name: '', url: 'https://x.org' } }],
    ['future retrieval date', { retrievedAt: '2999-01-01' }],
    ['bad date format', { retrievedAt: 'yesterday' }],
    ['unknown unit', { unit: 'dollars' }],
    ['percent above 100', { unit: 'percent', value: 101 }],
    ['negative value', { value: -1 }],
    ['non-numeric value', { value: '5' }],
    ['missing table id', { tableId: '' }],
    ['missing normalization', { normalization: '' }],
    ['missing reference period', { referencePeriod: '' }],
  ])('rejects %s', (_n, patch) => {
    expect(validateFacts({ schema: 1, facts: [{ ...good, ...(patch as object) }] }).length).toBeGreaterThan(0);
  });

  it('rejects duplicates', () => {
    expect(validateFacts({ schema: 1, facts: [good, { ...good }] }).length).toBeGreaterThan(0);
  });
});

describe('ingest CSV path', () => {
  it('turns one matching row into a valid fact, copying the published value', async () => {
    const { parseCsv, factFromRow } = await import('../../../scripts/geo-ingest.mjs');
    const [row] = parseCsv('REF_DATE,GEO,VALUE\n2021,"Test, Place",1234\n');
    expect(row).toEqual({ REF_DATE: '2021', GEO: 'Test, Place', VALUE: '1234' });
    const fact = factFromRow(
      { id: 't', marketSlug: 'toronto', metric: 'm', unit: 'persons', productId: '98100001', sourceName: 'S', normalization: 'as published' },
      row, '2026-01-01',
    );
    expect(fact.value).toBe(1234);
    expect(validateFacts({ schema: 1, facts: [fact] })).toEqual([]);
  });
});

const MARKERS = [
  /expansion priorit/i, /opportunity score/i, /\bunsourced\b/i, /MIN_CONFIDENCE/, /\bDOMINATE\b/, /HIGH_PRIORITY/,
  /sourced-facts/i, /market-inputs/i, /worthiness/i, /contentQueue/,
];

describe('no internal-strategy marker leaks to public surfaces', () => {
  const surfaces: Record<string, string> = {};
  beforeAll(async () => {
    for (const a of SERVICE_AREAS) {
      const r = await renderPage(`/service-areas/${a.slug}`);
      surfaces[`/service-areas/${a.slug}`] = r.html + JSON.stringify(r.metadata);
    }
    surfaces['/llms.txt'] = await (await (await import('@/app/llms.txt/route')).GET()).text();
    surfaces['/llms-full.txt'] = await (await (await import('@/app/llms-full.txt/route')).GET()).text();
    const { NextRequest } = await import('next/server');
    const k = await (await import('@/app/api/knowledge/route')).GET(new NextRequest('https://ecowoods.ca/api/knowledge'));
    surfaces['/api/knowledge'] = await k.text();
  }, 180_000);

  it('rendered surfaces carry none of the markers', () => {
    const hits: string[] = [];
    for (const [p, text] of Object.entries(surfaces)) {
      for (const m of MARKERS) if (m.test(text)) hits.push(`${p}: ${m}`);
    }
    expect(Object.keys(surfaces).length).toBeGreaterThan(100);
    expect(hits).toEqual([]);
  });
});
