/**
 * The five species dossiers were linked only from the guides index and the
 * nav; /hardwood-flooring-toronto — where a buyer is choosing a floor — links
 * to them in context, resolved from the guides registry.
 * Run: node --experimental-strip-types --no-warnings \
 *   --import ./scripts/lib/ts-register.mjs --test scripts/species-guides.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { getGuide } = await import('../apps/web/lib/guides.ts');
const src = fs.readFileSync(new URL('../apps/web/app/hardwood-flooring-toronto/page.tsx', import.meta.url), 'utf8');
const SLUGS = ['red-oak', 'hard-maple', 'white-ash', 'hickory', 'black-walnut'].map((s) => `${s}-flooring-toronto`);

test('every species slug the landing page names is a published guide', () => {
  for (const s of SLUGS) {
    assert.ok(src.includes(`'${s}'`), `${s} missing from the landing page`);
    assert.ok(getGuide(s), `${s} is not in the guides registry`);
  }
});

test('the landing page renders them as links from the registry', () => {
  assert.ok(src.includes('href={`/guides/${g.slug}`}'));
});
