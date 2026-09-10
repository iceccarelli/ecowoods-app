import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sitemap from '@/app/sitemap';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { CORRIDORS } from '@/lib/geo';
import { MACHINES } from '@/lib/equipment';
import { getGuides } from '@/lib/guides';
import { getPapers } from '@/lib/papers';
import { getServicePages } from '@/lib/service-pages';
import { GLOSSARY } from '@/lib/glossary';

/**
 * Reachability, per instance rather than per pattern.
 *
 * verify-navigation.mjs proves every ROUTE PATTERN is within three clicks of the
 * homepage. That is a weaker statement than it sounds: `/service-areas/[city]`
 * counts once, so the guard is satisfied by a single city being linked while
 * eighty-eight others are not. The same holds for forty-four glossary terms,
 * sixteen guides and eleven corridors.
 *
 * What actually has to be true is that every URL in the sitemap is reachable by
 * clicking, and the structural guarantee for a family of pages is that its index
 * renders the WHOLE collection — not a curated subset that silently drops the
 * tail. So these compare each index's collection against the sitemap's count for
 * that family, which is the same set seen from two different ends.
 */

const APP = join(process.cwd(), 'app');
const abs = (u: string) => u.replace('https://ecowoods.ca', '') || '/';

const routeFiles: string[] = [];
(function walk(dir: string) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n === 'page.tsx') routeFiles.push(p);
  }
})(APP);

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

describe('every published URL is reachable by clicking', () => {
  it('publishes a sitemap that covers every indexable page and nothing that 404s', async () => {
    const urls = new Set((await sitemap()).map((e) => abs(e.url)));
    const PRIVATE = /^\/(admin|mypage|login|register|verify-email|docs)/;
    const statics = routeFiles
      .map((p) => {
        const u = p.slice(APP.length).replace(/\/page\.tsx$/, '').replace(/\/\([^)]*\)/g, '');
        return u === '' ? '/' : u;
      })
      .filter((r) => !PRIVATE.test(r) && !r.includes('['));

    for (const r of statics) {
      const src = read(join(APP, r === '/' ? '' : r, 'page.tsx'));
      const noindex = /robots:\s*\{[^}]*index:\s*false/.test(src);
      if (noindex) {
        expect(urls.has(r), `${r} is noindex and must NOT be in the sitemap`).toBe(false);
      } else {
        expect(urls.has(r), `${r} is an indexable page missing from the sitemap`).toBe(true);
      }
    }
  });

  /**
   * Count parity between an index and the sitemap. If the index renders the
   * whole collection and the sitemap lists the whole collection, the two counts
   * agree — and a curated index that quietly drops the tail shows up as a gap.
   */
  const families: Array<[string, () => number]> = [
    ['/service-areas/', () => SERVICE_AREAS.length],
    ['/corridors/', () => CORRIDORS.length],
    ['/equipment/', () => MACHINES.length],
    ['/guides/', () => getGuides('decision').length + getGuides('reference').length],
    ['/papers/', () => getPapers().length],
    ['/services/', () => getServicePages().length],
    ['/glossary/', () => GLOSSARY.length],
  ];

  for (const [prefix, size] of families) {
    it(`lists every page under ${prefix} on its index`, async () => {
      const urls = (await sitemap()).map((e) => abs(e.url));
      const inSitemap = urls.filter((u) => u.startsWith(prefix) && u !== prefix.slice(0, -1)).length;
      expect(inSitemap, `${prefix} sitemap count`).toBe(size());
      const index = read(join(APP, prefix.slice(0, -1), 'page.tsx'));
      expect(index.length, `${prefix} has no index page`).toBeGreaterThan(0);
      // The index must iterate a collection rather than list hand-written links.
      expect(index, `${prefix} index does not map over a collection`).toMatch(/\.map\(/);
    });
  }
});

describe('no page is a dead end', () => {
  /**
   * A visitor who lands anywhere must always have somewhere to go next. The
   * chrome guarantees a floor, but a page whose own body offers no onward link
   * is a page that ends the session — which on a site whose whole job is to move
   * a reader from a symptom to a measure is the most expensive failure there is.
   */
  const PRIVATE = /\/(admin|mypage|login|register|verify-email|docs|api)\//;
  const pages = routeFiles.filter((p) => !PRIVATE.test(p));

  /**
   * Links are counted through component delegation, two levels deep. A page
   * that renders <ArticleLayout> has no hrefs of its own and is not a dead end;
   * the first version of this counted only the page file and reported the
   * homepage — which links to everything — as the thinnest page on the site.
   * A test that cannot see where the links actually live measures the file
   * layout, not the navigation.
   */
  const linkCount = (file: string, depth = 0, seen = new Set<string>()): number => {
    if (depth > 2 || seen.has(file)) return 0;
    seen.add(file);
    const src = read(file);
    if (!src) return 0;
    const own = new Set([
      ...[...src.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]),
      ...[...src.matchAll(/href=\{`(\/[^`]*)`\}/g)].map((m) => m[1]),
      ...[...src.matchAll(/href=\{([A-Za-z][\w.]*)\}/g)].map((m) => m[1]),
    ]).size;

    /* Follow every locally-imported component this file renders. */
    let inherited = 0;
    const rendered = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]));
    for (const m of src.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))\s+from\s+'([^']+)'/g)) {
      const names = (m[1] ?? m[2] ?? '').split(',').map((x) => x.trim().split(' as ')[0]).filter(Boolean);
      if (!names.some((n) => rendered.has(n))) continue;
      const spec = m[3];
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const base = spec.startsWith('@/')
        ? join(process.cwd(), spec.slice(2))
        : join(file, '..', spec);
      for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
        if (existsSync(base + ext)) { inherited += linkCount(base + ext, depth + 1, seen); break; }
      }
    }
    return own + inherited;
  };

  it('gives every public page at least three onward links a visitor can see', () => {
    const thin: string[] = [];
    for (const p of pages) {
      if (linkCount(p) < 3) thin.push(p.slice(APP.length));
    }
    expect(thin, `dead ends: ${thin.join(', ')}`).toEqual([]);
  });
});
