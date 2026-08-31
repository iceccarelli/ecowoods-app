#!/usr/bin/env node
/**
 * scripts/verify-referral.mjs — the guard on a promise made to a customer.
 *
 * WHAT IS AT STAKE HERE THAT IS NOT AT STAKE ELSEWHERE
 *
 * A referral reward is the only figure on this site that somebody is OWED. A
 * price band that drifts produces an awkward conversation; a reward that drifts
 * produces a customer who referred a friend, waited for a job to complete, and
 * was then paid less than the page they read said. That person does not
 * complain. They stop referring, and they tell the friend they sent.
 *
 * So the rule is the same one the price bands live under, applied to the one
 * number that is a debt rather than an estimate:
 *
 *   1. The percentage and the flat amount exist ONLY in content/referral.ts.
 *      Anywhere else they are a literal, the build fails.
 *   2. The reward is never published without its condition. Any file that
 *      renders `referralRewardLine()` must also render `REFERRAL.condition`,
 *      `referralOfferLine()` or `REFERRAL.legalLine` — an offer whose terms are
 *      discovered later is the pattern this whole project refuses.
 *   3. The legal line exists and is rendered on the page that collects the
 *      referral.
 *
 *   node scripts/verify-referral.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = 'apps/web/content/referral.ts';
const SOURCE_ABS = path.join(ROOT, SOURCE);
const SCAN = ['apps/web/app', 'apps/web/lib', 'apps/web/content', 'packages'];
const EXT = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx']);

if (!fs.existsSync(SOURCE_ABS)) {
  console.error(`✗ ${SOURCE} not found — run from the repo root.`);
  process.exit(2);
}

const src = fs.readFileSync(SOURCE_ABS, 'utf8');
const problems = [];

const pct = (src.match(/creditPercent:\s*(\d+)/) ?? [])[1];
const flat = (src.match(/flatCad:\s*(\d+)/) ?? [])[1];
if (!pct || !flat) {
  console.error(`✗ ${SOURCE}: could not read creditPercent / flatCad — the literal shape changed.`);
  process.exit(1);
}
if (!/legalLine:/.test(src)) problems.push(`${SOURCE} has no legalLine.`);
if (!/condition:/.test(src)) problems.push(`${SOURCE} has no condition.`);

/* ── walk ─────────────────────────────────────────────────────────────────── */
const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p);
    } else if (EXT.has(path.extname(e.name))) files.push(p);
  }
};
for (const d of SCAN) walk(path.join(ROOT, d));

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const isComment = (line) => {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

/* 1 · the reward figures appear nowhere but the source */
const FLAT_RE = new RegExp(`\\$${flat}\\b`);
const PCT_RE = new RegExp(`\\b${pct}%\\s*(credit|off|back)`, 'i');

for (const f of files) {
  const r = rel(f);
  if (r === SOURCE) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isComment(line) || line.includes('referral-allow')) return;
    if (FLAT_RE.test(line) || PCT_RE.test(line)) {
      problems.push(
        `${r}:${i + 1}\n      publishes the referral reward as a literal: ${line.trim().slice(0, 100)}\n` +
          `      Import it from content/referral.ts. This figure is a debt, not a description.`,
      );
    }
  });
}

/* 2 · the reward never appears without its condition */
for (const f of files) {
  const r = rel(f);
  if (r === SOURCE) continue;
  const text = fs.readFileSync(f, 'utf8');
  if (!/referralRewardLine\s*\(/.test(text)) continue;
  const statesTerms =
    /referralOfferLine\s*\(/.test(text) || /REFERRAL\.condition/.test(text) || /REFERRAL\.legalLine/.test(text);
  if (!statesTerms) {
    problems.push(
      `${r}\n      renders referralRewardLine() without the condition beside it.\n` +
        `      Use referralOfferLine(), or render REFERRAL.condition / REFERRAL.legalLine on the same surface.`,
    );
  }
}

/* 3 · the page that collects a referral shows the legal line */
const referPage = path.join(ROOT, 'apps/web/app/refer/page.tsx');
if (!fs.existsSync(referPage)) {
  problems.push('apps/web/app/refer/page.tsx is missing — the offer has nowhere to be accepted.');
} else if (!/REFERRAL\.legalLine/.test(fs.readFileSync(referPage, 'utf8'))) {
  problems.push('apps/web/app/refer/page.tsx does not render REFERRAL.legalLine.');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the referral offer:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ referral verified — ${pct}% / $${flat} declared once in ${SOURCE}, never published without its condition`,
);
