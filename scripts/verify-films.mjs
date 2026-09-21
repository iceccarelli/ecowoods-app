#!/usr/bin/env node
/**
 * verify-films.mjs — the guard on lib/films.ts, the film registry.
 *
 * WHY THIS EXISTS
 *
 * lib/films.ts is typed data, same as apps/web/content/projects/*.ts — but
 * verify-media.mjs only reads that directory. Nothing checked that a film
 * chapter's `src` or a series' `poster` import actually resolves to a file on
 * disk, so a renamed or un-moved mp4 would build green and 404 on a page whose
 * whole job is to play it.
 *
 * TWO FAILURES THIS MAKES IMPOSSIBLE TO MERGE
 *
 * 1. A REGISTERED CHAPTER WITH NO FILE ON DISK, or a zero-byte one.
 * 2. A FILM SOURCE FILE STILL SITTING AT THE REPO ROOT. Every mp4 belongs
 *    under apps/web/public/films/<slug>/ — see the note in lib/films.ts on
 *    why root is not a valid film home.
 *
 * Dependency-free. It reads lib/films.ts as text rather than importing it, so
 * it runs in the pre-build gate with no compilation and no bundler.
 *
 * Run:  pnpm verify:films
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FILE = join(ROOT, 'apps/web/lib/films.ts');
const PUBLIC = join(ROOT, 'apps/web/public');

if (!existsSync(FILE)) {
  console.error('✗ apps/web/lib/films.ts not found — run from the repo root');
  process.exit(1);
}

const errors = [];
const src = readFileSync(FILE, 'utf8');
const where = relative(ROOT, FILE);

/* 1 — every chapter src resolves to a non-empty file in apps/web/public. */
let chapters = 0;
for (const m of src.matchAll(/src:\s*'(\/films\/[^']+)'/g)) {
  chapters += 1;
  const rel = m[1];
  const line = src.slice(0, m.index).split('\n').length;
  const onDisk = join(PUBLIC, rel);
  if (!existsSync(onDisk)) {
    errors.push(`${where}:${line} registers ${rel}, which is not in apps/web/public/films.`);
  } else if (statSync(onDisk).size === 0) {
    errors.push(`${where}:${line} registers ${rel}, which is a zero-byte file.`);
  }
}

/* 1b — every poster import resolves too. */
let posters = 0;
for (const m of src.matchAll(/import\s+\w+\s+from\s+'(\.\.\/public\/films\/[^']+)';/g)) {
  posters += 1;
  const rel = m[1].replace(/^\.\.\/public/, '');
  const onDisk = join(PUBLIC, rel);
  if (!existsSync(onDisk)) {
    errors.push(`lib/films.ts imports a poster at ${rel}, which is not on disk.`);
  } else if (statSync(onDisk).size === 0) {
    errors.push(`lib/films.ts imports a poster at ${rel}, which is a zero-byte file.`);
  }
}

/* 2 — no film source file left at the repo root. A film's filename (the
   Title_Case originals this registry's own header describes moving, plus
   the registered basenames themselves) must not exist at the repo root. */
const rootFiles = readdirSync(ROOT).filter((f) => f.endsWith('.mp4'));
for (const f of rootFiles) {
  errors.push(`${f} is an mp4 sitting at the repo root. Every film lives under apps/web/public/films/<slug>/ — see lib/films.ts.`);
}

if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ films: ${errors.length} problem(s)`);
  process.exit(1);
}

console.log(`✓ films verified — ${chapters} chapter(s), ${posters} poster(s) on disk, root clean of stray mp4s`);
