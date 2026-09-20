#!/usr/bin/env node
/**
 * verify-media.mjs — the guard on the photographic records.
 *
 * FOUR FAILURES THIS MAKES IMPOSSIBLE TO MERGE
 *
 * 1. A REGISTERED PLATE THAT IS NOT ON DISK. The registry is typed data and
 *    the files are promoted by a script; nothing in TypeScript connects the
 *    two. A renamed plate builds green, deploys green, and renders a broken
 *    image on a page whose entire job is to show photographs.
 *
 * 2. A CIVIC ADDRESS. Every published case study on this site was stripped of
 *    a private street address in August (F-176), and the campaign material
 *    these records come from carries one. A number-and-street pattern anywhere
 *    in a project registry fails the build.
 *
 * 3. AN EMPTY OR USELESS ALT. "Image of a stair" is what a screen reader
 *    announces instead of the room. Alt text that starts with "image of",
 *    "photo of" or "picture of" is rejected, and so is anything under 20
 *    characters.
 *
 * 4. A PAIR POINTING AT A PLATE THAT DOES NOT EXIST. A before/after with one
 *    half missing renders as a single frame labelled "Before", which is worse
 *    than showing nothing.
 *
 * Dependency-free. It reads the registry as text rather than importing it, so
 * it runs in the pre-build gate with no compilation and no bundler.
 *
 * Run:  pnpm verify:media
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'apps/web/content/projects');
const PUBLIC = join(ROOT, 'apps/web/public');

if (!existsSync(DIR)) {
  console.error('✗ apps/web/content/projects not found — run from the repo root');
  process.exit(1);
}

const errors = [];
let plates = 0;
let films = 0;
let promoted = true;

const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
if (files.length === 0) errors.push('no project registries found — apps/web/content/projects is empty');

for (const name of files) {
  const path = join(DIR, name);
  const src = readFileSync(path, 'utf8');
  const where = relative(ROOT, path);

  /* Strip block comments: the header explains WHY there is no street address,
     and the explanation must not trip the check it is explaining. */
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '');

  /* 2 — a civic address. Number, space, capitalised street word. */
  for (const m of body.matchAll(/\b\d{1,5}\s+[A-Z][a-z]+\s+(Crescent|Cres|Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Court|Ct|Place|Pl|Lane|Way|Terrace|Trail)\b/g)) {
    const line = body.slice(0, m.index).split('\n').length;
    errors.push(`${where}:${line} contains what looks like a private street address ("${m[0]}"). Neighbourhood resolution and no finer — see lib/content/case-study-types.ts for why.`);
  }

  /* 1 — every src resolves to a file in public/.
     Paths in the registry are built from short consts (`const F = '/films/…'`)
     so the file reads cleanly; those are expanded here rather than skipped —
     a check that silently ignores every templated path checks nothing. */
  const consts = Object.fromEntries(
    [...body.matchAll(/^const ([A-Z]) = '([^']+)';$/gm)].map((m) => [m[1], m[2]]),
  );
  const expand = (raw) => raw.replace(/\$\{([A-Z])\}/g, (whole, k) => consts[k] ?? whole);

  for (const m of body.matchAll(/src:\s*`?([^'"`\s,]*\/(?:proof|films)\/[^'"`\s,]+|\$\{[A-Z]\}\/[^'"`\s,]+)/g)) {
    const rel = expand(m[1]);
    if (rel.includes('${')) continue;
    const line = body.slice(0, m.index).split('\n').length;
    const onDisk = join(PUBLIC, rel);
    if (!existsSync(onDisk)) {
      errors.push(`${where}:${line} registers ${rel}, which is not in apps/web/public. Run: node scripts/promote-giorgia-media.mjs`);
    } else if (statSync(onDisk).size === 0) {
      errors.push(`${where}:${line} registers ${rel}, which is a zero-byte file.`);
    }
    if (rel.startsWith('/films/')) films += 1;
    else plates += 1;
  }

  /* The helper-built stills use a template; count them by their factory call
     and check the promoted directory exists at all. Each registry names its
     own base path in a `const P = '/proof/<slug>'` — read from that rather
     than assuming every project lives under maple-vaughan's, which broke the
     moment a second project registry existed. */
  const base = consts.P ?? '/proof/maple-vaughan-curved-stair';
  const helperCalls = [...body.matchAll(/\bstill\(\s*([12])\s*,\s*(\d+)\s*,\s*'([^']+)'/g)];
  for (const m of helperCalls) {
    const [, chapter, order, stem] = m;
    const file = `${base}/ch${chapter}/${String(order).padStart(2, '0')}_${stem}.webp`;
    if (!existsSync(join(PUBLIC, file))) {
      promoted = false;
      const line = body.slice(0, m.index).split('\n').length;
      errors.push(`${where}:${line} registers ${file}, which is not in apps/web/public. Run: node scripts/promote-giorgia-media.mjs`);
    } else {
      plates += 1;
    }
  }

  /* 3 — alt text quality. */
  for (const m of body.matchAll(/'([^']{0,400}?)'\s*,\s*'(?:center|\d+% \d+%)'/g)) {
    const alt = m[1];
    const line = body.slice(0, m.index).split('\n').length;
    if (alt.length < 20) errors.push(`${where}:${line} alt text is too short to describe a room: "${alt}"`);
    if (/^(an?\s+)?(image|photo|photograph|picture)\s+of/i.test(alt)) {
      errors.push(`${where}:${line} alt text starts with "${alt.slice(0, 24)}…" — a screen reader already says it is an image. Describe the room.`);
    }
  }

  /* 4 — pairs point at ids that exist. */
  const ids = new Set([...body.matchAll(/id:\s*`ch\$\{chapter\}-/g)].length ? [] : []);
  const declaredIds = new Set(
    helperCalls.map(([, c, o]) => `ch${c}-${String(o).padStart(2, '0')}`),
  );
  for (const m of body.matchAll(/(beforeStillId|afterStillId|posterStillId):\s*'([^']+)'/g)) {
    if (declaredIds.size && !declaredIds.has(m[2])) {
      const line = body.slice(0, m.index).split('\n').length;
      errors.push(`${where}:${line} ${m[1]} points at "${m[2]}", which is not a registered still.`);
    }
  }
  void ids;
}

if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  if (!promoted) {
    console.error('\n  The archives are in the repository root; the promotion script turns them');
    console.error('  into webp and mp4 under apps/web/public and is idempotent.');
  }
  console.error(`\n✗ media: ${errors.length} problem(s)`);
  process.exit(1);
}

console.log(`✓ media verified — ${files.length} project(s), ${plates} plate(s) and ${films} film(s) on disk, alt text present, no civic address`);
