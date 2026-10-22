/**
 * tests/seo-link-integrity.test.ts
 *
 * One crawl, five questions, answered on what a crawler or an agent actually
 * receives (rendered pages, route-handler bodies, the sitemap function) rather
 * than on source text:
 *
 *   1. LINKS      every in-site URL that appears in ANY rendered sitemap page
 *                 (anchors AND JSON-LD url/@id/item values), in every markdown
 *                 twin, in /llms.txt, /llms-full.txt, /ai.txt, /api/knowledge
 *                 and the /api/v1 collection payloads resolves to a real page,
 *                 a route handler, a static file or a declared redirect whose
 *                 target resolves. A dynamic URL must be one the route actually
 *                 generates, not merely one that matches [slug].
 *   2. CANONICAL  every sitemap URL is its own canonical; no two sitemap URLs
 *                 share a canonical; no sitemap URL is noindex or robots-
 *                 disallowed; every route in app/ that is public and indexable
 *                 and has no dynamic segment is in the sitemap (and vice versa).
 *   3. TWINS      a page that advertises a markdown twin has one that serves,
 *                 and every in-site link inside a twin resolves (the existing
 *                 markdown-twins-agreement test proves the plumbing; this proves
 *                 the content).
 *   4. FACTS      counts and years written into prose agree with the registry
 *                 they are derived from (service areas, services, years).
 *   5. INTENT     each commercial intent has exactly one canonical page: titles
 *                 and H1s of the commercial canonicals are pairwise distinct and
 *                 no two of them canonicalise to the same URL.
 *
 * Existing guards (verify-links, verify-destinations, area-pages-integrity,
 * markdown-twins-agreement, jsonld-registry-agreement) are NOT replaced; this
 * file closes the gaps between them.
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

import { NextRequest } from 'next/server';
import { renderPage, matchPage, flattenNodes, APP_DIR } from './helpers/render-jsonld';
import { SITE_URL, SERVICES, SERVICE_AREAS } from '@/lib/seo-data';

const req = createRequire(__filename);
const nextConfig = req('../next.config.js') as { rewrites(): Promise<{ source: string; destination: string }[]> };
const { match } = req('next/dist/compiled/path-to-regexp') as {
  match(route: string): (p: string) => false | { params: Record<string, string> };
};
const aliases: Record<string, string> = req('../content/search/route-aliases.json').aliases;

const PUBLIC_DIRS = [path.resolve(__dirname, '../public'), path.resolve(__dirname, '../../../public')];
const norm = (p: string) => p.replace(/\/+$/, '') || '/';
const isFile = (p: string) => PUBLIC_DIRS.some((d) => existsSync(path.join(d, p)) && statSync(path.join(d, p)).isFile());

type Page = { path: string; html: string; metadata: any; nodes: Record<string, any>[] };
const pages = new Map<string, Page>();
let sitemapPaths: string[] = [];
let sitemapEntries: { url: string }[] = [];
let rewrites: { source: string; destination: string }[] = [];
const twinBodies = new Map<string, string>();
const staticParamsCache = new Map<string, Set<string> | null>();

/** The route.ts / page.tsx for a pathname, with its dynamic params. */
function matchRoute(pathname: string): { file: string; params: Record<string, string>; kind: 'page' | 'route' } | null {
  const parts = pathname.split('/').filter(Boolean);
  const walk = (dir: string, i: number, params: Record<string, string>): ReturnType<typeof matchRoute> => {
    if (i === parts.length) {
      for (const [f, kind] of [['page.tsx', 'page'], ['route.ts', 'route']] as const) {
        if (existsSync(path.join(dir, f))) return { file: path.join(dir, f), params, kind };
      }
      return null;
    }
    const dirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const e of dirs) if (e.name === parts[i]) {
      const r = walk(path.join(dir, e.name), i + 1, params);
      if (r) return r;
    }
    for (const e of dirs) if (/^\(.+\)$/.test(e.name)) {
      const r = walk(path.join(dir, e.name), i, params);
      if (r) return r;
    }
    for (const e of dirs) {
      const m = /^\[([^.\]]+)\]$/.exec(e.name);
      if (m) {
        const r = walk(path.join(dir, e.name), i + 1, { ...params, [m[1]!]: decodeURIComponent(parts[i]!) });
        if (r) return r;
      }
    }
    return null;
  };
  return walk(APP_DIR, 0, {});
}

