/**
 * Geo data engine: geography mapping, normalization, source metadata and
 * unavailable inputs, on SYNTHETIC fixtures only. Nothing here is census data;
 * names ("Fixture A"), ids and figures exist to exercise the code paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFacts, validateCrosswalk, deriveInputs, percentile, staleFacts, MIN_COHORT } from './geo-lib.mjs';
import { readCensusProfile, readAcs, caFacts, usFacts, censusNumber, CA_LINES, US_VARIABLES } from './geo-sources.mjs';

const TODAY = '2026-10-25';
const letters = 'abcdefghij'.split('');
const caMarkets = letters.map((l) => ({ slug: `fx-${l}`, country: 'CA', kind: 'municipality' }));
const usMarkets = letters.map((l) => ({ slug: `fu-${l}`, country: 'US', kind: 'municipality' }));
const districts = [{ slug: 'fx-a-east', country: 'CA', kind: 'district', partOf: 'fx-a' }, { slug: 'fu-orphan', country: 'US', kind: 'municipality' }];
const markets = [...caMarkets, ...usMarkets, ...districts];

const map = { schema: 1, markets: {} };
letters.forEach((l, i) => {
  map.markets[`fx-${l}`] = { direct: { system: 'statcan-csd', id: `35${String(90000 + i)}`, name: `Fixture ${l.toUpperCase()}` } };
  map.markets[`fu-${l}`] = { direct: { system: 'us-place', id: `36${String(90000 + i)}`, name: `Fixture ${l.toUpperCase()} city, New York` } };
});
map.markets['fx-a-east'] = { parent: 'fx-a' };
map.markets['fu-orphan'] = { unmapped: 'no confirmed code' };

const HEAD = 'CENSUS_YEAR,DGUID,ALT_GEO_CODE,GEO_LEVEL,GEO_NAME,CHARACTERISTIC_ID,CHARACTERISTIC_NAME,C1_COUNT_TOTAL';
function csv({ skipSingle = [], dupIncome = [], suppress = [], rename = {} } = {}) {
  const rows = [HEAD];
  letters.forEach((l, i) => {
    const code = `35${90000 + i}`;
    const name = rename[l] ?? `Fixture ${l.toUpperCase()}`;
    const add = (n, v) => rows.push(`2021,2021A0005${code},${code},Census subdivision,"${name}",1,"  ${n}",${v}`);
    add('Population, 2021', 1000 * (i + 1));
    add('Total private dwellings', 400 * (i + 1));
    add('Median total income of household in 2020 ($)', suppress.includes(l) ? 'x' : 50000 + i * 1000);
    if (dupIncome.includes(l)) add('Median total income of household in 2020 ($)', 1);
    add('Median value of dwellings ($)', 300000 + i * 10000);
    add('Total - Occupied private dwellings by period of construction - 25% sample data', 1000);
    add('1960 or before', 100 + i * 10);
    add('1961 to 1980', 100);
    add('Total - Occupied private dwellings by structural type of dwelling - 100% data', 1000);
    if (!skipSingle.includes(l)) add('Single-detached house', 300 + i * 20);
  });
  return rows;
}
async function* gen(rows) { for (const r of rows) yield r; }
const wantCsds = new Set(Object.values(map.markets).filter((e) => e.direct?.system === 'statcan-csd').map((e) => e.direct.id));

const acsJson = ({ blank = [] } = {}) => [
  ['NAME', ...US_VARIABLES, 'state', 'place'],
  ...letters.map((l, i) => [
    `Fixture ${l.toUpperCase()} city, New York`,
    ...US_VARIABLES.map((v) => {
      if (blank.includes(l) && v === 'B19013_001E') return '-666666666';
      if (v === 'B19013_001E') return String(60000 + i * 2000);
      if (v === 'B25077_001E') return String(200000 + i * 5000);
      if (v === 'B25034_001E') return '1000';
      if (/^B25034_0(07|08|09|10|11)E$/.test(v)) return '50';
      if (v === 'B25024_001E') return '1000';
      if (v === 'B25024_002E') return String(200 + i * 10);
      return String(100 * (i + 1));
    }),
    '36', String(90000 + i),
  ]),
];

const build = async (opts) => {
  const report = [];
  const ca = caFacts(await readCensusProfile(gen(csv(opts)), wantCsds), map, markets, '2026-10-20', report);
  const us = usFacts([readAcs(acsJson(opts))], map, markets, '2026-10-20', report);
  return { facts: [...ca, ...us], report };
};

test('crosswalk: every market has exactly one decision; bad shapes are named', () => {
  assert.deepEqual(validateCrosswalk(map, markets), []);
  const bad = structuredClone(map);
  delete bad.markets['fx-b'];
  bad.markets['fx-c'].direct.id = '123';
  bad.markets['fx-d'].direct.id = bad.markets['fx-e'].direct.id;
  bad.markets['fx-a-east'] = { parent: 'fx-b' };
  const errs = validateCrosswalk(bad, markets).join('\n');
  assert.match(errs, /fx-b: no geography decision/);
  assert.match(errs, /fx-c: statcan-csd id "123"/);
  assert.match(errs, /fx-e: .* already used by fx-d/);
  assert.match(errs, /fx-a-east: parent must be its registry partOf/);
  const district = structuredClone(map);
  district.markets['fx-a-east'] = { direct: { system: 'statcan-csd', id: '3599999', name: 'X' } };
  assert.match(validateCrosswalk(district, markets).join('\n'), /district may not claim its own direct geography/);
});

test('Census Profile: exact CSD match, whitespace-tolerant names, suppression and ambiguity yield no fact', async () => {
  const { facts, report } = await build({ suppress: ['b'], dupIncome: ['c'], skipSingle: ['d'] });
  const get = (slug, metric) => facts.find((f) => f.marketSlug === slug && f.metric === metric);
  assert.equal(get('fx-a', 'median_household_income').value, 50000);
  assert.equal(get('fx-a', 'median_household_income').geographyId, '3590000');
  assert.equal(get('fx-b', 'median_household_income'), undefined, 'suppressed "x" is unavailable, not zero');
  assert.equal(get('fx-c', 'median_household_income'), undefined, 'a name matching twice is ambiguous');
  assert.equal(get('fx-d', 'single_detached'), undefined);
  assert.equal(get('fx-a', 'built_early').value, 200, '1960-or-before + 1961-1980');
  assert.equal(get('fx-a', 'built_1960_or_before'), undefined, 'component lines are folded into built_early');
  assert.ok(report.some((r) => r.startsWith('fx-b:') && r.includes('Median total income')));
});

test('a geography whose official name differs from the crosswalk is skipped, never trusted', async () => {
  const report = [];
  const facts = caFacts(await readCensusProfile(gen(csv({ rename: { e: 'Somewhere Else' } })), wantCsds), map, markets, '2026-10-20', report);
  assert.equal(facts.filter((f) => f.marketSlug === 'fx-e').length, 0);
  assert.ok(report.some((r) => /fx-e: CSD 3590004 is "Somewhere Else"/.test(r)));
});

test('facts carry full provenance and validate; CAD and USD are labelled', async () => {
  const { facts } = await build();
  assert.deepEqual(validateFacts({ schema: 1, facts }, TODAY), []);
  const ca = facts.find((f) => f.marketSlug === 'fx-a' && f.metric === 'median_household_income');
  const us = facts.find((f) => f.marketSlug === 'fu-a' && f.metric === 'median_household_income');
  assert.equal(ca.unit, 'CAD');
  assert.equal(us.unit, 'USD');
  assert.match(ca.source.url, /^https:\/\/www150\.statcan\.gc\.ca\//);
  assert.match(us.source.url, /^https:\/\/www\.census\.gov\//);
  assert.equal(ca.referencePeriod, '2021 Census (income year 2020)');
  assert.equal(us.referencePeriod, 'ACS 2020–2024 5-year');
  assert.equal(us.tableId, 'B19013');
  assert.equal(facts.find((f) => f.marketSlug === 'fu-a' && f.metric === 'built_early').value, 250);
});

test('ACS sentinel values are unavailable', async () => {
  const { facts, report } = await build({ blank: ['c'] });
  assert.equal(facts.find((f) => f.marketSlug === 'fu-c' && f.metric === 'median_household_income'), undefined);
  assert.ok(report.some((r) => r.startsWith('fu-c:') && r.includes('B19013_001E')));
  assert.equal(censusNumber('-666666666'), null);
  assert.equal(censusNumber('x'), null);
  assert.equal(censusNumber('1,234'), 1234);
});

test('normalization: mid-rank percentile within country, deterministic, ties share a score', () => {
  assert.equal(percentile(5, [1, 5, 9, 10]), 37.5);
  assert.equal(percentile(1, [1, 5, 9, 10]), 12.5);
  assert.equal(percentile(7, [7, 7, 7, 7]), 50);
});

test('deriveInputs: scores, proxy label, parent geography, unavailable inputs', async () => {
  const { facts } = await build();
  const { inputs } = deriveInputs(facts, map, markets);
  const a = inputs['fx-a'], j = inputs['fx-j'];
  assert.equal(a.purchasingPower.score, 5, 'lowest of 10 → (0+0.5)/10');
  assert.equal(j.purchasingPower.score, 95);
  assert.equal(a.purchasingPower.basis, 'measured');
  assert.equal(a.purchasingPower.geography.kind, 'direct');
  assert.equal(a.hardwoodOpportunity.basis, 'proxy');
  assert.match(a.hardwoodOpportunity.note, /PROXY: hardwood prevalence is not census-measured/);
  assert.equal(a.purchasingPower.source.retrievedAt, '2026-10-20');
  assert.equal(a.purchasingPower.raw.components[0].unit, 'CAD');
  assert.match(inputs['fu-a'].purchasingPower.note, /United States/);
  assert.match(inputs['fx-a'].purchasingPower.note, /Canadian/);
  /* a district inherits its parent, labelled, never as a direct measurement */
  const d = inputs['fx-a-east'].purchasingPower;
  assert.equal(d.score, a.purchasingPower.score);
  assert.equal(d.geography.kind, 'parent');
  assert.equal(d.geography.parentSlug, 'fx-a');
  assert.match(d.note, /parent geography/);
  /* unmapped market and renovation/search/competition inputs stay absent */
  assert.equal(inputs['fu-orphan'], undefined);
  for (const id of ['renovationPotential', 'searchDemand', 'competition']) assert.equal(a[id], undefined);
});

