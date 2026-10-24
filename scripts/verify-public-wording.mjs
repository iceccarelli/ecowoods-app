#!/usr/bin/env node
/**
 * scripts/verify-public-wording.mjs — no internal-process language on any
 * customer-visible or machine-readable surface.
 *
 * Customer copy, llms.txt, llms-full.txt, ai.txt, the markdown twins, /api/v1
 * and JSON-LD are read by buyers and by AI systems that quote them. Audit
 * references ("F-157"), engineering status words ("pending_key", "unproven",
 * "NONE RECORDED") and to-do markers do not belong there. Where one appears the
 * fix is to correct the underlying fact or delete the sentence, then say it in
 * plain customer language.
 *
 * Two checks:
 *
 *   1. REGISTRY. Every claim allowed in the `machine` context must carry a
 *      customer-readable `publicSource`, and neither `publicSource` nor
 *      `publicNote` may contain process language. /api/v1 publishes those two
 *      fields, never the internal `source` and `note`.
 *
 *   2. SOURCE. Code comments are stripped, then the files that produce public
 *      text are scanned. /assistant, admin, portal, auth and tests are out of
 *      scope here.
 *
 * Run via `pnpm verify:wording` (also joined by `pnpm verify`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'apps/web');

export const BANNED = [
  [/\bF-\d{2,3}\b/, 'audit finding reference'],
  [/\bunproven\b/i, '"unproven"'],
  [/\bwe cannot claim\b/i, '"we cannot claim"'],
  [/\bnot finished\b/i, '"not finished"'],
  [/\bpending[ -]verification\b/i, '"pending verification"'],
  [/\bpending_key\b/, 'engineering status "pending_key"'],
  [/\bNONE RECORDED\b/, '"NONE RECORDED"'],
  [/\bNamed but not published\b/i, '"named but not published"'],
  [/\bfenced (out|to)\b/i, 'engineering term "fenced"'],
  [/\b(TODO|TBD|WIP|FIXME)\b/, 'to-do marker'],
  [/\bplaceholder\b(?!\s*[=:'"])/i, '"placeholder"'],
  [/\bsee audit\//i, 'audit-file reference'],
];

/**
 * Remove block, JSX and line comments while leaving string and template
 * literals (and the URLs inside them) intact. Comment text is blanked, not
 * deleted, so line numbers still match the file.
 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (c !== '`' && src[j] === '\n') break;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const files = [];
function walk(dir, test) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'tests'].includes(e.name)) continue;
      walk(p, test);
    } else if (test(p)) files.push(p);
  }
}

/**
 * Deny-list, so a new public route is scanned by default. Out of scope: the
 * /assistant workspace (preserved as shipped), signed-in and admin areas,
 * the Floor Studio engine, tests and generated image data.
 */
const EXCLUDE = [
  /^app\/assistant\//, /^app\/admin\//, /^app\/\(portal\)\//, /^app\/\(auth\)\//,
  /^app\/api\/(?!v1\/|knowledge\/)/, /^app\/data\//, /^app\/globals\.css/,
  /^lib\/assistant-workspace\//, /^lib\/floor-studio\//, /^lib\/actions\//, /^lib\/auth\.ts$/, /^lib\/ai\.ts$/, // admin-only prompt templates
  /^content\/claims\.ts$/, // engineering source/note live here; check 1 covers what is published
];
for (const dir of ['app', 'lib', 'content']) {
  walk(path.join(WEB, dir), (f) => /\.(ts|tsx|md|json)$/.test(f) && !/\.test\.|\.d\.ts$/.test(f));
}

const problems = [];
for (const f of [...new Set(files)]) {
  const rel = path.relative(WEB, f);
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const [re, why] of BANNED) {
      if (re.test(line)) problems.push(`${rel}:${i + 1}  ${why}: ${line.trim().slice(0, 110)}`);
    }
  });
}

/* Check 1 — the claims registry, loaded through the repo's TS loader. */
const flags = ['--no-warnings', ...(process.features.typescript ? [] : ['--experimental-strip-types']), '--import', path.join(ROOT, 'scripts/lib/ts-register.mjs')];
const probe = `
  import { CLAIMS } from ${JSON.stringify(path.join(WEB, 'content/claims.ts'))};
  const out = CLAIMS.filter((c) => c.allowedContexts.includes('machine')).map((c) => ({ id: c.id, publicSource: c.publicSource ?? '', publicNote: c.publicNote ?? '' }));
  console.log(JSON.stringify(out));
`;
const r = spawnSync(process.execPath, [...flags, '--input-type=module', '-e', probe], { encoding: 'utf8' });
if (r.status !== 0) {
  problems.push(`claims registry could not be loaded: ${(r.stderr || '').trim().split('\n').slice(-2).join(' ')}`);
} else {
  for (const c of JSON.parse(r.stdout.trim().split('\n').pop())) {
    if (!c.publicSource.trim()) problems.push(`content/claims.ts  claim ${c.id} is published to machines with no publicSource`);
    for (const [re, why] of BANNED) {
      if (re.test(c.publicSource) || re.test(c.publicNote)) problems.push(`content/claims.ts  claim ${c.id} public provenance has ${why}`);
    }
  }
}

if (problems.length) {
  console.error(`✗ verify:wording — ${problems.length} internal-process phrase(s) on public surfaces:\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`✓ verify:wording — ${new Set(files).size} public-surface files and the machine claim registry are free of internal-process language`);