/** Does a dynamic route actually generate these params? null = cannot tell. */
async function generates(file: string, params: Record<string, string>): Promise<boolean | null> {
  if (!staticParamsCache.has(file)) {
    const mod = await import(/* @vite-ignore */ file);
    if (typeof mod.generateStaticParams !== 'function') staticParamsCache.set(file, null);
    else {
      const list = (await mod.generateStaticParams()) as Record<string, string>[];
      staticParamsCache.set(file, new Set(list.map((p) => JSON.stringify(p, Object.keys(p).sort()))));
    }
  }
  const set = staticParamsCache.get(file)!;
  if (set === null) return null;
  return set.has(JSON.stringify(params, Object.keys(params).sort()));
}

/** Resolve an in-site path. Returns null when fine, or a reason when it is dead. */
async function deadReason(pathname: string, depth = 0): Promise<string | null> {
  const p = norm(pathname);
  if (depth > 4) return 'redirect loop';
  if (p === '/' || p === '/robots.txt' || p === '/sitemap.xml' || p === '/feed.xml') return null;
  if (p.startsWith('/_next/')) return null;
  if (isFile(p)) return null;
  if (aliases[p]) return deadReason(aliases[p]!, depth + 1);
  if (sitemapPaths.includes(p)) return null;
  for (const r of rewrites) {
    const m = match(r.source)(p);
    if (m) {
      const dest = r.destination.replace(/:([a-zA-Z]+)/g, (_, k) => (m.params as any)[k]);
      const route = matchRoute(dest);
      if (!route) return `rewrite → ${dest} has no handler`;
      const g = await generates(route.file, route.params);
      return g === false ? `rewrite → ${dest}: params not generated` : null;
    }
  }
  const route = matchRoute(p);
  if (!route) return 'no route';
  if (Object.keys(route.params).length) {
    const g = await generates(route.file, route.params);
    if (g === false) return `${path.relative(APP_DIR, route.file)} does not generate ${JSON.stringify(route.params)}`;
  }
  return null;
}

