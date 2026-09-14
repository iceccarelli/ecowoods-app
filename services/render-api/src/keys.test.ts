/**
 * keys.test.ts — the auth and the meter.
 *
 * Runs on Node alone: `pnpm --filter @ecowoods/render-api test`. This service
 * has no dependencies, which includes no test runner, so the assertions are
 * a function and a counter. A dependency here would be the same stale-lockfile
 * problem the service exists without.
 */
import { parseKeys, parseBearer, verify, RateLimiter, sha256, usageLine } from './keys.ts';

let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) console.log('  ✓', name);
  else {
    failed += 1;
    console.log('  ✗', name, extra);
  }
};

const SECRET = 'abcdefghijklmnop0123456789';
const KEYS = parseKeys(`acme:${sha256(SECRET)}:200, globex:${sha256('another-secret-value')}:60`);

console.log('parsing keys');
ok('reads both entries', KEYS.size === 2, String(KEYS.size));
ok('reads the per-minute limit', KEYS.get('acme')?.limit === 200, String(KEYS.get('acme')?.limit));
ok('defaults a missing limit rather than disabling it', parseKeys(`x:${sha256('s')}:`).get('x')?.limit === 60);
ok('drops an entry with a hash that is not a sha256', parseKeys('x:tooshort:10').size === 0);
ok('an unset variable is no keys, not a crash', parseKeys(undefined).size === 0);

console.log('\nparsing the header');
ok('accepts the documented shape', parseBearer(`Bearer ew_live_acme_${SECRET}`)?.id === 'acme');
ok('rejects a bare token', parseBearer(SECRET) === null);
ok('rejects another prefix', parseBearer(`Bearer sk_live_acme_${SECRET}`) === null);
ok('rejects a secret too short to be one', parseBearer('Bearer ew_live_acme_short') === null);
ok('tolerates surrounding whitespace', parseBearer(`  Bearer ew_live_acme_${SECRET}  `)?.id === 'acme');

console.log('\nverifying');
ok('the right secret verifies', verify(`Bearer ew_live_acme_${SECRET}`, KEYS)?.id === 'acme');
ok('a wrong secret does not', verify(`Bearer ew_live_acme_${SECRET}x`, KEYS) === null);
ok('an unknown id does not', verify(`Bearer ew_live_nobody_${SECRET}`, KEYS) === null);
ok('one key does not open another', verify(`Bearer ew_live_globex_${SECRET}`, KEYS) === null);
ok('no header does not', verify(undefined, KEYS) === null);
/* The secret must never be recoverable from what is configured. */
ok('the configured value is a hash, not the secret', !JSON.stringify([...KEYS]).includes(SECRET));

console.log('\nthe rate limiter');
let now = 1_700_000_000_000;
const limiter = new RateLimiter(() => now);
const small = { id: 'acme', hash: 'x', limit: 3 };
ok('lets the first three through', [1, 2, 3].every(() => limiter.take(small) !== null));
ok('refuses the fourth', limiter.take(small) === null);
ok('counts down as it goes', new RateLimiter(() => now).take({ ...small, limit: 10 })?.remaining === 9);
now += 61_000;
ok('the next minute is a fresh window', limiter.take(small) !== null);
ok('two keys do not share a window', (() => {
  const l = new RateLimiter(() => now);
  l.take({ ...small, id: 'a' });
  l.take({ ...small, id: 'a' });
  l.take({ ...small, id: 'a' });
  return l.take({ ...small, id: 'b' }) !== null;
})());
ok('reports seconds until reset, never more than a minute', (() => {
  const r = new RateLimiter(() => now).take(small);
  return !!r && r.resetSeconds > 0 && r.resetSeconds <= 60;
})());
/* A long-lived process must not accumulate a window per key per minute. */
ok('sweeps windows nobody is in', (() => {
  let t = 0;
  const l = new RateLimiter(() => t);
  for (let i = 0; i < 500; i += 1) {
    t = i * 60_000;
    l.take({ ...small, id: `k${i}` });
  }
  l.sweep();
  return (l as unknown as { hits: Map<string, unknown> }).hits.size <= 2;
})());

console.log('\nthe usage line');
const line = JSON.parse(usageLine({ key: 'acme', route: '/v1/render', status: 200, ms: 96.4, pixels: 307200 }));
ok('is one JSON object per request', line.event === 'render_api.request');
ok('carries who, what, how it went and how long', line.key === 'acme' && line.route === '/v1/render' && line.status === 200 && line.ms === 96.4);
ok('is timestamped in ISO 8601', !Number.isNaN(Date.parse(line.at)));
ok('carries no secret', !usageLine({ key: 'acme', route: '/x', status: 200, ms: 1 }).includes(SECRET));

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
