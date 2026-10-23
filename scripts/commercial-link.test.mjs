/**
 * /commercial is sitemapped at priority 0.95 but was linked only from the
 * header, footer and homepage. The six service pages are where a condo board
 * or property manager lands from a search, so each links to it in context.
 * Run: node --test scripts/commercial-link.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../apps/web/app/services/[slug]/page.tsx', import.meta.url), 'utf8');

test('the service template links to /commercial with descriptive anchor text', () => {
  const m = /<Link href="\/commercial">([^<]+)<\/Link>/.exec(src);
  assert.ok(m, 'no /commercial link in the service template');
  assert.match(m[1], /commercial hardwood flooring/i);
  assert.ok(!/click here|read more/i.test(m[1]));
});

test('the link sits in the "other services" section, not the hero', () => {
  const related = src.indexOf('id="related"');
  assert.ok(related > 0 && src.indexOf('href="/commercial"') > related);
});
