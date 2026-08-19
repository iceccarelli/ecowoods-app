#!/usr/bin/env node
/**
 * scripts/verify-papers.mjs
 *
 * Cross-checks the technical-paper manifest against everything derived from it.
 *
 * WHY THIS EXISTS
 *
 * `lib/papers.ts` is a single source that fans out into a lot of surfaces: two
 * routes, three schema blocks, the sitemap, /llms.txt, /ai.txt, the
 * /technical-library cards and the cross-links between papers. That is the
 * point of a manifest — but it also means one bad field is wrong in eight
 * places at once, and most of those places are invisible until a crawler reads
 * them.
 *
 * Specific failures this is built to catch:
 *
 *   · A paper whose `pdf` filename exists in NEITHER public/papers/ (published)
 *     NOR docs/papers-pending/ (staged). `pdfIsPublished()` fails soft — the
 *     button just does not render — so a typo in the filename looks exactly
 *     like "not published yet" and can sit there for months.
 *   · Two sections with the same `id`. Those ids are the anchors in the
 *     contents rail; a duplicate silently makes one of them unreachable.
 *   · A slug collision, which would make one paper unreachable entirely.
 *   · A paper that never got wired into the sitemap or the machine files
 *     because the derivation was edited by hand somewhere.
 *   · A table row whose cell count does not match its header, which renders as
 *     a broken row rather than an error.
 *
 * Dependency-free. Parses the manifest as text rather than importing it,
 * because it is TypeScript and this has to run without a build step — the same
 * approach verify-schema.mjs and verify-tokens.mjs take.
 *
 *   node scripts/verify-papers.mjs
 *   node scripts/verify-papers.mjs --list    print the full inventory
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');

const MANIFEST = path.join(ROOT, 'apps/web/lib/papers.ts');
const PUBLIC_DIR = path.join(ROOT, 'apps/web/public/papers');
const PENDING_DIR = path.join(ROOT, 'docs/papers-pending');
const SITEMAP = path.join(ROOT, 'apps/web/app/sitemap.ts');
const LLMS = path.join(ROOT, 'apps/web/app/llms.txt/route.ts');
const AITXT = path.join(ROOT, 'apps/web/app/ai.txt/route.ts');
const ROUTE_INDEX = path.join(ROOT, 'apps/web/app/papers/page.tsx');
const ROUTE_SLUG = path.join(ROOT, 'apps/web/app/papers/[slug]/page.tsx');

if (!fs.existsSync(MANIFEST)) {
  console.error('verify-papers: apps/web/lib/papers.ts not found — run from the repo root.');
  process.exit(2);
}

const src = fs.readFileSync(MANIFEST, 'utf8');
const problems = [];
const fail = (msg) => problems.push(msg);

/* ── parse the manifest ──────────────────────────────────────────────────── */
// Split on top-level slug boundaries. Crude, and deliberately so: a real parse
// would need TypeScript, and this only has to read fields it can see.
const blocks = src.split(/\n  \{\n/).slice(1);
const papers = blocks.map((b) => {
    // Values may be single- OR double-quoted. A title containing an apostrophe
    // ("The Intelligent Homeowner's ...") is double-quoted in the TS source, and
    // a single-quote-only regex reported it as a MISSING FIELD — a false positive
    // this guard produced against its own manifest on the first run.
    const one = (k) => {
      const m = b.match(new RegExp(`\\b${k}: '([^']*)'`)) ||
                b.match(new RegExp(`\\b${k}: "([^"]*)"`));
      return m ? m[1] : undefined;
    };
  const num = (k) => {
    const m = b.match(new RegExp(`\\b${k}: (\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    slug: one('slug'),
    title: one('title'),
    version: one('version'),
    publishedAt: one('publishedAt'),
    pdf: one('pdf'),
    pages: num('pages'),
    readingMinutes: num('readingMinutes'),
    sectionIds: [...b.matchAll(/\n        id: '([^']+)'/g)].map((m) => m[1]),
    headings: [...b.matchAll(/\n        heading: ['"]([^'"]+)/g)].map((m) => m[1]),
    raw: b,
  };
}).filter((p) => p.slug);

if (!papers.length) fail('No papers parsed out of the manifest — the file shape changed.');

/* ── 1. identity ─────────────────────────────────────────────────────────── */
const slugs = papers.map((p) => p.slug);
for (const s of new Set(slugs)) {
  if (slugs.filter((x) => x === s).length > 1) fail(`duplicate slug: ${s}`);
}
for (const p of papers) {
  if (!/^[a-z0-9-]+$/.test(p.slug)) fail(`slug is not url-safe: ${p.slug}`);
  for (const f of ['title', 'version', 'publishedAt', 'pdf']) {
    if (!p[f]) fail(`${p.slug}: missing ${f}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.publishedAt || '')) {
    fail(`${p.slug}: publishedAt is not ISO yyyy-mm-dd (${p.publishedAt})`);
  }
  if (!p.sectionIds.length) fail(`${p.slug}: no sections`);
  for (const id of new Set(p.sectionIds)) {
    if (p.sectionIds.filter((x) => x === id).length > 1) {
      fail(`${p.slug}: duplicate section id "${id}" — one of the contents links is dead`);
    }
  }
  if (p.sectionIds.length !== p.headings.length) {
    fail(`${p.slug}: ${p.sectionIds.length} section ids but ${p.headings.length} headings`);
  }
}

/* ── 2. the PDF exists somewhere ─────────────────────────────────────────── */
const inDir = (dir, name) => fs.existsSync(path.join(dir, name));
const pdfState = new Map();
for (const p of papers) {
  const published = inDir(PUBLIC_DIR, p.pdf);
  const staged = inDir(PENDING_DIR, p.pdf);
  // A paper may legitimately have no PDF yet — as long as the LaTeX it will be
  // exported from is sitting in docs/papers-pending/ under the same basename.
  // That is "awaiting export", which is a real state and not a defect. What is
  // a defect is a filename nothing anywhere can satisfy, because
  // pdfIsPublished() fails soft and a typo then looks exactly like "not yet".
  const source = inDir(PENDING_DIR, p.pdf.replace(/\.pdf$/, '.tex'));
  pdfState.set(p.slug, published ? 'PUBLISHED' : staged ? 'staged' : source ? 'awaiting export' : 'MISSING');

  if (!published && !staged && !source) {
    fail(
      `${p.slug}: pdf "${p.pdf}" is in neither apps/web/public/papers/ nor docs/papers-pending/,\n` +
        `      and no matching .tex is staged to export it from. Either the filename is a typo or\n` +
        `      the source was never committed. pdfIsPublished() fails soft, so this is invisible on the page.`
    );
  }
  if (published && staged) {
    fail(`${p.slug}: pdf exists in BOTH public/papers and docs/papers-pending — delete the stale one`);
  }
}

/* ── 3. tables are rectangular ───────────────────────────────────────────── */
for (const p of papers) {
  for (const t of p.raw.matchAll(/head: \[([^\]]*)\],\s*\n\s*rows: \[([\s\S]*?)\n        \],/g)) {
    const cols = (t[1].match(/'/g) || []).length / 2;
    for (const row of t[2].matchAll(/\[([^\]]*)\]/g)) {
      const cells = (row[1].match(/'/g) || []).length / 2;
      if (cells !== cols) {
        fail(`${p.slug}: table row has ${cells} cells but the header has ${cols}`);
      }
    }
  }
}

/* ── 4. derived surfaces still derive ────────────────────────────────────── */
const derives = [
  [SITEMAP, 'getPapers', 'app/sitemap.ts no longer reads the manifest'],
  [SITEMAP, '/papers', 'app/sitemap.ts does not emit /papers'],
  [LLMS, 'getPapers', '/llms.txt no longer reads the manifest'],
  [AITXT, 'getPapers', '/ai.txt no longer reads the manifest'],
  [ROUTE_INDEX, 'getPapers', 'app/papers/page.tsx no longer reads the manifest'],
  [ROUTE_SLUG, 'generateStaticParams', 'app/papers/[slug] does not prerender from the manifest'],
];
for (const [file, needle, why] of derives) {
  if (!fs.existsSync(file)) fail(`missing file: ${path.relative(ROOT, file)}`);
  else if (!fs.readFileSync(file, 'utf8').includes(needle)) fail(why);
}

/* ── 5. nothing published under public/ that the manifest does not know ──── */
if (fs.existsSync(PUBLIC_DIR)) {
  const known = new Set(papers.map((p) => p.pdf));
  for (const f of fs.readdirSync(PUBLIC_DIR)) {
    if (f.endsWith('.pdf') && !known.has(f)) {
      fail(`apps/web/public/papers/${f} is served but no paper in the manifest points at it`);
    }
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log('\nTechnical papers\n');
  for (const p of papers) {
    console.log(`  ${p.title}  ·  v${p.version}  ·  ${p.publishedAt}`);
    console.log(`    /papers/${p.slug}`);
    console.log(`    pdf     ${pdfState.get(p.slug).padEnd(9)} ${p.pdf}`);
    console.log(`    ${p.sectionIds.length} sections, ${p.pages} pages, ${p.readingMinutes} min`);
    console.log(`    ${p.sectionIds.join(', ')}\n`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} paper manifest problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

const count = (v) => [...pdfState.values()].filter((x) => x === v).length;
console.log(
  `✓ papers verified — ${papers.length} paper(s), ` +
    `${papers.reduce((n, p) => n + p.sectionIds.length, 0)} sections, ` +
    `pdf: ${count('PUBLISHED')} published / ${count('staged')} staged / ${count('awaiting export')} awaiting export`
);
