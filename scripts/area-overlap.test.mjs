/**
 * Regression tests for the service-area overlap metric and its ratchet.
 * Run: node --test scripts/area-overlap.test.mjs   (dependency-free)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, shingles, jaccard, measure, compare, METRIC } from './lib/area-overlap.mjs';

const LONG_A =
  'Original oak strip floors in century homes were laid over wide pine subfloors that move with the seasons, so refinishing here starts with checking every board for cupping before any sander is switched on and fixing the loose ones. Stairs and thresholds get the same treatment because their treads wear differently from the open floor.';
const LONG_B =
  'Concrete slab condominiums need a moisture reading and a vapour barrier before anything floats on top, and elevator bookings, insurance certificates and strict noise windows decide how the schedule is built for each building. Debris leaves through the same service lift, so the removal plan is written before the first day.';
const SHARED =
  'Ecowoods Hardwood Flooring Inc. is based in Etobicoke and answers the phone every weekday. Book your free in-home estimate today.';

const page = (slug, name, local, shared = SHARED) => ({
  slug,
  names: [name],
  sections: [
    { id: 'intro', text: local, local: true },
    { id: 'company', text: shared, local: false },
  ],
});

test('tokenize ignores markup, case, punctuation and whitespace', () => {
  assert.deepEqual(tokenize('  <b>Hello</b>,\n WORLD!! '), ['hello', 'world']);
});

test('identical substantive text is fully overlapping', () => {
  const r = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_A)]);
  assert.equal(r.mean, 1);
  assert.equal(r.max, 1);
});

test('text differing only in the location name is identical', () => {
  const r = measure([
    page('a', 'Etobicoke', LONG_A.replace(/century homes/, 'Etobicoke homes') + ' We work in Etobicoke every week of the year.'),
    page('b', 'Scarborough', LONG_A.replace(/century homes/, 'Scarborough homes') + ' We work in Scarborough every week of the year.'),
  ]);
  assert.equal(r.max, 1);
});

test('multi-word and possessive place names are replaced as a unit', () => {
  const a = tokenize('Work in North York is steady', ['North York']);
  const b = tokenize('Work in Mississauga is steady', ['Mississauga']);
  assert.deepEqual(a, b);
  assert.deepEqual(tokenize('Whitby and Whitbyshire', ['Whitby']), ['zzplace', 'and', 'whitbyshire']);
});

test('genuinely different substantive text barely overlaps', () => {
  const r = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_B)]);
  assert.ok(r.max < 0.1, `expected < 0.1, got ${r.max}`);
});

test('shared boilerplate with distinct local content does not count as overlap', () => {
  // The same company sentence is embedded in both local sections; it is also a shared component.
  const r = measure([page('a', 'Alpha', `${LONG_A} ${SHARED}`), page('b', 'Beta', `${LONG_B} ${SHARED}`)]);
  assert.ok(r.max < 0.1, `boilerplate leaked into the score: ${r.max}`);
  // Without a shared-component declaration the same text WOULD overlap — the subtraction is what is being tested.
  const naive = measure([
    { slug: 'a', names: ['Alpha'], sections: [{ id: 'intro', text: `${LONG_A} ${SHARED}`, local: true }] },
    { slug: 'b', names: ['Beta'], sections: [{ id: 'intro', text: `${LONG_B} ${SHARED}`, local: true }] },
  ]);
  assert.ok(naive.max > r.max);
});

test('empty and very short substantive sections are thin and never compared', () => {
  const r = measure([page('a', 'Alpha', ''), page('b', 'Beta', 'Short.'), page('c', 'Gamma', LONG_A), page('d', 'Delta', LONG_B)]);
  assert.deepEqual(r.thin, ['a', 'b']);
  assert.equal(r.compared_pages, 2);
  assert.equal(r.pairs, 1);
  // Two thin pages must not score as a perfect match by accident.
  const both = measure([page('a', 'Alpha', ''), page('b', 'Beta', '')]);
  assert.equal(both.pairs, 0);
  assert.equal(both.max, 0);
});

test('result is stable under route order and harmless formatting changes', () => {
  const pages = [page('c', 'Gamma', LONG_A), page('a', 'Alpha', LONG_B), page('b', 'Beta', `${LONG_A} ${LONG_B}`)];
  const base = measure(pages);
  const shuffled = measure([pages[2], pages[0], pages[1]]);
  const reformatted = measure(
    pages.map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s, text: `<p>\n  ${s.text.toUpperCase().replace(/ /g, '   ')}  </p>` })) })),
  );
  const strip = ({ pairsOver, ...rest }) => JSON.stringify(rest);
  assert.equal(strip(shuffled), strip(base));
  assert.equal(strip(reformatted), strip(base));
});

test('repeating a sentence inside a page does not change its overlap', () => {
  const once = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_B)]);
  const twice = measure([page('a', 'Alpha', `${LONG_A} ${LONG_A}`), page('b', 'Beta', LONG_B)]);
  assert.equal(twice.max, once.max);
});

test('top pairs name the sections involved', () => {
  const r = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_A)]);
  assert.equal(r.top_pairs[0].sections[0].section, 'intro');
  assert.ok(r.top_pairs[0].sections[0].shared_shingles > 10);
});

test('jaccard / shingles basics', () => {
  assert.equal(jaccard(new Set(['a']), new Set(['a'])), 1);
  assert.equal(jaccard(new Set(), new Set()), 0);
  assert.equal(shingles(['a', 'b', 'c', 'd', 'e'], 4).size, 2);
});

/* ── the ratchet ────────────────────────────────────────────────────────── */
const baselineOf = (r) => ({ metric: r.metric, mean: r.mean, max: r.max, thin: r.thin, worst_by_page: r.worst_by_page });
const THREE = () => [page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_B), page('c', 'Gamma', 'Oak strip in tall narrow townhouses needs the sander kept moving along every board because stairs and landings were finished decades apart by different hands and each stretch cuts differently, which is why a single pass with one grit never works on them.')];