test('deriveInputs: a cohort below the minimum yields no score rather than a flattering one', async () => {
  const { facts } = await build();
  const few = facts.filter((f) => !(f.marketSlug.startsWith('fx-') && /[e-j]$/.test(f.marketSlug)));
  const { inputs, missing } = deriveInputs(few, map, markets);
  assert.equal(inputs['fx-a']?.purchasingPower, undefined);
  assert.ok(missing.some((m) => m.includes('purchasingPower/CA') && m.includes(`below ${MIN_COHORT}`)));
  assert.ok(inputs['fu-a'].purchasingPower, 'the US cohort is unaffected');
});

test('regeneration is idempotent and order-independent', async () => {
  const { facts } = await build();
  const one = JSON.stringify(deriveInputs(facts, map, markets).inputs);
  const two = JSON.stringify(deriveInputs([...facts].reverse(), map, markets).inputs);
  assert.equal(one, two);
});

test('stale sources are detected by retrieval date', () => {
  const doc = { facts: [{ id: 'old', retrievedAt: '2022-01-01' }, { id: 'new', retrievedAt: '2026-10-01' }] };
  assert.deepEqual(staleFacts(doc, TODAY), ['old']);
});

test('the lines read from the Census Profile are the ones the spec names', () => {
  assert.equal(new Set(CA_LINES.map((l) => l.metric)).size, CA_LINES.length);
});

test('committed dataset is internally consistent with the committed crosswalk', () => {
  const facts = JSON.parse(readFileSync(new URL('../apps/web/content/geo/sourced-facts.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateFacts(facts), []);
});
