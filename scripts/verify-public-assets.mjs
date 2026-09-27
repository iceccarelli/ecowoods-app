#!/usr/bin/env node
/**
 * verify-public-assets.mjs — the guard on the static root.
 *
 * THE DEFECT IT EXISTS FOR
 *
 * Every one of the 422 files under apps/web/public returned 404 in production,
 * for months, because Vercel takes its static root from the repository root
 * while this project builds out of apps/web. docs/PUBLIC_ASSETS.md has the
 * measurements. The build command now copies one into the other.
 *
 * WHAT THIS CHECKS
 *
 *  1. The sync clause is still in vercel.json's buildCommand. Remove it and
 *     every raw-path asset on the site 404s again, silently, with a green
 *     build and a green test suite — which is exactly how it went unnoticed
 *     the first time.
 *
 *  2. No path exists in BOTH trees with different bytes. `cp -R` lets the app
 *     copy win, so a root file of the same name is a file that quietly stops
 *     being served. Same name, same bytes is fine and is what the sync itself
 *     produces.
 *
 *  3. Nothing in apps/web/public is large enough to be a mistake, UNLESS it is
 *     first-party film/audio media that is actually tracked by Git LFS. An
 *     ordinary static asset (an image, a font, a stray zip) has no business
 *     being 25+ MB — that is still almost always a mistake, so the 25 MB cap
 *     stays exactly where it was for everything else. But apps/web/public/films
 *     is real first-party video and audio (docs/PUBLIC_ASSETS.md, lib/films.ts),
 *     Git LFS is how this repo stores it (.gitattributes tracks *.mp4/*.m4a/
 *     *.mov/*.webm), and Vercel's own documented static-file ceiling is 100 MB
 *     on Hobby / 1 GB on Pro — the 25 MB figure was never Vercel's limit, it
 *     was this repo's own heuristic for "did somebody forget object storage."
 *     A file only gets the higher MAX_LFS_BYTES ceiling if `git check-attr`
 *     confirms `filter: lfs` for it — matching the extension is not enough,
 *     because that would silently exempt any future *.mp4 that was NOT
 *     actually LFS-tracked (checked in as a plain multi-MB git blob, which is
 *     the exact mistake this guard exists to catch — see 6ad3fc5's own history
 *     of shipping LFS pointer text for files that then needed `git lfs pull`).
 *
 * WHAT IT CANNOT DO
 *
 * Prove the fix. `next start` serves apps/web/public correctly and always did,
 * so a local check passes whether or not the deployment is broken. The
 * production curl in the command block is the real verification — the same
 * lesson the Access-Control-Allow-Origin note in next.config.js records.
 *
 * It also cannot prove Vercel's Git LFS project setting is enabled — that is a
 * dashboard toggle (Project → Settings → Git → Git Large File Storage), not
 * anything expressible in this repository. Without it, Vercel checks out LFS
 * *pointer* text instead of the real objects, which 404s or serves garbage in
 * production while every check here stays green — the same class of gap the
 * buildCommand sync clause has.
 *
 * Run:  pnpm verify:assets:public
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP_PUBLIC = join(ROOT, 'apps/web/public');
const ROOT_PUBLIC = join(ROOT, 'public');
const VERCEL = join(ROOT, 'vercel.json');
const MAX_BYTES = 25 * 1024 * 1024;
/* Vercel's documented Hobby-tier static-file ceiling — the conservative of its
   two published limits (100 MB Hobby / 1 GB Pro), so this guard does not pass
   a file that would fail on the cheaper tier. */
const MAX_LFS_BYTES = 100 * 1024 * 1024;

/** True only when `git check-attr` reports this path is actually filtered
 *  through Git LFS — not merely that its extension matches .gitattributes. */
const isLfsTracked = (relFromRoot) => {
  try {
    const out = execFileSync('git', ['check-attr', 'filter', '--', relFromRoot], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out.trim().endsWith('filter: lfs');
  } catch {
    return false;
  }
};

const errors = [];

if (!existsSync(VERCEL)) {
  console.error('✗ vercel.json not found — run from the repo root');
  process.exit(1);
}

const vercel = JSON.parse(readFileSync(VERCEL, 'utf8'));
const build = String(vercel.buildCommand ?? '');
if (!/apps\/web\/public\/\.\s+public\//.test(build)) {
  errors.push(
    'vercel.json buildCommand no longer copies apps/web/public into public/.\n' +
      `    Found: ${build || '(none)'}\n` +
      '    Without it, every raw-path asset on the site 404s in production while the\n' +
      '    build stays green. docs/PUBLIC_ASSETS.md has the measurements.',
  );
}

const walk = (dir, base = dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, base, out);
    else out.push({ rel: relative(base, p), abs: p, size: s.size });
  }
  return out;
};

const appFiles = walk(APP_PUBLIC);
const rootFiles = walk(ROOT_PUBLIC);
const rootByRel = new Map(rootFiles.map((f) => [f.rel, f]));

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

let collisions = 0;
for (const f of appFiles) {
  const twin = rootByRel.get(f.rel);
  if (twin && sha(twin.abs) !== sha(f.abs)) {
    collisions += 1;
    errors.push(
      `public/${f.rel} exists in both trees with different content.\n` +
        '    The build-time copy lets the apps/web version win, so the root file is being\n' +
        '    served today and will stop being served the moment a deploy runs. Delete one.',
    );
  }
  if (f.size > MAX_BYTES) {
    const relFromRoot = relative(ROOT, f.abs);
    if (isLfsTracked(relFromRoot) && f.size <= MAX_LFS_BYTES) {
      // First-party media, actually LFS-tracked, under Vercel's own ceiling — fine.
    } else if (isLfsTracked(relFromRoot)) {
      errors.push(
        `apps/web/public/${f.rel} is ${(f.size / 1e6).toFixed(1)} MB, over the ${(MAX_LFS_BYTES / 1e6).toFixed(0)} MB ` +
          'ceiling even for LFS-tracked media — that is past Vercel’s own Hobby-tier static-file limit. Put it behind object storage.',
      );
    } else {
      errors.push(
        `apps/web/public/${f.rel} is ${(f.size / 1e6).toFixed(1)} MB and is not Git LFS-tracked. A static root is not` +
          ' object storage — either track it with Git LFS (if it is genuine first-party media) or put it behind a bucket.',
      );
    }
  }
}

if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ public assets: ${errors.length} problem(s)`);
  process.exit(1);
}

const totalMb = appFiles.reduce((n, f) => n + f.size, 0) / 1e6;
console.log(
  `✓ public assets verified — ${appFiles.length} file(s) in apps/web/public (${totalMb.toFixed(1)} MB) ` +
    `synced into the static root at build time, ${rootFiles.length} at the root, ${collisions} collision(s)`,
);
