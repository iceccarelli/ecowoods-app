#!/usr/bin/env node
/**
 * scripts/verify-glossary.mjs
 *
 * The glossary is the densest link graph on the site — every entry points at
 * three or four others, and the whole value of the surface is that following
 * any of those links lands somewhere real. A dead cross-reference here costs
 * more than a dead link anywhere else, because a term page with a broken
 * "related" list reads as abandoned rather than as merely incomplete.
 *
 * So this checks four things, in order of how quietly each one fails:
 *
 *   1. Every `source: { paper, section }` resolves against lib/papers.ts. Same
 *      rule as the framework and the guides: a definition restates a published
 *      paper, it does not extend the corpus. If the substance is not in a paper
 *      yet, the paper is written first.
 *   2. Every slug in a `related` array is a real term. This is the one that
 *      fails silently — the link renders, the page 404s, and nobody notices
 *      until a crawler reports it.
 *   3. Every `pillars` id exists in lib/framework.ts.
 *   4. Slugs are unique and url-safe, and no term lists itself as related.
 *
 *   node scripts/verify-glossary.mjs
 *   node scripts/verify-glossary.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

for (const f of ['apps/web/lib/papers.ts', 'apps/web/lib/glossary.ts', 'apps/web/lib/framework.ts']) {
  if (!exists(f)) {
    console.error(`verify-glossary: ${f} not found — run from the repo root.`);
    process.exit(2);
  }
}

const papersSrc = read('apps/web/lib/papers.ts');
const glSrc = read('apps/web/lib/glossary.ts');
const fwSrc = read('apps/web/lib/framework.ts');

const problems = [];
const fail = (m) => problems.push(m);

/* ── what the papers contain ─────────────────────────────────────────────── */
const paperSections = new Map();
for (const b of papersSrc.split(/\n  \{\n/).slice(1)) {
  const slug = (b.match(/\bslug: '([^']*)'/) || [])[1];
  if (!slug) continue;
  paperSections.set(slug, new Set([...b.matchAll(/\n        id: '([^']+)'/g)].map((m) => m[1])));
}

/* ── parse the glossary ──────────────────────────────────────────────────── */
const consts = new Map([...glSrc.matchAll(/const (P_[A-Z_]+) = '([^']+)';/g)].map((m) => [m[1], m[2]]));
const blocks = glSrc.split(/\n  \{\n/).slice(1);
const terms = blocks
  .map((b) => {
    // `:\s*` rather than `: ` — prettier wraps a long value onto its own line,
    // and a same-line-only regex reported every wrapped `short:` as MISSING.
    // Thirty false positives on the first run, against this guard's own data.
    // Double-quoted values are matched too, for values containing an apostrophe.
    const one = (k) => {
      const m =
        b.match(new RegExp(`\\b${k}:\\s*'([^']*)'`)) ||
        b.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`));
      return m ? m[1] : undefined;
    };
    const arr = (k) => {
      const m = b.match(new RegExp(`\\b${k}:\\s*\\[([^\\]]*)\\]`));
      if (!m) return [];
      return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    };
    const srcM = b.match(/source: \{\s*paper:\s*(P_[A-Z_]+|'[^']+'),\s*section:\s*'([^']+)'\s*\}/);
    const rawPaper = srcM ? srcM[1] : undefined;
    return {
      slug: one('slug'),
      term: one('term'),
      short: one('short'),
      related: arr('related'),
      pillars: arr('pillars'),
      aka: arr('aka'),
      source: srcM
        ? { paper: rawPaper.startsWith("'") ? rawPaper.slice(1, -1) : consts.get(rawPaper), section: srcM[2] }
        : undefined,
    };
  })
  .filter((t) => t.slug);

if (!terms.length) fail('No terms parsed out of lib/glossary.ts — the file shape changed.');

const slugs = new Set(terms.map((t) => t.slug));
const pillarIds = new Set([...fwSrc.matchAll(/\n    id: '([a-z-]+)',\n    number: \d+,/g)].map((m) => m[1]));

for (const t of terms) {
  if (!/^[a-z0-9-]+$/.test(t.slug)) fail(`slug is not url-safe: ${t.slug}`);
  if (terms.filter((x) => x.slug === t.slug).length > 1) fail(`duplicate slug: ${t.slug}`);
  if (!t.term) fail(`${t.slug}: missing term`);
  if (!t.short) fail(`${t.slug}: missing short definition (it is the schema description)`);

  if (!t.source || !t.source.paper) {
    fail(`${t.slug}: no source citation — every definition must cite a published paper`);
  } else {
    const sections = paperSections.get(t.source.paper);
    if (!sections) fail(`${t.slug}: cites paper "${t.source.paper}", which is not in lib/papers.ts`);
    else if (!sections.has(t.source.section)) {
      fail(
        `${t.slug}: cites ${t.source.paper}#${t.source.section}, but that paper has no such section.\n` +
          `      Available: ${[...sections].join(', ')}`,
      );
    }
  }

  for (const r of t.related) {
    if (r === t.slug) fail(`${t.slug}: lists itself as related`);
    else if (!slugs.has(r)) {
      fail(`${t.slug}: related term "${r}" does not exist — this renders as a link to a 404`);
    }
  }
  for (const p of t.pillars) {
    if (!pillarIds.has(p)) fail(`${t.slug}: references framework pillar "${p}", which does not exist`);
  }
}

/* ── derived surfaces ────────────────────────────────────────────────────── */
for (const [file, needle, why] of [
  ['apps/web/app/sitemap.ts', 'getTerms', 'sitemap.ts no longer emits the glossary'],
  ['apps/web/app/llms.txt/route.ts', '/glossary', '/llms.txt does not advertise the glossary'],
  ['apps/web/app/api/knowledge/route.ts', 'getTerms', '/api/knowledge no longer reads the glossary'],
]) {
  if (!exists(file)) fail(`missing file: ${file}`);
  else if (!read(file).includes(needle)) fail(why);
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log('\nGlossary\n');
  for (const t of [...terms].sort((a, b) => a.term.localeCompare(b.term))) {
    const back = terms.filter((x) => x.related.includes(t.slug)).length;
    console.log(
      `  ${t.term.padEnd(26)} /glossary/${t.slug.padEnd(24)} ${t.related.length} out, ${back} in`,
    );
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} glossary problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

// An orphan here is a term nothing else points at. Not an error — some terms are
// genuinely leaves — but worth printing, because the graph is the product.
const orphans = terms.filter((t) => !terms.some((x) => x.related.includes(t.slug)));
const links = terms.reduce((n, t) => n + t.related.length, 0);
console.log(
  `✓ glossary verified — ${terms.length} term(s), ${links} cross-links, all resolved` +
    (orphans.length ? ` (${orphans.length} with no inbound link: ${orphans.map((o) => o.slug).join(', ')})` : ''),
);
