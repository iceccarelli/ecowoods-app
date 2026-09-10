#!/usr/bin/env node
/**
 * scripts/verify-catalogues.mjs — a published document index may not advertise a
 * file the host does not serve.
 *
 * WHY THIS ONE MATTERS MORE THAN IT LOOKS
 *
 * Every other guard here protects a page. This one protects eleven files that
 * leave the site: a homeowner downloads one, prints it, and puts it in front of
 * a spouse or a condo board. A broken page is a bad minute; a catalogue that
 * 404s from a link somebody forwarded is the company failing in front of the
 * person the reader was trying to convince.
 *
 * And this repository has already had the failure at scale. Every file under
 * apps/web/public returned 404 in production for months because the static root
 * was the repository root — which is exactly where all eleven of these PDFs were
 * sitting until they were moved. So the checks below are not hypothetical
 * hygiene; they are the specific defect, written down.
 *
 * WHAT IS CHECKED
 *
 *  1. Every catalogue in the manifest is a file on disk under public/catalogues.
 *  2. Every file under public/catalogues is in the manifest — an unlisted
 *     document is one nobody can find, and one no guard is reading for retired
 *     claims.
 *  3. Filenames match the published pattern and are unique. The filename is the
 *     public identifier: it is in the URL, the sitemap, /llms.txt and
 *     /api/knowledge, and renaming one breaks a URL somebody has printed.
 *  4. Every `related` href resolves to a route this repository generates.
 *  5. Every CATALOGUE_RAILS key is a real route, and every id it names exists.
 *  6. No price, percentage or four-digit year in the prose fields — the figures
 *     live in content/constants/pricing.ts and in the `year` field, and a second
 *     copy is the drift class this project spends most of its guards on.
 *  7. The API and the index page both derive from the manifest rather than
 *     carrying their own list.
 *
 *   node scripts/verify-catalogues.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const MANIFEST = join(WEB, 'lib/catalogues.ts');
const DIR = join(WEB, 'public/catalogues');

const fail = [];
const src = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : '';
if (!src) fail.push('apps/web/lib/catalogues.ts is missing — the manifest is the whole design');

/* ── parse the manifest ──────────────────────────────────────────────────── */
const records = [];
for (const m of src.matchAll(/\{\s*\n\s*id: '(\d{2})',[\s\S]*?\n  \},/g)) {
  const b = m[0];
  records.push({
    id: m[1],
    slug: /slug: '([a-z0-9-]+)'/.exec(b)?.[1] ?? null,
    file: /file: '([^']+)'/.exec(b)?.[1] ?? null,
    title: /title: '([^']*)'/.exec(b)?.[1] ?? '',
    kicker: /kicker: '([^']*)'/.exec(b)?.[1] ?? '',
    purpose: /purpose:\s*\n?\s*'([^']*)'/.exec(b)?.[1] ?? '',
    series: /series: '([a-z]+)'/.exec(b)?.[1] ?? null,
    related: [...b.matchAll(/href: '([^']+)'/g)].map((x) => x[1]),
    block: b,
  });
}
if (records.length < 5) {
  fail.push(`read only ${records.length} catalogue(s) from the manifest — the reader is blind, fix it rather than deleting this guard`);
}

/* ── 1 + 2. the manifest and the directory agree ─────────────────────────── */
const onDisk = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.pdf')) : [];
if (!existsSync(DIR)) fail.push('apps/web/public/catalogues does not exist');

const listed = new Set(records.map((r) => r.file).filter(Boolean));
for (const r of records) {
  if (!r.file) { fail.push(`catalogue ${r.id} has no file`); continue; }
  if (!onDisk.includes(r.file)) {
    fail.push(
      `${r.id} lists ${r.file}, which is not in apps/web/public/catalogues. Every machine surface on this ` +
        'site would advertise a document the host cannot serve.',
    );
  }
}
for (const f of onDisk) {
  if (!listed.has(f)) {
    fail.push(
      `${f} is on disk and in no manifest entry. It is served but unfindable: absent from /catalogues, the ` +
        'sitemap, llms.txt and the API — and absent from the PDF fact check, so nothing is reading it for ' +
        'retired claims.',
    );
  }
}

/* ── 3. filenames and ids ────────────────────────────────────────────────── */
const seenId = new Set();
const seenSlug = new Set();
for (const r of records) {
  if (seenId.has(r.id)) fail.push(`duplicate catalogue id ${r.id}`);
  seenId.add(r.id);
  if (r.slug) {
    if (seenSlug.has(r.slug)) fail.push(`duplicate catalogue slug ${r.slug}`);
    seenSlug.add(r.slug);
  } else fail.push(`catalogue ${r.id} has no slug — the anchor on /catalogues comes from it`);
  if (r.file && !new RegExp(`^Ecowoods_${r.id}_[A-Za-z0-9_]+\\.pdf$`).test(r.file)) {
    fail.push(
      `${r.file} does not match Ecowoods_${r.id}_<Name>.pdf. The filename is the public identifier — it is in ` +
        'the URL, the sitemap and /llms.txt, and somebody has printed it.',
    );
  }
}

