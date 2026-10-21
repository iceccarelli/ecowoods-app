/**
 * tests/markdown-twins-agreement.test.ts
 *
 * Four things must name the same markdown twin of a page, and nothing in the
 * build proves they do:
 *
 *   1. MARKDOWN_TWINS in next.config.js (→ the `Link: …; rel="alternate"` header),
 *   2. the rewrites() that make the twin URL resolve to /md/…,
 *   3. the app/md/** route handler that answers it,
 *   4. each page's own metadata `alternates.types['text/markdown']`.
 *
 * verify-markdown.mjs proves 2 → 3 (rewrite destinations exist on disk). This
 * proves the rest, in BOTH directions, against the real page and route modules:
 * every page with a twin advertises exactly the twin the header names; every
 * advertised twin is rewritten, answered 200 text/markdown; every handler's
 * static params are exactly the pages that advertise it; and an unknown slug is
 * a 404, not an empty 200.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

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
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}));

import { SITE_URL } from '@/lib/seo-data';
import { matchPage, APP_DIR } from './helpers/render-jsonld';

const req = createRequire(__filename);
type PathFns = {
  match(route: string, opts?: { decode?: (s: string) => string }): (p: string) => false | { params: Record<string, string> };
  compile(route: string): (params: Record<string, string>) => string;
};
/* Next's own compiled path-to-regexp — the matcher its rewrites() and headers() use. */
const { match, compile } = req('next/dist/compiled/path-to-regexp') as PathFns;
const nextConfig = req('../next.config.js') as { headers(): Promise<any[]>; rewrites(): Promise<any[]> };

const strip = (u: string) => (u.startsWith(SITE_URL) ? u.slice(SITE_URL.length) : u);

/** The route.ts that answers an internal /md/… path, with its params. */
function matchRoute(pathname: string): { file: string; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean);
  const walk = (dir: string, i: number, params: Record<string, string>): ReturnType<typeof matchRoute> => {
    if (i === parts.length) {
      const f = path.join(dir, 'route.ts');
      return existsSync(f) ? { file: f, params } : null;
    }
    const dirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of dirs) if (e.name === parts[i]) {
      const r = walk(path.join(dir, e.name), i + 1, params);
      if (r) return r;
    }
    for (const e of dirs) {
      const m = /^\[([^.\]]+)\]$/.exec(e.name);
      if (m) {
        const r = walk(path.join(dir, e.name), i + 1, { ...params, [m[1]!]: parts[i]! });
        if (r) return r;
      }
    }
    return null;
  };
  return walk(APP_DIR, 0, {});
}

let TWINS: [string, string][] = [];
let REWRITES: { source: string; destination: string }[] = [];
let sitemapPaths: string[] = [];

beforeAll(async () => {
  const headers = await nextConfig.headers();
  TWINS = headers
    .filter((h) => h.headers.length === 1 && h.headers[0].key === 'Link' && /type="text\/markdown"/.test(h.headers[0].value))
    .map((h) => {
      const m = /^<([^>]+)>; rel="alternate"; type="text\/markdown"$/.exec(h.headers[0].value);
      return [h.source, m![1]!] as [string, string];
    });
  REWRITES = await nextConfig.rewrites();
  const sitemap = (await import('@/app/sitemap')).default;
  sitemapPaths = (await sitemap()).map((e) => new URL(e.url).pathname || '/');
});

/** Which twin source (if any) a concrete page path falls under, and its params. */
function twinFor(p: string): { source: string; twin: string; params: Record<string, string> } | null {
  for (const [source, twin] of TWINS) {
    const m = match(source, { decode: decodeURIComponent })(p);
    if (m) return { source, twin: compile(twin)(m.params as any), params: m.params as Record<string, string> };
  }
  return null;
}

function rewriteFor(twinUrl: string): { destination: string } | null {
  for (const r of REWRITES) {
    const m = match(r.source)(twinUrl);
    if (m) return { destination: compile(r.destination)(m.params as any) };
  }
  return null;
}

