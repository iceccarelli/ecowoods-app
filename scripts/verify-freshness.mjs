#!/usr/bin/env node
/**
 * scripts/verify-freshness.mjs
 *
 * A page that shows how old something is must be regenerated, or the answer it
 * gives is the age at deploy time, forever.
 *
 * WHY THIS EXISTS
 *
 * `/standards` exists to publish, for every external document it tracks, the
 * date it was last verified and how long ago that was. That column is the whole
 * product — anyone can copy a list of standards; only a maintained one stays
 * true. It shipped statically rendered, so `new Date()` was evaluated once at
 * deploy, and the live page read **"0 days ago" on all four entries** — and
 * would have kept reading that in six months.
 *
 * The register built to prevent silent rot was silently rotting. It was found
 * by someone asking whether the site really updates itself, not by any of the
 * twelve guards, because every one of them reads source code and this defect
 * only exists at runtime.
 *
 * THE RULE: if a file computes a duration from the current time and renders it,
 * it must declare `export const revalidate`. Next statically renders by default,
 * and "static" and "correct" stop being the same thing the moment a page's
 * output depends on when it is read rather than on what it contains.
 *
 * Scope is the public site. Admin and portal pages are dynamic by nature — they
 * read a session — and are excluded rather than special-cased.
 *
 *   node scripts/verify-freshness.mjs
 *   node scripts/verify-freshness.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(APP)) {
  console.error('verify-freshness: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(APP);

const rel = (f) => path.relative(ROOT, f);
const isPrivate = (f) =>
  /\/(admin|\(portal\)|\(auth\)|docs)\//.test(f.split(path.sep).join('/'));

// Strip comments before scanning. A guard that reads its own documentation as a
// violation is worse than no guard — F-58, and again in F-106.
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* Signals that a file turns "now" into an elapsed value it then shows.
   Matching `new Date()` alone would flag every `datePublished: new Date()` in a
   schema block, which is a timestamp, not a duration — those are fine static. */
const ELAPSED = [
  /Date\.now\(\)\s*-/,
  /-\s*Date\.now\(\)/,
  /\bstalenessDays\s*\(/,
  /getTime\(\)\s*-\s*new Date\(/,
  /new Date\(\)\.getTime\(\)\s*-/,
  /\bdaysSince\s*\(/,
  /\bageDays\b/,
];

const rows = [];
const problems = [];

for (const f of files) {
  if (isPrivate(f)) continue;
  const base = path.basename(f);
  // Only entry points have a rendering mode. A helper in lib/ inherits it.
  if (!['page.tsx', 'route.ts', 'sitemap.ts'].includes(base)) continue;

  const src = strip(fs.readFileSync(f, 'utf8'));
  const usesElapsed = ELAPSED.some((re) => re.test(src));
  if (!usesElapsed) continue;

  const revalidate = (src.match(/export const revalidate\s*=\s*(\d+)/) || [])[1];
  const dynamic = (src.match(/export const dynamic\s*=\s*'([^']+)'/) || [])[1];
  const ok = Boolean(revalidate) || dynamic === 'force-dynamic';
  rows.push({ file: rel(f), revalidate: revalidate ?? (dynamic ?? '—'), ok });

  if (!ok) {
    problems.push(
      `${rel(f)} renders an elapsed time but declares no revalidate.\n` +
        `      Next renders it statically, so the duration is frozen at deploy and the page will\n` +
        `      report the same age forever. Add \`export const revalidate = 86400\` (or a shorter\n` +
        `      interval), or \`dynamic = 'force-dynamic'\` if it must be exact.`,
    );
  }
}

/* The lib modules those pages read from are worth naming in --list, because the
   helper is where the elapsed calculation actually lives and the next person
   will look there first. */
if (LIST) {
  console.log('\nPages that render an elapsed time\n');
  for (const r of rows) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.file.padEnd(46)} revalidate=${r.revalidate}`);
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} page(s) render a frozen clock:\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ freshness verified — ${rows.length} page(s) render an elapsed time, all declare a revalidate`,
);