test('unchanged content passes', () => {
  const r = measure(THREE());
  assert.deepEqual(compare(r, baselineOf(r)), []);
});

test('a page copied from another fails, and names the page', () => {
  const base = baselineOf(measure(THREE()));
  const worse = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_A), THREE()[2]]);
  const problems = compare(worse, base);
  assert.ok(problems.some((p) => p.kind === 'max'));
  assert.ok(problems.some((p) => p.kind === 'page' && p.slug === 'b'));
});

test('improved content passes', () => {
  const worse = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_A), THREE()[2]]);
  const better = measure(THREE());
  assert.deepEqual(compare(better, baselineOf(worse)), []);
});

test('a regression hidden inside a low mean is still caught per page', () => {
  const many = Array.from({ length: 8 }, (_, i) => page(`p${i}`, `Place${i}`, `Distinct number ${i} local paragraph. ${'unique'.repeat(1)}${i} ${LONG_B.split(' ').reverse().slice(i, i + 30).join(' ')} word${i}a word${i}b word${i}c word${i}d word${i}e word${i}f`));
  const base = baselineOf(measure(many));
  const dup = many.map((p, i) => (i === 1 ? { ...p, sections: [{ ...p.sections[0], text: many[0].sections[0].text }, p.sections[1]] } : p));
  const problems = compare(measure(dup), base);
  assert.ok(problems.some((p) => p.kind === 'page'));
});

test('a page falling below the word floor fails as thin', () => {
  const base = baselineOf(measure(THREE()));
  const thinner = measure([page('a', 'Alpha', LONG_A), page('b', 'Beta', LONG_B), page('c', 'Gamma', 'Too short.')]);
  assert.ok(compare(thinner, base).some((p) => p.kind === 'thin'));
});

test('a changed metric definition refuses to compare against an old baseline', () => {
  const r = measure(THREE());
  const stale = baselineOf(r);
  stale.metric = { ...METRIC, version: METRIC.version + 1 };
  assert.equal(compare(r, stale)[0].kind, 'metric-changed');
});

test('tolerance absorbs noise but not a real step', () => {
  const r = measure(THREE());
  const b = baselineOf(r);
  assert.deepEqual(compare({ ...r, mean: r.mean + 0.004 }, b), []);
  assert.ok(compare({ ...r, mean: r.mean + 0.02 }, b).some((p) => p.kind === 'mean'));
});
