#!/usr/bin/env node
/**
 * scripts/verify-claims.mjs — no unregistered claim reaches a customer.
 *
 *   pnpm seo:claims            report; fail on hard violations only
 *   pnpm seo:claims --strict   also fail on every unsourced claim in use
 *
 * WHAT IT CHECKS, IN THREE PASSES
 *
 * 1. HARD — a business fact typed as a literal where a constant exists.
 *    The current phone number, the current email, the founding year, a year
 *    count. verify-business-facts.mjs bans the RETIRED values; it cannot ban the
 *    current ones, because they legitimately appear in the constants module. So
 *    this pass bans them everywhere EXCEPT the constants module, which is the
 *    check that actually prevents the next drift rather than the last one.
 *
 * 2. HARD — a claim shape appearing in a context the registry forbids for it.
 *    Currently that means: a numeric performance percentage inside a schema
 *    builder. A percentage in prose is a sentence; the same percentage inside
 *    JSON-LD is a machine-readable assertion an answer engine repeats verbatim.
 *
 * 3. SOFT — every registered claim whose `status` is `unsourced`, listed with
 *    where it is currently used and what evidence would settle it. This is a
 *    queue, not a failure, until `--strict`. See UNSOURCED_DEADLINE in
 *    apps/web/content/claims.ts.
 *
 * WHY THE REGISTRY IS PARSED AND NOT IMPORTED
 *
 * Same reason as every other guard here: this script runs on a bare `node` with
 * no build step, no TypeScript, and no dependencies, so it works in a
 * three-second CI job before anyone waits on an install. It reads claims.ts as
 * text and extracts the fields it needs. The cost is that a syntax change to
 * the registry could silently reduce what this sees — so it FAILS if it cannot
 * find any claims at all, rather than reporting a clean run over nothing. That
 * is F-23's lesson, and it is the whole reason this line exists.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const REGISTRY = 'apps/web/content/claims.ts';
const CONSTANTS = 'packages/shared/constants/index.ts';
const OPT_OUT = 'claims-allow';

const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mdx', '.md']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/* ── the registry ─────────────────────────────────────────────────────────── */
const registrySrc = read(join(ROOT, REGISTRY));
const claims = [...registrySrc.matchAll(
  /\{\s*\n\s*id:\s*'([^']+)',([\s\S]*?)\n  \},/g,
)].map(([, id, body]) => ({
  id,
  status: (body.match(/status:\s*'([a-z]+)'/) || [, 'unknown'])[1],
  source: (body.match(/source:\s*\n?\s*'([^']*)'/) || [, ''])[1],
  verifiedAt: (body.match(/verifiedAt:\s*'([^']+)'/) || [, ''])[1],
  contexts: [...(body.match(/allowedContexts:\s*\[([^\]]*)\]/) || [, ''])[1]
    .matchAll(/'([a-z]+)'/g)].map((m) => m[1]),
}));

if (claims.length === 0) {
  console.error(
    `\n✗ ${REGISTRY} parsed to ZERO claims.\n\n` +
      `  This guard reads the registry as text. Zero claims means either the file is\n` +
      `  missing or its shape changed, and in both cases every check below would have\n` +
      `  passed over nothing and printed a tick. A guard that silently skips the file it\n` +
      `  cannot read is how F-23 shipped, so this is a failure and not a skip.\n`,
  );
  process.exit(1);
}

const deadline = (registrySrc.match(/UNSOURCED_DEADLINE\s*=\s*'([^']+)'/) || [, 'unset'])[1];

/* ── pass 1: business facts typed as literals ─────────────────────────────── */
const nap = read(join(ROOT, CONSTANTS));
const val = (k) => (nap.match(new RegExp(`${k}:\\s*'([^']+)'`)) || [, null])[1];
const foundedYear = (nap.match(/foundedYear:\s*(\d{4})/) || [, null])[1];

