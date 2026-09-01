#!/usr/bin/env node
/**
 * scripts/verify-destinations.mjs
 *
 * Fails the build when a link does not land where it says it lands.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT verify-links.mjs
 *
 * verify-links.mjs asks the INBOUND question: does every public route have a
 * way in? It found /papers and /authority sitting in the sitemap with no path
 * to them from the chrome.
 *
 * Nothing asked the OUTBOUND question: does every link we publish resolve?
 * Those are different failures with different shapes:
 *
 *   /guides/white-oak-flooring-toronto     → resolves; the slug is in GUIDES
 *   /guides/white-oak-flooring             → matches the [slug] route pattern,
 *                                            passes any regex check, and 404s
 *                                            in production because that slug
 *                                            is in no manifest
 *
 * A path-shape check cannot tell those apart. A crawler can, but only after
 * the thing is deployed and only for pages it happens to reach. This guard
 * resolves every internal link against the manifest that actually generates
 * the page, at build time, before anyone can click it.
 *
 * SIX QUESTIONS, ONE PASS
 *
 *  1. STATIC ROUTES   every internal href resolves to a page.tsx, a route.ts,
 *                     or a file in public/.
 *  2. DYNAMIC SLUGS   every /services/:slug, /guides/:slug, /papers/:slug,
 *                     /glossary/:slug, /service-areas/:city, /blog/:slug and
 *                     /case-studies/:slug names a slug that exists in the
 *                     manifest its generateStaticParams reads. This is the
 *                     check nothing else in the repo performs.
 *  3. ANCHORS         every '#fragment' we link to is an id that is actually
 *                     rendered on the destination route. A fragment that does
 *                     not exist is a link that silently lands at the top of
 *                     the page — the visitor reads it as "the site is broken",
 *                     and it is the single hardest link failure to notice,
 *                     because the page still renders.
 *  4. NO SELF-REDIRECT  no internal href points at a path that next.config.js
 *                     redirects. The alias redirects (/stairs, /toronto-
 *                     hardwood, …) exist to catch inbound traffic from
 *                     elsewhere. Linking to one from our own pages spends a
 *                     round trip and dilutes the internal link graph for no
 *                     reason: link to the canonical.
 *  5. RETIRED DOMAIN  no link anywhere points at ecowoodshardwood.com. That
 *                     host is being killed as a content host; a link from the
 *                     new site to the old one re-teaches Google the thing the
 *                     301s are trying to un-teach it.
 *  6. EXTERNAL HOSTS  every external host is in ALLOWED_EXTERNAL below. An
 *                     outbound link is an endorsement and a PageRank leak;
 *                     adding one is a deliberate act, not a side effect.
 *
 * Usage:
 *   node scripts/verify-destinations.mjs
 *   node scripts/verify-destinations.mjs --list    every link and its verdict
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'apps/web');
const APP = path.join(WEB, 'app');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(APP)) {
  console.error('verify-destinations: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

/**
 * Hosts we are willing to point a visitor at.
 *
 * Two sources, and only two.
 *
 * PROFILE_LINKS in packages/shared/constants is the verified-profiles file the
 * engineering rules require: a URL goes in it only after somebody opened it and
 * saw an Ecowoods page, and it is what feeds `sameAs`. Deriving the allowlist
 * from it means a profile cannot be linked from the site without also being
 * claimed as this entity in schema — the two can no longer disagree, which is
 * exactly how the footer ended up with two hardcoded handles that no verified
 * file had ever seen.
 *
 * INFRASTRUCTURE below is the short list of hosts that are not profiles: our
 * own domain, the vocabulary JSON-LD points at, the CDN our licensed imagery is
 * served from and the licence it is served under. Adding to it is a deliberate
 * act — an outbound link is an endorsement and it leaks authority.
 */
const INFRASTRUCTURE = [
  'ecowoods.ca',
  'www.ecowoods.ca',
  'schema.org',
  'www.schema.org',
  'images.unsplash.com',
  'creativecommons.org',
];

