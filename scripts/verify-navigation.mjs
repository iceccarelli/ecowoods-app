#!/usr/bin/env node
/**
 * verify-navigation.mjs — can a person actually GET there?
 *
 * WHAT THIS ADDS THAT verify-links.mjs DOES NOT
 *
 * verify-links proves no route is an ORPHAN: every public route has at least
 * one inbound link from somewhere. That is a necessary condition and a weak
 * one. A page linked only from a page that is itself linked only from a page
 * buried four levels down is not an orphan and is not reachable either — it is
 * findable by a crawler and invisible to a person.
 *
 * So this measures DEPTH. It builds the real link graph from the rendered
 * source, starts at the homepage plus the persistent chrome (header and
 * footer, which appear on every page and are therefore depth 0), and reports
 * the shortest click path to every public route.
 *
 * THE RULE
 *
 *   Every public route is reachable within MAX_DEPTH clicks of the homepage,
 *   counting the chrome as free.
 *
 * Three clicks is the budget. Homepage → hub → page is two; a third allows a
 * detail page under a hub (a city under /service-areas, a paper under
 * /papers). A route needing four is a route somebody will never find, and the
 * fix is a link, not a bigger budget.
 *
 * IT ALSO CHECKS THE CHROME ITSELF
 *
 *   · every href in the header and footer resolves to a route that exists,
 *     an on-page anchor, a tel:/mailto:, or an external URL
 *   · no two chrome entries carry the same label pointing at different routes,
 *     which is how a nav quietly teaches people that a word means two things
 *
 * Dependency-free and connectionless, like the rest of the pre-build gate.
 *
 * Run:  pnpm verify:navigation
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'apps/web/app');
const MAX_DEPTH = 3;

const CHROME = [
  join(APP, 'components/Header.tsx'),
  join(APP, 'components/SiteFooter.tsx'),
];

if (!existsSync(APP)) {
  console.error('✗ apps/web/app not found — run from the repo root');
  process.exit(1);
}

/* ── the route table ─────────────────────────────────────────────────────── */

const PRIVATE = /^\/(admin|mypage|login|register|verify-email|docs|api)\b/;

const routes = new Set();
/** Real URLs that are valid link targets but are not browsable pages. */
const served = new Set();
/** Behind a login. They exist; they are simply not part of public reachability. */
const authedRoutes = new Set();
(function walk(dir, url) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      /* (groups) do not appear in the URL. */
      const seg = /^\(.*\)$/.test(name) ? url : `${url}/${name}`;
      walk(p, seg);
    } else if (name === 'page.tsx') {
      const u = url === '' ? '/' : url;
      if (PRIVATE.test(u)) authedRoutes.add(u);
      else routes.add(u);
    } else if (name === 'route.ts' && !url.startsWith('/api')) {
      /* A route handler is a real URL a person can be sent to — /feed.xml,
         /llms.txt, the /md twins. It is a valid LINK TARGET, but it is not a
         page and is not required to be reachable by clicking. */
      served.add(url === '' ? '/' : url);
    }
  }
})(APP, '');

/* Dynamic segments are represented by their pattern; a link to any concrete
   instance satisfies them, so they are matched loosely below. */
const isDynamic = (r) => r.includes('[');
const dynamicToRe = (r) =>
  new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+').replace(/\//g, '\\/')}$`);

/* ── the link graph ──────────────────────────────────────────────────────── */

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
  }
})(join(ROOT, 'apps/web'));

