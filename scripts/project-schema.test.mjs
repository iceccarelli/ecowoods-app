/**
 * A project recorded at region resolution must not publish the region as a
 * locality. Run: node --experimental-strip-types --no-warnings \
 *   --import ./scripts/lib/ts-register.mjs --test scripts/project-schema.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { projectAddressLocality, PROJECTS } = await import('../apps/web/lib/projects.ts');

test('region names are not localities', () => {
  for (const n of ['GTA', 'gta ', 'Greater Toronto Area', 'Ontario']) assert.equal(projectAddressLocality({ neighbourhood: n }), undefined, n);
});

test('a real neighbourhood passes through unchanged', () => {
  assert.equal(projectAddressLocality({ neighbourhood: 'Maple' }), 'Maple');
});

test('no published project emits a region as addressLocality', () => {
  assert.ok(PROJECTS.length >= 3);
  for (const p of PROJECTS) assert.notEqual(projectAddressLocality(p.location)?.toLowerCase(), 'gta', p.slug);
});

test('the project page uses the helper', () => {
  const src = fs.readFileSync(new URL('../apps/web/app/projects/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('addressLocality: projectAddressLocality(project.location)'));
  assert.ok(!src.includes('addressLocality: project.location.neighbourhood'));
});
