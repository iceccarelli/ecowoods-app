/**
 * One Service entity per /services/<slug>#service. The organisation embeds six
 * Service nodes (root layout) and each /services/<slug> page emits another with
 * the same @id; they must not contradict each other.
 * Run: node --experimental-strip-types --no-warnings \
 *   --import ./scripts/lib/ts-register.mjs --test scripts/schema-service.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = await import('../apps/web/lib/schema/root-schema.ts');
const seo = await import('../apps/web/lib/seo-data.ts');
const ORG = 'https://ecowoods.ca/#organization';
const services = root.ROOT_ORGANIZATION_SCHEMA.service ?? [];
const expectedPlaces = seo.CITIES.map((c) => root.placeForArea(c));

test('the organisation embeds a Service for every published service', () => {
  assert.equal(services.length, seo.SERVICES.length);
});

test('embedded Service nodes name places the way the service pages do', () => {
  for (const s of services) {
    assert.deepEqual(s.areaServed, expectedPlaces, s['@id']);
  }
});

test('no embedded Service names a bare place with no province or state', () => {
  for (const s of services) {
    for (const p of s.areaServed) {
      const bare = p['@type'] === 'City' && !p.containedInPlace;
      assert.ok(!bare, `${s['@id']}: bare City "${p.name}"`);
    }
  }
});

test('embedded Service nodes reference the one organisation as provider', () => {
  for (const s of services) assert.deepEqual(s.provider, { '@id': ORG }, s['@id']);
});

test('the service page still emits the same places and provider (drift guard)', () => {
  const src = fs.readFileSync(new URL('../apps/web/app/services/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('areaServed: CITIES.map((c) => placeForArea(c))'));
  assert.ok(src.includes("provider: { '@id': `${SITE_URL}/#organization` }"));
});
