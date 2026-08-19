#!/usr/bin/env node
/**
 * scripts/verify-framework.mjs
 *
 * Every claim in the framework and in every guide must trace to a section of a
 * published paper. This resolves those citations and fails the build when one
 * does not exist.
 *
 * WHY THIS EXISTS
 *
 * The framework and the guides are the two surfaces on this site whose entire
 * value is that they are trustworthy. A framework that quietly accumulates
 * unsourced assertions is worth less than no framework: it is exactly what a
 * competitor attacks, and exactly what an answer engine learns to discount
 * after catching one bad figure.
 *
 * The rule is therefore mechanical rather than editorial — every criterion and
 * every guide carries `source: { paper, section }`, and this guard checks that
 * the paper exists in lib/papers.ts and that the section id exists inside it.
 * A criterion that cannot cite a published paper does not ship; the paper gets
 * written first.
 *
 * It also enforces the things that make a citation URL durable: unique
 * criterion ids, ids that match their pillar number, no duplicate guide slugs,
 * and a version string that is present and parseable.
 *
 *   node scripts/verify-framework.mjs
 *   node scripts/verify-framework.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

for (const f of ['apps/web/lib/papers.ts', 'apps/web/lib/framework.ts', 'apps/web/lib/guides.ts']) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    console.error(`verify-framework: ${f} not found — run from the repo root.`);
    process.exit(2);
  }
}

const papersSrc = read('apps/web/lib/papers.ts');
const fwSrc = read('apps/web/lib/framework.ts');
const gdSrc = read('apps/web/lib/guides.ts');

const problems = [];
const fail = (m) => problems.push(m);

/* ── what the papers actually contain ────────────────────────────────────── */
// Parsed as text, like verify-papers.mjs: this has to run without a build step.
const paperSections = new Map(); // slug -> Set(sectionId)
{
  const blocks = papersSrc.split(/\n  \{\n/).slice(1);
  for (const b of blocks) {
    const slug = (b.match(/\bslug: '([^']*)'/) || [])[1];
    if (!slug) continue;
    const ids = new Set([...b.matchAll(/\n        id: '([^']+)'/g)].map((m) => m[1]));
    paperSections.set(slug, ids);
  }
}
if (!paperSections.size) fail('No papers parsed out of lib/papers.ts — the file shape changed.');

/* ── every citation, from both manifests ─────────────────────────────────── */
const citations = [];
for (const [label, src] of [
  ['framework', fwSrc],
  ['guides', gdSrc],
]) {
  // Constants indirect the slug (P_CLIMATE etc). Resolve them first so the
  // citation check reads real slugs rather than identifiers.
  const consts = new Map(
    [...src.matchAll(/const (P_[A-Z_]+) = '([^']+)';/g)].map((m) => [m[1], m[2]]),
  );
  for (const m of src.matchAll(/\{\s*paper:\s*(P_[A-Z_]+|'[^']+'),\s*section:\s*'([^']+)'\s*\}/g)) {
    const raw = m[1];
    const slug = raw.startsWith("'") ? raw.slice(1, -1) : consts.get(raw);
    citations.push({ label, slug: slug ?? `UNRESOLVED(${raw})`, section: m[2] });
  }
}
if (!citations.length) fail('No source citations found in framework.ts or guides.ts.');

for (const c of citations) {
  const sections = paperSections.get(c.slug);
  if (!sections) {
    fail(`${c.label}: cites paper "${c.slug}", which is not in lib/papers.ts`);
  } else if (!sections.has(c.section)) {
    fail(
      `${c.label}: cites ${c.slug}#${c.section}, but that paper has no section with that id.\n` +
        `      Sections available: ${[...sections].join(', ')}`,
    );
  }
}

/* ── the framework's own invariants ──────────────────────────────────────── */
const version = (fwSrc.match(/FRAMEWORK_VERSION = '([^']+)'/) || [])[1];
if (!version) fail('FRAMEWORK_VERSION is missing.');
else if (!/^\d+\.\d+$/.test(version)) fail(`FRAMEWORK_VERSION "${version}" is not major.minor.`);

const publishedAt = (fwSrc.match(/FRAMEWORK_PUBLISHED_AT = '([^']+)'/) || [])[1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt || '')) {
  fail(`FRAMEWORK_PUBLISHED_AT "${publishedAt}" is not ISO yyyy-mm-dd.`);
}

const pillars = [...fwSrc.matchAll(/\n    id: '([a-z-]+)',\n    number: (\d+),\n    name: '([^']+)'/g)].map(
  (m) => ({ id: m[1], number: Number(m[2]), name: m[3] }),
);
if (!pillars.length) fail('No pillars parsed out of framework.ts.');

const critIds = [...fwSrc.matchAll(/\n        id: '(\d+\.\d+)',/g)].map((m) => m[1]);
for (const id of new Set(critIds)) {
  if (critIds.filter((x) => x === id).length > 1) {
    fail(`duplicate criterion id "${id}" — criterion ids are cited externally and must be unique`);
  }
}
// A criterion numbered 3.x inside pillar 2 makes every external citation wrong.
{
  let cursor = 0;
  for (const m of fwSrc.matchAll(/\n    number: (\d+),|\n        id: '(\d+)\.\d+',/g)) {
    if (m[1]) cursor = Number(m[1]);
    else if (m[2] && Number(m[2]) !== cursor) {
      fail(`criterion ${m[2]}.x sits inside pillar ${cursor} — the numbers must agree`);
    }
  }
}
for (const p of pillars) {
  if (!fwSrc.includes(`id: '${p.id}'`)) fail(`pillar ${p.number} has no id`);
}

/* ── the guides' invariants ──────────────────────────────────────────────── */
const guideSlugs = [...gdSrc.matchAll(/\n    slug: '([^']+)',\n    kind: '(decision|reference)'/g)].map(
  (m) => ({ slug: m[1], kind: m[2] }),
);
if (!guideSlugs.length) fail('No guides parsed out of guides.ts.');
for (const g of guideSlugs) {
  if (!/^[a-z0-9-]+$/.test(g.slug)) fail(`guide slug is not url-safe: ${g.slug}`);
  if (guideSlugs.filter((x) => x.slug === g.slug).length > 1) fail(`duplicate guide slug: ${g.slug}`);
}
// A guide that points at a pillar id which does not exist renders a dead link.
const pillarIds = new Set(pillars.map((p) => p.id));
for (const m of gdSrc.matchAll(/pillars: \[([^\]]*)\]/g)) {
  for (const raw of m[1].split(',')) {
    const id = raw.trim().replace(/^'|'$/g, '');
    if (id && !pillarIds.has(id)) fail(`a guide references pillar "${id}", which does not exist`);
  }
}

