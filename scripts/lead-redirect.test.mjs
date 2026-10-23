/**
 * The no-JS lead POST redirect contract, shared by /api/leads and
 * /api/photo-triage. Run: node --experimental-strip-types --no-warnings \
 *   --import ./scripts/lib/ts-register.mjs --test scripts/lead-redirect.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { leadBackTo, leadRedirectOutcome, leadRedirectTrack } = await import('../apps/web/lib/lead-redirect.ts');
const SITE = 'https://ecowoods.ca';

test('photo POST from /pricing returns to the form with an outcome the form can read', () => {
  const loc = leadBackTo({ referer: `${SITE}/pricing`, siteUrl: SITE, ok: true, source: 'pricing', track: 'photos' });
  assert.equal(loc, '/pricing?sent=1&from=pricing&track=photos#estimate');
  const search = loc.slice(loc.indexOf('?'), loc.indexOf('#'));
  assert.equal(leadRedirectOutcome(search, 'pricing'), 'sent');
  assert.equal(leadRedirectTrack(search), 'photos');
});

test('an error redirect names the form and replaces a stale outcome', () => {
  const loc = leadBackTo({ referer: `${SITE}/estimate?sent=1&from=estimate`, siteUrl: SITE, ok: false, source: 'estimate' });
  assert.equal(loc, '/estimate?error=1&from=estimate#estimate');
});

test('a redirect for another form is ignored', () => {
  const loc = leadBackTo({ referer: `${SITE}/pricing`, siteUrl: SITE, ok: true, source: 'other-form' });
  assert.equal(leadRedirectOutcome(loc.slice(loc.indexOf('?'), loc.indexOf('#')), 'pricing'), null);
});

test('cross-origin referers and unsafe sources never leak into the redirect', () => {
  assert.equal(leadBackTo({ referer: 'https://evil.example/x', siteUrl: SITE, ok: true }), '/?sent=1');
  assert.ok(!leadBackTo({ referer: `${SITE}/a`, siteUrl: SITE, ok: true, source: 'a b&c=d' }).includes('from='));
});

test('both lead routes build their redirect with the shared function and the anchor the form renders', () => {
  for (const f of ['app/api/leads/route.ts', 'app/api/photo-triage/route.ts']) {
    const src = fs.readFileSync(new URL(`../apps/web/${f}`, import.meta.url), 'utf8');
    assert.ok(src.includes('leadBackTo('), `${f} must use leadBackTo`);
    assert.ok(!/hash\s*=\s*'quote'/.test(src), `${f} must not target #quote`);
  }
});
