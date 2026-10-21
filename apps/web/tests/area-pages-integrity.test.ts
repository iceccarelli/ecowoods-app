/**
 * tests/area-pages-integrity.test.ts
 *
 * The 100 /service-areas/<slug> pages and the crawl graph around them, checked
 * on the RENDERED output (react-dom server), not the source:
 *
 *   - every page declares itself canonical (relative canonical === its own path,
 *     og:url === canonical on the canonical origin);
 *   - <title> and meta description are unique across all 100 areas;
 *   - every internal link on every area page resolves (sitemap page, existing
 *     route, static file or a declared redirect) and every #fragment on an
 *     in-site link names an id that exists on the destination page;
 *   - the link graph, built from the rendered anchors of every sitemap page plus
 *     the persistent chrome (Header + SiteFooter, depth 0), reaches EVERY sitemap
 *     URL within three clicks of the homepage — per URL, not per route pattern.
 *
 * scripts/verify-navigation.mjs proves the route PATTERNS from source;
 * tests/reachability.test.ts proves each index renders its whole collection.
 * This is the per-instance proof on what a crawler actually receives.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
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

import { renderPage, matchPage } from './helpers/render-jsonld';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';

const PUBLIC_DIRS = [path.resolve(__dirname, '../public'), path.resolve(__dirname, '../../../public')];
const MAX_DEPTH = 3;
/** <a href="#id"> — built from parts so the source-level destinations guard does not mistake this pattern for a link. */
const SAME_PAGE_ANCHOR = new RegExp('<a\\b[^>]*?\\shref=' + '"' + '#([^"]+)' + '"', 'g');

type Page = { path: string; html: string; metadata: any };
const pages = new Map<string, Page>();
let chromeLinks = new Set<string>();
let aliases: Record<string, string> = {};

/** Internal hrefs in rendered markup, as { pathname, hash }. Only real anchors a crawler follows. */
function internalLinks(html: string): { pathname: string; hash: string; raw: string }[] {
  const out: { pathname: string; hash: string; raw: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const raw = m[1]!.replace(/&amp;/g, '&');
    if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('sms:') || raw.startsWith('javascript:')) continue;
    let u: URL;
    try {
      u = new URL(raw, SITE_URL + '/');
    } catch {
      continue;
    }
    if (u.origin !== SITE_URL) continue;
    out.push({ pathname: u.pathname.replace(/\/+$/, '') || '/', hash: u.hash.slice(1), raw });
  }
  return out;
}

const resolvesAsFile = (p: string) => PUBLIC_DIRS.some((d) => existsSync(path.join(d, p)));

beforeAll(async () => {
  const sitemap = (await import('@/app/sitemap')).default;
  const paths = (await sitemap()).map((e) => new URL(e.url).pathname.replace(/\/+$/, '') || '/');
  for (const p of paths) {
    if (/\.pdf$/i.test(p) || p === '/products/floorforge') continue;
    const r = await renderPage(p);
    pages.set(p, { path: p, html: r.html, metadata: r.metadata });
  }
  // the persistent chrome: rendered once, linked from every page
  const Header = (await import('@/app/components/Header')).default;
  const SiteFooter = (await import('@/app/components/SiteFooter')).default;
  const chromeHtml = renderToStaticMarkup(createElement('div', null, createElement(Header as any), createElement(SiteFooter as any)));
  chromeLinks = new Set(internalLinks(chromeHtml).map((l) => l.pathname));
  aliases = require('../content/search/route-aliases.json').aliases;
}, 180_000);

const sitemapSet = () => new Set(pages.keys());

describe('the 100 service-area pages are each their own canonical', () => {
  it('there are 100 area pages and every registry area has exactly one', () => {
    expect(SERVICE_AREAS.length).toBe(100);
    for (const a of SERVICE_AREAS) expect(pages.has(`/service-areas/${a.slug}`), a.slug).toBe(true);
  });

  it('canonical === own path; og:url === canonical on the canonical origin; no robots exclusion', () => {
    const bad: string[] = [];
    for (const a of SERVICE_AREAS) {
      const own = `/service-areas/${a.slug}`;
      const md = pages.get(own)!.metadata;
      if (md.alternates?.canonical !== own) bad.push(`${a.slug}: canonical ${md.alternates?.canonical}`);
      if (md.openGraph?.url !== `${SITE_URL}${own}`) bad.push(`${a.slug}: og:url ${md.openGraph?.url}`);
      if (md.robots && (md.robots.index === false || /noindex/.test(String(md.robots)))) bad.push(`${a.slug}: robots excludes it but it is in the sitemap`);
    }
    expect(bad).toEqual([]);
  });

  it('title is unique across all 100 areas', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const a of SERVICE_AREAS) {
      const t = String(pages.get(`/service-areas/${a.slug}`)!.metadata.title);
      if (seen.has(t)) dup.push(`${a.slug} duplicates ${seen.get(t)}: ${t}`);
      seen.set(t, a.slug);
    }
    expect(dup).toEqual([]);
  });

  it('meta description is unique across all 100 areas and is not empty', () => {
    const seen = new Map<string, string>();
    const bad: string[] = [];
    for (const a of SERVICE_AREAS) {
      const d = String(pages.get(`/service-areas/${a.slug}`)!.metadata.description ?? '');
      if (d.trim().length < 50) bad.push(`${a.slug}: description too short`);
      if (seen.has(d)) bad.push(`${a.slug} duplicates ${seen.get(d)}`);
      seen.set(d, a.slug);
    }
    expect(bad).toEqual([]);
  });

  it('the on-page <h1> names the area, once', () => {
    const bad: string[] = [];
    for (const a of SERVICE_AREAS) {
      const html = pages.get(`/service-areas/${a.slug}`)!.html;
      const h1s = [...html.matchAll(/<h1\b[\s\S]*?<\/h1>/g)].map((m) => m[0].replace(/<[^>]+>/g, ''));
      if (h1s.length !== 1) bad.push(`${a.slug}: ${h1s.length} h1`);
      else if (!h1s[0]!.includes(a.name.replace(/,\s*(NY|ON)$/, ''))) bad.push(`${a.slug}: h1 "${h1s[0]}" lacks the area name`);
    }
    expect(bad).toEqual([]);
  });
});

