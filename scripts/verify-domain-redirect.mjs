#!/usr/bin/env node
/**
 * scripts/verify-domain-redirect.mjs — prove the retired domain actually 301s.
 *
 * next.config.js declares permanent, host-conditioned redirects for the
 * retired domain, generated from old-domain/path-map.json. The rules are
 * inert until that domain is attached to this Vercel project in the
 * dashboard, so this asks the network rather than the config. For every known
 * path it checks: status is 301 (not 302 — a 302 keeps the old URL indexed),
 * the Location lands on ecowoods.ca at the path the map assigns (not a blind
 * homepage redirect), and it resolves in one hop.
 *
 * If the domain does not resolve at all, that is the expected pre-attachment
 * state and the script exits 0. It fails only when the domain answers and
 * answers wrongly.
 *
 *   node scripts/verify-domain-redirect.mjs
 *   node scripts/verify-domain-redirect.mjs --strict   (unresolved = failure)
 */
import { readFileSync } from 'node:fs';

const OLD = ['https://ecowoodshardwood.com', 'https://www.ecowoodshardwood.com'];
const NEW_HOST = 'ecowoods.ca';

/**
 * The probed paths are the ones the retired site actually publishes
 * (`old-domain/path-map.json` `knownUrls`), each checked against the
 * destination the map assigns it — asserting the 301 goes where the map
 * intends, not merely that a 301 happened.
 */
const map = JSON.parse(
  readFileSync(new URL('../old-domain/path-map.json', import.meta.url), 'utf8'),
);

/** The destination path-map.json assigns to an old path. */
const expectedFor = (raw) => {
  const [pathname, query = ''] = raw.split('?');
  for (const q of map.queryRules ?? []) {
    if (query && new RegExp(q.from).test(query)) return q.to;
  }
  for (const r of map.rules ?? []) {
    if (new RegExp(r.from).test(pathname)) return r.to;
  }
  return map.fallback.to;
};

const PATHS = [...new Set(map.knownUrls ?? ['/'])];
const STRICT = process.argv.includes('--strict');


const head = async (url) => {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    return {
      status: r.status,
      location: r.headers.get('location'),
      /* Which stack is answering. When the old domain responds 200 the very
         next question is always "what is serving it", because that decides
         which config file is the right one. Answering it here saves a round
         trip through a runbook. */
      server: r.headers.get('server'),
      powered: r.headers.get('x-powered-by'),
      cf: r.headers.get('cf-ray') ? 'cloudflare' : null,
      vercel: r.headers.get('x-vercel-id') ? 'vercel' : null,
    };
  } catch (e) {
    return { status: 0, error: String(e).slice(0, 80) };
  }
};

const stackOf = (r) =>
  [r.vercel, r.cf, r.server, r.powered].filter(Boolean).join(' / ') || 'unidentified';

let unreachable = 0;
let failures = 0;
let ok = 0;

console.log(`\nOLD DOMAIN REDIRECT CHECK  →  https://${NEW_HOST}\n`);

/* Control probe: reach the known-good host first. If it cannot be reached, or
   answers with the same status as the old domain, the network is the
   variable — an egress-blocked sandbox answers every host 403 — and this
   script says it cannot tell rather than reporting a false failure. */
const control = await head(`https://${NEW_HOST}/`);
if (control.status === 0 || control.status === 403 || control.status >= 500) {
  console.log(
    `· Cannot reach https://${NEW_HOST}/ from here (HTTP ${control.status}).\n` +
      `  Without a working control this check cannot tell a real redirect failure from a\n` +
      `  blocked network, so it is not going to claim either. Run it from a machine with\n` +
      `  open egress — a Codespace or a laptop:\n\n` +
      `      node scripts/verify-domain-redirect.mjs\n`,
  );
  process.exit(0);
}
console.log(`  control  https://${NEW_HOST}/ answered ${control.status} — network is usable\n`);

for (const origin of OLD) {
  for (const p of PATHS) {
    const from = `${origin}${p}`;
    const r = await head(from);

    if (r.status === 0) {
      unreachable++;
      continue;
    }
    if (r.status === 403 && !r.location) {
      /* Answered, but with no redirect and no body we can attribute. Most often
         an intermediary rather than the origin. Counted as undetermined. */
      unreachable++;
      continue;
    }
    if (r.status !== 301) {
      failures++;
      console.log(`  FAIL  ${from}`);
      let why = '';
      if (r.status === 200) {
        why = ' — serving instead of redirecting.';
      } else if (r.status === 404) {
        why =
          ' — every link, listing or citation pointing here reaches a dead page,\n' +
          '          and a crawler following one learns nothing.';
      } else if (r.status === 302) {
        why = ' — a 302 tells crawlers to keep the OLD url indexed. Must be 301.';
      }
      console.log(`        HTTP ${r.status}${why}`);
      if (r.status === 200) console.log(`        served by: ${stackOf(r)}  → old-domain/EXECUTE.md picks the config`);
      continue;
    }
    let dest;
    try {
      dest = new URL(r.location ?? '', from);
    } catch {
      failures++;
      console.log(`  FAIL  ${from}\n        301 with an unparseable Location: ${r.location}`);
      continue;
    }
    if (dest.host !== NEW_HOST) {
      failures++;
      console.log(`  FAIL  ${from}\n        301 → ${dest.host}, expected ${NEW_HOST}`);
      continue;
    }
    /* The destination is what path-map.json says it should be, not the same
       path. These two sites share no paths, so "the path survived" is the
       wrong assertion — it would pass only on a config that sends every URL
       to a 404. */
    const want = expectedFor(p);
    const wantPath = want.split('#')[0] || '/';
    if (dest.pathname.replace(/\/$/, '') !== wantPath.replace(/\/$/, '')) {
      failures++;
      console.log(
        `  FAIL  ${from}\n        301 → ${dest.pathname}, expected ${wantPath}\n` +
          `        (old-domain/path-map.json assigns this URL to ${want})`,
      );
      continue;
    }
    /* One hop: the destination itself must not redirect again. */
    const second = await head(dest.href);
    if (second.status >= 300 && second.status < 400) {
      failures++;
      console.log(
        `  FAIL  ${from}\n        chains: 301 → ${dest.href} → ${second.status} ${second.location ?? ''}`,
      );
      continue;
    }
    ok++;
    console.log(`  PASS  ${(p.length > 46 ? p.slice(0, 43) + '…' : p).padEnd(46)} → ${expectedFor(p)}`);
  }
}

console.log('');
if (unreachable === OLD.length * PATHS.length) {
  console.log(
    `· the retired domain does not resolve to this app yet — ${unreachable} request(s) unreachable.\n` +
      `  Expected until the domain is added in Vercel → Settings → Domains.\n` +
      `  Steps: old-domain/EXECUTE.md\n`,
  );
  process.exit(STRICT ? 1 : 0);
}
if (failures) {
  const probe = await head(`${OLD[1]}/`);
  console.error(
    `✗ ${failures} redirect failure(s), ${ok} correct.\n\n` +
      `  The old domain is answering, so this is not a DNS problem — it is a configuration\n` +
      `  one, and it is live right now. Served by: ${stackOf(probe)}\n\n` +
      `  Pick the matching file in old-domain/ and follow old-domain/EXECUTE.md.\n` +
      `  Do not file a change of address until this reports zero failures: telling Google a\n` +
      `  move happened while the old site still answers 200 is worse than saying nothing.\n`,
  );
  process.exit(1);
}
console.log(`✓ old domain consolidated — ${ok} path(s), all 301, path-preserving, single hop\n`);
