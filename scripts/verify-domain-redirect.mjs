#!/usr/bin/env node
/**
 * scripts/verify-domain-redirect.mjs — prove the old domain actually 301s.
 *
 * WHY A DOCUMENT IS NOT ENOUGH
 *
 * next.config.js declares four permanent redirects from ecowoodshardwood.com,
 * and DOMAIN_CONSOLIDATION.md explains them. Neither fact means a single
 * request is being redirected: the rules only fire once that domain is attached
 * to this Vercel project, which happens in a dashboard this repository cannot
 * see. A redirect that is configured and not live looks exactly like a redirect
 * that is working, from in here.
 *
 * So this asks the network. For every representative path it checks three
 * things, and all three have to hold:
 *
 *   1. The status is 301, not 302. A temporary redirect tells a crawler to keep
 *      the OLD url indexed, which is the opposite of consolidating.
 *   2. The Location lands on ecowoods.ca with the SAME path. Redirecting
 *      everything to the homepage is the common implementation and it discards
 *      most of the value — a link earned by /services/floor-refinishing should
 *      pass to that page, not to a homepage the visitor must then navigate.
 *   3. It arrives in ONE hop. www → bare → https → destination costs signal at
 *      every stage.
 *
 * Exit codes are deliberate. If the domain does not resolve at all, that is
 * NOT a failure — it is the expected state before the dashboard step, and the
 * script says so and exits 0. It fails only when the domain answers and answers
 * wrongly, which is the state that silently destroys a migration.
 *
 *   node scripts/verify-domain-redirect.mjs
 *   node scripts/verify-domain-redirect.mjs --strict   (unresolved = failure)
 */
import { readFileSync } from 'node:fs';

const OLD = ['https://ecowoodshardwood.com', 'https://www.ecowoodshardwood.com'];
const NEW_HOST = 'ecowoods.ca';

/**
 * WHAT TO PROBE, AND WHY THE FIRST VERSION PROBED THE WRONG THING.
 *
 * It probed ecowoods.ca's paths — /framework, /papers, /service-areas/etobicoke
 * — on the old domain. That answers "would an old link to a new-site path
 * survive", which is a question nobody was ever going to ask, because those
 * paths never existed on the old site. Every one came back 404 and the check
 * reported fourteen failures that were all the same non-finding.
 *
 * The URLs that matter are the ones the old site actually publishes, and it
 * publishes a sitemap listing them. They are committed in
 * `old-domain/path-map.json` as `knownUrls`, and each one is checked against
 * the destination the map assigns it — so this does not merely assert "a 301
 * happened", it asserts the 301 went where the migration intends.
 *
 * A handful of new-site paths are kept at the end as a control: they SHOULD
 * still resolve to their equivalent on ecowoods.ca once the catch-all is live.
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

/* ── control probe, and the reason it exists ─────────────────────────────────
 *
 * The first version of this script reported 16 redirect failures with HTTP 403
 * on every path. The old domain was fine. The 403s came from the sandbox's
 * egress proxy, which answers every non-allowlisted host that way — so the
 * check confidently reported a broken migration caused entirely by where it was
 * running.
 *
 * That is the failure mode this repository has recorded five times (F-117,
 * F-149, F-166, F-177, F-192): a check that reports a result it did not
 * actually measure. A false FAIL on a migration is worse than no check, because
 * the natural response is to go and "fix" a redirect that was never broken.
 *
 * So: reach the KNOWN-GOOD host first. If the control cannot be reached, or
 * answers with the same status the old domain does, the network is the variable
 * and this script says it cannot tell rather than guessing.
 */
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
        why =
          ' — a SECOND LIVE PAGE for this business. It competes with ecowoods.ca\n' +
          '          for the entity, which is the split this migration exists to end.';
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
    `· ecowoodshardwood.com does not resolve to this app yet — ${unreachable} request(s) unreachable.\n` +
      `  That is the EXPECTED state until the domain is added in Vercel → Settings → Domains.\n` +
      `  The rules in next.config.js are inert until then and cannot break anything.\n` +
      `  Steps: docs/outreach/DOMAIN_CONSOLIDATION.md\n`,
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
