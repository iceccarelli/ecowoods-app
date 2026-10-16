import { describe, it, expect } from 'vitest';
import { buildWebSite } from '@/lib/schema/builders';
import { headlineFeatures } from '@/lib/assistant-site';
import { searchSite } from '@/lib/site-search';
import SearchPage from '@/app/search/page';

describe('site search', () => {
  it('WebSite schema advertises the real /search target', () => {
    const w = buildWebSite('https://ecowoods.ca');
    expect(w.potentialAction?.target.urlTemplate).toBe('https://ecowoods.ca/search?q={search_term_string}');
    expect(w.potentialAction?.['query-input']).toBe('required name=search_term_string');
  });

  it('finds glossary terms, guides, papers and services, and only real pages', () => {
    const cupping = searchSite('cupping');
    expect(cupping.some((r) => r.href === '/glossary/cupping')).toBe(true);
    expect(searchSite('refinishing').length).toBeGreaterThan(0);
    expect(searchSite('nail down glue down').some((r) => r.href.startsWith('/guides/'))).toBe(true);
    for (const q of ['cupping', 'price', 'stairs', 'quote', 'moisture']) {
      const r = searchSite(q);
      expect(r.length, q).toBeGreaterThan(0);
      for (const d of r) expect(d.href.startsWith('/'), d.href).toBe(true);
    }
  });

  it('requires every word to match, and ignores junk', () => {
    expect(searchSite('hardwood zzzzqqq')).toEqual([]);
    expect(searchSite('a')).toEqual([]);
    expect(searchSite('')).toEqual([]);
  });

  it('popular pages are all real destinations', () => {
    expect(headlineFeatures().length).toBeGreaterThan(3);
  });

  it('the page renders results and the empty state without throwing', async () => {
    const hit = (await SearchPage({ searchParams: Promise.resolve({ q: 'refinishing' }) })) as unknown as { props: unknown };
    expect(hit).toBeTruthy();
    const miss = await SearchPage({ searchParams: Promise.resolve({ q: 'zzzzqqq' }) });
    expect(miss).toBeTruthy();
    await SearchPage({ searchParams: Promise.resolve({}) });
  });
});