describe('next.config.js: MARKDOWN_TWINS ↔ rewrites()', () => {
  it('the twin list is non-trivial and no source or twin is listed twice', () => {
    expect(TWINS.length).toBeGreaterThan(20);
    expect(new Set(TWINS.map(([s]) => s)).size).toBe(TWINS.length);
    expect(new Set(TWINS.map(([, t]) => t)).size).toBe(TWINS.length);
  });

  it('every twin is `<page path>.md` (the root being /index.md)', () => {
    const bad = TWINS.filter(([s, t]) => t !== (s === '/' ? '/index.md' : `${s.replace(/\(\[[^)]*\]\+\)/g, '')}.md`));
    expect(bad).toEqual([]);
  });

  it('every .md rewrite source is a declared twin, and every twin is rewritten', () => {
    const rewriteSources = REWRITES.map((r) => r.source);
    expect(rewriteSources.every((s) => /\.md$/.test(s))).toBe(true);
    // twins → a rewrite answers them (checked on concrete URLs below too)
    const unrewritten: string[] = [];
    for (const [, twin] of TWINS) {
      // exercise dynamic twins with a representative slug
      const concrete = twin.replace(/:[a-z]+/g, 'x-sample');
      if (!rewriteFor(concrete)) unrewritten.push(twin);
    }
    expect(unrewritten).toEqual([]);
    // rewrites → a twin declares them: a rewrite with no header advertising it is invisible to agents
    const undeclared: string[] = [];
    const commercial = /^\/:slug\(([^)]+)\)\.md$/.exec(REWRITES.find((r) => r.destination === '/md/commercial/:slug')!.source)![1]!.split('|');
    for (const r of REWRITES) {
      if (r.destination === '/md/commercial/:slug') continue;
      const concrete = r.source.replace(/:[a-z]+(\([^)]*\))?/g, 'x-sample');
      const asTwin = TWINS.some(([, t]) => match(t.replace(/:[a-z]+/g, ':p'))(concrete));
      if (!asTwin) undeclared.push(r.source);
    }
    expect(undeclared).toEqual([]);
    // the commercial rewrite lists exactly the commercial twins
    const commercialTwins = TWINS.filter(([s]) => !s.includes(':') && commercial.includes(s.slice(1))).map(([s]) => s.slice(1));
    expect(commercialTwins.sort()).toEqual([...commercial].sort());
  });
});

describe('pages ↔ twins, both directions', () => {
  it('every sitemap page under a twin source advertises exactly that twin in alternates.types', async () => {
    const bad: string[] = [];
    let checked = 0;
    for (const p of sitemapPaths) {
      const t = twinFor(p);
      if (!t) continue;
      const m = matchPage(p);
      if (!m) {
        bad.push(`${p}: no page module`);
        continue;
      }
      const mod = await import(/* @vite-ignore */ m.file);
      const props = { params: Promise.resolve(m.params), searchParams: Promise.resolve({}) };
      const md = typeof mod.generateMetadata === 'function' ? await mod.generateMetadata(props, Promise.resolve({})) : mod.metadata;
      const declared = md?.alternates?.types?.['text/markdown'];
      checked++;
      if (typeof declared !== 'string' || strip(declared) !== t.twin) bad.push(`${p}: header says ${t.twin}, <head> says ${declared}`);
    }
    expect(checked).toBeGreaterThan(150);
    expect(bad).toEqual([]);
  });

  it('every sitemap page that declares a markdown alternate is covered by a twin source', async () => {
    const bad: string[] = [];
    for (const p of sitemapPaths) {
      if (twinFor(p)) continue;
      const m = matchPage(p);
      if (!m) continue;
      const src = readFileSync(m.file, 'utf8');
      if (src.includes("'text/markdown'")) bad.push(`${p}: declares a markdown alternate but no MARKDOWN_TWINS source covers it`);
    }
    expect(bad).toEqual([]);
  });

  it('every page.tsx in app/ that declares a markdown alternate sits under a twin source (indexable or not)', () => {
    const files: string[] = [];
    (function walk(dir: string) {
      for (const n of readdirSync(dir)) {
        const f = path.join(dir, n);
        if (statSync(f).isDirectory()) walk(f);
        else if (n === 'page.tsx' && readFileSync(f, 'utf8').includes("'text/markdown'")) files.push(f);
      }
    })(APP_DIR);
    const bad: string[] = [];
    for (const f of files) {
      const route = '/' + path.relative(APP_DIR, path.dirname(f)).split(path.sep).filter((s) => !/^\(.+\)$/.test(s)).map((s) => s.replace(/^\[(.+)\]$/, ':$1')).join('/');
      const r = route === '/.' ? '/' : route;
      const sample = r.replace(/:[a-zA-Z]+/g, 'x-sample');
      if (!TWINS.some(([s]) => match(s)(sample))) bad.push(`${path.relative(APP_DIR, f)} (${r})`);
    }
    expect(files.length).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });
});