const ALLOWED_EXTERNAL = new Set(INFRASTRUCTURE);
{
  const file = path.join(ROOT, 'packages/shared/constants/index.ts');
  if (!fs.existsSync(file)) {
    console.error('verify-destinations: packages/shared/constants/index.ts not found — cannot read the verified-profiles list.');
    process.exit(2);
  }
  const src = fs.readFileSync(file, 'utf8');
  let found = 0;
  for (const m of src.matchAll(/href:\s*['"`](https?:\/\/[^'"`]+)['"`]/g)) {
    try { ALLOWED_EXTERNAL.add(new URL(m[1]).hostname); found++; } catch { /* not a URL */ }
  }
  if (!found) {
    console.error('verify-destinations: read no profile URL out of packages/shared/constants/index.ts.');
    console.error('  The allowlist would then be infrastructure-only and this guard would fail every');
    console.error('  legitimate profile link. Fix the reader rather than pasting hosts in here.');
    process.exit(2);
  }
}

/** Hosts that must never appear. */
const FORBIDDEN_HOST = /(^|\.)ecowoodshardwood\.com$/i;

/* ── 1. the route table ──────────────────────────────────────────────────── */
const staticRoutes = new Set();
const dynamicRoutes = [];
(function walk(dir, seg) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'components' || e.name === 'api' || e.name.startsWith('_')) continue;
      // (group) folders do not appear in the URL
      walk(p, e.name.startsWith('(') ? seg : `${seg}/${e.name}`);
    } else if (/^(page|route)\.(tsx|ts)$/.test(e.name)) {
      const route = seg || '/';
      if (route.includes('[')) dynamicRoutes.push(route);
      else staticRoutes.add(route);
    }
  }
})(APP, '');

// Next's file-convention metadata routes: real URLs with no page.tsx.
for (const [file, route] of [
  ['sitemap.ts', '/sitemap.xml'],
  ['robots.ts', '/robots.txt'],
  ['manifest.ts', '/manifest.webmanifest'],
]) {
  if (fs.existsSync(path.join(APP, file))) staticRoutes.add(route);
}

/* ── 2. public/ ──────────────────────────────────────────────────────────── */
const publicFiles = new Set();
const PUBLIC_DIRS = [path.join(WEB, 'public'), path.join(ROOT, 'public')];
for (const base of PUBLIC_DIRS) {
  if (!fs.existsSync(base)) continue;
  (function walk(dir, prefix) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}/${e.name}`);
      else publicFiles.add(`${prefix}/${e.name}`);
    }
  })(base, '');
}

/* ── 3. the slug manifests ───────────────────────────────────────────────── */
/**
 * Read the slugs out of the same file generateStaticParams reads. A regex over
 * `slug: '...'` is deliberate: importing the module would need a TS runtime and
 * a database client, and the failure mode of the regex (missing a slug that is
 * computed rather than written) is a FALSE FAIL, which someone notices, rather
 * than a false pass, which nobody does.
 */