/* ── the derived surfaces still derive ───────────────────────────────────── */
const derives = [
  ['apps/web/app/sitemap.ts', 'getGuides', 'sitemap.ts no longer emits the guides'],
  ['apps/web/app/sitemap.ts', '/framework', 'sitemap.ts does not emit /framework'],
  ['apps/web/app/llms.txt/route.ts', '/framework', '/llms.txt does not advertise the framework'],
];
for (const [file, needle, why] of derives) {
  if (!fs.existsSync(path.join(ROOT, file))) fail(`missing file: ${file}`);
  else if (!read(file).includes(needle)) fail(why);
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log(`\n${'Well-Installed Framework'} v${version} · ${publishedAt}\n`);
  for (const p of pillars) {
    const n = critIds.filter((c) => c.startsWith(`${p.number}.`)).length;
    console.log(`  ${p.number}. ${p.name.padEnd(30)} ${n} criteria`);
  }
  console.log('\nGuides\n');
  for (const g of guideSlugs) console.log(`  ${g.kind.padEnd(10)} /guides/${g.slug}`);
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} framework problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ framework verified — v${version}, ${pillars.length} pillars, ${critIds.length} criteria, ` +
    `${guideSlugs.filter((g) => g.kind === 'decision').length} decision guide(s), ` +
    `${guideSlugs.filter((g) => g.kind === 'reference').length} reference installation(s), ` +
    `${citations.length} citations all resolved`,
);
