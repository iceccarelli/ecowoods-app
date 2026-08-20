#!/usr/bin/env node
/**
 * scripts/verify-changelog.mjs — completeness of /whats-new, freshness of /standards.
 *
 * TWO MANIFESTS, TWO DIFFERENT RISKS.
 *
 * The changelog is written prose, because "why this matters" cannot be derived.
 * Its failure mode is silence: something ships, nobody adds a line, and the page
 * claims a publication history it no longer has. So this guard works backwards —
 * it walks papers, guides and figures and fails if any of them is unmentioned.
 * The prose stays editorial; the completeness becomes mechanical.
 *
 * The standards register's failure mode is the opposite: it does not go missing,
 * it goes STALE. An entry that says "ASTM F2170-19a" is a claim about the world
 * that was true when someone checked and may not be now. `verifiedAt` is
 * therefore a claim about our own diligence, and this guard makes going stale
 * visible at build time rather than leaving it to memory. A register that
 * silently rots is worse than no register — it asserts a currency it does not
 * have, to readers who have no way to tell.
 *
 * Staleness is a WARNING, not a failure. Failing a build because a calendar
 * advanced would train everyone to bypass the guard, which is how a ratchet
 * becomes a wall and then becomes ignored.
 *
 *   node scripts/verify-changelog.mjs
 *   node scripts/verify-changelog.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

for (const f of [
  'apps/web/lib/changelog.ts',
  'apps/web/lib/standards.ts',
  'apps/web/lib/papers.ts',
  'apps/web/lib/guides.ts',
  'apps/web/lib/figures.ts',
]) {
  if (!exists(f)) {
    console.error(`verify-changelog: ${f} not found — run from the repo root.`);
    process.exit(2);
  }
}

const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);

const clogSrc = read('apps/web/lib/changelog.ts');
const stdSrc = read('apps/web/lib/standards.ts');

/* ── 1. changelog completeness ───────────────────────────────────────────── */
const covered = new Set(
  [...clogSrc.matchAll(/covers: \[([\s\S]*?)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)])
    .map((m) => m[1]),
);

const idsIn = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const paperSlugs = idsIn(read('apps/web/lib/papers.ts'), /\n    slug: '([^']+)',/g);
const guideSlugs = idsIn(read('apps/web/lib/guides.ts'), /\n    slug: '([^']+)',/g);
const figureIds = idsIn(read('apps/web/lib/figures.ts'), /\n    id: '([^']+)',/g);

for (const [label, ids] of [
  ['paper', paperSlugs],
  ['guide', guideSlugs],
  ['figure', figureIds],
]) {
  for (const id of ids) {
    if (!covered.has(id)) {
      fail(
        `${label} "${id}" has shipped but no changelog entry covers it.\n` +
          `      Add it to lib/changelog.ts with a covers: ['${id}'] — a changelog that\n` +
          `      silently falls behind claims a publication history the site does not have.`,
      );
    }
  }
}
// The reverse: an entry covering something that no longer exists.
const known = new Set([...paperSlugs, ...guideSlugs, ...figureIds]);
for (const c of covered) {
  if (!known.has(c)) fail(`changelog covers "${c}", which is not in any manifest`);
}

