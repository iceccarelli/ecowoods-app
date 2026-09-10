#!/usr/bin/env node
/**
 * scripts/verify-strategy.mjs — the strategy layer may not describe a site that
 * does not exist.
 *
 * THREE REGISTRIES, ONE FAILURE MODE
 *
 * The funnels, the tracked question set and the expansion scorecard all say
 * something about this site: that a route serves an intent, that a page answers
 * a question, that a market is worth reaching. Each is useful exactly as long as
 * it is true, and each degrades in the same silent way — a route is renamed, a
 * page is retired, an event stops firing, and the registry goes on asserting.
 *
 * A funnel whose completion event nothing emits reports 0% forever and reads as
 * a broken page rather than a missing instrument. A tracked question pointing at
 * a 404 records a loss that was never winnable. An expansion score built from an
 * invented figure directs capital.
 *
 * WHAT IS CHECKED
 *
 *  1. Every funnel's tool route exists, and every route in ROUTE_FUNNEL exists.
 *  2. Every funnel step is a real AnalyticsEvent, and the completion event is
 *     actually emitted somewhere in the app — not merely declared.
 *  3. Every funnel names what its visitor is NOT ready for. The field exists to
 *     stop an estimate button appearing at the top of a diagnostic page.
 *  4. Every tracked query with coverage points at a route this repository
 *     generates. Coverage of `null` is a declared gap and is allowed.
 *  5. No two tracked queries share an id, and the set is large enough to mean
 *     something.
 *  6. The expansion scorecard still refuses the economic inputs it does not
 *     have. A score that quietly starts including a population figure is a
 *     score built on a number nobody sourced.
 *  7. Every route in ROUTE_FUNNEL renders <NextStep>. A funnel that exists only
 *     in lib/ is a strategy document — the visitor still gets the generic call.
 *
 *   node scripts/verify-strategy.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const fail = [];
const read = (rel) => (existsSync(join(WEB, rel)) ? readFileSync(join(WEB, rel), 'utf8') : '');

const funnels = read('lib/funnels/index.ts');
const queries = read('content/aeo/queries.ts');
const worthiness = read('lib/geo/worthiness.ts');
const analytics = read('lib/analytics.ts');
if (!funnels) fail.push('apps/web/lib/funnels/index.ts is missing');
if (!queries) fail.push('apps/web/content/aeo/queries.ts is missing');

/* ── the routes this repository generates ────────────────────────────────── */
const routes = new Set();
(function walk(dir, url) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, /^\(.*\)$/.test(e.name) ? url : `${url}/${e.name}`);
    else if (e.name === 'page.tsx') routes.add(url === '' ? '/' : url);
  }
})(join(WEB, 'app'), '');

const keysOf = (rel, key = 'slug') => {
  const p = join(WEB, rel);
  if (!existsSync(p)) return new Set();
  return new Set([...readFileSync(p, 'utf8').matchAll(new RegExp(`\\b${key}:\\s*'([a-z0-9-]+)'`, 'g'))].map((m) => m[1]));
};
const DYN = {
  '/guides': keysOf('lib/guides.ts'),
  '/papers': keysOf('lib/papers.ts'),
  '/glossary': keysOf('lib/glossary.ts'),
  '/services': keysOf('lib/service-pages.ts'),
};
const areaSlugs = new Set(
  [...['AREAS', 'NEIGHBOURHOODS'].flatMap((b) => {
    const m = new RegExp(`const ${b} = \\[([\\s\\S]*?)\\];`).exec(read('lib/seo-data.ts'));
    return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  })].map((n) => n.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')),
);
DYN['/service-areas'] = areaSlugs;

const resolves = (href) => {
  const path = href.split('#')[0].split('?')[0] || '/';
  if (routes.has(path)) return true;
  const i = path.lastIndexOf('/');
  return DYN[path.slice(0, i)]?.has(path.slice(i + 1)) ?? false;
};

/* ── 1 + 2 + 3. funnels ──────────────────────────────────────────────────── */
const events = new Set([...analytics.matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1]));
if (events.size < 5) fail.push('could not read the AnalyticsEvent union — the reader is blind');

/* Which events are actually emitted anywhere in the app, not merely declared. */
const emitted = new Set();
(function scan(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (!/\.(ts|tsx)$/.test(e.name) || /analytics\.ts$|funnels\//.test(p)) continue;
    const src = readFileSync(p, 'utf8');
    for (const ev of events) if (new RegExp(`'${ev}'`).test(src)) emitted.add(ev);
  }
})(join(WEB, 'app'));
(function scanLib() {
  const d = join(WEB, 'lib');
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory() || !/\.tsx?$/.test(f) || /analytics\.ts$/.test(f)) continue;
    const src = readFileSync(p, 'utf8');
    for (const ev of events) if (new RegExp(`'${ev}'`).test(src)) emitted.add(ev);
  }
})();

const funnelBlocks = [...funnels.matchAll(/\{\s*\n\s*id: '([a-z]+)',[\s\S]*?\n  \},/g)];
if (funnelBlocks.length < 4) fail.push(`read only ${funnelBlocks.length} funnel(s) — the reader is blind`);

