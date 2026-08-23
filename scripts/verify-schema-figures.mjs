#!/usr/bin/env node
/**
 * scripts/verify-schema-figures.mjs — the twenty-sixth guard.
 *
 * WHAT IT CAUGHT, AND WHY IT EXISTS
 *
 * The Organization schema carried five project price ranges — $4,000–$15,000,
 * $2,500–$8,000, $2,000–$6,000, $3,000–$10,000 and one more — that appear
 * nowhere else on this site, derive from nothing, and were being handed to
 * Google as structured price data for the business. It also repeated
 * "~99.7% of airborne dust", a figure already recorded in
 * docs/outreach/CLAIMS_REGISTER.md as unsourced.
 *
 * Twenty-five guards were watching the pages. None was watching the schema.
 * That is the wrong way round: an unsourced number on a page is read by a human
 * who can weigh it in context, and the same number in JSON-LD is read by a
 * machine that quotes it as fact. The schema layer is the most consequential
 * place on the site to be wrong and it was the least guarded.
 *
 * THE RULE
 *
 * No currency amount and no percentage may appear as a literal anywhere under
 * apps/web/lib/schema. Every figure must be interpolated from a published
 * constant — PRICING, BUSINESS_NAP, REVIEW_EVIDENCE, the framework — so the
 * schema cannot state something the site does not.
 *
 * Comments are stripped first. This repository explains at length why it does
 * NOT publish certain numbers, and flagging its own explanation is the mistake
 * recorded as F-58, F-106, F-163, F-175 — four times. Not a fifth.
 *
 *   node scripts/verify-schema-figures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIRS = ['apps/web/lib/schema', 'apps/web/lib/graph'];
const problems = [];

/* Years, versions, dimensions and coordinates are not money or claims. */
const ALLOW = [
  /^\d{4}$/,                 // a year
  /^\d{1,2}$/,               // small counts
];

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const walk = (dir) => {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return;
  for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(rel);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(ent.name)) continue;
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    code.split('\n').forEach((line, i) => {
      /* A currency amount: $ followed by digits, inside a string literal. */
      for (const m of line.matchAll(/['"`][^'"`]*\$\s?[\d,]+(?:\.\d+)?[^'"`]*['"`]/g)) {
        if (m[0].includes('${')) continue; // interpolated — that is the correct form
        problems.push({
          where: `${rel}:${i + 1}`,
          detail: `currency literal in schema: ${m[0].trim().slice(0, 60)}`,
        });
      }
      /* A percentage claim inside a string literal. */
      for (const m of line.matchAll(/['"`][^'"`]*?\d+(?:\.\d+)?\s?%[^'"`]*['"`]/g)) {
        if (m[0].includes('${')) continue;
        problems.push({
          where: `${rel}:${i + 1}`,
          detail: `percentage literal in schema: ${m[0].trim().slice(0, 60)}`,
        });
      }
    });
  }
};
DIRS.forEach(walk);

const filtered = problems.filter((p) => !ALLOW.some((re) => re.test(p.detail)));

if (filtered.length) {
  console.error(`\n✗ ${filtered.length} unsourced figure(s) in the schema layer:\n`);
  for (const p of filtered) console.error(`  · ${p.where}\n      ${p.detail}`);
  console.error(
    `\n  A number in JSON-LD is quoted by a machine as fact. Interpolate it from a published\n` +
      `  constant — PRICING, BUSINESS_NAP, REVIEW_EVIDENCE — or do not publish it. See F-195.\n`,
  );
  process.exit(1);
}
console.log(
  `✓ schema figures verified — no currency or percentage literals under ${DIRS.join(', ')}`,
);
