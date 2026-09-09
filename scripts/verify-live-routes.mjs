#!/usr/bin/env node
/**
 * scripts/verify-live-routes.mjs — every route this repository defines,
 * fetched from production.
 *
 * WHY THIS EXISTS, AND THE WEEK THAT PRODUCED IT
 *
 * On 2026-09-09 the live site was serving a build that was two features old.
 * `pnpm build` had reported 331 pages. `vercel --prod` had reported
 * `✓ Ready` and `▲ Aliased https://ecowoods.ca`. Every guard was green, every
 * test passed, and /quote-check — which had been live and confirmed 200 hours
 * earlier — was returning 404 to every visitor and every crawler.
 *
 * The cause was mundane: a Git integration was deploying `main` to production
 * on every push, and `main` did not contain the work. It took the alias back
 * within minutes of each CLI deploy. Nothing in the repository could see that,
 * because everything in the repository was correct.
 *
 * That is the shape of the whole class. A deploy pipeline can report success
 * and serve something else, and the only way to know is to ask the live site
 * what it has. Not one URL as a smoke test — verify-live.sh already proves a
 * sample, and a sample is exactly what let this run for a week — but EVERY
 * public route the source defines.
 *
 * WHAT IT DOES
 *
 * Walks apps/web/app for page.tsx, expands each dynamic segment from the same
 * manifests that generate it, adds every endpoint declared in the API manifest,
 * and fetches all of them from the live host. Any route the repository defines
 * and production does not serve is a failure, named.
 *
 * It reaches the network, so it is not in `pnpm verify`. It runs after a
 * deploy, which is the only moment it can tell you anything:
 *
 *   pnpm verify:live-routes
 *   node scripts/verify-live-routes.mjs --base https://ecowoods.ca
 *   node scripts/verify-live-routes.mjs --all      # every slug, not one per route
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const APP = join(WEB, 'app');

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = (argOf('--base', process.env.SITE_URL ?? 'https://ecowoods.ca')).replace(/\/$/, '');
const ALL = process.argv.includes('--all');
const CB = Date.now();

/* ── routes from source ──────────────────────────────────────────────────── */

const PRIVATE = /^\/(admin|mypage|login|register|verify-email|docs)\b/;
const routes = [];
(function walk(dir, url) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p, /^\(.*\)$/.test(name) ? url : `${url}/${name}`);
    } else if (name === 'page.tsx') {
      routes.push(url === '' ? '/' : url);
    } else if (name === 'route.ts' && !url.startsWith('/api')) {
      /*
       * The markdown twins under /md/ and the machine files (/llms.txt,
       * /ai.txt, /feed.xml) are route handlers, not pages. Walking only
       * page.tsx made every one of them invisible to this check — which is
       * forty-nine URLs that exist precisely so machines can read them, and
       * exactly the surface this file was written to protect.
       */
      routes.push(url === '' ? '/' : url);
    }
  }
})(APP, '');

/* ── the slug manifests, read the way the pages read them ────────────────── */

const slugsFromFile = (rel, key = 'slug') => {
  const p = join(WEB, rel);
  if (!existsSync(p)) return [];
  const re = new RegExp(`\\b${key}:\\s*['"\`]([a-z0-9-]+)['"\`]`, 'g');
  return [...new Set([...readFileSync(p, 'utf8').matchAll(re)].map((m) => m[1]))];
};
const slugsFromDir = (rel, key = 'slug') => {
  const d = join(WEB, rel);
  if (!existsSync(d)) return [];
  const out = new Set();
  for (const f of readdirSync(d)) {
    const full = join(d, f);
    if (statSync(full).isDirectory()) continue;
    if (/\.mdx?$/.test(f)) { out.add(f.replace(/\.mdx?$/, '')); continue; }
    if (!/\.tsx?$/.test(f)) continue;
    const re = new RegExp(`\\b${key}:\\s*['"\`]([a-z0-9-]+)['"\`]`, 'g');
    for (const m of readFileSync(full, 'utf8').matchAll(re)) out.add(m[1]);
  }
  return [...out];
};

/*
 * Service areas are plain place names in two arrays, not `slug:` entries — and
 * reading lib/seo-data.ts for `slug:` picks up the SERVICES list instead,
 * which is how the first run of this file asked production for
 * /service-areas/hardwood-installation. Slugify the names the way the page does.
 */
