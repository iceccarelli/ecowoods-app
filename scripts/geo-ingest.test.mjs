/**
 * Geo data: geography mapping, normalization, source metadata and unavailable
 * inputs, on SYNTHETIC facts only. Nothing here is census data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFacts, validateCrosswalk, deriveInputs, percentile, staleFacts, MIN_COHORT } from './geo-lib.mjs';

const TODAY = '2026-10-25';
const letters = 'abcdefghij'.split('');
const markets = [
  ...letters.map((l) => ({ slug: `fx-${l}`, country: 'CA', kind: 'municipality' })),
  ...letters.map((l) => ({ slug: `fu-${l}`, country: 'US', kind: 'municipality' })),
  { slug: 'fx-a-east', country: 'CA', kind: 'district', partOf: 'fx-a' },
  { slug: 'fu-orphan', country: 'US', kind: 'municipality' },
];
const map = { schema: 1, markets: {} };
letters.forEach((l, i) => {
  map.markets[`fx-${l}`] = { direct: { system: 'statcan-csd', id: `35${90000 + i}`, name: `Fixture ${l.toUpperCase()}` } };
  map.markets[`fu-${l}`] = { direct: { system: 'us-place', id: `36${90000 + i}`, name: `Fixture ${l.toUpperCase()} city, New York` } };
});
map.markets['fx-a-east'] = { parent: 'fx-a' };
map.markets['fu-orphan'] = { unmapped: 'no confirmed code' };

const fact = (slug, metric, value, unit, i, country) => ({
  id: `${slug}.${metric}`, marketSlug: slug, metric, value, unit, geography: slug, referencePeriod: '2021 Census',
  source: { name: 'Fixture table', url: country === 'CA' ? 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1' : 'https://www.census.gov/' },
  retrievedAt: '2026-10-20', tableId: 'T', normalization: 'copied as-is', geographyId: String(i), geographySystem: 'x',
});
const facts = [];
letters.forEach((l, i) => {
  for (const [prefix, country, money] of [['fx', 'CA', 'CAD'], ['fu', 'US', 'USD']]) {
    const s = `${prefix}-${l}`;
    facts.push(fact(s, 'median_household_income', 50000 + i * 1000, money, i, country));
    facts.push(fact(s, 'median_dwelling_value', 300000 + i * 10000, money, i, country));
    facts.push(fact(s, 'structural_total', 1000, 'dwellings', i, country));
    facts.push(fact(s, 'single_detached', 300 + i * 20, 'dwellings', i, country));
    facts.push(fact(s, 'period_total', 1000, 'dwellings', i, country));
    facts.push(fact(s, 'built_early', 200 + i * 10, 'dwellings', i, country));
  }
});

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

test('facts carry full provenance and CAD and USD are labelled', () => {
  assert.deepEqual(validateFacts({ schema: 1, facts }, TODAY), []);
  assert.equal(facts.find((f) => f.id === 'fx-a.median_household_income').unit, 'CAD');
  assert.equal(facts.find((f) => f.id === 'fu-a.median_household_income').unit, 'USD');
  const broken = [{ ...facts[0], source: { name: '', url: 'http://x' }, retrievedAt: '2999-01-01' }];
  const errs = validateFacts({ schema: 1, facts: broken }, TODAY).join('\n');
  assert.match(errs, /source.name/);
  assert.match(errs, /https/);
  assert.match(errs, /future/);
});

test('normalization: mid-rank percentile within country, deterministic, ties share a score', () => {
  assert.equal(percentile(5, [1, 5, 9, 10]), 37.5);
  assert.equal(percentile(1, [1, 5, 9, 10]), 12.5);
  assert.equal(percentile(7, [7, 7, 7, 7]), 50);
});

test('deriveInputs: scores, proxy label, parent geography, unavailable inputs', () => {
  const { inputs } = deriveInputs(facts, map, markets);
  const a = inputs['fx-a'], j = inputs['fx-j'];
  assert.equal(a.purchasingPower.score, 5);
  assert.equal(j.purchasingPower.score, 95);
  assert.equal(a.purchasingPower.basis, 'measured');
  assert.equal(a.hardwoodOpportunity.basis, 'proxy');
  assert.match(a.hardwoodOpportunity.note, /PROXY: hardwood prevalence is not census-measured/);
  assert.equal(a.purchasingPower.raw.components[0].unit, 'CAD');
  assert.match(inputs['fu-a'].purchasingPower.note, /United States/);
  const d = inputs['fx-a-east'].purchasingPower;
  assert.equal(d.geography.kind, 'parent');
  assert.equal(d.geography.parentSlug, 'fx-a');
  assert.match(d.note, /parent geography/);
  assert.equal(inputs['fu-orphan'], undefined);
  for (const id of ['renovationPotential', 'searchDemand', 'competition']) assert.equal(a[id], undefined);
});

test('a cohort below the minimum yields no score rather than a flattering one', () => {
  const few = facts.filter((f) => !(f.marketSlug.startsWith('fx-') && /[e-j]$/.test(f.marketSlug)));
  const { inputs, missing } = deriveInputs(few, map, markets);
  assert.equal(inputs['fx-a']?.purchasingPower, undefined);
  assert.ok(missing.some((m) => m.includes('purchasingPower/CA') && m.includes(`below ${MIN_COHORT}`)));
  assert.ok(inputs['fu-a'].purchasingPower, 'the US cohort is unaffected');
});

test('regeneration is idempotent and order-independent', () => {
  assert.equal(
    JSON.stringify(deriveInputs(facts, map, markets).inputs),
    JSON.stringify(deriveInputs([...facts].reverse(), map, markets).inputs),
  );
});

test('stale sources are detected by retrieval date', () => {
  assert.deepEqual(staleFacts({ facts: [{ id: 'old', retrievedAt: '2022-01-01' }, { id: 'new', retrievedAt: '2026-10-01' }] }, TODAY), ['old']);
});

test('the committed dataset validates', () => {
  const doc = JSON.parse(readFileSync(new URL('../apps/web/content/geo/sourced-facts.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateFacts(doc), []);
});
