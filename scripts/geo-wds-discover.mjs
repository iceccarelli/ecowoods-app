#!/usr/bin/env node
/**
 * scripts/geo-wds-discover.mjs — list the Statistics Canada data cubes that
 * could carry the census indicators at census-subdivision level, using the
 * official Web Data Service (www150.statcan.gc.ca/t1/wds). Read-only; prints
 * product id, title and reference period so a table can be chosen on evidence.
 *
 *   node scripts/geo-wds-discover.mjs
 */
const WDS = 'https://www150.statcan.gc.ca/t1/wds/rest';
const TOPICS = [
  ['income', /income/i],
  ['dwelling value', /value of (owner-occupied )?dwellings?|dwelling value|shelter cost/i],
  ['period of construction', /period of construction/i],
  ['structural type', /structural type/i],
];

export const matchesTopic = (title) => TOPICS.filter(([, re]) => re.test(title)).map(([name]) => name);

async function main() {
  const res = await fetch(`${WDS}/getAllCubesListLite`, { headers: { accept: 'application/json', 'user-agent': 'ecowoods-geo-ingest/1.0 (+https://ecowoods.ca)' } });
  if (res.status !== 200) throw new Error(`getAllCubesListLite: HTTP ${res.status}`);
  const cubes = await res.json();
  if (!Array.isArray(cubes) || cubes.length < 1000) throw new Error(`unexpected cube list (${Array.isArray(cubes) ? cubes.length : typeof cubes})`);
  console.log(`${cubes.length} cubes in the catalogue`);
  const rows = cubes
    .filter((c) => /^98100/.test(String(c.productId)) || /2021 census/i.test(c.cubeTitleEn ?? ''))
    .map((c) => ({ id: c.productId, title: c.cubeTitleEn, start: c.cubeStartDate, end: c.cubeEndDate, topics: matchesTopic(c.cubeTitleEn ?? '') }))
    .filter((r) => r.topics.length)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  console.log(`${rows.length} candidate 2021-census cube(s):`);
  for (const r of rows) console.log(`${r.id}\t${r.topics.join('+')}\t${r.start}..${r.end}\t${r.title}`);
  if (!rows.length) throw new Error('no 2021 census cubes matched');
}
if (process.argv[1] === new URL(import.meta.url).pathname) await main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
