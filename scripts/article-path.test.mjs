/**
 * Blog articles and case studies must lead to the estimate and the services.
 * Run: node --test scripts/article-path.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../apps/web/${f}`, import.meta.url), 'utf8');

test('the shared block links to /estimate and /services', () => {
  const src = read('app/components/ArticleNextStep.tsx');
  assert.match(src, /href="\/estimate"/);
  assert.match(src, /href="\/services"/);
});

test('both content layouts render the block', () => {
  for (const f of ['app/components/ArticleLayout.tsx', 'app/case-studies/[slug]/case-study-layout.tsx']) {
    assert.match(read(f), /<ArticleNextStep \/>/, f);
    assert.match(read(f), /import \{ ArticleNextStep \}/, f);
  }
});
