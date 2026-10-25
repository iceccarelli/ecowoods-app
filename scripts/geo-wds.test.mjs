/** Web Data Service reader on SYNTHETIC rows in the cube CSV layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWdsCube, wdsFacts, WDS_TABLES, dimName } from './geo-wds.mjs';
import { checkWdsDownloadReply, checkWdsHeader } from './geo-fetch.mjs';
import { validateFacts } from './geo-lib.mjs';

const HEAD = 'REF_DATE,GEO,DGUID,Household size (8),Statistics (3C),Structural type of dwelling (10),UOM,UOM_ID,SCALAR_FACTOR,SCALAR_ID,VECTOR,COORDINATE,VALUE,STATUS';
const row = (geo, csd, size, stat, type, value, scalar = 'units') =>
  `2021,"${geo}",2021A0005${csd},"${size}","${stat}","${type}",Number,1,${scalar},0,v1,1.1,${value},`;
async function* gen(rows) { for (const r of [HEAD, ...rows]) yield r; }

const table = WDS_TABLES.find((t) => t.pid === '98100240');
const want = new Set(['3599001', '3599002']);
const TOT = 'Total - Household size', HH = 'Number of private households';

test('selects the single-detached and total rows, ignoring other structural types', async () => {
  const { found, notes } = await readWdsCube(gen([
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Total - Structural type of dwelling', 1000),
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Single-detached house', 400),
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Row house', 100),
    row('Fixture A, Ontario', '3599001', '1 person', HH, 'Single-detached house', 50),
    row('Elsewhere, Ontario', '3500000', TOT, HH, 'Single-detached house', 9),
  ]), table, want);
  assert.equal(found.get('3599001').get('single_detached').value, 400);
  assert.equal(found.get('3599001').get('structural_total').value, 1000);
  assert.equal(found.has('3500000'), false, 'unmapped geographies are not read');
  assert.deepEqual(notes, []);
});

test('a duplicate qualifying row is ambiguous and leaves the metric unavailable', async () => {
  const { found, notes } = await readWdsCube(gen([
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Single-detached house', 400),
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Single-detached house', 401),
  ]), table, want);
  assert.equal(found.get('3599001')?.has('single_detached') ?? false, false);
  assert.ok(notes.some((n) => /ambiguous/.test(n)));
});

test('a scalar factor other than units is refused; suppressed values are unavailable', async () => {
  const { found, notes } = await readWdsCube(gen([
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Single-detached house', 4, 'thousands'),
    row('Fixture B, Ontario', '3599002', TOT, HH, 'Single-detached house', 'x'),
  ]), table, want);
  assert.equal(found.size, 0);
  assert.ok(notes.some((n) => /scalar factor/.test(n)));
});

test('facts: geography name and dguid are both checked; out-of-range values are not trusted', async () => {
  const map = { schema: 1, markets: {
    a: { direct: { system: 'statcan-csd', id: '3599001', name: 'Fixture A' } },
    b: { direct: { system: 'statcan-csd', id: '3599002', name: 'Fixture B' } },
  } };
  const markets = [{ slug: 'a', country: 'CA', kind: 'municipality' }, { slug: 'b', country: 'CA', kind: 'municipality' }];
  const read = await readWdsCube(gen([
    row('Fixture A, Ontario', '3599001', TOT, HH, 'Single-detached house', 400),
    row('Somewhere Else, Ontario', '3599002', TOT, HH, 'Single-detached house', 50),
  ]), table, want);
  const report = [];
  const facts = wdsFacts([{ table, result: read }], map, markets, '2026-10-20', report);
  assert.deepEqual(facts.map((f) => `${f.marketSlug}.${f.metric}`), ['a.single_detached']);
  assert.ok(report.some((r) => /CSD 3599002 is "Somewhere Else, Ontario"/.test(r)));
  assert.deepEqual(validateFacts({ schema: 1, facts }, '2026-10-25'), []);
  assert.equal(facts[0].source.url, 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810024001');
  assert.equal(facts[0].unit, 'dwellings');

  const vt = WDS_TABLES.find((t) => t.pid === '98100257');
  const v = await readWdsCube((async function* () {
    yield 'REF_DATE,GEO,DGUID,Statistics (3C),Value (owner-estimated) of dwelling (16),Structural type of dwelling (10),UOM,UOM_ID,SCALAR_FACTOR,SCALAR_ID,VECTOR,COORDINATE,VALUE,STATUS';
    yield '2021,"Fixture A, Ontario",2021A00053599001,Number of private households,Median value of dwelling $,Total - Structural type of dwelling,Dollars,1,units,0,v,1,12,';
  })(), vt, want);
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
  assert.ok(checkWdsHeader('REF_DATE,GEO,DGUID,A,UOM,SCALAR_FACTOR,VALUE', 'p').includes('DGUID'));
  assert.throws(() => checkWdsHeader('GEO,VALUE', 'p'), /missing column/);
});
