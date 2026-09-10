#!/usr/bin/env node
/**
 * scripts/verify-allocation.mjs — the 80/20 split, enforced.
 *
 * WHY A GUARD AND NOT A NOTE IN A STRATEGY DOCUMENT
 *
 * Eighty percent Canada, twenty percent western New York. Nobody will ever
 * violate that on purpose. It goes wrong the way every allocation goes wrong:
 * one commit at a time, each individually reasonable, none of them looking like
 * the moment a Toronto contractor's site started reading as an American one.
 * "Add the affluent Buffalo suburbs, they're high-value" is a correct sentence
 * that, repeated for six months, produces a site whose geography no longer
 * matches its business.
 *
 * So the ratio is measured from the repository and the floor fails the build.
 *
 * THE HARDER LINE
 *
 * Underneath the ratio is something that is not a ratio at all: no United
 * States market may ever hold an indexable page or appear in the service area.
 * Ecowoods has no United States office, crew, address or phone number. The
 * twenty percent is spent on reach — records in the model, corridor structure,
 * an entity graph that says where expansion would go — never on a landing page
 * implying service. Those two checks have no tolerance and no threshold.
 *
 *   node scripts/verify-allocation.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const fail = [];
const read = (rel) => {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fail.push(`${rel} is missing`); return ''; }
  return readFileSync(p, 'utf8');
};

const marketsSrc = read('content/geo/markets.ts');
const alloc = read('lib/geo/allocation.ts');
const worthiness = read('lib/geo/worthiness.ts');
const geoIndex = read('lib/geo/index.ts');

/* ── read the map ────────────────────────────────────────────────────────── */
const ca = [...marketsSrc.matchAll(/\bm\(\s*'[^']+',\s*'([a-z0-9-]+)'/g)].map((x) => x[1]);
const us = [...marketsSrc.matchAll(/\bus\(\s*'[^']+',\s*'([a-z0-9-]+)'/g)].map((x) => x[1]);
if (ca.length < 20 || us.length < 3) {
  fail.push(
    `read ${ca.length} Canadian and ${us.length} United States market(s) — the reader is blind, and a blind reader ` +
      'here reports a perfect allocation forever.',
  );
}

const floor = Number(/CA_RECORD_FLOOR\s*=\s*([0-9.]+)/.exec(alloc)?.[1] ?? NaN);
if (Number.isNaN(floor)) {
  fail.push('could not read CA_RECORD_FLOOR from lib/geo/allocation.ts — the floor under Canada\'s share of the model');
} else if (ca.length + us.length > 0) {
  const share = ca.length / (ca.length + us.length);
  if (share < floor) {
    fail.push(
      `Canada holds ${(share * 100).toFixed(1)}% of the markets in the model, below the ${(floor * 100).toFixed(0)}% ` +
        `floor (${ca.length} Canadian, ${us.length} United States). The centre of gravity has moved; either the ` +
        'Canadian map is being neglected or American markets are being added faster than the business can justify.',
    );
  }
}

/* ── the two lines with no tolerance ─────────────────────────────────────── */
if (!/us-proxy: advertising reach/.test(worthiness)) {
  fail.push(
    'lib/geo/worthiness.ts no longer blocks a page for a us-proxy market. That single condition is what stops this ' +
      'repository publishing a Buffalo landing page for a company with no United States office.',
  );
}
if (!/x\.kind === 'municipality'/.test(geoIndex) || !/isOperational/.test(geoIndex)) {
  fail.push(
    'lib/geo/index.ts no longer filters the service area to operational municipalities. us-proxy markets are not ' +
      'operational; drop that filter and every New York town enters areaServed.',
  );
}

/* Every measure in the allocation report must be readable, and the report must
   still say what a 100/0 measure means — otherwise the next person reads the
   page column as a failure and "balances" it by publishing in Buffalo. */
const measures = [...alloc.matchAll(/measure:\s*'([a-z]+)'/g)].map((x) => x[1]);
for (const required of ['records', 'pages', 'depth', 'graph']) {
  if (!measures.includes(required)) fail.push(`the allocation report no longer computes "${required}"`);
}
if (!/[Ss]tructurally 100\/0/.test(alloc) || !/never hold/.test(alloc)) {
  fail.push(
    'the allocation report no longer explains why the page measure is 100/0. Without that sentence the split reads ' +
      'as a Canadian bias to be corrected, and correcting it means publishing an American page.',
  );
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ allocation: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
const share = ((ca.length / (ca.length + us.length)) * 100).toFixed(1);
console.log(
  `✓ allocation verified — ${ca.length} Canadian and ${us.length} United States market(s), Canada at ${share}% of ` +
    `the model against an 80% target and a ${(floor * 100).toFixed(0)}% floor; no United States market can hold a ` +
    'page or enter the service area',
);