const hrefsIn = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/href=["'`](\/[^"'`\s{}]*)["'`]/g)) out.add(m[1].split('#')[0].split('?')[0] || '/');
  for (const m of src.matchAll(/href=\{`(\/[^`${]*)/g)) out.add(m[1].replace(/\/$/, '') || '/');
  return out;
};

/** Which route does this source file render? Only page.tsx files own a route. */
const routeOfFile = (p) => {
  const r = relative(APP, p);
  if (!r.endsWith('page.tsx') || r.startsWith('..')) return null;
  const url = '/' + r.replace(/\/?page\.tsx$/, '').split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
  return url === '/' ? '/' : url.replace(/\/$/, '');
};

/* Components are attributed to nothing; their links are only reachable from
   wherever they are rendered. Rather than resolve the render tree — which is
   where a static analysis becomes a lie — every non-page file's links are
   attributed to every page that imports it, transitively one level, which is
   how these pages are actually composed. */
const componentLinks = new Map();
const pageLinks = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const route = routeOfFile(f);
  if (route) pageLinks.set(route, hrefsIn(src));
  else componentLinks.set(f, { links: hrefsIn(src), src });
}

for (const [route] of pageLinks) {
  const pageFile = files.find((f) => routeOfFile(f) === route);
  if (!pageFile) continue;
  const src = readFileSync(pageFile, 'utf8');
  for (const [cf, { links }] of componentLinks) {
    const base = cf.split('/').pop().replace(/\.tsx?$/, '');
    if (new RegExp(`\\b${base}\\b`).test(src)) {
      const set = pageLinks.get(route);
      for (const l of links) set.add(l);
    }
  }
}

/* ── chrome ──────────────────────────────────────────────────────────────── */

const chromeLinks = new Set();
const chromeLabels = new Map();
for (const f of CHROME) {
  if (!existsSync(f)) {
    console.error(`✗ chrome file missing: ${relative(ROOT, f)}`);
    process.exit(1);
  }
  const src = readFileSync(f, 'utf8');
  for (const l of hrefsIn(src)) chromeLinks.add(l);
  for (const m of src.matchAll(/label:\s*'([^']+)',\s*href:\s*'([^']+)'/g)) {
    const [, label, href] = m;
    /*
     * The mega-menus are data, not JSX: `{ label: 'Sanding equipment', href:
     * '/equipment' }`. hrefsIn() only sees `href="/x"` in markup, so for the
     * reachability graph the entire header menu did not exist — a route linked
     * from nothing but the menu was reported as unreachable, and a route linked
     * from nowhere at all would have been reported the same way. The distinction
     * this guard exists to make was invisible for every entry in the menu.
     */
    chromeLinks.add(href.split('#')[0].split('?')[0] || '/');
    const seen = chromeLabels.get(label);
    if (seen && seen !== href) {
      console.error(`✗ chrome label "${label}" points at both ${seen} and ${href}. One word, one destination.`);
      process.exitCode = 1;
    }
    chromeLabels.set(label, href);
  }
}

const errors = [];
const resolves = (href) => {
  if (href === '/') return true;
  if (routes.has(href) || served.has(href) || authedRoutes.has(href)) return true;
  for (const r of routes) if (isDynamic(r) && dynamicToRe(r).test(href)) return true;
  return false;
};

/* A template-literal link is captured up to its first interpolation, so a link
   written href={`/blog/${slug}`} arrives here as "/blog/". That prefix is
   exactly what proves the dynamic route beneath it is linked. */
const satisfiesDynamic = (href, route) => {
  if (!isDynamic(route)) return false;
  if (dynamicToRe(route).test(href)) return true;
  const prefix = route.slice(0, route.indexOf('['));
  return href === prefix || `${href}/` === prefix;
};

for (const href of chromeLinks) {
  if (!resolves(href)) errors.push(`chrome links to ${href}, which is not a route.`);
}

/* ── breadth-first over the graph ────────────────────────────────────────── */

const depth = new Map([['/', 0]]);
for (const l of chromeLinks) if (resolves(l)) depth.set(l, 1);

let frontier = [...depth.keys()];
for (let d = 1; d <= MAX_DEPTH && frontier.length; d++) {
  const next = [];
  for (const from of frontier) {
    for (const to of pageLinks.get(from) ?? []) {
      if (!resolves(to) || depth.has(to)) continue;
        depth.set(to, d + 1);
      next.push(to);
    }
    /* A concrete link satisfies the dynamic route it instantiates. */
    for (const to of pageLinks.get(from) ?? []) {
      for (const r of routes) {
        if (!depth.has(r) && satisfiesDynamic(to, r)) {
          depth.set(r, d + 1);
          next.push(r);
        }
      }
    }
  }
  frontier = next;
}

/* TWO KINDS OF ROUTE ARE UNREACHABLE ON PURPOSE, AND BOTH ALREADY SAY SO IN
   THE REPOSITORY. Rather than invent a second waiver list, this reads the one
   verify-links.mjs already uses, and honours a page's own robots directive.

   · scripts/links-baseline.json — a documented reason per path. /r is the
     example worth reading: it is a QR-code destination on a printed card, and
     putting "leave us a review" in the footer would show it to people who have
     not hired us yet.
   · metadata.robots index:false — a page that tells search engines not to list
     it is not a page we then require the navigation to advertise. /design/spec
     is an output of the configurator, not a destination.  */
const waivers = existsSync(join(ROOT, 'scripts/links-baseline.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'scripts/links-baseline.json'), 'utf8'))
  : {};

const noindex = new Set();
for (const f of files) {
  const r = routeOfFile(f);
  if (!r) continue;
  const src = readFileSync(f, 'utf8');
  if (/robots:\s*\{[^}]*index:\s*false/.test(src)) noindex.add(r);
}

const unreachable = [...routes].filter(
  (r) => !depth.has(r) && !(r in waivers) && !noindex.has(r),
);

if (unreachable.length) {
  errors.push(
    `${unreachable.length} route(s) are more than ${MAX_DEPTH} clicks from the homepage:\n` +
      unreachable.map((r) => `      ${r}`).join('\n') +
      '\n    Link them from the header, the footer, or a hub that already is.',
  );
}

if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ navigation: ${errors.length} problem(s)`);
  process.exit(1);
}

const routeDepths = [...routes].map((r) => depth.get(r)).filter((d) => d !== undefined);
const byDepth = [0, 1, 2, 3].map((d) => routeDepths.filter((v) => v === d).length);
console.log(
  `✓ navigation verified — ${routes.size} public route(s), all within ${MAX_DEPTH} clicks ` +
    `(chrome ${byDepth[1]}, depth-2 ${byDepth[2]}, depth-3 ${byDepth[3]}), chrome hrefs all resolve, no duplicate labels`,
);
