import { describe, it, expect, vi } from 'vitest';
import { clampDescription, clampTitle } from '@/lib/meta-clamp';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));

describe('clamp helpers', () => {
  it('leave short values alone', () => {
    expect(clampDescription('Short.')).toBe('Short.');
    expect(clampTitle('Hardwood Flooring Toronto')).toBe('Hardwood Flooring Toronto');
  });
  it('cut descriptions at a sentence when one fits', () => {
    const long = 'First sentence about hardwood flooring in Toronto and the GTA, stated plainly. ' + 'Second sentence that runs on and on and on and on and on and on and on and on and on and on.';
    const out = clampDescription(long);
    expect(out).toBe('First sentence about hardwood flooring in Toronto and the GTA, stated plainly.');
  });
  it('cut at a word with an ellipsis when no sentence fits', () => {
    const out = clampDescription('word '.repeat(80));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });
  it('drop trailing title clauses at a separator', () => {
    expect(clampTitle('Rosedale Estate Grand Staircase + Radiant Heat Main Floor: Maple/Oak Installation with Thermal Management')).toBe('Rosedale Estate Grand Staircase + Radiant Heat Main Floor');
  });
  it('never add words', () => {
    const t = 'Water-Based vs Oil-Based Polyurethane — Chemistry, Performance, VOC, and When to Choose Which';
    const out = clampTitle(t).replace(/…$/, '');
    expect(t.startsWith(out)).toBe(true);
  });
});

describe('templated pages stay inside search-result limits', () => {
  it('every guide, case study and article', async () => {
    const [{ generateMetadata: g }, { generateMetadata: c }, { generateMetadata: b }] = await Promise.all([
      import('@/app/guides/[slug]/page'),
      import('@/app/case-studies/[slug]/page'),
      import('@/app/blog/[slug]/page'),
    ]);
    const { GUIDES } = await import('@/lib/guides');
    const { getArticles } = await import('@/lib/content/loader');
    const { getCaseStudies } = await import('@/lib/content/case-study-loader');
    const bad: string[] = [];
    const check = (id: string, md: { title?: unknown; description?: string | null }) => {
      const t = typeof md.title === 'string' ? md.title : '';
      if (t.length > 61 || (md.description?.length ?? 0) > 160) bad.push(`${id}:${t.length}/${md.description?.length}`);
    };
    for (const x of GUIDES) check(x.slug, await g({ params: Promise.resolve({ slug: x.slug }) }));
    for (const x of await getCaseStudies()) check(x.slug, await c({ params: Promise.resolve({ slug: x.slug }) }));
    for (const x of await getArticles()) check(x.slug, await b({ params: Promise.resolve({ slug: x.slug }) }));
    expect(bad).toEqual([]);
  });
});
