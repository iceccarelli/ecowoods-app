/** Web Data Service reader on SYNTHETIC rows in the cube's wide CSV layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWdsCube, wdsFacts, WDS_TABLES, dimName, parseWideHeader, geoBase } from './geo-wds.mjs';
import { checkWdsDownloadReply, checkWdsHeader } from './geo-fetch.mjs';
import { validateFacts } from './geo-lib.mjs';

/* 98100240-like: structural type is a row dimension, Statistics is the wide dimension. */
const HEAD240 = 'REF_DATE,GEO,DGUID,Household size (8),Structural type of dwelling (10),Coordinate,Statistics (3C):Number of private households[1],Symbol,Statistics (3C):Confidence interval lower bound of number of private households[2],Symbol';
const r240 = (geo, csd, size, type, n, lo = 1) => `2021,"${geo}",2021A0005${csd},"${size}","${type}",1.1,${n},,${lo},`;
async function* gen(head, rows) { for (const r of [`﻿${head}`, ...rows]) yield r; }

const table = WDS_TABLES.find((t) => t.pid === '98100240');
const want = new Set(['3599001', '3599002']);
const TOT = 'Total - Household size';

test('wide header: row dimensions, value columns and Symbol columns are told apart', () => {
  const l = parseWideHeader(HEAD240.split(','));
  assert.deepEqual(l.rowDims.map((d) => d.name), ['Household size', 'Structural type of dwelling']);
  assert.deepEqual(l.cols.map((c) => c.member), ['Number of private households', 'Confidence interval lower bound of number of private households']);
  assert.throws(() => parseWideHeader(['REF_DATE', 'GEO', 'DGUID', 'Coordinate']), /no "<dimension>:<member>\[n\]"/);
  assert.throws(() => parseWideHeader(['GEO', 'DGUID']), /missing column/);
});

test('selects single-detached and total, never the confidence-interval column or other types', async () => {
  const { found, notes } = await readWdsCube(gen(HEAD240, [
    r240('Fixture A, Ontario', '3599001', TOT, 'Total - Structural type of dwelling', 1000),
    r240('Fixture A, Ontario', '3599001', TOT, 'Single-detached house', 400, 380),
    r240('Fixture A, Ontario', '3599001', TOT, 'Row house', 100),
    r240('Fixture A, Ontario', '3599001', '1 person', 'Single-detached house', 50),
    r240('Elsewhere, Ontario', '3500000', TOT, 'Single-detached house', 9),
  ]), table, want);
  assert.equal(found.get('3599001').get('single_detached').value, 400);
  assert.equal(found.get('3599001').get('structural_total').value, 1000);
  assert.equal(found.has('3500000'), false, 'unmapped geographies are not read');
  assert.deepEqual(notes, []);
});

test('a duplicate qualifying cell is ambiguous and leaves the metric unavailable', async () => {
  const { found, notes } = await readWdsCube(gen(HEAD240, [
    r240('Fixture A, Ontario', '3599001', TOT, 'Single-detached house', 400),
    r240('Fixture A, Ontario', '3599001', TOT, 'Single-detached house', 401),
  ]), table, want);
  assert.equal(found.get('3599001')?.has('single_detached') ?? false, false);
  assert.ok(notes.some((n) => /ambiguous/.test(n)));
});

test('suppressed and blank values are unavailable, not zero', async () => {
  const { found } = await readWdsCube(gen(HEAD240, [
    r240('Fixture A, Ontario', '3599001', TOT, 'Single-detached house', 'x'),
    r240('Fixture B, Ontario', '3599002', TOT, 'Single-detached house', ''),
  ]), table, want);
  assert.equal(found.size, 0);
});

test('income: the figure is found in a wide column named by its member, with 2015 columns ignored', async () => {
  const t = WDS_TABLES.find((x) => x.pid === '98100060');
  const head = 'REF_DATE,GEO,DGUID,Household type including census family structure (11),Structural type of dwelling (9),Coordinate,'
    + 'Household income statistics (16):Total - Household income statistics - 100% Data (2020)[1],Symbol,'
    + 'Household income statistics (16):Median total income of households ($) (2020)[2],Symbol,'
    + 'Household income statistics (16):Median total income of households ($) (2015)[10],Symbol';
  const row = (v) => `2021,"Fixture A, Ontario",2021A00053599001,"Total - Household type including census family structure","Total - Structural type of dwelling",1.1,900,,${v},,70000,`;
  const { found } = await readWdsCube(gen(head, [row(85000)]), t, want);
  assert.equal(found.get('3599001').get('median_household_income').value, 85000);
});