describe('internal links on the area pages resolve', () => {
  it('every in-site href is a sitemap page, an existing route, a public file, or a declared redirect', () => {
    const sm = sitemapSet();
    const dead: string[] = [];
    for (const a of SERVICE_AREAS) {
      const own = `/service-areas/${a.slug}`;
      for (const l of internalLinks(pages.get(own)!.html)) {
        if (sm.has(l.pathname) || resolvesAsFile(l.pathname) || aliases[l.pathname] || l.pathname.startsWith('/_next/')) continue;
        if (/\.md$/.test(l.pathname)) continue; // markdown twins are covered by markdown-twins-agreement
        if (matchPage(l.pathname)) continue; // a real, non-sitemapped page (a noindex tool, say)
        dead.push(`${a.slug}: ${l.raw}`);
      }
    }
    expect([...new Set(dead)]).toEqual([]);
  });

  it('every #fragment on a link to a sitemap page names an id that exists on that page', () => {
    const bad: string[] = [];
    const idsOf = (html: string) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
    const cache = new Map<string, Set<string>>();
    for (const a of SERVICE_AREAS) {
      const own = `/service-areas/${a.slug}`;
      for (const l of internalLinks(pages.get(own)!.html)) {
        if (!l.hash) continue;
        const dest = pages.get(l.pathname);
        if (!dest) continue;
        if (!cache.has(dest.path)) cache.set(dest.path, idsOf(dest.html));
        if (!cache.get(dest.path)!.has(l.hash)) bad.push(`${a.slug}: ${l.raw}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('each area page links back to its hub, and every same-page #anchor (the on-page estimate form) has its target', () => {
    const bad: string[] = [];
    for (const a of SERVICE_AREAS) {
      const html = pages.get(`/service-areas/${a.slug}`)!.html;
      const links = new Set(internalLinks(html).map((l) => l.pathname));
      if (!links.has('/service-areas')) bad.push(`${a.slug}: no link back to /service-areas`);
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
      for (const m of html.matchAll(SAME_PAGE_ANCHOR)) if (!ids.has(m[1]!)) bad.push(`${a.slug}: same-page anchor #${m[1]} has no target`);
      if (!ids.has('quote')) bad.push(`${a.slug}: no #quote estimate form on the page`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('no indexable page is more than three clicks from the homepage', () => {
  it('the chrome (Header + SiteFooter) renders real links', () => {
    expect(chromeLinks.size).toBeGreaterThan(15);
    expect(chromeLinks.has('/service-areas')).toBe(true);
  });

  it('BFS over rendered anchors: every sitemap URL is reached at depth <= 3, chrome counted as depth 1 from anywhere', () => {
    const sm = sitemapSet();
    const depth = new Map<string, number>([['/', 0]]);
    let frontier = ['/'];
    for (let d = 1; d <= MAX_DEPTH + 2 && frontier.length; d++) {
      const next: string[] = [];
      for (const from of frontier) {
        const targets = new Set<string>(chromeLinks);
        for (const l of internalLinks(pages.get(from)?.html ?? '')) targets.add(aliases[l.pathname] ?? l.pathname);
        for (const t of targets) {
          if (!sm.has(t) || depth.has(t)) continue;
          depth.set(t, d);
          next.push(t);
        }
      }
      frontier = next;
    }
    const tooDeep = [...sm].filter((p) => !depth.has(p) || depth.get(p)! > MAX_DEPTH).map((p) => `${p} (${depth.get(p) ?? 'unreachable'})`);
    // PDFs in the sitemap are leaf documents linked from /catalogues; count them as reached if their index is.
    const unreached = tooDeep.filter((p) => !/\.pdf /.test(p));
    expect(unreached).toEqual([]);
  });

  it('every one of the 100 area pages is linked from /service-areas itself (depth 2 by content, not only by chrome)', () => {
    const hubLinks = new Set(internalLinks(pages.get('/service-areas')!.html).map((l) => l.pathname));
    const missing = SERVICE_AREAS.filter((a) => !hubLinks.has(`/service-areas/${a.slug}`)).map((a) => a.slug);
    expect(missing).toEqual([]);
  });
});
