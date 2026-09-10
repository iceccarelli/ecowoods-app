/**
 * tests/catalogues.test.ts — the field catalogues, end to end in-process.
 *
 * The failure this suite exists for is F-162 in a new costume: a machine
 * surface advertising a document that is not there. Eight PDFs are now named in
 * the sitemap, /llms.txt, /llms-full.txt, /ai.txt and /api/knowledge, and every
 * one of those names is a promise to a crawler. So the file on disk is the
 * thing asserted, and every surface is required to agree with it.
 *
 * It also holds the line on the two rules that make this a library rather than
 * a download folder: no catalogue may point at a route that does not exist, and
 * no page may carry more than two of them.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  CATALOGUES,
  CATALOGUE_RAILS,
  CATALOGUE_SERIES,
  catalogueHref,
  cataloguesForRoute,
  getPublishedCatalogues,
} from '@/lib/catalogues';
import { GET as llmsGet } from '@/app/llms.txt/route';
import { GET as llmsFullGet } from '@/app/llms-full.txt/route';
import { GET as aiGet } from '@/app/ai.txt/route';
import { GET as knowledgeGet } from '@/app/api/knowledge/route';
import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/lib/seo-data';

const PUBLIC_DIR = join(process.cwd(), 'public', 'catalogues');
const APP_DIR = join(process.cwd(), 'app');

/** Every route.ts / page.tsx path that exists, as a set of URL paths. */
const routeExists = (href: string): boolean => {
  const path = href.split('#')[0].split('?')[0];
  if (path === '/') return existsSync(join(APP_DIR, 'page.tsx'));
  const dir = join(APP_DIR, ...path.replace(/^\//, '').split('/'));
  if (existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'route.ts'))) return true;
  // A dynamic segment: /guides/<slug> is served by app/guides/[slug]/page.tsx.
  const parts = path.replace(/^\//, '').split('/');
  const parent = join(APP_DIR, ...parts.slice(0, -1));
  if (!existsSync(parent)) return false;
  return readdirSync(parent).some(
    (n) => n.startsWith('[') && existsSync(join(parent, n, 'page.tsx')),
  );
};

describe('the manifest', () => {
  it('gives every catalogue a unique number, slug and filename', () => {
    const uniq = (xs: string[]) => new Set(xs).size === xs.length;
    expect(uniq(CATALOGUES.map((c) => c.id))).toBe(true);
    expect(uniq(CATALOGUES.map((c) => c.slug))).toBe(true);
    expect(uniq(CATALOGUES.map((c) => c.file))).toBe(true);
  });

  it('uses only declared series', () => {
    const ids = new Set(CATALOGUE_SERIES.map((s) => s.id));
    for (const c of CATALOGUES) expect(ids.has(c.series), c.file).toBe(true);
  });

  it('gives every catalogue at least one related page, and every one resolves', () => {
    for (const c of CATALOGUES) {
      expect(c.related.length, `${c.file} has no related page`).toBeGreaterThan(0);
      for (const r of c.related) {
        expect(routeExists(r.href), `${c.file} → ${r.href} is not a route`).toBe(true);
      }
    }
  });

  it('restates no price, year count or review figure', () => {
    /* A number typed here is a second copy of a fact sourced elsewhere. The
       purpose lines describe documents; they never quote them. */
    const text = CATALOGUES.map((c) => `${c.title} ${c.kicker} ${c.purpose}`).join(' ');
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\b(19|20)\d{2}\b/);
    expect(text).not.toMatch(/\bper\s+sq(uare)?\s*(ft|foot)\b/i);
  });
});

describe('the files', () => {
  it('serves every declared catalogue from public/catalogues', () => {
    for (const c of CATALOGUES) {
      const f = join(PUBLIC_DIR, c.file);
      expect(existsSync(f), `${c.file} is missing from public/catalogues`).toBe(true);
      expect(statSync(f).size, `${c.file} is empty`).toBeGreaterThan(1024);
    }
  });

  it('leaves no unlisted PDF in public/catalogues', () => {
    const declared = new Set(CATALOGUES.map((c) => c.file));
    const onDisk = existsSync(PUBLIC_DIR)
      ? readdirSync(PUBLIC_DIR).filter((n) => n.toLowerCase().endsWith('.pdf'))
      : [];
    for (const n of onDisk) expect(declared.has(n), `${n} is served but not in the manifest`).toBe(true);
  });

  it('publishes all of them', () => {
    expect(getPublishedCatalogues()).toHaveLength(CATALOGUES.length);
  });

  it('builds the public URL from the filename, unchanged', () => {
    for (const c of CATALOGUES) expect(catalogueHref(c)).toBe(`/catalogues/${c.file}`);
  });
});

describe('the contextual rails', () => {
  it('puts at most two catalogues on any page', () => {
    for (const [route, ids] of Object.entries(CATALOGUE_RAILS)) {
      expect(ids.length, `${route} carries ${ids.length}`).toBeLessThanOrEqual(2);
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  it('names only routes that exist and catalogues that exist', () => {
    for (const [route, ids] of Object.entries(CATALOGUE_RAILS)) {
      expect(routeExists(route), `${route} is not a route`).toBe(true);
      expect(cataloguesForRoute(route), route).toHaveLength(ids.length);
    }
  });

  it('leaves /papers alone', () => {
    expect(cataloguesForRoute('/papers')).toHaveLength(0);
    expect(CATALOGUE_RAILS['/papers']).toBeUndefined();
  });
});

describe('the machine surfaces', () => {
  it('lists the index and every file in the sitemap, once', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/catalogues`);
    for (const c of CATALOGUES) {
      const abs = `${SITE_URL}${catalogueHref(c)}`;
      expect(urls.filter((u) => u === abs), abs).toHaveLength(1);
    }
    /* No preview host may reach the sitemap. */
    for (const u of urls) expect(u.startsWith(SITE_URL), u).toBe(true);
  });

  it('names every catalogue URL in /llms.txt, /llms-full.txt and /ai.txt', async () => {
    const bodies = await Promise.all(
      [llmsGet(), llmsFullGet(), aiGet()].map(async (r) => (await r).text()),
    );
    for (const body of bodies) {
      expect(body).toContain('Field catalogues');
      for (const c of CATALOGUES) {
        expect(body, c.file).toContain(`${SITE_URL}${catalogueHref(c)}`);
      }
    }
  });

  it('registers each catalogue as a document entity in /api/knowledge', async () => {
    const res = await knowledgeGet(
      new NextRequest('https://ecowoods.ca/api/knowledge?collection=catalogues'),
    );
    const json = (await res.json()) as {
      meta: { collections: string[]; counts: Record<string, number> };
      catalogues: Array<Record<string, unknown>>;
    };
    expect(json.meta.collections).toContain('catalogues');
    expect(json.meta.counts.catalogues).toBe(CATALOGUES.length);
    expect(json.catalogues).toHaveLength(CATALOGUES.length);
    for (const record of json.catalogues) {
      expect(record.contentType).toBe('application/pdf');
      expect(String(record.pdfUrl)).toMatch(/^https:\/\/[^/]+\/catalogues\/Ecowoods_\d{2}_.+\.pdf$/);
      expect(String(record.canonicalUrl)).toContain(SITE_URL);
      expect(String(record.canonicalUrl)).not.toContain('.pdf');
    }
  });
});
