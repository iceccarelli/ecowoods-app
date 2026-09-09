#!/usr/bin/env node
/**
 * verify-equipment.mjs — the guard on other people's published facts.
 *
 * THE RISK THIS COVERS
 *
 * Every number in content/equipment/machines.ts is a claim about a machine
 * somebody else manufactures. Getting one wrong is worse than getting one of
 * our own wrong: a contractor who buys a sander on the strength of a voltage
 * this site published has a five-figure machine and the wrong circuit, and
 * Lägler has a page on their site with our error on it.
 *
 * So the rules are strict and they are checked as text:
 *
 *  1. EVERY SOURCE IS AN https URL WITH A VERIFICATION DATE, and that date is
 *     real, not in the future, and not older than 400 days. A spec sheet
 *     revised last spring is a spec sheet this file has not read.
 *
 *  2. NO PRICE. Lägler, Bona and American Sanders publish no machine list
 *     prices — checked on all three manufacturers' own product and store pages.
 *     A price appearing in this file therefore came from a dealer or from
 *     nowhere, and neither belongs in a record whose entire value is that it is
 *     the manufacturer's own figure.
 *
 *  3. NO PRODUCTIVITY FIGURE. No manufacturer publishes square feet or square
 *     metres per hour for any of these machines. A field like that could only
 *     be an estimate wearing a specification's clothes.
 *
 *  4. EVERY MACHINE DECLARES WHAT IS MISSING. `notPublished` may not be empty
 *     for a machine that has null fields — the gaps get stated, not left for a
 *     reader to notice.
 *
 * Dependency-free, like the rest of the pre-build gate.
 *
 * Run:  pnpm verify:equipment
 */
import { readFileSync, existsSync } from 'node:fs';

const FILE = 'apps/web/content/equipment/machines.ts';
const MAX_AGE_DAYS = 400;

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} not found — run from the repo root`);
  process.exit(1);
}

const raw = readFileSync(FILE, 'utf8');
/* Strip block comments: the header explains WHY there is no price, and must not
   trip the check it is explaining. */
const body = raw.replace(/\/\*[\s\S]*?\*\//g, '');

const errors = [];
const lineOf = (i) => body.slice(0, i).split('\n').length;

/* ── 1. sources ──────────────────────────────────────────────────────────── */
const sources = [...body.matchAll(/url:\s*'([^']+)'\s*,\s*kind:\s*'([^']+)'\s*,\s*verifiedAt:\s*'([^']+)'/g)];
if (sources.length === 0) errors.push('no SpecSource entries parsed — the guard cannot verify anything');

const today = new Date();
for (const m of sources) {
  const [, url, kind, verifiedAt] = m;
  const line = lineOf(m.index);
  if (!/^https:\/\//.test(url)) errors.push(`${FILE}:${line} source url is not https: ${url}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
    errors.push(`${FILE}:${line} verifiedAt "${verifiedAt}" is not an ISO date`);
    continue;
  }
  const when = new Date(`${verifiedAt}T00:00:00Z`);
  if (Number.isNaN(when.getTime())) {
    errors.push(`${FILE}:${line} verifiedAt "${verifiedAt}" is not a real date`);
    continue;
  }
  if (when > today) errors.push(`${FILE}:${line} verifiedAt ${verifiedAt} is in the future`);
  const ageDays = (today - when) / 86_400_000;
  if (ageDays > MAX_AGE_DAYS) {
    errors.push(
      `${FILE}:${line} ${url} was last read ${Math.round(ageDays)} days ago. Manufacturers revise data sheets; re-read it or drop the machine.`,
    );
  }
  void kind;
}

/* ── 2 + 3. forbidden fields ─────────────────────────────────────────────── */
const FORBIDDEN = [
  [/\bprice\w*\s*:/i, 'a price. No manufacturer in this category publishes one, so any value here came from a dealer or from nowhere.'],
  [/\bmsrp\b/i, 'an MSRP.'],
  [/\$\s*\d/, 'a currency amount.'],
  [/sq(uare)?[_ ]?(ft|feet|m|metres)[_ ]?per[_ ]?hour/i, 'a productivity figure. No manufacturer publishes one for these machines.'],
  [/\bsqftPerHour\b|\bcoverageRate\b|\bproductivity\b/i, 'a productivity figure.'],
];
for (const [re, what] of FORBIDDEN) {
  const hit = body.match(re);
  if (hit) errors.push(`${FILE}:${lineOf(body.indexOf(hit[0]))} contains ${what}`);
}

/* ── 4. gaps are declared ────────────────────────────────────────────────── */
const blocks = [...body.matchAll(/\bid:\s*'([a-z0-9-]+)',\s*\n\s*manufacturer:[\s\S]*?\n  \},\n/g)];
for (const b of blocks) {
  const [block, id] = b;
  const hasNull = /:\s*null\b/.test(block);
  const notPublished = block.match(/notPublished:\s*\[([\s\S]*?)\]/);
  const declared = notPublished ? notPublished[1].trim().length > 0 : false;
  if (hasNull && !declared) {
    errors.push(
      `${FILE}: machine "${id}" has null fields but an empty notPublished. State the gaps — an unexplained null reads as an oversight.`,
    );
  }
}

if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ equipment: ${errors.length} problem(s)`);
  process.exit(1);
}

const machines = (body.match(/\n    id: '/g) ?? []).length;
console.log(
  `✓ equipment verified — ${machines} machine(s), ${sources.length} manufacturer source(s) all https and read within ${MAX_AGE_DAYS} days, no price, no productivity figure`,
);
