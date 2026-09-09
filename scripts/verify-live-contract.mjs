#!/usr/bin/env node
/**
 * scripts/verify-live-contract.mjs — the live checks must assert things this
 * repository can actually produce, and point at files that actually exist.
 *
 * TWO FAILURES ON THE SAME DAY, BOTH OF THIS SHAPE
 *
 * The first time production was checked properly after a deploy, both of these
 * turned up, and neither was a fault in the site:
 *
 *  1. scripts/verify-live.sh asserted that /llms-full.txt contains the phrase
 *     "complete technical corpus". The generator says "complete published
 *     corpus" and has for some time. The live check had therefore been
 *     guaranteed to fail on every run since the wording changed, on a file that
 *     was correct — 265 KB of correct corpus reported as a broken deploy. That
 *     is the exact failure mode verify-live.sh's own header warns about: "the
 *     moment it cries wolf, the next real failure gets waved through".
 *
 *  2. Five places across four files told the operator to "follow
 *     old-domain/EXECUTE.md". That file did not exist. The old domain has been
 *     answering 200 on 35 URLs — a second live site competing with ecowoods.ca
 *     for the same entity, holding 22 customer testimonials — and the runbook
 *     every guard pointed at was not there to follow. An instruction that names
 *     a missing file does not read as an error; it reads as a task somebody
 *     else already documented.
 *
 * Both are unfalsifiable from inside the site: no amount of correct production
 * makes either pass. So they are checked here, offline, before a deploy.
 *
 * WHAT IS CHECKED
 *
 *  1. Every `md_check … "<want>"` string in verify-live.sh appears literally in
 *     the generator that produces that document. If it does not, the live check
 *     can only ever fail.
 *  2. Every repository path named inside scripts/ under old-domain/ or docs/
 *     exists. A guard that tells you to read a file is making a promise.
 *
 *   node scripts/verify-live-contract.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCRIPTS = join(ROOT, 'scripts');
const LIVE = join(SCRIPTS, 'verify-live.sh');
const GENERATOR = join(ROOT, 'apps/web/lib/markdown-export.ts');

const fail = [];

/* ── 1. the live markers exist in the generator ──────────────────────────── */
if (!existsSync(LIVE)) {
  fail.push('scripts/verify-live.sh is missing — the live check is the only thing that proves a deploy');
} else if (!existsSync(GENERATOR)) {
  fail.push('apps/web/lib/markdown-export.ts is missing — every markdown surface comes from it');
} else {
  const live = readFileSync(LIVE, 'utf8');
  const gen = readFileSync(GENERATOR, 'utf8');

  const wants = [...live.matchAll(/^md_check\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"\s*$/gm)].map(
    (m) => ({ label: m[1], url: m[2], want: m[3] }),
  );

  if (!wants.length) {
    fail.push(
      'read no md_check lines from verify-live.sh. Either they moved or their shape changed and this ' +
        'guard is now blind — fix the reader rather than deleting the check.',
    );
  }

  for (const w of wants) {
    if (!gen.includes(w.want)) {
      fail.push(
        `verify-live.sh asserts ${w.label} contains "${w.want}", but that string does not appear in ` +
          'apps/web/lib/markdown-export.ts. The live check cannot pass, whatever production does. ' +
          'Either the generator was reworded and the assertion was not, or the assertion is a guess.',
      );
    }
  }
}

/* ── 2. every file a guard tells you to read exists ──────────────────────── */
/**
 * Deliberately narrow: old-domain/ and docs/ are where this repository keeps
 * the things a guard sends a human to read. Widening it to any path anywhere
 * would sweep up example paths in prose and teach people to ignore this.
 */
const REFERENCED = /\b((?:old-domain|docs)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)/g;
const missing = new Map();

/**
 * Only lines that INSTRUCT. `state-of-truth.sh` asserts that
 * old-domain/vercel.json is absent — it is a loaded gun that was removed on
 * purpose — and a guard which demanded that every mentioned path exist would
 * demand the return of a file another guard exists to keep out.
 */
const INSTRUCTS = /\b(see|follow|read|steps|described in|documented in|explains|tells you|use)\b/i;

for (const name of readdirSync(SCRIPTS)) {
  if (!/\.(mjs|sh)$/.test(name)) continue;
  const src = readFileSync(join(SCRIPTS, name), 'utf8');
  const lineAt = (i) => src.slice(src.lastIndexOf('\n', i) + 1, (src.indexOf('\n', i) + 1 || src.length) - 1);
  for (const m of src.matchAll(REFERENCED)) {
    if (!INSTRUCTS.test(lineAt(m.index))) continue;
    /* Prose ends in a full stop, and `old-domain/path-map.json.` is the same
       file as `old-domain/path-map.json`. Trim sentence punctuation before
       asking the filesystem, or this guard invents six missing files. */
    const rel = m[1].replace(/[.,;:)]+$/, '');
    /* A trailing-directory mention like `old-domain/` is a folder, not a file. */
    if (rel.endsWith('/') || !/\.[A-Za-z0-9]+$/.test(rel)) continue;
    if (existsSync(join(ROOT, rel))) continue;
    /* Generated outputs are allowed to be absent before the first build only if
       the generator writes them; both of ours are committed, so no exception. */
    if (!missing.has(rel)) missing.set(rel, new Set());
    missing.get(rel).add(`scripts/${name}`);
  }
}

for (const [rel, where] of missing) {
  fail.push(
    `${rel} does not exist, and ${[...where].join(', ')} tell${where.size === 1 ? 's' : ''} an operator to ` +
      'use it. An instruction naming a missing file does not read as an error — it reads as a task ' +
      'somebody else already documented.',
  );
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ live contract: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}

console.log('✓ live contract verified — every live assertion exists in its generator, every referenced runbook is on disk');
