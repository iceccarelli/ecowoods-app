#!/usr/bin/env node
/**
 * scripts/verify-all.mjs — run every guard, then say plainly what failed.
 *
 * WHY THIS EXISTS
 *
 * `pnpm verify` used to be a 57-link `&&` chain. Two properties of that shape
 * cost real time, twice, in the same week:
 *
 *   1. IT STOPS AT THE FIRST FAILURE. Fifty-six guards go unrun. You fix the
 *      one it reported, run it again, and learn about the next one. A chain
 *      cannot tell you "three things are wrong"; it can only ever say "one
 *      thing is wrong", which reads like you are one fix from green when you
 *      are not.
 *
 *   2. THE FAILURE SCROLLS AWAY. The chain prints its error and exits, and then
 *      the next pasted command — `pnpm test`, `pnpm build` — prints four hundred
 *      lines of green on top of it. F-181: `verify:hygiene` failed, and the
 *      commit and push that followed went out anyway, because by the time the
 *      screen stopped moving the failure was gone and everything visible said
 *      ✓. That happened twice. Both times the operator was reading the screen
 *      carefully; the screen was lying by omission.
 *
 * So: run all of them, in parallel, and make the LAST thing on the screen a
 * summary of what failed — reprinted in full, so you never have to scroll up to
 * a buffer that may not go back far enough. Exit code is still the contract; the
 * summary is for the human.
 *
 * ANTI-DRIFT. The run set is derived from package.json, not from a list kept
 * here. Every `verify:*`, `seo:*` and `domain:*` script that runs a single node
 * scripts/*.mjs is run, unless it is in SKIP below with a stated reason. A new
 * guard therefore joins `pnpm verify` the moment it has a package.json entry —
 * you cannot forget to chain it, which is exactly how verify:assets:public and
 * verify:equipment nearly shipped unchained. A script that is neither run nor
 * skipped fails this runner by design.
 *
 *   node scripts/verify-all.mjs            # everything
 *   node scripts/verify-all.mjs --list     # what would run, and what is skipped
 *   node scripts/verify-all.mjs --serial   # one at a time, interleaved output
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');
const SERIAL = process.argv.includes('--serial');

/**
 * Not gates. Each entry needs a reason, because an unexplained exclusion is how
 * a guard stops running without anyone deciding that it should.
 */
const SKIP = new Map([
  ['verify:live', 'hits the live site over the network; run it after a deploy, not before'],
  ['verify:live-images', 'hits the live site over the network'],
  ['verify:live-routes', 'fetches every route from the live host; run it after a deploy — it is the check that catches a deployment serving code you did not build'],
  ['verify:domain', 'hits the live site over the network'],
  ['seo:domain', 'hits the live site over the network'],
  ['seo:hosts', 'hits the live site over the network'],
  ['seo:crawl', 'crawls the live site over the network'],
  ['seo:live', 'composite of the three network checks above'],
  ['seo:consistency', 'composite of guards this runner already runs individually'],
  ['seo:links', 'same script as verify:links'],
  ['seo:schema', 'same script as verify:schema'],
  ['domain:build', 'a generator — it writes old-domain/; domain:check is the gate'],
  ['domain:simulate', 'a generator, not a check'],
  ['seo:prompts', 'a generator — it writes the AI prompt set'],
  ['seo:audit', 'a report, not a gate: it describes the current state and always exits 0'],
]);

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

/** `node scripts/x.mjs --flag` → ['scripts/x.mjs', '--flag']; anything else → null. */
function nodeArgs(cmd) {
  const m = /^node\s+(scripts\/[\w.-]+\.mjs)((?:\s+--[\w-]+)*)\s*$/.exec(cmd.trim());
  if (!m) return null;
  return [m[1], ...m[2].split(/\s+/).filter(Boolean)];
}

const candidates = Object.keys(scripts).filter((k) => /^(verify|seo|domain):/.test(k));
const run = [];
const skipped = [];
const unclassified = [];

for (const name of candidates.sort()) {
  if (SKIP.has(name)) {
    skipped.push({ name, why: SKIP.get(name) });
    continue;
  }
  const args = nodeArgs(scripts[name]);
  if (!args) {
    unclassified.push({ name, cmd: scripts[name] });
    continue;
  }
  run.push({ name, args });
}