/* ── 2. changelog shape ──────────────────────────────────────────────────── */
const entries = clogSrc.split(/\n  \{\n/).slice(1);
const seenIds = new Set();
for (const b of entries) {
  const id = (b.match(/\bid: '([^']+)'/) || [])[1];
  if (!id) continue;
  if (seenIds.has(id)) fail(`duplicate changelog id: ${id}`);
  seenIds.add(id);
  const date = (b.match(/\bdate: '([^']+)'/) || [])[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(`${id}: date "${date}" is not ISO yyyy-mm-dd`);
  const href = (b.match(/\bhref: '([^']+)'/) || [])[1];
  if (!href || !href.startsWith('/')) fail(`${id}: href must be a site-relative path`);
}

/* ── 3. standards register ───────────────────────────────────────────────── */
const REVIEW_DAYS = Number((stdSrc.match(/REVIEW_INTERVAL_DAYS = (\d+)/) || [])[1] || 180);
// Date.now() is fine here: this is a guard, not a workflow that has to replay.
const now = Date.now();
const stdBlocks = stdSrc.split(/\n  \{\n/).slice(1);
const standards = [];
for (const b of stdBlocks) {
  const one = (k) => {
    const m = b.match(new RegExp(`\\b${k}: '([^']*)'`)) || b.match(new RegExp(`\\b${k}:\\s*\\n?\\s*'([^']*)'`));
    return m ? m[1] : undefined;
  };
  const id = one('id');
  if (!id) continue;
  const sourceUrl = one('sourceUrl');
  const verifiedAt = one('verifiedAt');
  const status = one('status');
  standards.push({ id, sourceUrl, verifiedAt, status });

  if (!sourceUrl || !/^https:\/\//.test(sourceUrl)) {
    fail(`standard "${id}": sourceUrl must be an https link to the ISSUING BODY, never a reseller or a blog`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt || '')) {
    fail(`standard "${id}": verifiedAt "${verifiedAt}" is not ISO yyyy-mm-dd`);
  } else {
    const days = Math.floor((now - Date.parse(verifiedAt)) / 86_400_000);
    if (days > REVIEW_DAYS) {
      warn(
        `standard "${id}" was last verified ${days} days ago (interval ${REVIEW_DAYS}). ` +
          `Re-check ${sourceUrl} and update verifiedAt, or the register asserts a currency it does not have.`,
      );
    }
  }
  if (!['current', 'revision-open', 'unverified-edition'].includes(status || '')) {
    fail(`standard "${id}": status "${status}" is not one of current | revision-open | unverified-edition`);
  }
}
if (!standards.length) fail('No standards parsed out of lib/standards.ts.');

// Framework references must resolve, or the register links nowhere.
if (exists('apps/web/lib/framework.ts')) {
  const fw = read('apps/web/lib/framework.ts');
  const pillarIds = new Set([...fw.matchAll(/\n    id: '([a-z-]+)',\n    number: \d+/g)].map((m) => m[1]));
  const critIds = new Set([...fw.matchAll(/\n        id: '(\d+\.\d+)',/g)].map((m) => m[1]));
  for (const m of stdSrc.matchAll(/pillars: \[([^\]]*)\]/g)) {
    for (const raw of m[1].split(',')) {
      const id = raw.trim().replace(/^'|'$/g, '');
      if (id && !pillarIds.has(id)) fail(`standards register points at pillar "${id}", which does not exist`);
    }
  }
  for (const m of stdSrc.matchAll(/criteria: \[([^\]]*)\]/g)) {
    for (const raw of m[1].split(',')) {
      const id = raw.trim().replace(/^'|'$/g, '');
      if (id && !critIds.has(id)) fail(`standards register points at criterion "${id}", which does not exist`);
    }
  }
}

/* ── 4. derived surfaces ─────────────────────────────────────────────────── */
for (const [file, needle, why] of [
  ['apps/web/app/sitemap.ts', '/whats-new', 'sitemap.ts does not emit /whats-new'],
  ['apps/web/app/sitemap.ts', '/standards', 'sitemap.ts does not emit /standards'],
  ['apps/web/app/llms.txt/route.ts', '/whats-new', '/llms.txt does not advertise the changelog'],
]) {
  if (!exists(file)) fail(`missing file: ${file}`);
  else if (!read(file).includes(needle)) fail(why);
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log('\nChangelog\n');
  for (const b of entries) {
    const id = (b.match(/\bid: '([^']+)'/) || [])[1];
    const date = (b.match(/\bdate: '([^']+)'/) || [])[1];
    if (id) console.log(`  ${date}  ${id}`);
  }
  console.log('\nStandards register\n');
  for (const s of standards) {
    const days = /^\d{4}-\d{2}-\d{2}$/.test(s.verifiedAt || '')
      ? Math.floor((now - Date.parse(s.verifiedAt)) / 86_400_000)
      : '?';
    console.log(`  ${String(s.id).padEnd(18)} ${String(s.status).padEnd(20)} verified ${days}d ago`);
  }
  console.log('');
}

for (const w of warnings) console.warn(`  ! ${w}`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} changelog/standards problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ changelog verified — ${seenIds.size} entr(ies), every paper/guide/figure covered; ` +
    `${standards.length} external standard(s), ${warnings.length} due for re-verification`,
);
