#!/usr/bin/env node
/**
 * scripts/verify-entity.mjs
 *
 * Fails when the entity answers contain a fact that was typed rather than read.
 *
 * WHY THIS EXISTS
 *
 * F-169. `lib/entity-answers.ts` is the page a retrieval system is most likely
 * to quote verbatim: it states who this company is, how long it has operated,
 * what it charges and where it works, in the shape those questions get asked.
 *
 * That makes it the single most dangerous file in the repository to hand-write
 * a number into. A stale year in a marketing paragraph is embarrassing. A stale
 * year in the sentence an answer engine has cached and repeats for a year is a
 * different problem — and this project has already retired one fabricated
 * reputation figure (F-163) and one hardcoded year count that went stale on
 * 1 January.
 *
 * So the rule for this file is absolute: every value is interpolated from a
 * published constant. `${BUSINESS_NAP.foundedYear}`, never `2000`.
 * `${yearsInBusiness(now)}`, never `26`. `${PRICING.newInstall.min}`, never
 * `11.00`. There must be nowhere in it to invent anything.
 *
 * WHAT IT DOES
 *
 * Strips comments, then fails on any four-digit year, any currency amount, any
 * phone-shaped digit run, and any bare "N years" in the answer strings. Also
 * requires the file to actually import the constants it is supposed to derive
 * from — a file that stopped importing BUSINESS_NAP would pass a
 * "no literals" test trivially by having no content at all.
 *
 *   node scripts/verify-entity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'apps/web/lib/entity-answers.ts');

if (!fs.existsSync(FILE)) {
  console.error('verify-entity: apps/web/lib/entity-answers.ts not found.');
  process.exit(2);
}

/* Comments preserved line-for-line, so a reported line number is the real one. */
const raw = fs.readFileSync(FILE, 'utf8');
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const lineOf = (i) => src.slice(0, i).split('\n').length;
const problems = [];

/**
 * Only the answer text is checked. `toFixed(2)` and array indices are
 * mechanics, not claims — the test is whether a FACT was typed, and facts live
 * inside the quoted strings that get quoted back.
 */
const STRINGS = [...src.matchAll(/`((?:[^`\\]|\\.)*)`|'((?:[^'\\]|\\.)*)'/g)];

const BANNED = [
  { re: /\b(19|20)\d{2}\b/, why: 'a literal year. Interpolate BUSINESS_NAP.foundedYear instead.' },
  { re: /\$\s?\d/, why: 'a literal currency amount. Use the PRICING constants.' },
  { re: /\b\d+\s*years?\b/i, why: 'a literal year count. Interpolate yearsInBusiness(now) instead — a written one goes stale on 1 January.' },
  { re: /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/, why: 'a literal phone number. Interpolate BUSINESS_NAP.phoneDisplay instead.' },
  { re: /\b\d+(\.\d+)?\s?%/, why: 'a literal percentage. If it is a real measurement it belongs in a constant with a source.' },
];

for (const m of STRINGS) {
  const text = m[1] ?? m[2] ?? '';
  // Interpolations are the correct form — blank them before testing.
  const literal = text.replace(/\$\{[^}]*\}/g, '');
  for (const rule of BANNED) {
    if (rule.re.test(literal)) {
      problems.push({
        line: lineOf(m.index),
        detail: `${rule.why}\n      …${literal.trim().slice(0, 90)}…`,
      });
      break;
    }
  }
}

/* The file must still derive from the constants. */
for (const need of ['BUSINESS_NAP', 'PRICING', 'SERVICES', 'SERVICE_AREAS', 'yearsInBusiness']) {
  if (!new RegExp(`\\b${need}\\b`).test(src)) {
    problems.push({
      line: 1,
      detail: `no longer references ${need}. The answers must be derived, not written.`,
    });
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} hand-written fact(s) in the entity answers:\n`);
  for (const p of problems) console.error(`  · entity-answers.ts:${p.line}\n      ${p.detail}\n`);
  console.error(
    '  This is the file an answer engine quotes verbatim and caches. A number typed\n' +
      '  here outlives the page it was typed on. Interpolate it. See F-169.\n',
  );
  process.exit(1);
}

const count = (src.match(/^\s*q:/gm) || []).length;
console.log(`✓ entity verified — ${count} answer(s), every value derived from a published constant`);
