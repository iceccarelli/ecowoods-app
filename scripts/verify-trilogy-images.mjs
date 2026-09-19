#!/usr/bin/env node
/**
 * scripts/verify-trilogy-images.mjs
 *
 * The orphan check for the 20-trilogy real-photograph set, same principle as
 * verify-color-matching-images.mjs applied to this pack's own layout: every
 * `<slug>/0N` on disk under public/images/trilogies must (1) have a static
 * import in app/data/trilogy-images.ts, (2) have an entry in lib/trilogies.ts
 * (the only page that may render a trilogy's frames — everything else pulls
 * through that one module), and (3) be listed in TRILOGIES for a slug that is
 * actually reachable from at least one of the routes it claims.
 *
 *   node scripts/verify-trilogy-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, 'apps/web/public/images/trilogies');
const DATA_MODULE = path.join(ROOT, 'apps/web/app/data/trilogy-images.ts');
const LIB_MODULE = path.join(ROOT, 'apps/web/lib/trilogies.ts');
const APP_DIR = path.join(ROOT, 'apps/web/app');

const problems = [];
const fail = (m) => problems.push(m);

if (!fs.existsSync(PUBLIC_ROOT)) fail(`${path.relative(ROOT, PUBLIC_ROOT)} is missing.`);
if (!fs.existsSync(DATA_MODULE)) {
  fail(`${path.relative(ROOT, DATA_MODULE)} is missing. Run: node scripts/gen-trilogy-imports.mjs`);
}
if (!fs.existsSync(LIB_MODULE)) fail(`${path.relative(ROOT, LIB_MODULE)} is missing.`);

/* Every basename is "<slug>-0N" — one folder per job, three frames each,
   webp for runtime and jpg kept as the archive/source copy. */
const onDisk = [];
if (fs.existsSync(PUBLIC_ROOT)) {
  for (const slug of fs.readdirSync(PUBLIC_ROOT)) {
    const dir = path.join(PUBLIC_ROOT, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^0[1-3]\.(webp|jpe?g)$/i.test(f)) {
        onDisk.push({ slug, file: f, id: `${slug}-${f.replace(/\.(webp|jpe?g)$/i, '')}` });
      }
    }
  }
}
if (!onDisk.length) fail('No files found under apps/web/public/images/trilogies/<slug>/0N.{webp,jpg}.');

const basenames = new Set(onDisk.map((f) => f.id));

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
    fail(`"${id}" has no static import in ${path.relative(ROOT, DATA_MODULE)}. Run: node scripts/gen-trilogy-imports.mjs`);
  }
}
for (const m of dataSrc.matchAll(/^  '([a-z0-9-]+)': /gm)) {
  if (!basenames.has(m[1])) {
    fail(`${path.relative(ROOT, DATA_MODULE)} carries an import for "${m[1]}", which is not on disk — regenerate it.`);
  }
}

/* Every frame must have an entry in lib/trilogies.ts — bundled and imported is
   not the same fact as a page rendering it, and this pack has exactly one
   legitimate render path (TRILOGIES → trilogySlides/TrilogyHero), unlike the
   colour-matching pack's many hand-wired placements. */
const libSrc = fs.existsSync(LIB_MODULE) ? fs.readFileSync(LIB_MODULE, 'utf8') : '';
for (const id of basenames) {
  const [, slug, frame] = /^(.+)-(0[1-3])$/.exec(id) ?? [];
  if (!slug) continue;
  if (!libSrc.includes(`frame('${slug}', '${frame}',`)) {
    fail(`"${id}" is on disk and imported but has no frame() call in ${path.relative(ROOT, LIB_MODULE)}.`);
  }
}

const slugsOnDisk = new Set(onDisk.map((f) => f.slug));
for (const m of libSrc.matchAll(/^\s*slug: '([a-z0-9-]+)',$/gm)) {
  if (!slugsOnDisk.has(m[1])) {
    fail(`${path.relative(ROOT, LIB_MODULE)} declares slug "${m[1]}", which has no folder under ${path.relative(ROOT, PUBLIC_ROOT)}.`);
  }
}

/* Every slug must actually be reachable: either its own routes[] names a real
   page other than its own /projects/<slug> record, or /projects/[slug]'s
   fallback renders it (that page's own generateStaticParams pulls every
   TRILOGIES slug in, so this is always true today) — checked here anyway so a
   future rewrite of that fallback trips this guard instead of shipping a
   silent 404. */
const projectPageFile = path.join(APP_DIR, 'projects/[slug]/page.tsx');
if (!fs.existsSync(projectPageFile)) {
  fail(`${path.relative(ROOT, projectPageFile)} is missing — the trilogy story-page fallback lives there.`);
} else {
  const body = fs.readFileSync(projectPageFile, 'utf8');
  if (!body.includes('getTrilogy(slug)') || !body.includes('TrilogyProjectPage')) {
    fail(`${path.relative(ROOT, projectPageFile)} no longer wires getTrilogy()/TrilogyProjectPage — every trilogy slug would 404.`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} trilogy image problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ trilogy images verified — ${slugsOnDisk.size} job(s), ${onDisk.length} file(s) on disk, all imported and all in lib/trilogies.ts`,
);
