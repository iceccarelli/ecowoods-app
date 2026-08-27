#!/usr/bin/env node
/**
 * scripts/verify-repo-hygiene.mjs — the repository root is not a scratch folder.
 *
 * WHY THIS EXISTS
 *
 * .gitignore already lists `*.patch`, `*.diff` and `*.zip`, with a paragraph
 * explaining exactly why. Four patch files, two one-off shell scripts and a
 * 1.5 MB zip were committed to the root anyway.
 *
 * Not because anyone ignored the rule. Because **.gitignore does not apply to a
 * file uploaded through the GitHub web UI.** That is the only way a patch gets
 * into this repository — it is how every patch in this project has been
 * delivered — and it is the one path .gitignore cannot see. Once the file is
 * tracked, .gitignore never applies to it again either. So the rule was written
 * for the one workflow that could not obey it, and nothing has ever failed.
 *
 * Two categories, and the second is the one that can actually hurt someone.
 *
 * TRANSPORT ARTIFACTS. A committed patch is a frozen second copy of changes
 * that also exist in the history, and it drifts from them the moment anything is
 * amended. It is also diff text that every clone, every CI checkout and every
 * crawler of the raw repository carries forever. A zip is worse: 1.5 MB of
 * binary that git cannot delta-compress, permanent in the object store even
 * after deletion.
 *
 * UNVALIDATED DUPLICATE CONFIGS. This is the dangerous one. `nginx.conf`,
 * `htaccess.txt` and `netlify_redirects.txt` sat at the root as older,
 * superseded copies of what `pnpm domain:build` now generates into old-domain/.
 * `domain:check` validates old-domain/ and has never looked at the root. So the
 * repository was carrying redirect rules that no guard has ever checked, under
 * names that read exactly like the ones that are checked, one confident `scp`
 * away from serving a live domain. `vercel (3).json` was the same shape of
 * problem: a second, smaller, unread Vercel config beside the real one.
 *
 * WHAT IS DELIBERATELY NOT FLAGGED
 *
 * The reports. There are around thirty EXECUTION_REPORT_*.md and similar at the
 * root, and they are the written record of what was done and why. They are not
 * litter, they are the history, and a guard that nags about them would be
 * ignored — which is how a guard stops working.
 *
 *   node scripts/verify-repo-hygiene.mjs
 *   node scripts/verify-repo-hygiene.mjs --list
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');

/** Transport formats. Deliver it, apply it, delete it. */
const TRANSPORT = [
  { re: /\.patch$/i, why: 'a patch is a transport format — apply it, then delete it. The history already has the change.' },
  { re: /\.diff$/i, why: 'a diff is a transport format — apply it, then delete it.' },
  { re: /\.(zip|tar|tar\.gz|tgz|rar|7z)$/i, why: 'an archive at the root is permanent in the git object store even after deletion, and git cannot delta-compress it.' },
];

/**
 * Config filenames that have a validated home elsewhere. A copy at the root is
 * an unchecked config wearing the name of a checked one.
 */
const SHADOW_CONFIG = new Map([
  ['nginx.conf', 'old-domain/nginx.conf, generated and checked by `pnpm domain:check`'],
  ['htaccess.txt', 'old-domain/.htaccess, generated and checked by `pnpm domain:check`'],
  ['.htaccess', 'old-domain/.htaccess, generated and checked by `pnpm domain:check`'],
  ['netlify_redirects.txt', 'old-domain/_redirects, generated and checked by `pnpm domain:check`'],
  ['index.php', 'old-domain/index.php, which is the copy old-domain/EXECUTE.md tells you to deploy'],
]);

/**
 * A paper source at the root. `ecowoodsmachinesCORRECTED.tex` was byte-identical
 * to docs/papers-pending/ecowoods-hardwood-refinishing-machines-and-sequence-v1.0-2026-08.tex,
 * under a name that says nothing about which paper it is or whether it is current.
 * scripts/gen-paper-tex.mjs writes to docs/papers-pending/; a .tex anywhere else
 * is a copy that will not be regenerated and will quietly go stale.
 */
const STRAY_TEX = /\.tex$/i;

/** A duplicate a browser made: "vercel (3).json", "schema (1).ts". */
const BROWSER_DUPE = /\s\(\d+\)\.[a-z0-9]+$/i;

/** One-off operational scripts. scripts/ is where a script that matters lives. */
const ONE_OFF_SCRIPT = /^(integrate|apply|statecheck|state-check|fix|run|do)[-_a-z0-9]*\.(sh|py|mjs|js)$/i;

const problems = [];
const kept = [];

for (const name of readdirSync(ROOT)) {
  const full = join(ROOT, name);
  let st;
  try { st = statSync(full); } catch { continue; }
  if (st.isDirectory()) continue;

  const transport = TRANSPORT.find((t) => t.re.test(name));
  if (transport) {
    problems.push({ name, kb: Math.round(st.size / 1024), why: transport.why });
    continue;
  }
  if (SHADOW_CONFIG.has(name)) {
    problems.push({
      name,
      kb: Math.round(st.size / 1024),
      why:
        `an unvalidated duplicate of ${SHADOW_CONFIG.get(name)}.\n` +
        `        No guard reads this copy. Deploying it serves rules nothing has checked.`,
    });
    continue;
  }
  if (BROWSER_DUPE.test(name)) {
    problems.push({
      name,
      kb: Math.round(st.size / 1024),
      why: 'a browser-numbered duplicate — the "(3)" is what a download manager adds when the real file already existed.',
    });
    continue;
  }
  if (STRAY_TEX.test(name)) {
    problems.push({
      name,
      kb: Math.round(st.size / 1024),
      why: 'a paper source at the root. docs/papers-pending/ is where scripts/gen-paper-tex.mjs writes and where verify-papers.mjs looks; a copy anywhere else goes stale silently.',
    });
    continue;
  }
  if (ONE_OFF_SCRIPT.test(name)) {
    problems.push({
      name,
      kb: Math.round(st.size / 1024),
      why: 'a one-off operational script at the root. If it is worth keeping it belongs in scripts/ with a header saying what it is for; if it has run, it is done.',
    });
    continue;
  }
  kept.push(name);
}

if (LIST) {
  console.log('\nRepository root — files kept\n');
  for (const k of kept.sort()) console.log(`  ${k}`);
  console.log('');
}

if (problems.length) {
  const kb = problems.reduce((n, p) => n + p.kb, 0);
  console.error(`\n✗ ${problems.length} file(s) at the repository root that should not be tracked (${kb} KB):\n`);
  for (const p of problems) {
    console.error(`  · ${p.name}  (${p.kb} KB)`);
    console.error(`        ${p.why}\n`);
  }
  console.error(
    '  .gitignore already lists most of these. It does not apply to a file uploaded\n' +
      "  through the GitHub web UI, and it never applies to a file that is already\n" +
      '  tracked — which is every file above. Remove them:\n\n' +
      `      git rm --cached ${problems.map((p) => `'${p.name}'`).join(' ')}\n` +
      `      rm -f ${problems.map((p) => `'${p.name}'`).join(' ')}\n`,
  );
  process.exit(1);
}

console.log(`✓ repo hygiene verified — ${kept.length} file(s) at the root, no transport artifacts, no unvalidated duplicate configs`);