describe('twin URL → rewrite → handler answers 200 text/markdown', () => {
  it('every page instance: its twin is rewritten to an existing handler that serves it', async () => {
    const bad: string[] = [];
    let n = 0;
    for (const p of sitemapPaths) {
      const t = twinFor(p);
      if (!t) continue;
      const rw = rewriteFor(t.twin);
      if (!rw) {
        bad.push(`${t.twin}: no rewrite`);
        continue;
      }
      const route = matchRoute(rw.destination);
      if (!route) {
        bad.push(`${t.twin} → ${rw.destination}: no route.ts`);
        continue;
      }
      const mod = await import(/* @vite-ignore */ route.file);
      const res: Response = await mod.GET(new Request(`${SITE_URL}${t.twin}`), { params: Promise.resolve(route.params) });
      n++;
      if (res.status !== 200) bad.push(`${t.twin}: HTTP ${res.status}`);
      else if (!/^text\/markdown/.test(res.headers.get('content-type') ?? '')) bad.push(`${t.twin}: content-type ${res.headers.get('content-type')}`);
      else if ((await res.text()).trim().length < 80) bad.push(`${t.twin}: empty body`);
    }
    expect(n).toBeGreaterThan(150);
    expect(bad).toEqual([]);
  });

  it('each dynamic handler\'s static params are exactly the sitemap pages that advertise it', async () => {
    const bad: string[] = [];
    for (const [source, twin] of TWINS) {
      if (!source.includes(':')) continue;
      const rw = rewriteFor(twin.replace(/:[a-z]+/g, 'x-sample'));
      const route = rw && matchRoute(rw.destination);
      if (!route) continue; // covered above
      const mod = await import(/* @vite-ignore */ route.file);
      if (typeof mod.generateStaticParams !== 'function') {
        bad.push(`${route.file}: no generateStaticParams`);
        continue;
      }
      const handlerSlugs = (await mod.generateStaticParams()).map((p: any) => Object.values(p)[0] as string).sort();
      const pageSlugs = sitemapPaths
        .map((p) => match(source)(p))
        .filter(Boolean)
        .map((m) => Object.values((m as any).params)[0] as string)
        .sort();
      if (JSON.stringify(handlerSlugs) !== JSON.stringify(pageSlugs)) {
        const extra = handlerSlugs.filter((s: string) => !pageSlugs.includes(s));
        const missing = pageSlugs.filter((s: string) => !handlerSlugs.includes(s));
        bad.push(`${source}: markdown-only [${extra}] / page-only [${missing}]`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('an unknown slug is a 404, never an empty 200', async () => {
    const bad: string[] = [];
    for (const [source, twin] of TWINS) {
      if (!source.includes(':') && !/commercial/.test(source)) continue;
      const rw = rewriteFor(twin.replace(/:[a-z]+/g, 'no-such-thing-zz'));
      const route = rw && matchRoute(rw.destination);
      if (!route) continue;
      const mod = await import(/* @vite-ignore */ route.file);
      const res: Response = await mod.GET(new Request(`${SITE_URL}/x`), { params: Promise.resolve({ ...Object.fromEntries(Object.keys(route.params).map((k) => [k, 'no-such-thing-zz'])) }) });
      if (res.status !== 404) bad.push(`${source}: HTTP ${res.status}`);
    }
    expect(bad).toEqual([]);
  });
});
