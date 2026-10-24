/**
 * Every field error in EstimateForm is tied to its control, so the first
 * invalid control receives focus and a screen reader hears the message.
 * Run: node --test scripts/estimate-form-a11y.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../apps/web/app/components/EstimateForm.tsx', import.meta.url), 'utf8');
const errorTags = [...src.matchAll(/\{errors(?:\.\w+|\[\w+\]) && <em className="ef-err"([^>]*)>/g)];

test('there are field errors to check', () => assert.ok(errorTags.length >= 9, `found ${errorTags.length}`));

test('every field error carries an id', () => {
  for (const m of errorTags) assert.match(m[1], /\bid=\{`[^`]+`\}/, m[0]);
});

test('every error id is referenced by aria-describedby on its control', () => {
  for (const m of errorTags) {
    const id = /id=\{`([^`]+)`\}/.exec(m[1])?.[1];
    assert.ok(id && src.includes(`aria-describedby={`) && src.includes('`' + id + '`'), `no aria-describedby for ${id}`);
    const refs = src.split('aria-describedby=').filter((x) => x.includes('`' + id + '`') && x.indexOf('`' + id + '`') < 120);
    assert.ok(refs.length >= 1, `${id} is never referenced`);
  }
});

test('controls with an error set aria-invalid so the focus effect can find them', () => {
  assert.equal((src.match(/aria-invalid=\{/g) ?? []).length >= errorTags.length, true);
});

test('error ids are unique across the two tracks', () => {
  const ids = errorTags.map((m) => /id=\{`([^`]+)`\}/.exec(m[1])?.[1]);
  const templated = ids.filter(Boolean);
  // areaSelect() is one template used for two field names; the rest must not repeat.
  const dup = templated.filter((x, i) => templated.indexOf(x) !== i);
  assert.deepEqual(dup, []);
});