/** In-site URLs inside a blob of HTML / markdown / JSON text. */
function urlsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/https:\/\/ecowoods\.ca(\/[^\s)"'<>\]\\,]*)?/g)) out.add(m[1] ?? '/');
  return [...out].filter((u) => !/[{}*<>]/.test(u));
}
const anchorsIn = (html: string): string[] => {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const raw = m[1]!.replace(/&amp;/g, '&');
    if (!raw || /^(mailto:|tel:|sms:|javascript:|#)/.test(raw)) continue;
    let u: URL;
    try {
      u = new URL(raw, SITE_URL + '/');
    } catch {
      continue;
    }
    if (u.origin !== SITE_URL) continue;
    out.push(u.pathname);
  }
  return out;
};
const mdLinksIn = (md: string): string[] => {
  const out: string[] = [];
  for (const m of md.matchAll(/\]\((\/[^)\s#]*|https:\/\/ecowoods\.ca[^)\s#]*)(?:#[^)\s]*)?\)/g)) {
    out.push(m[1]!.replace(/^https:\/\/ecowoods\.ca/, '') || '/');
  }
  for (const m of m2(md)) out.push(m);
  return out.filter((u) => !/[{}*]/.test(u));
};
function* m2(md: string) {
  for (const m of md.matchAll(/https:\/\/ecowoods\.ca(\/[^\s)"'<>\]\\,#]*)?/g)) yield m[1] ?? '/';
}
const stripQuery = (p: string) => p.split('?')[0]!.split('#')[0]!.replace(/[.,;:!]+$/, '');

beforeAll(async () => {
  const sitemap = (await import('@/app/sitemap')).default;
  sitemapEntries = await sitemap();
  sitemapPaths = sitemapEntries.map((e) => norm(new URL(e.url).pathname));
  rewrites = await nextConfig.rewrites();
  for (const p of sitemapPaths) {
    if (/\.pdf$/i.test(p) || p === '/products/floorforge') continue;
    const r = await renderPage(p);
    pages.set(p, { path: p, html: r.html, metadata: r.metadata, nodes: r.nodes });
  }
}, 240_000);

/* ───────────────────────────── 1. LINKS ───────────────────────────── */

describe('every in-site link in every rendered page resolves', () => {
  it('anchors on all sitemap pages (not only the area pages)', async () => {
    const dead = new Map<string, string[]>();
    for (const pg of pages.values()) {
      for (const href of new Set(anchorsIn(pg.html))) {
        const why = await deadReason(stripQuery(href));
        if (why) dead.set(`${href} (${why})`, [...(dead.get(`${href} (${why})`) ?? []), pg.path]);
      }
    }
    expect([...dead].map(([k, v]) => `${k} <- ${v.slice(0, 3).join(', ')}${v.length > 3 ? ` +${v.length - 3}` : ''}`)).toEqual([]);
  });

  it('url / @id / item / mainEntityOfPage values inside JSON-LD', async () => {
    const dead = new Map<string, string>();
    const walk = (v: unknown, from: string) => {
      if (Array.isArray(v)) return v.forEach((x) => walk(x, from));
      if (v && typeof v === 'object') {
        for (const [k, val] of Object.entries(v)) {
          if (typeof val === 'string' && /^(url|@id|item|mainEntityOfPage|sameAs|contentUrl)$/.test(k) && val.startsWith(SITE_URL)) {
            const p = stripQuery(new URL(val).pathname);
            dead.set(p, from);
          } else walk(val, from);
        }
      }
    };
    for (const pg of pages.values()) for (const n of flattenNodes(pg.nodes)) walk(n, pg.path);
    const bad: string[] = [];
    for (const [p, from] of dead) {
      const why = await deadReason(p);
      if (why) bad.push(`${p} (${why}) <- ${from}`);
    }
    expect(bad).toEqual([]);
  });

  it('links in the head metadata: canonical, alternates, openGraph.url', async () => {
    const bad: string[] = [];
    for (const pg of pages.values()) {
      const md = pg.metadata ?? {};
      const urls = [md.alternates?.canonical, md.openGraph?.url, ...Object.values(md.alternates?.types ?? {}).flat()].filter(
        (x): x is string => typeof x === 'string',
      );
      for (const u of urls) {
        const p = stripQuery(u.startsWith('http') ? new URL(u).pathname : u);
        const why = await deadReason(p);
        if (why) bad.push(`${pg.path}: ${u} (${why})`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('machine surfaces cite only URLs that resolve', () => {
  const surfaces: Array<[string, () => Promise<string>]> = [
    ['/llms.txt', async () => (await (await import('@/app/llms.txt/route')).GET()).text()],
    ['/llms-full.txt', async () => (await (await import('@/app/llms-full.txt/route')).GET()).text()],
    ['/ai.txt', async () => (await (await import('@/app/ai.txt/route')).GET()).text()],
    [
      '/api/knowledge',
      async () => (await (await import('@/app/api/knowledge/route')).GET(new NextRequest(`${SITE_URL}/api/knowledge`))).text(),
    ],
  ];
  for (const [name, load] of surfaces) {
    it(name, async () => {
      const body = await load();
      const bad: string[] = [];
      const seen = new Set<string>();
      for (const u of [...urlsIn(body), ...mdLinksIn(body).filter((x) => x.startsWith('/'))]) {
        const p = stripQuery(u);
        if (seen.has(p)) continue;
        seen.add(p);
        const why = await deadReason(p);
        if (why) bad.push(`${p} (${why})`);
      }
      expect(seen.size).toBeGreaterThan(5);
      expect(bad).toEqual([]);
    });
  }

  it('/api/v1 collection payloads: every canonical_url / url is a resolving in-site URL', async () => {
    const { ENDPOINTS } = await import('@/lib/registry/manifest');
    const bad: string[] = [];
    let n = 0;
    for (const ep of ENDPOINTS as any[]) {
      const rel = String(ep.path ?? ep.href ?? '');
      if (!rel || /[:{[]/.test(rel) || /openapi|manifest|service-match|movement|quote-check/.test(rel)) continue;
      const segs = rel.replace(/^.*\/api\/v1\/?/, '').split('/').filter(Boolean);
      const file = path.join(APP_DIR, 'api/v1', ...segs, 'route.ts');
      if (!existsSync(file)) continue;
      const mod = await import(/* @vite-ignore */ file);
      if (typeof mod.GET !== 'function') continue;
      const res: Response = await mod.GET(new NextRequest(`${SITE_URL}/api/v1/${segs.join('/')}`, { headers: { 'x-forwarded-for': `10.9.0.${++n}` } }), {
        params: Promise.resolve({}),
      });
      if (res.status !== 200) continue;
      const text = await res.text();
      for (const u of new Set(urlsIn(text))) {
        const p = stripQuery(u);
        if (p.startsWith('/api/')) continue;
        const why = await deadReason(p);
        if (why) bad.push(`/api/v1/${segs.join('/')}: ${p} (${why})`);
      }
    }
    expect(n).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });
});

/* ───────────────────────────── 3. TWINS ───────────────────────────── */

describe('markdown twins', () => {
  it('every in-site link inside every served twin resolves, and every page advertising a twin has one', async () => {
    const bad: string[] = [];
    let served = 0;
    for (const pg of pages.values()) {
      const adv = pg.metadata?.alternates?.types?.['text/markdown'];
      if (!adv) continue;
      const twinPath = stripQuery(adv.startsWith('http') ? new URL(adv).pathname : adv);
      const rw = rewrites.find((r) => match(r.source)(twinPath));
      if (!rw) {
        bad.push(`${pg.path}: advertises ${twinPath} but no rewrite`);
        continue;
      }
      const m = match(rw.source)(twinPath) as { params: Record<string, string> };
      const dest = rw.destination.replace(/:([a-zA-Z]+)/g, (_, k) => m.params[k]!);
      const route = matchRoute(dest);
      if (!route || route.kind !== 'route') {
        bad.push(`${pg.path}: twin ${twinPath} → ${dest} has no handler`);
        continue;
      }
      const mod = await import(/* @vite-ignore */ route.file);
      const res: Response = await mod.GET(new Request(`${SITE_URL}${twinPath}`), { params: Promise.resolve(route.params) });
      if (res.status !== 200) {
        bad.push(`${pg.path}: twin ${twinPath} HTTP ${res.status}`);
        continue;
      }
      served++;
      const body = await res.text();
      twinBodies.set(twinPath, body);
      for (const u of new Set(mdLinksIn(body))) {
        const p = stripQuery(u);
        if (!p.startsWith('/') || /[{}*]/.test(p)) continue;
        const why = await deadReason(p);
        if (why) bad.push(`${twinPath}: ${p} (${why})`);
      }
    }
    expect(served).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});

/* ───────────────────────────── 2. CANONICAL ───────────────────────────── */

describe('canonical, sitemap and indexability agree', () => {
  it('every sitemap page is its own canonical and no two share one', () => {
    const byCanon = new Map<string, string[]>();
    const bad: string[] = [];
    for (const pg of pages.values()) {
      const c = pg.metadata?.alternates?.canonical;
      if (typeof c !== 'string') {
        bad.push(`${pg.path}: no canonical`);
        continue;
      }
      const cp = norm(stripQuery(c.startsWith('http') ? new URL(c).pathname : c));
      if (cp !== pg.path) bad.push(`${pg.path}: canonical → ${c}`);
      byCanon.set(cp, [...(byCanon.get(cp) ?? []), pg.path]);
    }
    for (const [c, from] of byCanon) if (from.length > 1) bad.push(`duplicate canonical ${c}: ${from.join(', ')}`);
    expect(bad).toEqual([]);
  });

  it('sitemap has no duplicate URLs, no redirect aliases, no noindex pages and no robots-disallowed paths', async () => {
    const bad: string[] = [];
    const seen = new Set<string>();
    for (const p of sitemapPaths) {
      if (seen.has(p)) bad.push(`duplicate sitemap entry ${p}`);
      seen.add(p);
      if (aliases[p]) bad.push(`${p} is a redirect alias`);
      const robots = pages.get(p)?.metadata?.robots;
      const flat = typeof robots === 'string' ? robots : JSON.stringify(robots ?? '');
      if (/noindex|"index":false/.test(flat)) bad.push(`${p} is noindex`);
    }
    const robotsMod = (await import('@/app/robots')).default() as any;
    const rule = (Array.isArray(robotsMod.rules) ? robotsMod.rules : [robotsMod.rules]).find((r: any) => r.userAgent === '*');
    const dis: string[] = ([] as string[]).concat(rule.disallow ?? []);
    const alw: string[] = ([] as string[]).concat(rule.allow ?? []);
    for (const p of sitemapPaths) {
      const blocked = dis.filter((d) => p.startsWith(d));
      if (blocked.length && !alw.some((a) => p.startsWith(a) && a.length >= Math.max(...blocked.map((b) => b.length)))) bad.push(`${p} disallowed by robots (${blocked})`);
    }
    expect(bad).toEqual([]);
  });

  it('every public static page in app/ that is indexable is in the sitemap', () => {
    const PRIVATE = /^\/(admin|docs|api|md|login|register|verify-email|mypage|portal|r|design\/spec|floor-plan|listing-floor-report|well-installed-review|assistant\/[^/]+)(\/|$)/;
    const missing: string[] = [];
    const walk = (dir: string, segs: string[]) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const group = /^\(.+\)$/.test(e.name);
        const next = group ? segs : [...segs, e.name];
        const full = path.join(dir, e.name);
        if (!group && /^\[/.test(e.name)) continue; // dynamic: covered by static-params-sitemap-parity
        if (existsSync(path.join(full, 'page.tsx')) && !group) {
          const url = '/' + next.join('/');
          const src = readFileSync(path.join(full, 'page.tsx'), 'utf8');
          const noindex = /index:\s*false|noindex/.test(src);
          if (!PRIVATE.test(url) && !noindex && !sitemapPaths.includes(url)) missing.push(url);
        }
        walk(full, next);
      }
    };
    walk(APP_DIR, []);
    expect(missing).toEqual([]);
  });

  it('every sitemap path is served by a real route (and by a generated param when dynamic)', async () => {
    const bad: string[] = [];
    for (const p of sitemapPaths) {
      if (/\.pdf$/i.test(p) || isFile(p)) continue;
      const why = await deadReason(p);
      if (why) bad.push(`${p} (${why})`);
      else if (!matchPage(p) && !isFile(p)) bad.push(`${p}: no page module`);
    }
    expect(bad).toEqual([]);
  });
});

/* ───────────────────────────── 4. FACTS ───────────────────────────── */

describe('counts and years written into prose equal their registry', () => {
  it('visible pages, markdown twins, llms.txt, llms-full.txt and ai.txt', async () => {
    const { getGuides } = await import('@/lib/guides');
    const { getPapers } = await import('@/lib/papers');
    const { getTerms } = await import('@/lib/glossary');
    const { yearsInBusiness, BUSINESS_NAP, REVIEW_EVIDENCE } = await import('@ecowoods/shared/constants');
    const guides = getGuides();
    const guideCounts = new Set([guides.length, guides.filter((g) => g.kind === 'decision').length, guides.filter((g) => g.kind === 'reference').length]);
    const reviewCounts = new Set(REVIEW_EVIDENCE.map((r) => r.count));
    const rules: Array<{ re: RegExp; ok: (n: number) => boolean; want: string }> = [
      { re: /\b(\d+)(?:-| )(?:glossary )?terms?\b(?! of)/gi, ok: (n) => n === getTerms().length, want: `${getTerms().length} terms` },
      { re: /\b(\d+) (?:decision |reference )?guides\b/gi, ok: (n) => guideCounts.has(n), want: `guides ${[...guideCounts]}` },
      { re: /\b(\d+) (?:technical )?papers\b/gi, ok: (n) => n === getPapers().length, want: `${getPapers().length} papers` },
      { re: /\b(\d+) (?:published (?:service )?areas|service areas|areas served)\b/gi, ok: (n) => n === SERVICE_AREAS.length, want: `${SERVICE_AREAS.length} areas` },
      { re: /\b(\d+) (?:five-star )?(?:HomeStars |Google )?reviews\b/gi, ok: (n) => reviewCounts.has(n), want: `reviews ${[...reviewCounts]}` },
      { re: /(?:established|in business since|operating\? since)\s+(\d{4})\b/gi, ok: (n) => n === BUSINESS_NAP.foundedYear, want: `founded ${BUSINESS_NAP.foundedYear}` },
      { re: /(?:in business|established \d{4}\s*[·—-]|since \d{4}\s*[—-]|has done so for|operating\? since \d{4}\s*[—-])\s*(?:for\s*)?(\d+)\+? years?\b/gi, ok: (n) => n === yearsInBusiness(), want: `${yearsInBusiness()} years` },
    ];
    const corpus: Array<[string, string]> = [...pages.values()].map((pg) => [
      pg.path,
      pg.html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' '),
    ]);
    for (const [k, v] of twinBodies) corpus.push([k, v]);
    corpus.push(['/llms.txt', await (await (await import('@/app/llms.txt/route')).GET()).text()]);
    corpus.push(['/llms-full.txt', await (await (await import('@/app/llms-full.txt/route')).GET()).text()]);
    corpus.push(['/ai.txt', await (await (await import('@/app/ai.txt/route')).GET()).text()]);
    expect(twinBodies.size).toBeGreaterThan(100);
    const bad = new Map<string, string[]>();
    /* /whats-new is a dated history: "32-term glossary" there was true on its date. */
    const HISTORY = /^\/whats-new(\.md)?$/;
    for (const [from, text] of corpus) {
      if (HISTORY.test(from)) continue;
      for (const { re, ok, want } of rules) {
        for (const m of text.matchAll(re)) {
          if (!ok(Number(m[1]))) {
            const k = `"${m[0]}" (registry: ${want})`;
            bad.set(k, [...(bad.get(k) ?? []), from]);
          }
        }
      }
    }
    expect([...bad].map(([k, v]) => `${k} <- ${v.slice(0, 3).join(', ')}${v.length > 3 ? ` +${v.length - 3}` : ''}`)).toEqual([]);
  });
});

/* ───────────────────────────── 5. INTENT ───────────────────────────── */

describe('commercial intents have one canonical page each', () => {
  it('each service page links its Toronto-wide head-term page, and the head-term page links back', async () => {
    const { getServicePages } = await import('@/lib/service-pages');
    const hrefs = (p: string) => new Set(anchorsIn(pages.get(p)!.html).map(norm));
    const bad: string[] = [];
    const withHead = getServicePages().filter((sp) => sp.headTerm);
    expect(withHead.map((sp) => sp.slug).sort()).toEqual(['dust-free-sanding', 'floor-refinishing', 'hardwood-installation', 'stair-refinishing']);
    for (const sp of withHead) {
      const svc = `/services/${sp.slug}`;
      const head = sp.headTerm!.href;
      if (!sitemapPaths.includes(head)) bad.push(`${svc}: headTerm ${head} is not a sitemap page`);
      if (!hrefs(svc).has(head)) bad.push(`${svc} does not link ${head}`);
      if (!hrefs(head).has(svc)) bad.push(`${head} does not link back to ${svc}`);
    }
    expect(bad).toEqual([]);
  });

  const COMMERCIAL = [
    '/hardwood-flooring-toronto',
    '/hardwood-floor-refinishing-toronto',
    '/hardwood-stairs-toronto',
    '/hardwood-floor-problems-toronto',
    '/best-hardwood-flooring-company-toronto',
    '/best-hardwood-flooring-company-gta',
    '/hardwood-color-matching-toronto',
    '/commercial',
    '/realtors',
    '/estimate',
    '/pricing',
  ];
  const titleOf = (md: any): string => (typeof md?.title === 'string' ? md.title : (md?.title?.absolute ?? md?.title?.default ?? ''));

  it('titles, meta descriptions and H1s are pairwise distinct across the commercial canonicals', () => {
    const t = new Map<string, string>();
    const d = new Map<string, string>();
    const h = new Map<string, string>();
    const bad: string[] = [];
    for (const p of COMMERCIAL) {
      const pg = pages.get(p);
      if (!pg) {
        bad.push(`${p}: not in sitemap`);
        continue;
      }
      const title = titleOf(pg.metadata).trim().toLowerCase();
      const desc = String(pg.metadata?.description ?? '').trim().toLowerCase();
      const h1 = [...pg.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase());
      if (!title) bad.push(`${p}: no title`);
      if (t.has(title)) bad.push(`${p}: same title as ${t.get(title)}`);
      t.set(title, p);
      if (desc && d.has(desc)) bad.push(`${p}: same description as ${d.get(desc)}`);
      d.set(desc, p);
      if (h1.length !== 1) bad.push(`${p}: ${h1.length} H1s`);
      else {
        if (h.has(h1[0]!)) bad.push(`${p}: same H1 as ${h.get(h1[0]!)}`);
        h.set(h1[0]!, p);
      }
    }
    expect(bad).toEqual([]);
  });

  it('no redirect alias points at a page other than a sitemap canonical', () => {
    const bad = Object.entries(aliases).filter(([, dest]) => !sitemapPaths.includes(norm(String(dest).split('#')[0]!.split('?')[0]!)) && !isFile(String(dest)));
    expect(bad.map(([s, d]) => `${s} → ${d}`)).toEqual([]);
  });

  it('no two alias sources chain through another alias', () => {
    const bad = Object.entries(aliases).filter(([, dest]) => aliases[norm(String(dest))]);
    expect(bad.map(([s, d]) => `${s} → ${d}`)).toEqual([]);
  });
});
