#!/usr/bin/env node
/**
 * scripts/verify-retired-hosts.mjs — the retired hostnames may appear only in
 * files that need the literal to redirect, guard, test or generate against it.
 *
 * Checks every git-tracked file for `ecowoodshardwood.com` and
 * `ecowoods-app.vercel.app`. A hit outside ALLOWLIST fails the build.
 *
 *   node scripts/verify-retired-hosts.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();

const HOSTS = [
  { name: 'ecowoodshardwood.com', re: /ecowoodshardwood\.com/i },
  { name: 'ecowoods-app.vercel.app', re: /ecowoods-app\.vercel\.app/i },
];

/**
 * Files allowed to carry the literal: the redirect/guard infrastructure that
 * needs it to function or to verify it, plus test fixtures for that logic and
 * the ops kit under old-domain/. Everything else — docs, audits, narrative —
 * must not mention a retired host as a going concern.
 */
const ALLOWLIST = [
  'vercel.json',
  'apps/web/next.config.js',
  'scripts/build-old-domain-redirects.mjs',
  'scripts/verify-domain-redirect.mjs',
  'scripts/verify-stale-hosts.mjs',
  'scripts/verify-vercel-config.mjs',
  'scripts/verify-agentic.mjs',
  'scripts/verify-production-agentic.mjs',
  'scripts/verify-business-facts.mjs',
  'scripts/verify-destinations.mjs',
  'scripts/state-of-truth.sh',
  'scripts/verify-live.sh',
  'scripts/verify-retired-hosts.mjs',
  'apps/web/tests/security.test.ts',
  'apps/web/tests/drift.test.ts',
  'apps/web/tests/registry-invariants.test.ts',
  'apps/web/tests/negative.test.ts',
  /^old-domain\//,
  // Live social-media handles carrying the retired brand name, not a second
  // website — @ecowoodshardwood on Instagram/Facebook is the account in use.
  'packages/shared/constants/index.ts',
];

const isAllowed = (file) =>
  ALLOWLIST.some((entry) => (entry instanceof RegExp ? entry.test(file) : entry === file));

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const problems = [];

for (const file of tracked) {
  if (isAllowed(file)) continue;
  let body;
  try {
    body = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable — not a text mention
  }
  for (const host of HOSTS) {
    if (host.re.test(body)) {
      const line = body.split('\n').findIndex((l) => host.re.test(l)) + 1;
      problems.push({ file, host: host.name, line });
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} retired-host mention(s) outside the allowlist:\n`);
  for (const p of problems) console.error(`  · ${p.file}:${p.line}  (${p.host})`);
  console.error(
    '\n  Retired hosts (ecowoodshardwood.com, ecowoods-app.vercel.app) may appear only in\n' +
      '  the redirect/guard infrastructure and its tests, listed in ALLOWLIST at the top of\n' +
      '  scripts/verify-retired-hosts.mjs. Remove the mention, or extend the allowlist if the\n' +
      '  file is genuinely part of that infrastructure.\n',
  );
  process.exit(1);
}

console.log(`✓ retired hosts verified — no mention outside ${ALLOWLIST.length} allowlisted path(s)`);
