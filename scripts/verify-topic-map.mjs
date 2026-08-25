#!/usr/bin/env node
/**
 * scripts/verify-topic-map.mjs — the query map points at pages that exist.
 *
 *   pnpm seo:topics
 *
 * WHAT BREAKS WITHOUT THIS
 *
 * content/search/route-aliases.json declares that thirty-odd keyword-variant
 * slugs permanently redirect to a canonical page, and next.config.js builds its
 * redirect table straight from that file. A destination that does not resolve
 * therefore produces the single worst outcome available here: a permanent
 * redirect into a 404. It is worse than no redirect at all — a 404 that a
 * crawler was told to treat as the permanent home of a URL removes both URLs
 * from the index, and the failure is invisible from inside the repository
 * because the config is syntactically perfect.
 *
 * THE FOUR CHECKS
 *
 *   1. Every alias destination resolves to a real route — a static page
 *      directory, or a dynamic segment whose data source actually contains
 *      that slug. `/guides/white-oak-flooring-toronto` is only real if
 *      lib/guides.ts has that slug in it, and this checks.
 *   2. No alias key collides with a real route. A redirect declared for a path
 *      that also has a page.tsx shadows the page: the page becomes
 *      unreachable, silently, and the only symptom is a URL that used to work.
 *   3. No alias points at another alias. A redirect chain costs signal at every
 *      hop and is trivially introduced by moving a canonical.
 *   4. Every canonical in the cluster map resolves, and no two clusters with
 *      DIFFERENT intents share one canonical — which is the cannibalisation
 *      check. Two clusters may legitimately share a page when the intent is the
 *      same; a commercial cluster and a technical cluster pointing at one URL
 *      means one of them has no page.
 *
 * Like every guard here it runs on bare `node`, parses TypeScript as text, and
 * FAILS rather than skips when it cannot find what it is meant to check.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const APP = join(WEB, 'app');
const ALIASES = 'apps/web/content/search/route-aliases.json';
const TOPIC_MAP = 'apps/web/content/search/topic-map.ts';

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const fail = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };

/* ── real static routes ───────────────────────────────────────────────────── */
const SKIP_DIR = new Set(['node_modules', '.next', '.git']);
function pageRoutes(dir, segs = [], out = new Set()) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const seg = (name.startsWith('(') && name.endsWith(')')) || name.startsWith('@') ? null : name;
      pageRoutes(full, seg === null ? segs : [...segs, seg], out);
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(name)) {
      out.add('/' + segs.join('/'));
    }
  }
  return out;
}
const routes = pageRoutes(APP);
if (routes.size < 10) fail(`Found only ${routes.size} route(s) under apps/web/app. Something is wrong with this scan, and a guard that scans nothing passes everything.`);

/* ── dynamic-segment data sources ─────────────────────────────────────────── */
const slugsIn = (file) =>
  new Set([...read(join(WEB, file)).matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

const mdxSlugs = (dir) => {
  try {
    return new Set(readdirSync(join(WEB, dir)).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, '')));
  } catch { return new Set(); }
};

const DYNAMIC = {
  '/guides': slugsIn('lib/guides.ts'),
  '/papers': slugsIn('lib/papers.ts'),
  '/glossary': slugsIn('lib/glossary.ts'),
  '/services': slugsIn('lib/service-pages.ts'),
  '/case-studies': mdxSlugs('content/case-studies'),
  '/blog': mdxSlugs('content/articles'),
  '/service-areas': null, // generated from SERVICE_AREAS; presence checked separately
};

