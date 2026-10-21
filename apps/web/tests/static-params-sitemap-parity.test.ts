import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { generateStaticParams as blog } from '@/app/blog/[slug]/page';
import { generateStaticParams as caseStudies } from '@/app/case-studies/[slug]/page';
import { generateStaticParams as corridors } from '@/app/corridors/[id]/page';
import { generateStaticParams as equipment } from '@/app/equipment/[id]/page';
import { generateStaticParams as glossary } from '@/app/glossary/[slug]/page';
import { generateStaticParams as guides } from '@/app/guides/[slug]/page';
import { generateStaticParams as papers } from '@/app/papers/[slug]/page';
import { generateStaticParams as projects } from '@/app/projects/[slug]/page';
import { generateStaticParams as serviceAreas } from '@/app/service-areas/[city]/page';
import { generateStaticParams as services } from '@/app/services/[slug]/page';

/* Every indexable dynamic route's generateStaticParams must be listed in
   sitemap.xml. Trilogy project pages were built but missing from llms.txt;
   this closes the same gap for the sitemap generally. */
const ROUTES: Array<[string, string, () => unknown]> = [
  ['/blog', 'slug', blog],
  ['/case-studies', 'slug', caseStudies],
  ['/corridors', 'id', corridors],
  ['/equipment', 'id', equipment],
  ['/glossary', 'slug', glossary],
  ['/guides', 'slug', guides],
  ['/papers', 'slug', papers],
  ['/projects', 'slug', projects],
  ['/service-areas', 'city', serviceAreas],
  ['/services', 'slug', services],
];

describe('every generateStaticParams route is in the sitemap', async () => {
  const urls = new Set((await sitemap()).map((e) => new URL(e.url).pathname));
  for (const [prefix, key, fn] of ROUTES) {
    it(prefix, async () => {
      const params = (await fn()) as Array<Record<string, string>>;
      expect(params.length).toBeGreaterThan(0);
      const missing = params.map((p) => `${prefix}/${p[key]}`).filter((u) => !urls.has(u));
      expect(missing).toEqual([]);
    });
  }
});

describe('machine surfaces list every project page the sitemap lists', () => {
  it('llms.txt links every /projects/{slug} the sitemap carries', async () => {
    const { GET } = await import('@/app/llms.txt/route');
    const body = await (await GET()).text();
    const projectUrls = (await sitemap())
      .map((e) => new URL(e.url).pathname)
      .filter((p) => /^\/projects\/[^/]+$/.test(p));
    expect(projectUrls.length).toBeGreaterThan(20);
    const missing = projectUrls.filter((p) => !new RegExp(`${p}(\\)|\\s|$)`, 'm').test(body));
    expect(missing).toEqual([]);
  });

  it('llms-full.txt carries every trilogy page', async () => {
    const { GET } = await import('@/app/llms-full.txt/route');
    const body = await (await GET()).text();
    const { TRILOGIES } = await import('@/lib/trilogies');
    for (const t of TRILOGIES) expect(body).toContain(`/projects/${t.slug}`);
  });

  it('project and trilogy slugs never collide', async () => {
    const { PROJECTS } = await import('@/lib/projects');
    const { TRILOGIES } = await import('@/lib/trilogies');
    const all = [...PROJECTS.map((p) => p.slug), ...TRILOGIES.map((t) => t.slug)];
    expect(new Set(all).size).toBe(all.length);
  });
});
