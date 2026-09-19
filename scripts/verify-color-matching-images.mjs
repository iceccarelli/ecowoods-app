#!/usr/bin/env node
/**
 * scripts/verify-color-matching-images.mjs
 *
 * The orphan check for the 2026 colour-matching illustration pack: every
 * basename on disk under the five public/images/{...} folders must (1) have a
 * static import in data/color-matching-images.ts and (2) be referenced by id
 * in at least one .tsx file under apps/web/app — i.e. actually drawn by a
 * page, not just bundled and sitemapped. Same principle as the "every slot
 * must actually be drawn by a page" guard in verify-images.mjs (F-131
 * inverted), applied to this pack's own five folders rather than
 * public/illustrations.
 *
 *   node scripts/verify-color-matching-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IMAGE_DIRS = ['color-matching', 'guides', 'species', 'services', 'case-studies'];
const PUBLIC_ROOT = path.join(ROOT, 'apps/web/public/images');
const DATA_MODULE = path.join(ROOT, 'apps/web/app/data/color-matching-images.ts');
const APP_DIR = path.join(ROOT, 'apps/web/app');
const MANIFEST = path.join(ROOT, 'scripts/fixtures/color-matching-manifest.csv');

const problems = [];
const fail = (m) => problems.push(m);

if (!fs.existsSync(MANIFEST)) fail(`${path.relative(ROOT, MANIFEST)} is missing.`);
if (!fs.existsSync(DATA_MODULE)) {
  fail(`${path.relative(ROOT, DATA_MODULE)} is missing. Run: node scripts/gen-color-matching-imports.mjs`);
}

const onDisk = [];
for (const dir of IMAGE_DIRS) {
  const full = path.join(PUBLIC_ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (/\.(webp|jpg|jpeg)$/i.test(f)) onDisk.push({ dir, file: f, id: f.replace(/\.(webp|jpg|jpeg)$/i, '') });
  }
}
if (!onDisk.length) fail('No files found under apps/web/public/images/{color-matching,guides,species,services,case-studies}.');

const basenames = new Set(onDisk.map((f) => f.id));

/* Every basename must have both a .webp and a .jpg — the pack ships both, and
   verify-images.mjs's counterpart to this check (the illustration pipeline)
   only cares about .webp because that pipeline never had a .jpg in the first
   place. Here a lone .jpg with no .webp would silently ship a runtime image
   nothing imports; a lone .webp with no .jpg is a dropped source/archive copy. */
const byExt = new Map();
for (const f of onDisk) {
  const ext = path.extname(f.file).slice(1).toLowerCase();
  if (!byExt.has(f.id)) byExt.set(f.id, new Set());
  byExt.get(f.id).add(ext);
}
for (const [id, exts] of byExt) {
  if (!exts.has('webp')) fail(`"${id}" has no .webp — next/image needs the webp for runtime use.`);
  if (!exts.has('jpg') && !exts.has('jpeg')) fail(`"${id}" has no .jpg source/archive copy.`);
}

/* Every basename must be statically imported — public/ is not served on this
   deployment (F-131), so an un-imported file is a broken icon in production
   even though it is genuinely on disk and genuinely committed. */
const dataSrc = fs.existsSync(DATA_MODULE) ? fs.readFileSync(DATA_MODULE, 'utf8') : '';
for (const id of basenames) {
  if (!dataSrc.includes(`'${id}': `)) {
    fail(`"${id}" has no static import in ${path.relative(ROOT, DATA_MODULE)}. Run: node scripts/gen-color-matching-imports.mjs`);
  }
}
for (const m of dataSrc.matchAll(/^  '([a-z0-9-]+)': \{$/gm)) {
  if (!basenames.has(m[1])) {
    fail(`${path.relative(ROOT, DATA_MODULE)} carries metadata for "${m[1]}", which is not on disk — regenerate it.`);
  }
}

/* Every basename must actually be drawn by some page — bundled and imported
   is not the same fact as rendered. Read every .tsx under apps/web/app for a
   literal id, same technique verify-images.mjs uses for the illustration
   corpus (JSX writes id="foo" with double quotes, a map writes 'foo' with
   single — both are read). */
const drawn = new Set();
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules') walk(full);
      continue;
    }
    if (!/\.tsx$/.test(ent.name)) continue;
    if (full === DATA_MODULE) continue;
    const body = fs.readFileSync(full, 'utf8');
    for (const m of body.matchAll(/['"]([a-z0-9]+(?:-[a-z0-9]+)+)['"]/g)) drawn.add(m[1]);
  }
})(APP_DIR);

const orphans = [...basenames].filter((id) => !drawn.has(id)).sort();
if (orphans.length) {
  fail(
    `${orphans.length} basename(s) are on disk and imported but drawn by no page:\n` +
      orphans.map((o) => `        ${o}`).join('\n') +
      `\n      Render each with <ColorMatchFigure id="…" />, a FigureRotator slide, or a RotatingTile shot.`,
  );
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} colour-matching image problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ colour-matching images verified — ${basenames.size} basename(s), ${onDisk.length} file(s) on disk, all imported and all drawn`,
);