/* ── 4 + 5. every link resolves ──────────────────────────────────────────── */
const routes = new Set();
(function walk(dir, url) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name.startsWith('.')) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, /^\(.*\)$/.test(name.name) ? url : `${url}/${name.name}`);
    else if (name.name === 'page.tsx') routes.add(url === '' ? '/' : url);
  }
})(join(WEB, 'app'), '');

const slugsOf = (rel, key = 'slug') => {
  const p = join(WEB, rel);
  if (!existsSync(p)) return new Set();
  const re = new RegExp(`\\b${key}:\\s*'([a-z0-9-]+)'`, 'g');
  return new Set([...readFileSync(p, 'utf8').matchAll(re)].map((m) => m[1]));
};
const DYN = {
  '/guides': slugsOf('lib/guides.ts'),
  '/papers': slugsOf('lib/papers.ts'),
  '/glossary': slugsOf('lib/glossary.ts'),
  '/services': slugsOf('lib/service-pages.ts'),
};
const resolves = (href) => {
  const path = href.split('#')[0].split('?')[0] || '/';
  if (routes.has(path)) return true;
  const i = path.lastIndexOf('/');
  const parent = path.slice(0, i);
  const slug = path.slice(i + 1);
  if (DYN[parent]) return DYN[parent].has(slug);
  /* One-file-per-record families. */
  for (const [prefix, dir, key] of [
    ['/projects', 'content/projects', 'slug'],
    ['/equipment', 'content/equipment', 'id'],
    ['/corridors', 'content/geo', 'id'],
  ]) {
    if (parent !== prefix) continue;
    const d = join(WEB, dir);
    if (!existsSync(d)) return false;
    const re = new RegExp(`\\b${key}:\\s*'${slug}'`);
    return readdirSync(d).some((f) => /\.tsx?$/.test(f) && re.test(readFileSync(join(d, f), 'utf8')));
  }
  return false;
};

for (const r of records) {
  if (!r.related.length) {
    fail.push(`catalogue ${r.id} has no related page. Every document has a page that argues it at length; say which.`);
  }
  for (const href of r.related) {
    if (!resolves(href)) fail.push(`catalogue ${r.id} links to ${href}, which is not a route this repository generates`);
  }
}

const railsBlock = /CATALOGUE_RAILS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src);
if (!railsBlock) fail.push('could not read CATALOGUE_RAILS — the rails decide which page carries which document');
else {
  for (const m of railsBlock[1].matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
    if (!resolves(m[1])) fail.push(`CATALOGUE_RAILS names route ${m[1]}, which does not exist`);
    for (const idm of m[2].matchAll(/'(\d{2})'/g)) {
      if (!seenId.has(idm[1])) fail.push(`CATALOGUE_RAILS route ${m[1]} names catalogue ${idm[1]}, which is not in the manifest`);
    }
  }
}

/* ── 6. no restated figure ───────────────────────────────────────────────── */
for (const r of records) {
  const prose = `${r.title} ${r.kicker} ${r.purpose}`;
  if (/\$\s?\d/.test(prose)) fail.push(`catalogue ${r.id} restates a price. Prices live in content/constants/pricing.ts.`);
  if (/\b\d+(\.\d+)?\s?%/.test(prose)) fail.push(`catalogue ${r.id} restates a percentage`);
  if (/\b(19|20)\d{2}\b/.test(prose)) {
    fail.push(`catalogue ${r.id} carries a four-digit year in prose. The edition year is the \`year\` field; two copies drift.`);
  }
}

/* ── 7. the surfaces derive rather than repeat ───────────────────────────── */
const page = existsSync(join(WEB, 'app/catalogues/page.tsx'))
  ? readFileSync(join(WEB, 'app/catalogues/page.tsx'), 'utf8')
  : '';
if (!page) fail.push('apps/web/app/catalogues/page.tsx is missing');
else if (/Ecowoods_\d{2}_/.test(page)) {
  fail.push(
    'app/catalogues/page.tsx names a catalogue filename directly. The page renders the manifest; a filename ' +
      'typed into it is a second list that will not be updated when a document is added.',
  );
}
const handlers = existsSync(join(WEB, 'lib/registry/handlers.ts'))
  ? readFileSync(join(WEB, 'lib/registry/handlers.ts'), 'utf8')
  : '';
if (handlers && !/getPublishedCatalogues\(\)/.test(handlers)) {
  fail.push(
    '/api/v1/catalogues no longer gates on getPublishedCatalogues(). The API would list a document whose file ' +
      'is absent, which is the one thing an index of downloadable files may not do.',
  );
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ catalogues: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}

console.log(
  `✓ catalogues verified — ${records.length} document(s), every file on disk and in the manifest, every related ` +
    'page resolves, no restated price, percentage or year',
);