function slugsFromSource(rel) {
  const file = path.join(WEB, rel);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/\bslug:\s*['"`]([a-z0-9-]+)['"`]/g)) out.add(m[1]);
  return out.size ? out : null;
}
function slugsFromContentDir(rel) {
  const dir = path.join(WEB, rel);
  if (!fs.existsSync(dir)) return null;
  const out = new Set(
    fs.readdirSync(dir).filter((f) => /\.mdx?$/.test(f)).map((f) => f.replace(/\.mdx?$/, '')),
  );
  return out.size ? out : null;
}

const MANIFESTS = {
  '/services': { source: 'lib/service-pages.ts', slugs: slugsFromSource('lib/service-pages.ts') },
  '/guides': { source: 'lib/guides.ts', slugs: slugsFromSource('lib/guides.ts') },
  '/papers': { source: 'lib/papers.ts', slugs: slugsFromSource('lib/papers.ts') },
  '/glossary': { source: 'lib/glossary.ts', slugs: slugsFromSource('lib/glossary.ts') },
  '/service-areas': { source: 'lib/seo-data.ts', slugs: slugsFromSource('lib/seo-data.ts') },
  '/blog': { source: 'content/articles/', slugs: slugsFromContentDir('content/articles') },
  '/case-studies': { source: 'content/case-studies/', slugs: slugsFromContentDir('content/case-studies') },
};
for (const [prefix, m] of Object.entries(MANIFESTS)) {
  if (!m.slugs) {
    console.error(`verify-destinations: could not read any slug from ${m.source} for ${prefix}.`);
    console.error('  Either the manifest moved or its shape changed. This guard is now blind —');
    console.error('  fix the reader rather than deleting the entry.');
    process.exit(2);
  }
}
// The .md mirrors are the same slugs under /md/*.
for (const p of ['/services', '/guides', '/papers', '/glossary', '/service-areas']) {
  MANIFESTS[`/md${p}`] = MANIFESTS[p];
}

/* ── 4. every source file, and every link in it ──────────────────────────── */
/**
 * Comments are not links. This repo comments heavily and several of those
 * comments quote the very hrefs they replaced — SiteFooter explains, in prose,
 * that its city links "used to be href='#areas'". A scanner that reads that as
 * a live link reports a bug that was fixed a year ago, and a guard that cries
 * wolf gets switched off. Strings survive; comments do not.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let quote = null;      // ' " ` when inside a string
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (quote) {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

const sources = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'public'].includes(e.name)) continue;
      walk(p);
    } else if (/\.(tsx|ts|mdx)$/.test(e.name)) {
      sources.push([path.relative(ROOT, p), stripComments(fs.readFileSync(p, 'utf8'))]);
    }
  }
})(WEB);

/** file → Set(id) rendered by that file */
const idsByFile = new Map();
for (const [rel, src] of sources) {
  const ids = new Set();
  for (const m of src.matchAll(/\bid=["'`]([A-Za-z][\w-]*)["'`]/g)) ids.add(m[1]);
  // MDX headings get an id from their slugified text.
  for (const m of src.matchAll(/^#{2,6}\s+(.+)$/gm)) {
    ids.add(
      m[1].trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
    );
  }
  idsByFile.set(rel, ids);
}

/** Local imports, so a page's ids include the ids of the components it renders. */
const importsByFile = new Map();
for (const [rel, src] of sources) {
  const out = new Set();
  // `import X from 'y'` AND `dynamic(() => import('y'))`. Missing the second
  // form is not a cosmetic gap: home-client.tsx loads FloorCatalog and
  // MachineCatalog that way, and a scanner that only reads static imports
  // concludes no page renders them — then passes their broken anchors, because
  // it has nothing to check them against. An unseen edge is a false PASS.
  const specs = [
    ...[...src.matchAll(/from\s+["'](@\/[^"']+|\.[^"']+)["']/g)].map((m) => m[1]),
    ...[...src.matchAll(/import\(\s*["'](@\/[^"']+|\.[^"']+)["']\s*\)/g)].map((m) => m[1]),
  ];
  for (const spec of specs) {
    let base;
    if (spec.startsWith('@/')) base = path.join(WEB, spec.slice(2));
    else base = path.resolve(path.dirname(path.join(ROOT, rel)), spec);
    for (const cand of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
      if (fs.existsSync(cand)) { out.add(path.relative(ROOT, cand)); break; }
    }
  }
  importsByFile.set(rel, out);
}

/** Ids reachable from a page file, following local imports (depth-limited). */
function reachableIds(entry, depth = 4, seen = new Set()) {
  if (depth < 0 || seen.has(entry)) return new Set();
  seen.add(entry);
  const out = new Set(idsByFile.get(entry) ?? []);
  for (const dep of importsByFile.get(entry) ?? []) {
    for (const id of reachableIds(dep, depth - 1, seen)) out.add(id);
  }
  return out;
}

/** Every local file a page pulls in, transitively — the page's render tree. */
function reachableFiles(entry, depth = 6, seen = new Set()) {
  if (depth < 0 || seen.has(entry)) return seen;
  seen.add(entry);
  for (const dep of importsByFile.get(entry) ?? []) reachableFiles(dep, depth - 1, seen);
  return seen;
}

/**
 * route → the files that render it: its page, and every layout that wraps it.
 *
 * The layouts are not a detail. Header and SiteFooter are mounted in
 * app/layout.tsx, not in any page — so a map built from page.tsx alone contains
 * neither, and a fragment link in the site navigation resolves against nothing
 * at all. The guard would then report "no page renders this file" for the two
 * components that render on every page of the site, which is both wrong and the
 * exact shape of error that teaches people to ignore a guard.
 *
 * Symmetrically, the ids CONTRIBUTED by the layouts belong to every page under
 * them: a link to a footer anchor is valid everywhere the footer is.
 */
const pageFileForRoute = new Map();
const layoutsForRoute = new Map();
(function walk(dir, seg, layouts) {
  const here = path.join(dir, 'layout.tsx');
  const chain = fs.existsSync(here) ? [...layouts, path.relative(ROOT, here)] : layouts;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'components' || e.name === 'api' || e.name.startsWith('_')) continue;
      walk(p, e.name.startsWith('(') ? seg : `${seg}/${e.name}`, chain);
    } else if (/^page\.tsx$/.test(e.name)) {
      const route = seg || '/';
      pageFileForRoute.set(route, path.relative(ROOT, p));
      layoutsForRoute.set(route, chain);
    }
  }
})(APP, '', []);

/** Every id a visitor can actually reach on this route — page tree plus chrome. */
function idsOnRoute(route) {
  const out = new Set();
  const pf = pageFileForRoute.get(route);
  if (pf) for (const id of reachableIds(pf)) out.add(id);
  for (const l of layoutsForRoute.get(route) ?? []) for (const id of reachableIds(l)) out.add(id);
  return out;
}

/**
 * Which pages actually render a given component.
 *
 * This is the whole point of the anchor check. A fragment link inside a shared
 * component is not right or wrong on its own — <PricingSection href="#quote">
 * is correct on the homepage, where id="quote" is a few hundred lines below it,
 * and it is a link to nowhere on any other page that renders the same section.
 * The component cannot know. Only the page can, and only by being asked.
 *
 * So: for every page, the set of files it renders; then a fragment inside a
 * component is checked once per page that renders it, and the error names the
 * page, which is the thing a human has to go and look at.
 */
const pagesRenderingFile = new Map();   // component file → [route, ...]
for (const [route, pageFile] of pageFileForRoute) {
  const rendered = new Set(reachableFiles(pageFile));
  for (const l of layoutsForRoute.get(route) ?? []) for (const f of reachableFiles(l)) rendered.add(f);
  for (const f of rendered) {
    if (!pagesRenderingFile.has(f)) pagesRenderingFile.set(f, []);
    pagesRenderingFile.get(f).push(route);
  }
}

/* ── 5. redirect sources, from the real config ───────────────────────────── */
/**
 * Ask next.config.js, do not read it.
 *
 * The commercial aliases — /stairs, /toronto-hardwood, /flooring-toronto and
 * three dozen more — are generated from an object at the top of that file, not
 * written out as literals. A regex over `source:` sees six rewrites and none of
 * the redirects, reports "no self-inflicted hops" with total confidence, and is
 * wrong about the only thing it was asked. So the config is required and its
 * redirects() is called: whatever Next will actually do is what gets checked.
 */
const redirectSources = new Set();
{
  const require_ = createRequire(path.join(WEB, 'next.config.js'));
  const cfg = require_(path.join(WEB, 'next.config.js'));
  const list = typeof cfg.redirects === 'function' ? await cfg.redirects() : [];
  if (!list.length) {
    console.error('verify-destinations: next.config.js returned no redirects — the guard is blind. Fix the reader.');
    process.exit(2);
  }
  for (const r of list) {
    // Host-conditioned rules only fire on the retired domain; they are not a
    // hop for anyone arriving on ecowoods.ca.
    if (Array.isArray(r.has) && r.has.some((h) => h.type === 'host')) continue;
    if (typeof r.source === 'string' && !r.source.includes(':') && !r.source.includes('(')) {
      redirectSources.add(r.source.replace(/\/+$/, '') || '/');
    }
  }
}

/* ── 6. collect and judge every link ─────────────────────────────────────── */
const LINK_PATTERNS = [
  // `href`, and any prop whose name ends in Href. A page that tells a shared
  // component where to send people — estimateHref="#estimate" — is making
  // exactly the same promise as an <a href>, on exactly the same page, and it
  // is checked the same way. Without this, moving a destination into a prop
  // would be a way to hide it from this guard.
  /\b[A-Za-z]*[Hh]ref=["'`]([^"'`{}\s]+)["'`]/g,   // JSX and HTML
  // The object-literal form: `{ label: 'Stairs', href: '/hardwood-stairs-toronto' }`.
  // This is not an edge case — it is how the entire site navigation is written.
  // Header.tsx alone declares 62 destinations this way and there are 130 in the
  // app. A scanner that only reads `href=` reads none of the chrome: it can
  // report several hundred links verified while never having looked at the
  // header or the footer, which are the links on every single page.
  /\b[A-Za-z]*[Hh]ref:\s*["'`]([^"'`]+)["'`]/g,
  /\]\(([^)\s]+)\)/g,                     // markdown
  /router\.(?:push|replace)\(\s*['"`]([^'"`]+)['"`]/g,
  /\bredirect\(\s*['"`](\/[^'"`]+)['"`]/g,
];

const failures = [];
const rows = [];
let checked = 0;

for (const [rel, src] of sources) {
  const seen = new Set();
  for (const re of LINK_PATTERNS) {
    for (const m of src.matchAll(re)) {
      const raw = m[1];
      if (seen.has(raw)) continue;
      seen.add(raw);
      if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('data:')) continue;
      // A template literal is not a link until it is interpolated; its shape is
      // checked by TypeScript, not by us.
      if (raw.includes('${')) continue;

      /* external */
      if (/^https?:\/\//i.test(raw)) {
        let host;
        try { host = new URL(raw).hostname; } catch { continue; }
        checked++;
        if (FORBIDDEN_HOST.test(host)) {
          failures.push([rel, raw, 'links to the retired domain — that host is being removed as a content host']);
          rows.push(['RETIRED', raw, rel]);
        } else if (!ALLOWED_EXTERNAL.has(host)) {
          failures.push([rel, raw, `external host "${host}" is not in ALLOWED_EXTERNAL`]);
          rows.push(['UNLISTED', raw, rel]);
        } else {
          rows.push(['ext ok', raw, rel]);
        }
        continue;
      }

      /* fragment-only: resolved per page that renders this file */
      if (raw.startsWith('#')) {
        checked++;
        const id = raw.slice(1);
        if (reachableIds(rel).has(id)) { rows.push(['frag ok', raw, rel]); continue; }
        const hosts = pagesRenderingFile.get(rel) ?? [];
        if (!hosts.length) {
          // Rendered by no page we can see — a layout partial, or dead code.
          // Fall back to the file's own tree, which we already know fails.
          failures.push([rel, raw, `no element with id="${id}" is rendered by this file, and no page renders this file`]);
          rows.push(['NO ANCHOR', raw, rel]);
          continue;
        }
        const broken = hosts.filter((route) => !idsOnRoute(route).has(id));
        if (broken.length) {
          failures.push([
            rel,
            raw,
            `renders no id="${id}" on ${broken.length} of the ${hosts.length} page(s) that use this component: ` +
              broken.slice(0, 6).join(', ') + (broken.length > 6 ? ` … +${broken.length - 6}` : '') +
              ' — on those pages the link scrolls nowhere',
          ]);
          rows.push(['NO ANCHOR', raw, rel]);
        } else rows.push(['frag ok', raw, rel]);
        continue;
      }

      if (!raw.startsWith('/')) continue;   // relative or template — out of scope
      checked++;

      const [rawPath, fragment] = raw.split('#');
      const p = (rawPath || '/').replace(/\/+$/, '') || '/';

      /* api and public assets */
      if (p.startsWith('/api/')) { rows.push(['api', raw, rel]); continue; }
      if (publicFiles.has(p)) { rows.push(['asset', raw, rel]); continue; }

      /* a link to one of our own alias redirects */
      if (redirectSources.has(p) && !staticRoutes.has(p)) {
        failures.push([rel, raw, `points at a redirect source — link to the canonical destination instead`]);
        rows.push(['REDIRECT', raw, rel]);
        continue;
      }

      let resolved = staticRoutes.has(p);
      let targetRoute = p;

      /* dynamic: the slug must be in the manifest, not merely match the shape */
      if (!resolved) {
        const seg = p.split('/');
        const prefix = seg.length >= 3 ? `/${seg[1]}` : null;
        const prefixMd = seg.length >= 4 && seg[1] === 'md' ? `/md/${seg[2]}` : null;
        const key = prefixMd ?? prefix;
        const slug = prefixMd ? seg[3] : seg[2];
        const man = key && MANIFESTS[key];
        if (man && seg.length === (prefixMd ? 4 : 3)) {
          if (man.slugs.has(slug)) {
            resolved = true;
            targetRoute = null;   // dynamic page — ids are per-slug, checked below
          } else {
            failures.push([rel, raw, `"${slug}" is in no manifest — ${man.source} does not generate this page, so it 404s`]);
            rows.push(['NO SLUG', raw, rel]);
            continue;
          }
        }
      }

      if (!resolved) {
        failures.push([rel, raw, 'no route, no public file, no manifest entry']);
        rows.push(['NO ROUTE', raw, rel]);
        continue;
      }

      /* cross-page fragment */
      if (fragment && targetRoute) {
        if (pageFileForRoute.has(targetRoute)) {
          const ids = idsOnRoute(targetRoute);
          if (!ids.has(fragment)) {
            failures.push([rel, raw, `${targetRoute} renders no id="${fragment}" — this lands at the top of the page`]);
            rows.push(['NO ANCHOR', raw, rel]);
            continue;
          }
        }
      }
      rows.push(['ok', raw, rel]);
    }
  }
}

if (LIST) {
  for (const [verdict, link, file] of rows.sort((a, b) => a[1].localeCompare(b[1]))) {
    console.log(`  ${verdict.padEnd(10)} ${link.padEnd(64)} ${file}`);
  }
  console.log('');
}

if (failures.length) {
  console.error(`✗ destinations: ${failures.length} link(s) do not land where they claim\n`);
  for (const [file, link, why] of failures) {
    console.error(`  ${link}`);
    console.error(`      in ${file}`);
    console.error(`      ${why}\n`);
  }
  process.exit(1);
}

const counts = rows.reduce((a, [v]) => ((a[v] = (a[v] ?? 0) + 1), a), {});
console.log(
  `✓ destinations verified — ${checked} link(s) resolved: ` +
    `${staticRoutes.size} static route(s), ` +
    `${Object.values(MANIFESTS).length} manifest(s), ` +
    `${counts['frag ok'] ?? 0} same-page anchor(s), ` +
    `${counts['ext ok'] ?? 0} external link(s); no 404, no redirect hop, no retired domain`,
);