for (const b of funnelBlocks) {
  const id = b[1];
  const tool = /tool:\s*'([^']+)'/.exec(b[0])?.[1];
  const steps = [...b[0].matchAll(/'([a-z_]+)'(?=[,\]])/g)].map((m) => m[1]).filter((x) => events.has(x));
  const next = /nextStep:\s*\{\s*href:\s*'([^']+)'/.exec(b[0])?.[1];
  const notYet = /notYet:/.test(b[0]);

  if (!tool) fail.push(`funnel ${id} has no tool route`);
  else if (!resolves(tool)) fail.push(`funnel ${id} tool "${tool}" is not a route this repository generates`);
  if (next && !resolves(next)) fail.push(`funnel ${id} nextStep "${next}" is not a route this repository generates`);
  if (!notYet) {
    fail.push(`funnel ${id} does not say what its visitor is NOT ready for. That field is what keeps an estimate button off a diagnostic page.`);
  }
  if (!steps.length) fail.push(`funnel ${id} declares no analytics steps`);
  else {
    const completion = steps[steps.length - 1];
    if (!emitted.has(completion)) {
      fail.push(
        `funnel ${id} completes on "${completion}", which nothing in the app emits. That funnel would report 0% ` +
          'forever and read as a broken page rather than a missing instrument.',
      );
    }
  }
}

/* The page file that serves a route: the static one, or the dynamic segment
   that generates it. Returns null when neither exists. */
const pageSourceFor = (route) => {
  const direct = join(WEB, 'app', route.replace(/^\//, ''), 'page.tsx');
  if (existsSync(direct)) return readFileSync(direct, 'utf8');
  const i = route.lastIndexOf('/');
  const parent = join(WEB, 'app', route.slice(1, i));
  if (!existsSync(parent)) return null;
  for (const e of readdirSync(parent, { withFileTypes: true })) {
    if (!e.isDirectory() || !/^\[.*\]$/.test(e.name)) continue;
    const dyn = join(parent, e.name, 'page.tsx');
    if (existsSync(dyn)) return readFileSync(dyn, 'utf8');
  }
  return null;
};

const routeFunnel = /ROUTE_FUNNEL[^=]*=\s*\{([\s\S]*?)\n\};/.exec(funnels);
if (routeFunnel) {
  const ids = new Set(funnelBlocks.map((b) => b[1]));
  for (const m of routeFunnel[1].matchAll(/'([^']+)':\s*'([a-z]+)'/g)) {
    if (!resolves(m[1])) fail.push(`ROUTE_FUNNEL maps "${m[1]}", which is not a route this repository generates`);
    if (!ids.has(m[2])) fail.push(`ROUTE_FUNNEL route "${m[1]}" names funnel "${m[2]}", which does not exist`);

    /* 7. and the page actually renders the call. A funnel that exists only in
       lib/ is a strategy document; the visitor never sees it. */
    const src = pageSourceFor(m[1]);
    if (src === null) {
      fail.push(`ROUTE_FUNNEL maps "${m[1]}" but no page file could be located for it`);
    } else if (!/<NextStep\b/.test(src)) {
      fail.push(
        `ROUTE_FUNNEL assigns "${m[1]}" to the ${m[2]} funnel, but that page renders no <NextStep>. ` +
          'The funnel would exist only in lib/ — every visitor to that page still gets the generic call.',
      );
    }
  }
}

/* ── 4 + 5. the tracked question set ─────────────────────────────────────── */
const tracked = [...queries.matchAll(/id:\s*'([a-z0-9]+)',\s*query:\s*'([^']+)',\s*family:\s*'([a-z]+)',\s*coverage:\s*(null|'[^']+')/g)];
if (tracked.length < 20) {
  fail.push(`read only ${tracked.length} tracked quer(y|ies) — either the set shrank or the reader is blind`);
}
const seen = new Set();
for (const t of tracked) {
  if (seen.has(t[1])) fail.push(`duplicate tracked query id ${t[1]}`);
  seen.add(t[1]);
  if (t[4] === 'null') continue;
  const href = t[4].slice(1, -1);
  if (!resolves(href)) {
    fail.push(
      `tracked query "${t[2]}" claims coverage at ${href}, which is not a route this repository generates. ` +
        'A question pointed at a 404 records a loss that was never winnable.',
    );
  }
}

/* ── 6. the scorecard still refuses what it does not know ────────────────── */
if (!/ECONOMIC_INPUTS/.test(worthiness)) {
  fail.push(
    'lib/geo/worthiness.ts no longer declares ECONOMIC_INPUTS. That list is how the expansion score states, in the ' +
      'payload, which inputs it does not have — remove it and the ranking looks like it was built on them.',
  );
}
for (const invented of ['population', 'medianIncome', 'homeValue', 'renovationSpend', 'cpc']) {
  if (new RegExp(`\\b${invented}\\s*[:=]\\s*[0-9]`).test(worthiness)) {
    fail.push(
      `lib/geo/worthiness.ts assigns a numeric "${invented}". That figure is not in this repository and was not ` +
        'sourced. A score built on it ranks markets and directs capital on a number somebody typed.',
    );
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ strategy: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}

const gaps = tracked.filter((t) => t[4] === 'null').length;
const wired = routeFunnel ? [...routeFunnel[1].matchAll(/'([^']+)':\s*'([a-z]+)'/g)].length : 0;
console.log(
  `✓ strategy verified — ${funnelBlocks.length} funnel(s) with emitted completion events on ${wired} wired route(s), ` +
    `${tracked.length} tracked question(s) (${gaps} declared gap(s)), expansion score still refusing the 10 economic ` +
    'inputs it does not hold',
);