const areaSlugs = new Set(
  [...read(join(WEB, 'lib/seo-data.ts')).matchAll(/'([^']+)'/g)]
    .map((m) => m[1].toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')),
);
DYNAMIC['/service-areas'] = areaSlugs;

function resolves(route) {
  if (routes.has(route)) return true;
  const i = route.lastIndexOf('/');
  const parent = route.slice(0, i);
  const slug = route.slice(i + 1);
  const src = DYNAMIC[parent];
  if (src && src.has(slug)) return true;
  return false;
}

/* ── load the alias table ─────────────────────────────────────────────────── */
let aliases;
try {
  aliases = JSON.parse(read(join(ROOT, ALIASES))).aliases;
} catch (e) {
  fail(`${ALIASES} is missing or not valid JSON — next.config.js require()s it, so the build would fail too.\n  ${e}`);
}
if (!aliases || Object.keys(aliases).length === 0) {
  fail(`${ALIASES} declares zero aliases. Every check below would pass over nothing.`);
}

const problems = [];

for (const [from, to] of Object.entries(aliases)) {
  if (!resolves(to)) {
    problems.push({
      what: `${from} → ${to}`,
      why: 'destination does not resolve — this redirect is a permanent 308 into a 404, which removes BOTH urls from the index',
    });
  }
  if (routes.has(from)) {
    problems.push({
      what: `${from} → ${to}`,
      why: `a page.tsx also exists at ${from}. The redirect shadows it and the page becomes unreachable`,
    });
  }
  if (aliases[to]) {
    problems.push({
      what: `${from} → ${to} → ${aliases[to]}`,
      why: 'redirect chain — point the first alias straight at the final destination',
    });
  }
}

/* ── clusters ─────────────────────────────────────────────────────────────── */
const mapSrc = read(join(ROOT, TOPIC_MAP));
const clusters = [...mapSrc.matchAll(
  /id:\s*'([^']+)',\s*\n\s*intent:\s*'([^']+)',\s*\n\s*canonical:\s*'([^']+)',(?:\s*\n\s*coverage:\s*'([a-z]+)')?/g,
)].map(([, id, intent, canonical, coverage]) => ({
  id, intent, canonical, coverage: coverage ?? 'covered',
}));

if (clusters.length === 0) {
  fail(`${TOPIC_MAP} parsed to zero clusters. The shape changed and this guard went blind.`);
}

for (const c of clusters) {
  if (!resolves(c.canonical)) {
    problems.push({
      what: `cluster ${c.id} → ${c.canonical}`,
      why: 'canonical page does not exist — the cluster has no answer',
    });
  }
}

const byCanonical = new Map();
for (const c of clusters) {
  const list = byCanonical.get(c.canonical) ?? [];
  list.push(c);
  byCanonical.set(c.canonical, list);
}
for (const [canonical, list] of byCanonical) {
  /* A cluster explicitly marked `gap` is ALLOWED to borrow another cluster's
     page. That is what the marker means: nothing here answers this yet, and the
     nearest page is named so the cluster is not silently unrouted. Failing on
     it would only teach people to delete the marker. The gaps are listed below
     on every run instead, which is the pressure that actually closes them. */
  const contenders = list.filter((c) => c.coverage !== 'gap');
  const intents = new Set(contenders.map((c) => c.intent));
  if (contenders.length > 1 && intents.size > 1) {
    problems.push({
      what: `${canonical} is canonical for ${list.map((c) => `${c.id} (${c.intent})`).join(' and ')}`,
      why:
        'two clusters with different intents share one page — one of them has no answer, and the ' +
        'page will rank for neither as well as a dedicated page would',
    });
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */
console.log('');
console.log(`TOPIC MAP — ${clusters.length} cluster(s), ${Object.keys(aliases).length} alias(es), ${routes.size} static route(s)`);
console.log('');

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.what}`);
    console.error(`    → ${p.why}\n`);
  }
  process.exit(1);
}

for (const c of clusters) {
  const flag = c.coverage === 'gap' ? '  ⚑ GAP' : '';
  console.log(`  ${c.intent.padEnd(11)} ${c.id.padEnd(28)} → ${c.canonical}${flag}`);
}
console.log('');

const gaps = clusters.filter((c) => c.coverage === 'gap');
if (gaps.length) {
  console.log(`  ${gaps.length} cluster(s) marked as a content gap:`);
  for (const g of gaps) {
    const note = (mapSrc.match(new RegExp(`id: '${g.id}'[\\s\\S]{0,600}?gapNote:\\s*\\n?\\s*'([^']*)'`)) || [, ''])[1];
    console.log(`    ${g.id} — currently borrowing ${g.canonical}`);
    if (note) console.log(`      ${note.slice(0, 160)}…`);
  }
  console.log('');
}
console.log('✓ topic map verified — every canonical resolves, no chains, no shadowed routes, no split intent\n');
process.exit(0);