test('facts: geography name and dguid are both checked; out-of-range values are not trusted', async () => {
  const map = { schema: 1, markets: {
    a: { direct: { system: 'statcan-csd', id: '3599001', name: 'Fixture A' } },
    b: { direct: { system: 'statcan-csd', id: '3599002', name: 'Fixture B' } },
  } };
  const markets = [{ slug: 'a', country: 'CA', kind: 'municipality' }, { slug: 'b', country: 'CA', kind: 'municipality' }];
  const read = await readWdsCube(gen(HEAD240, [
    r240('Fixture A, Ontario', '3599001', TOT, 'Single-detached house', 400),
    r240('Somewhere Else, Ontario', '3599002', TOT, 'Single-detached house', 50),
  ]), table, want);
  const report = [];
  const facts = wdsFacts([{ table, result: read }], map, markets, '2026-10-20', report);
  assert.deepEqual(facts.map((f) => `${f.marketSlug}.${f.metric}`), ['a.single_detached']);
  assert.ok(report.some((r) => /CSD 3599002 is "Somewhere Else, Ontario"/.test(r)));
  assert.deepEqual(validateFacts({ schema: 1, facts }, '2026-10-25'), []);
  assert.equal(facts[0].source.url, 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810024001');
  assert.equal(facts[0].unit, 'dwellings');

  const vt = WDS_TABLES.find((t) => t.pid === '98100257');
  const vhead = 'REF_DATE,GEO,DGUID,Statistics (3C),Structural type of dwelling (10),Coordinate,Value (owner-estimated) of dwelling (16):Median value of dwelling $[16],Symbol';
  const v = await readWdsCube(gen(vhead, ['2021,"Fixture A, Ontario",2021A00053599001,Number of private households,Total - Structural type of dwelling,1.1,12,']), vt, want);
  const rep = [];
  assert.equal(wdsFacts([{ table: vt, result: v }], map, markets, '2026-10-20', rep).length, 0, 'a median of 12 dollars is not trusted');
  assert.ok(rep.some((r) => /outside 50000/.test(r)));
});

test('dimension names drop the member-count suffix', () => {
  assert.equal(dimName('Household income statistics (16)'), 'Household income statistics');
  assert.equal(dimName('Statistics (3C)'), 'Statistics');
});

test('download reply and CSV header checks', () => {
  assert.equal(checkWdsDownloadReply({ status: 'SUCCESS', object: 'https://www150.statcan.gc.ca/n1/tbl/csv/98100240-eng.zip' }, 'p'), 'https://www150.statcan.gc.ca/n1/tbl/csv/98100240-eng.zip');
  assert.throws(() => checkWdsDownloadReply({ status: 'FAILED' }, 'p'), /unexpected reply/);
  assert.throws(() => checkWdsDownloadReply({ status: 'SUCCESS', object: 'https://evil.example.com/x.zip' }, 'p'), /not an https statcan/);
  assert.throws(() => checkWdsDownloadReply({ status: 'SUCCESS', object: 'http://www150.statcan.gc.ca/x.zip' }, 'p'), /not an https/);
  assert.ok(checkWdsHeader(`﻿${HEAD240}`, 'p').includes('DGUID'));
  assert.throws(() => checkWdsHeader('GEO,VALUE', 'p'), /missing column/);
  assert.throws(() => checkWdsHeader('REF_DATE,GEO,DGUID,Coordinate', 'p'), /no "<dimension>:<member>\[n\]"/);
  assert.ok(checkWdsHeader('REF_DATE,GEO,DGUID,Coordinate,"A (2):$100,000 to $149,999[3]",Symbol', 'p').includes('A (2):$100,000 to $149,999[3]'), 'quoted commas');
});

test('geography names: plain, with province, and with the "(code) type" suffix all reduce to the name', () => {
  assert.equal(geoBase('Toronto'), 'Toronto');
  assert.equal(geoBase('Toronto, Ontario'), 'Toronto');
  assert.equal(geoBase('Toronto (3520005) C'), 'Toronto');
  assert.equal(geoBase('St. Catharines (3526053) CY'), 'St. Catharines');
});
