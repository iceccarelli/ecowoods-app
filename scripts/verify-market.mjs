#!/usr/bin/env node
/**
 * scripts/verify-market.mjs
 *
 * The market page publishes numbers this repository does not own. That is a
 * different risk from every other guard here, and it needs different checks.
 *
 *   1. ONE SOURCE, NAMED. Every fetch must go to bankofcanada.ca. A second host
 *      appearing in lib/market.ts means data is arriving from somewhere that was
 *      never verified, under a page that says where its numbers come from.
 *   2. NO HARDCODED INDEX VALUES. A literal like `487.23` in the market code is
 *      either a fallback that will silently go stale or a figure someone typed.
 *      Both are the same defect as the stale runtime report: a number that is
 *      present gets trusted whether or not it is current.
 *   3. EVERY SERIES EXPLAINED AND DATED. `drives`, `volatility`, `sourceLabel`
 *      and `verifiedAt` are mandatory. The label is what the Bank actually
 *      returns and is how a reader confirms we are showing the series we claim.
 *   4. PAPER REFERENCES RESOLVE, like every other manifest here.
 *   5. THE DISCLAIMER EXISTS. This page shows commodity indices; it must say in
 *      the markup that it is not investment information. A missing disclaimer is
 *      a build failure, not a copy review.
 *
 *   node scripts/verify-market.mjs
 *   node scripts/verify-market.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const LIB = 'apps/web/lib/market.ts';
const PAGE = 'apps/web/app/market/page.tsx';
const API = 'apps/web/app/api/market/route.ts';

for (const f of [LIB, PAGE, API, 'apps/web/lib/papers.ts']) {
  if (!exists(f)) {
    console.error(`verify-market: ${f} not found — run from the repo root.`);
    process.exit(2);
  }
}

const lib = read(LIB);
const page = read(PAGE);
const api = read(API);
const problems = [];
const fail = (m) => problems.push(m);

/* ── 1. one source ───────────────────────────────────────────────────────── */
const hosts = new Set(
  [...`${lib}\n${api}`.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()),
);
const ALLOWED = new Set(['www.bankofcanada.ca', 'creativecommons.org', 'ecowoods.ca']);
for (const h of hosts) {
  if (!ALLOWED.has(h)) {
    fail(
      `market code reaches ${h}. Every index on this page must come from the one source the page ` +
        `names. Add the host to ALLOWED here only after verifying it at the issuing body.`,
    );
  }
}

/* ── 2. no hardcoded index values ────────────────────────────────────────── */
// Strip comments first (F-58: a guard that reads its own documentation as a
// violation is worse than no guard), then look for bare decimals outside the
// layout constants a chart legitimately needs.
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
for (const [name, src] of [[LIB, lib], [API, api]]) {
  for (const m of strip(src).matchAll(/(^|[^\w.])(\d{2,}\.\d+)/g)) {
    fail(
      `${name} contains the literal ${m[2]}. Index values are fetched, never typed — a hardcoded ` +
        `figure is a fallback that goes stale silently.`,
    );
  }
}

/* ── 3. every series explained and dated ─────────────────────────────────── */
const blocks = lib.split(/\n  \{\n/).slice(1);
const series = [];
for (const b of blocks) {
  const one = (k) => {
    const m = b.match(new RegExp(`\\b${k}:\\s*\\n?\\s*'([^']*)'`)) ||
              b.match(new RegExp(`\\b${k}:\\s*\\n?\\s*"([^"]*)"`));
    return m ? m[1] : undefined;
  };
  const id = one('id');
  if (!id || !/^[A-Z.]+$/.test(id)) continue;
  const entry = {
    id,
    name: one('name'),
    sourceLabel: one('sourceLabel'),
    frequency: one('frequency'),
    drives: one('drives'),
    volatility: one('volatility'),
    verifiedAt: one('verifiedAt'),
  };
  series.push(entry);
  for (const k of ['name', 'sourceLabel', 'drives', 'volatility']) {
    if (!entry[k]) fail(`series ${id}: missing ${k}`);
  }
  if (!['daily', 'monthly'].includes(entry.frequency || '')) {
    fail(`series ${id}: frequency "${entry.frequency}" must be daily or monthly`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedAt || '')) {
    fail(`series ${id}: verifiedAt "${entry.verifiedAt}" is not ISO yyyy-mm-dd`);
  }
}
if (!series.length) fail('No series parsed out of lib/market.ts.');
for (const s of series) {
  if (series.filter((x) => x.id === s.id).length > 1) fail(`duplicate series id: ${s.id}`);
}

/* ── 4. paper references resolve ─────────────────────────────────────────── */
const papersSrc = read('apps/web/lib/papers.ts');
const paperSections = new Map();
for (const b of papersSrc.split(/\n  \{\n/).slice(1)) {
  const slug = (b.match(/\bslug: '([^']*)'/) || [])[1];
  if (!slug) continue;
  paperSections.set(slug, new Set([...b.matchAll(/\n        id: '([^']+)'/g)].map((m) => m[1])));
}
const consts = new Map([...lib.matchAll(/const (P_[A-Z_]+) = '([^']+)';/g)].map((m) => [m[1], m[2]]));
for (const m of lib.matchAll(/paper:\s*(P_[A-Z_]+|'[^']+'),\s*\n?\s*section:\s*'([^']+)'/g)) {
  const raw = m[1];
  const slug = raw.startsWith("'") ? raw.slice(1, -1) : consts.get(raw);
  const sections = paperSections.get(slug);
  if (!sections) fail(`market cites paper "${slug}", which is not in lib/papers.ts`);
  else if (!sections.has(m[2])) fail(`market cites ${slug}#${m[2]}, which is not a section of it`);
}

/* ── 5. the disclaimer, and the honest-failure path ──────────────────────── */
// Collapse whitespace before matching. JSX wraps prose across lines, so
// "This is not\n  investment information" is one sentence to a reader and two
// tokens to a naive regex — which is how the first run of this guard reported a
// disclaimer that was sitting right there in the markup.
const flat = (t) => t.replace(/\s+/g, ' ');
if (!/not investment/i.test(flat(page))) {
  fail(
    `${PAGE} does not state that this is not investment information. A page showing commodity ` +
      `indices must say so in the markup.`,
  );
}
if (!/not investment/i.test(flat(api))) {
  fail(`${API} does not carry the same disclaimer in its payload.`);
}
// The page must have a branch for an unreachable source. Without one it either
// renders an empty figure or throws.
if (!/unreachable/i.test(flat(page))) {
  fail(
    `${PAGE} has no visible branch for a source that could not be reached. A missing number must ` +
      `be shown as missing, never as the last value that happened to be cached.`,
  );
}

/* ── 6. derived surfaces ─────────────────────────────────────────────────── */
for (const [file, needle, why] of [
  ['apps/web/app/sitemap.ts', '/market', 'sitemap.ts does not emit /market'],
  ['apps/web/app/llms.txt/route.ts', '/market', '/llms.txt does not advertise the market page'],
  ['apps/web/app/robots.ts', '/api/market', 'robots.txt does not allow /api/market — it sits under the blanket /api/ disallow'],
]) {
  if (!exists(file)) fail(`missing file: ${file}`);
  else if (!read(file).includes(needle)) fail(why);
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log('\nMarket series\n');
  for (const s of series) {
    console.log(`  ${s.id.padEnd(10)} ${String(s.frequency).padEnd(8)} ${s.name}`);
    console.log(`             ${s.sourceLabel}  · verified ${s.verifiedAt}\n`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} market problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ market verified — ${series.length} series, one named source, no hardcoded values, disclaimer present`,
);
