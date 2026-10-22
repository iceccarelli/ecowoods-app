/**
 * tests/seo-link-integrity.test.ts renders each sitemap page through its page
 * module and reads the metadata that module exports. A page that is a Client
 * Component cannot export metadata (Next forbids it), so its metadata lives in
 * a sibling layout.tsx — and the integrity suite cannot render such a page at
 * all (it skips /products/floorforge by name). Left alone, that page is in the
 * sitemap with its canonical, indexability and title unchecked by anything.
 *
 * This file checks exactly those pages from the layout that owns their
 * metadata: every sitemap page whose page.tsx is `'use client'` must have a
 * layout in its own folder exporting a canonical equal to the page's own path,
 * a title and a description, and must not be noindex.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  usePathname: () => '/',
}));

import { matchPage } from './helpers/render-jsonld';

const norm = (p: string) => p.replace(/\/+$/, '') || '/';

describe('sitemap pages that are Client Components are covered through their layout', () => {
  it('canonical equals the page path, not noindex, with a title and description', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const paths = (await sitemap()).map((e) => norm(new URL(e.url).pathname));
    const clientPages = paths.filter((p) => {
      if (/\.pdf$/i.test(p)) return false;
      const m = matchPage(p);
      return Boolean(m) && /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(readFileSync(m!.file, 'utf8'));
    });
    // The harness skips /products/floorforge by name; this is the page it skips.
    expect(clientPages).toContain('/products/floorforge');

    const bad: string[] = [];
    for (const p of clientPages) {
      const layoutFile = path.join(path.dirname(matchPage(p)!.file), 'layout.tsx');
      if (!existsSync(layoutFile)) {
        bad.push(`${p}: client page with no sibling layout to hold its metadata`);
        continue;
      }
      const md = (await import(/* @vite-ignore */ layoutFile)).metadata as any;
      if (!md) {
        bad.push(`${p}: layout exports no metadata`);
        continue;
      }
      const canonical = md.alternates?.canonical;
      if (typeof canonical !== 'string' || norm(canonical.replace(/^https?:\/\/[^/]+/, '')) !== p) bad.push(`${p}: canonical ${String(canonical)}`);
      if (!md.title) bad.push(`${p}: no title`);
      if (!md.description) bad.push(`${p}: no description`);
      if (/noindex|"index":false/.test(JSON.stringify(md.robots ?? ''))) bad.push(`${p}: noindex but listed in the sitemap`);
    }
    expect(bad).toEqual([]);
  });
});