const LITERAL_RULES = [
  { re: val('phoneDisplay') && new RegExp(escape(val('phoneDisplay'))), fix: 'BUSINESS_NAP.phoneDisplay', what: 'phone number' },
  { re: val('phoneE164') && new RegExp(escape(val('phoneE164'))), fix: 'BUSINESS_NAP.phoneE164', what: 'phone number (E.164)' },
  { re: val('email') && new RegExp(escape(val('email'))), fix: 'BUSINESS_NAP.email', what: 'email address' },
  { re: val('streetAddress') && new RegExp(escape(val('streetAddress'))), fix: 'BUSINESS_NAP.address.streetAddress', what: 'street address' },
  { re: foundedYear && new RegExp(`(est\\.?|since|founded|established)\\s+${foundedYear}\\b`, 'i'), fix: 'BUSINESS_NAP.foundedYear', what: 'founding year' },
  { re: /\b\d{2}[- ]year (reputation|history|track record)\b/i, fix: 'yearsInBusiness()', what: 'year count' },
].filter((r) => r.re);

function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Where a literal is legitimate.
 *   · the constants module — it IS the source
 *   · the claim registry — it quotes values to describe them
 *   · dev seed data and the guards themselves — never customer-facing
 *   · .md reports and audit output — records of what was found
 */
const LITERAL_EXEMPT = [
  CONSTANTS, REGISTRY,
  'apps/web/prisma/seed.ts',
  'scripts/',
  'audit/',
  'docs/',
];

const SCAN_ROOTS = ['apps/web/app', 'apps/web/lib', 'apps/web/content', 'packages'];
const hard = [];

for (const rootDir of SCAN_ROOTS) {
  for (const f of walk(join(ROOT, rootDir))) {
    if (!EXT.has(extname(f))) continue;
    const rel = relative(ROOT, f);
    if (LITERAL_EXEMPT.some((e) => rel === e || rel.startsWith(e))) continue;
    read(f).split('\n').forEach((line, i) => {
      if (line.includes(OPT_OUT)) return;
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      for (const rule of LITERAL_RULES) {
        if (rule.re.test(line)) {
          hard.push({
            rel, line: i + 1, text: t.slice(0, 120),
            why: `Current ${rule.what} typed as a literal. Use ${rule.fix}.`,
          });
        }
      }
    });
  }
}

/* ── pass 2: performance percentages inside schema ────────────────────────── */
const SCHEMA_DIR = 'apps/web/lib/schema';
for (const f of walk(join(ROOT, SCHEMA_DIR))) {
  if (!EXT.has(extname(f))) continue;
  const rel = relative(ROOT, f);
  read(f).split('\n').forEach((line, i) => {
    if (line.includes(OPT_OUT)) return;
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (/\d{1,3}(\.\d+)?\s*%/.test(line)) {
      hard.push({
        rel, line: i + 1, text: t.slice(0, 120),
        why:
          'A performance percentage inside a schema builder. In prose it is a sentence a ' +
          'reader weighs; in JSON-LD it is a machine-readable assertion an answer engine ' +
          'repeats verbatim with no hedging. Register it and state it in prose instead.',
      });
    }
  });
}

/* ── pass 3: the unsourced queue ──────────────────────────────────────────── */
const unsourced = claims.filter((c) => c.status === 'unsourced');

/* ── output ───────────────────────────────────────────────────────────────── */
console.log('');
console.log(`CLAIM REGISTRY — ${claims.length} claim(s) in ${REGISTRY}`);
const byStatus = claims.reduce((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {});
console.log(`  ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join('  ·  ')}`);
console.log('');

if (unsourced.length) {
  console.log(`  ${unsourced.length} claim(s) published without a recorded source.`);
  console.log(`  Deadline to clear this queue: ${deadline}.`);
  console.log('');
  for (const c of unsourced) {
    console.log(`    ${c.id}`);
    console.log(`      fenced to: ${c.contexts.join(', ') || '(none)'}`);
  }
  console.log('');
  console.log(`  These do not fail the build. \`pnpm seo:claims --strict\` does — turn that on`);
  console.log(`  in CI once the queue is meant to stay empty.`);
  console.log('');
}

if (hard.length) {
  console.error(`✗ ${hard.length} hard violation(s):\n`);
  for (const v of hard) {
    console.error(`  ${v.rel}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    → ${v.why}\n`);
  }
  process.exit(1);
}

if (STRICT && unsourced.length) {
  console.error(`✗ --strict: ${unsourced.length} unsourced claim(s) are still published.\n`);
  process.exit(1);
}

console.log('✓ claims verified — no unregistered business fact reaches a customer surface\n');
process.exit(0);