/**
 * verify:css is the one guard here with a real dependency: it asks postcss,
 * a Next devDependency, to parse every stylesheet (see scripts/verify-css.mjs
 * for why a text-based check cannot replace it). This runner is dependency-free
 * by design — the CI job that runs it never runs `pnpm install`, on purpose —
 * so on that job postcss can never resolve, and verify:css would fail every
 * time for an environment reason rather than a CSS one.
 *
 * That is not a reason to weaken verify:css itself, or to add an unconditional
 * static SKIP entry: a developer running `pnpm verify` locally has node_modules
 * and must still get the real check. So this is resolved once, here, by asking
 * the same question verify-css.mjs asks of the same package: if postcss
 * resolves, verify:css runs normally and a real parse failure still fails the
 * build. If it does not, this is the dependency-free job, and the real check
 * already runs — with node_modules installed — as its own step in the
 * "Typecheck & Build" job in .github/workflows/web.yml, after `pnpm install`.
 */
const cssGuard = run.findIndex((g) => g.name === 'verify:css');
if (cssGuard !== -1) {
  let postcssResolvable = true;
  try {
    createRequire(resolve(ROOT, 'apps/web/package.json'))('postcss');
  } catch {
    postcssResolvable = false;
  }
  if (!postcssResolvable) {
    run.splice(cssGuard, 1);
    skipped.push({
      name: 'verify:css',
      why: 'postcss (a Next dependency) is not resolvable in this dependency-free job; the real check runs in the "Typecheck & Build" job after pnpm install',
    });
  }
}

if (LIST) {
  console.log(`\nverify-all — ${run.length} guard(s) would run:\n`);
  for (const g of run) console.log(`  ${g.name.padEnd(24)} ${g.args.join(' ')}`);
  console.log(`\n${skipped.length} deliberately skipped:\n`);
  for (const s of skipped) console.log(`  ${s.name.padEnd(24)} ${s.why}`);
  console.log('');
  process.exit(0);
}

if (unclassified.length) {
  console.error(`\n✗ ${unclassified.length} script(s) are neither run nor skipped:\n`);
  for (const u of unclassified) console.error(`  · ${u.name}\n        ${u.cmd}\n`);
  console.error(
    '  This runner derives what it runs from package.json so a new guard cannot be\n' +
      '  forgotten. A script matching verify:/seo:/domain: that is not a single\n' +
      '  `node scripts/*.mjs` command has to be classified by hand: either give it\n' +
      '  that shape, or add it to SKIP in scripts/verify-all.mjs with a reason.\n',
  );
  process.exit(1);
}

const results = new Map();

function exec(guard) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(process.execPath, guard.args, { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => {
      results.set(guard.name, { ok: false, out: String(e), ms: Date.now() - started });
      done();
    });
    child.on('close', (code) => {
      results.set(guard.name, { ok: code === 0, out, ms: Date.now() - started });
      const r = results.get(guard.name);
      process.stdout.write(
        `${r.ok ? '✓' : '✗'} ${guard.name.padEnd(24)} ${String(r.ms).padStart(6)} ms\n`,
      );
      done();
    });
  });
}

const started = Date.now();
console.log(`▸ ${run.length} guards${SERIAL ? ' (serial)' : `, up to ${Math.min(8, cpus().length || 4)} at a time`}\n`);

const queue = [...run];
const width = SERIAL ? 1 : Math.min(8, cpus().length || 4);
await Promise.all(
  Array.from({ length: width }, async () => {
    for (let g = queue.shift(); g; g = queue.shift()) await exec(g);
  }),
);

const failed = run.filter((g) => !results.get(g.name).ok);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (!failed.length) {
  console.log(`\n✓ all ${run.length} guards passed in ${elapsed}s (${skipped.length} network/generator scripts skipped)\n`);
  process.exit(0);
}

// The whole point of this file: the failures are the last thing printed, in
// full, after everything else has finished writing to the screen.
console.error(`\n${'─'.repeat(78)}`);
console.error(`✗ ${failed.length} of ${run.length} guards FAILED in ${elapsed}s\n`);
for (const g of failed) console.error(`    ${g.name}`);
for (const g of failed) {
  console.error(`\n${'─'.repeat(78)}\n✗ ${g.name}  —  node ${g.args.join(' ')}\n`);
  console.error(results.get(g.name).out.trimEnd());
}
console.error(
  `\n${'─'.repeat(78)}\n` +
    `✗ ${failed.length} FAILED: ${failed.map((g) => g.name).join(', ')}\n` +
    '  Do not commit on top of this. If you pasted a block of commands, the ones\n' +
    '  after this line ran anyway and their output is above — this is the verdict.\n',
);
process.exit(1);
