/**
 * The generated <title> and meta description of every published service area,
 * checked as strings. Run: node --experimental-strip-types --no-warnings \
 *   --import ./scripts/lib/ts-register.mjs --test scripts/area-meta.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const seo = await import('../apps/web/lib/seo-data.ts');
const meta = await import('../apps/web/lib/area-description.ts');
const { SERVICE_AREAS, areaDisplayName } = seo;
const { areaTitle, areaDescription, TITLE_SUFFIX, AREA_TITLE_LIMIT, AREA_DESCRIPTION_LIMIT } = meta;

const rows = SERVICE_AREAS.map((c) => ({ slug: c.slug, where: areaDisplayName(c), title: areaTitle(c), full: areaTitle(c) + TITLE_SUFFIX, desc: areaDescription(c) }));

test('there are published areas to check', () => assert.ok(rows.length >= 100));

test('every composed title fits and still names the place', () => {
  for (const r of rows) {
    assert.ok(r.full.length <= AREA_TITLE_LIMIT, `${r.slug}: ${r.full.length} chars: ${r.full}`);
    assert.ok(r.title.endsWith(` in ${r.where}`), `${r.slug}: title must end with the place`);
    assert.ok(/hardwood/i.test(r.title), `${r.slug}: keeps the service term`);
  }
});

test('titles are unique', () => {
  assert.equal(new Set(rows.map((r) => r.full)).size, rows.length);
});

test('the longer, more specific title form is used wherever it fits', () => {
  for (const r of rows) {
    const long = `Hardwood floor refinishing & installation in ${r.where}`;
    if (long.length + TITLE_SUFFIX.length <= AREA_TITLE_LIMIT) assert.equal(r.title, long, r.slug);
  }
});

test('descriptions are whole sentences within the limit, unique, and name a call to action', () => {
  for (const r of rows) {
    assert.ok(r.desc.length <= AREA_DESCRIPTION_LIMIT, `${r.slug}: ${r.desc.length}`);
    assert.ok(/[.!?]$/.test(r.desc), `${r.slug}: ends mid-sentence: ${r.desc}`);
    assert.ok(!r.desc.includes('…') && !r.desc.endsWith('...'), `${r.slug}: truncated`);
    assert.ok(/Call \(\d{3}\) \d{3}-\d{4}\./.test(r.desc), `${r.slug}: no call to action`);
  }
  assert.equal(new Set(rows.map((r) => r.desc)).size, rows.length);
});
