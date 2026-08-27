#!/usr/bin/env node
/**
 * scripts/verify-hooks.mjs — the guards that protect the guards.
 *
 * WHY THIS EXISTS — F-152
 *
 * Every other check in this repository verifies the code. This one verifies the
 * process, because on 2026-08-27 the code was perfect and shipped nowhere: a
 * full day of work was committed onto local `main`, the build passed, all 36
 * guards passed, and the push that followed sent zero objects while reporting
 * success. See the header of scripts/hooks/pre-commit for the full sequence.
 *
 * The fix for that is two git hooks. A git hook, however, is the easiest thing
 * in a repository to lose: it lives outside the working tree unless
 * `core.hooksPath` points at it, it stops working the moment someone drops the
 * executable bit, and nothing anywhere fails when it silently stops running.
 * A protection that can disappear without a sound is not a protection.
 *
 * So this asserts what the repository can actually own:
 *
 *   · both hook files exist and are executable
 *   · pre-commit still refuses main, and still offers the documented escape
 *   · pre-push still runs the two fast guards AND still catches the empty push
 *   · package.json still carries `hooks:install`, which is how they get wired
 *
 * And it reports — without failing — whether `core.hooksPath` is set in THIS
 * checkout. That part cannot be a hard failure: CI clones have no hooks and must
 * not, and a fresh clone would be red before anyone had a chance to run the
 * install. It is printed loudly instead, which is the correct strength for a
 * fact that is true of a machine rather than of the code.
 *
 *   node scripts/verify-hooks.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd();
const problems = [];
const fail = (m) => problems.push(m);
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

/** Every hook, and the substrings that prove it still does its job. */
const HOOKS = [
  {
    path: 'scripts/hooks/pre-commit',
    must: [
      { needle: 'git branch --show-current', why: 'it no longer reads which branch you are on' },
      { needle: 'main|master)', why: 'it no longer matches the integration branch' },
      { needle: 'ECOWOODS_ALLOW_MAIN_COMMIT', why: 'the documented escape hatch is gone — people will use --no-verify for everything instead' },
      { needle: 'F-152', why: 'the incident reference is gone; the next person will not know why this exists and will delete it' },
    ],
  },
  {
    path: 'scripts/hooks/pre-push',
    must: [
      { needle: 'verify-business-facts.mjs', why: 'it no longer runs the business-facts guard before a push' },
      { needle: 'verify-migrations.mjs', why: 'it no longer runs the migration guard before a push' },
      { needle: 'rev-parse origin/main', why: 'it no longer detects a branch identical to origin/main — the silent empty push is back' },
    ],
  },
];

for (const hook of HOOKS) {
  const abs = join(ROOT, hook.path);
  if (!existsSync(abs)) {
    fail(`${hook.path} is missing. Without it the protection it carries is gone and nothing else notices.`);
    continue;
  }
  const mode = statSync(abs).mode;
  if (!(mode & 0o111)) {
    fail(
      `${hook.path} is not executable (mode ${(mode & 0o777).toString(8)}).\n` +
        `      Git skips a non-executable hook SILENTLY — no warning, no error, no hook.\n` +
        `      Fix: git update-index --chmod=+x ${hook.path} && chmod +x ${hook.path}`,
    );
  }
  const body = readFileSync(abs, 'utf8');
  if (!body.startsWith('#!')) fail(`${hook.path} has no shebang — git will not execute it.`);
  for (const { needle, why } of hook.must) {
    if (!body.includes(needle)) fail(`${hook.path}: ${why} (looked for "${needle}")`);
  }
}

/* The hooks are inert unless something wires core.hooksPath at them. */
const pkg = read('package.json');
if (!pkg.includes('core.hooksPath scripts/hooks')) {
  fail(
    'package.json no longer carries a `hooks:install` script setting core.hooksPath.\n' +
      '      The hook files would still be committed and would still never run.',
  );
}

/* Advisory, deliberately: true of a machine, not of the repository. */
let hooksPath = '';
try {
  hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim();
} catch { /* unset — git exits 1 */ }

console.log('');
console.log(`GIT HOOKS — ${HOOKS.length} hook(s) in scripts/hooks`);
if (hooksPath === 'scripts/hooks') {
  console.log('  core.hooksPath  scripts/hooks — hooks are live in this checkout');
} else {
  console.log(`  core.hooksPath  ${hooksPath || '(unset)'} — HOOKS ARE NOT RUNNING HERE`);
  console.log('                  Run: pnpm hooks:install');
  console.log('                  Not a failure: CI clones have no hooks and must not.');
}
console.log('');

if (problems.length) {
  console.error(`✗ ${problems.length} hook problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

console.log('✓ hooks verified — main refuses commits, and a branch with nothing on it refuses to push');