const serviceAreaSlugs = () => {
  const src = existsSync(join(WEB, 'lib/seo-data.ts'))
    ? readFileSync(join(WEB, 'lib/seo-data.ts'), 'utf8')
    : '';
  const names = [];
  for (const block of ['AREAS', 'NEIGHBOURHOODS']) {
    const m = new RegExp(`const ${block} = \\[([\\s\\S]*?)\\];`).exec(src);
    if (m) names.push(...[...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  }
  return [
    ...new Set(
      names.map((n) =>
        n.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      ),
    ),
  ];
};

const MANIFESTS = {
  '/services/[slug]': slugsFromFile('lib/service-pages.ts'),
  '/guides/[slug]': slugsFromFile('lib/guides.ts'),
  '/papers/[slug]': slugsFromFile('lib/papers.ts'),
  '/glossary/[slug]': slugsFromFile('lib/glossary.ts'),
  '/service-areas/[city]': serviceAreaSlugs(),
  '/blog/[slug]': slugsFromDir('content/articles'),
  '/case-studies/[slug]': slugsFromDir('content/case-studies'),
  '/projects/[slug]': slugsFromDir('content/projects'),
  '/equipment/[id]': slugsFromDir('content/equipment', 'id'),
  '/corridors/[id]': slugsFromDir('content/geo', 'id'),
  '/md/guides/[slug]': slugsFromFile('lib/guides.ts'),
  '/md/papers/[slug]': slugsFromFile('lib/papers.ts'),
  '/md/glossary/[slug]': slugsFromFile('lib/glossary.ts'),
  '/md/services/[slug]': slugsFromFile('lib/service-pages.ts'),
  '/md/service-areas/[slug]': serviceAreaSlugs(),
  '/md/commercial/[slug]': slugsFromFile('lib/service-pages.ts'),
};

const unexpanded = [];
const targets = new Set();

for (const r of routes) {
  if (PRIVATE.test(r) || r.startsWith('/api')) continue;
  if (!r.includes('[')) { targets.add(r); continue; }
  const slugs = MANIFESTS[r];
  if (!slugs || !slugs.length) { unexpanded.push(r); continue; }
  const use = ALL ? slugs : slugs.slice(0, 1);
  const seg = r.replace(/\[[^\]]+\]/, '%%');
  for (const s of use) targets.add(seg.replace('%%', s));
}

/* ── the API surface, from the same manifest the OpenAPI is generated from ─ */
const apiManifest = existsSync(join(WEB, 'lib/registry/manifest.ts'))
  ? readFileSync(join(WEB, 'lib/registry/manifest.ts'), 'utf8')
  : '';
const SAMPLE_ID = { '{id}': 'hardwood-installation', '{topic}': 'moisture', '{slug}': 'moisture' };
for (const m of apiManifest.matchAll(/\{\s*path:\s*'([^']+)',\s*method:\s*'GET'/g)) {
  let p = m[1];
  if (p.includes('{')) {
    if (p.startsWith('/equipment')) p = p.replace('{id}', 'laegler-hummel');
    else if (p.startsWith('/media')) continue;               // ids are opaque
    else if (p.startsWith('/evidence')) continue;
    else if (p.startsWith('/locations')) p = p.replace('{id}', 'toronto');
    else if (p.startsWith('/pricing')) continue;
    else for (const [k, v] of Object.entries(SAMPLE_ID)) p = p.replace(k, v);
  }
  if (p.includes('{')) continue;
  targets.add(`/api/v1${p === '/' ? '' : p}`);
}

/* Machine surfaces that are not pages. */
for (const f of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/ai.txt', '/feed.xml']) {
  targets.add(f);
}

const list = [...targets].sort();

/*
 * --list prints what would be fetched and exits. It is how this file is
 * developed and reviewed in an environment with no egress: the enumeration is
 * the half that can be wrong quietly, and it is checkable offline.
 */
if (process.argv.includes('--list')) {
  console.log(`\n${list.length} route(s) would be fetched from ${BASE}:\n`);
  for (const p of list) console.log(`  ${p}`);
  if (unexpanded.length) console.log(`\nnot expanded: ${unexpanded.join(', ')}`);
  console.log('');
  process.exit(0);
}

/* ── fetch ───────────────────────────────────────────────────────────────── */

async function head(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}cb=${CB}`;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': 'ecowoods-route-parity/1' } });
    return { status: res.status, id: res.headers.get('x-vercel-id') };
  } catch (e) {
    return { status: 0, error: String(e).slice(0, 80) };
  }
}

const results = [];
const queue = [...list];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      results.push({ path: p, ...(await head(p)) });
    }
  }),
);

const bad = results.filter((r) => r.status !== 200 && r.status !== 304).sort((a, b) => a.path.localeCompare(b.path));
const deployments = new Set(results.map((r) => (r.id ?? '').split('::')[1]?.split('-')[0]).filter(Boolean));

console.log(`\nROUTE PARITY  ${BASE}\n`);
console.log(`  ${list.length} route(s) defined in this repository${ALL ? '' : ' (one slug per dynamic route; --all for every slug)'}`);
if (unexpanded.length) {
  console.log(`  ${unexpanded.length} dynamic route(s) could not be expanded and were skipped: ${unexpanded.join(', ')}`);
}

if (!bad.length) {
  console.log(`\n✓ route parity verified — all ${list.length} routes serve 200 from the live host\n`);
  process.exit(0);
}

console.error(`\n✗ ${bad.length} of ${list.length} route(s) defined here do not serve from ${BASE}:\n`);
for (const r of bad) console.error(`  ${String(r.status).padStart(3)}  ${r.path}${r.error ? `  (${r.error})` : ''}`);
console.error(
  '\n  Every one of these exists in this repository and returns 200 on `next start`. If they 404 in\n' +
    '  production, the deployment serving the site is not the code you built. Check which deployment\n' +
    '  owns the alias, and which branch the Git integration deploys:\n\n' +
    '      vercel inspect ' + BASE.replace(/^https?:\/\//, '') + '\n' +
    '      curl -sI ' + BASE + bad[0].path + ' | grep -i x-vercel-id\n\n' +
    '  docs/DEPLOY.md has the branch rules and why this file exists.\n',
);
if (deployments.size > 1) {
  console.error(`  NOTE: responses came from more than one deployment id — the alias moved while this ran.\n`);
}
process.exit(1);
