#!/usr/bin/env node
/**
 * scripts/build-old-domain-redirects.mjs — one map, three configs.
 *
 *   pnpm domain:build          write the files
 *   pnpm domain:build --check  fail if they are out of date (CI)
 *
 * WRITES: old-domain/.htaccess, old-domain/nginx.conf, old-domain/_redirects,
 *         old-domain/vercel-redirects.json
 *
 * WHY THESE ARE GENERATED
 *
 * Three files, three syntaxes, one set of rules. Hand-maintaining them means
 * three chances to get a migration wrong and no way to tell which one is
 * authoritative — and only one of the three is ever deployed, so the other two
 * drift silently and are wrong on the day the host changes and someone reaches
 * for them.
 *
 * `old-domain/path-map.json` is the source. Edit that, run this, commit all
 * four. `--check` regenerates in memory and diffs, so a hand-edit fails CI
 * rather than shipping.
 *
 * WHAT THE PREVIOUS FILES GOT WRONG, AND IT IS WORTH BEING PRECISE
 *
 * They were path-preserving — `/x → ecowoods.ca/x`. That is the right default
 * for almost every migration and it is exactly wrong for this one, because the
 * two sites share zero paths. The old site is a hosted store platform serving
 * /pages/… and /blogs/… URLs; none of those exist on ecowoods.ca. Deploying
 * the old file would have turned thirty-six live URLs into thirty-six 404s
 * served by the new domain, which is a worse outcome than leaving it alone: a
 * crawler that follows a 301 into a 404 learns that the destination is broken.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'old-domain');
const CHECK = process.argv.includes('--check');

const map = JSON.parse(readFileSync(join(DIR, 'path-map.json'), 'utf8'));
const NEW = `https://${map.newHost}`;

if (!map.rules?.length) {
  console.error('\n✗ path-map.json has no rules. Generating three empty redirect configs is not a no-op — it is a migration that drops every URL on the floor.\n');
  process.exit(1);
}

const banner = (syntax) => `${syntax} =============================================================================
${syntax} ECOWOODS — ecowoodshardwood.com → ecowoods.ca
${syntax}
${syntax} GENERATED FILE. Do not edit.
${syntax}   source:   old-domain/path-map.json
${syntax}   generator: scripts/build-old-domain-redirects.mjs
${syntax}   run:      pnpm domain:build
${syntax}
${syntax} Inventory measured ${map.measuredAt} from ${map.source} — 36 URLs.
${syntax}
${syntax} NOT PATH-PRESERVING, AND THAT IS DELIBERATE. The two sites share no
${syntax} paths at all: the old one serves /pages/… and /blogs/… from a hosted
${syntax} store platform. A path-preserving rule turns every live URL into a 404
${syntax} on the new domain, which is worse than the 404 it already returns.
${syntax}
${syntax} 301, never 302. A 302 tells a crawler to keep the OLD url indexed,
${syntax} which is the opposite of consolidating two domains into one.
${syntax}
${syntax} ONE HOP. There is no separate HTTPS-forcing rule: the destination is
${syntax} already https, and forcing the scheme first is what turns one redirect
${syntax} into two. Every combination of scheme and host lands in a single 301.
${syntax} =============================================================================`;

/* ── Apache ───────────────────────────────────────────────────────────────
 *
 * THE LEADING SLASH. In a per-directory context — which is what `.htaccess`
 * is — Apache strips the directory prefix before matching, so the path handed
 * to `RewriteRule` has NO leading slash. A pattern written `^/blogs/…` matches
 * nothing, ever, and the symptom is a redirect file that installs cleanly,
 * throws no error, and silently does not fire. It is the single most common
 * way an .htaccess migration fails.
 *
 * In a `<VirtualHost>` or server-config context the leading slash IS present.
 * Writing `^/?` makes the pattern correct in both, which matters because the
 * person deploying this may paste it into either.
 */
const toApache = (re) => re.replace(/^\^\/?/, '^/?');

const htaccess = [
  banner('#'),
  '',
  '<IfModule mod_rewrite.c>',
  '  RewriteEngine On',
  '',
  ...map.queryRules.flatMap((q) => [
    `  # ${q.why}`,
    `  RewriteCond %{QUERY_STRING} ${q.from.replace(/^\^|\$$/g, '')}`,
    `  RewriteRule ^ ${NEW}${q.to}? [R=301,L,NE]`,
    '',
  ]),
  ...map.rules.flatMap((r) => [
    `  # ${r.why}`,
    `  RewriteRule ${toApache(r.from)} ${NEW}${r.to} [R=301,L,NE]`,
    '',
  ]),
  '  # Fallback.',
  ...map.fallback.why.filter(Boolean).map((l) => `  # ${l}`),
  `  RewriteRule ^(.*)$ ${NEW}${map.fallback.to} [R=301,L,NE]`,
  '</IfModule>',
  '',
  '# A server without mod_rewrite. mod_alias is compiled in almost everywhere',
  '# mod_rewrite is not. It cannot express the map, so it does the one thing it',
  '# can do correctly: send everything to the front door in a single permanent',
  '# hop. Worse than the map above, far better than nothing.',
  '<IfModule !mod_rewrite.c>',
  '  <IfModule mod_alias.c>',
  `    RedirectMatch permanent ^/(.*)$ ${NEW}${map.fallback.to}`,
  '  </IfModule>',
  '</IfModule>',
  '',
  '# No index file, no residual content, no robots.txt of its own. The redirect',
  '# must fire before anything can be served. Delete whatever is in this document',
  '# root — if an old index survives here it will never be reached, but someone',
  '# will restore a "temporary" homepage on top of it in six months.',
  '',
].join('\n');

/* ── nginx ────────────────────────────────────────────────────────────────── */
const toNginx = (re) =>
  re.replace(/^\^/, '^').replace(/\/\?\$$/, '/?$'); // nginx uses PCRE; the patterns port as-is

const nginx = [
  banner('#'),
  '',
  'server {',
  '  listen 80;',
  '  listen 443 ssl http2;',
  '  server_name ecowoodshardwood.com www.ecowoodshardwood.com;',
  '',
  '  # TLS must keep renewing on this host. A redirect that fails its',
  '  # certificate is a redirect browsers refuse to follow, and the failure',
  '  # looks like the site is gone rather than moved.',
  '  # ssl_certificate     /etc/letsencrypt/live/ecowoodshardwood.com/fullchain.pem;',
  '  # ssl_certificate_key /etc/letsencrypt/live/ecowoodshardwood.com/privkey.pem;',
  '',
  ...map.queryRules.flatMap((q) => [
    `  # ${q.why}`,
    `  if ($query_string ~ "${q.from.replace(/^\^|\$$/g, '')}") {`,
    `    return 301 ${NEW}${q.to};`,
    '  }',
    '',
  ]),
  ...map.rules.flatMap((r) => [
    `  # ${r.why}`,
    `  location ~ "${toNginx(r.from)}" { return 301 ${NEW}${r.to}; }`,
    '',
  ]),
  '  # Fallback.',
  ...map.fallback.why.filter(Boolean).map((l) => `  # ${l}`),
  `  location / { return 301 ${NEW}${map.fallback.to}; }`,
  '}',
  '',
].join('\n');

/* ── Netlify ──────────────────────────────────────────────────────────────── */
/* `_redirects` is glob-based, not regex, so each pattern is expressed as a
   prefix splat. The 301! bang forces the rule even when a matching file exists
   in the deploy, which is what makes this a complete redirect rather than one
   that leaks any page still sitting in the build output. */
/**
 * One regex can need TWO globs. `^/blogs/testimonials(/.*)?$` matches both the
 * index and every post under it; `/blogs/testimonials/*` in Netlify's glob
 * syntax matches only the posts. Emitting one line there would have left the
 * index — the page with 22 testimonials on it — falling through to the
 * catch-all. So this returns a list.
 */
const globsOf = (re) => {
  const bare = re.replace(/^\^/, '').replace(/\$$/, '');
  if (bare === '/') return ['/'];
  if (bare.endsWith('(/.*)?')) {
    const stem = bare.slice(0, -6);
    return [stem, `${stem}/*`];
  }
  if (bare.endsWith('/?')) return [bare.slice(0, -2)];
  return [bare];
};
const redirects = [
  banner('#'),
  '#',
  '# Netlify. Place at the site root (or in the publish directory).',
  '# Glob patterns, not regex — each rule below is the glob equivalent of its',
  '# entry in path-map.json. The trailing bang forces the rule even when a',
  '# matching file exists in the deploy.',
  '',
  ...map.rules.flatMap((r) => globsOf(r.from).map((g) => `${g.padEnd(70)}  ${NEW}${r.to}  301!`)),
  '',
  '# Fallback — everything else.',
  `${'/*'.padEnd(70)}  ${NEW}${map.fallback.to}  301!`,
  '',
].join('\n');

/* ── Vercel / Next.js ─────────────────────────────────────────────────────── */
/**
 * THE FOURTH TARGET, AND THE REASON IT EXISTS.
 *
 * `old-domain/EXECUTE.md` describes uploading .htaccess to whatever serves
 * ecowoodshardwood.com. The other route — attaching the old domain to THIS
 * Vercel project — is simpler, needs no host access, and was already
 * half-written: both `vercel.json` and `apps/web/next.config.js` carried
 * host-conditioned rules for the old domain.
 *
 * Both were PATH-PRESERVING: `/:path*` → `https://ecowoods.ca/:path*`.
 *
 * That is the one thing path-map.json exists to say is wrong. The two sites
 * share zero paths. The old URLs look like
 * /blogs/testimonials/172376--audrey-in-toronto and
 * /pages/flooring-services-toronto-etobicoke-hamilton. Preserving those sends
 * every one of them to a hard 404 on ecowoods.ca — including the 22 customer
 * testimonials, which are the single largest stranded reputation asset this
 * business has. The rules were inert because the domain was never attached, so
 * nothing ever surfaced the defect. Attaching the domain would have shipped it.
 *
 * So the same map that generates the three server configs now also generates
 * the redirect array Vercel and Next understand, and `--check` fails the build
 * if `vercel.json` drifts from it. One source of truth, four targets.
 *
 * The host condition is a regex covering apex and www in one rule, which is how
 * Vercel matches `has.host`. scripts/verify-vercel-config.mjs asserts that no
 * host pattern here can match the canonical host.
 */
const HOST_RE = `(www\\.)?${map.oldHosts[0].replace(/\./g, '\\.')}`;

/**
 * One regex can need TWO sources, for the same reason globsOf returns two:
 * `^/blogs/testimonials(/.*)?$` matches the index AND every post beneath it,
 * and path-to-regexp expresses those as separate patterns.
 */
const sourcesOf = (re) => {
  const bare = re.replace(/^\^/, '').replace(/\$$/, '');
  if (bare === '/') return ['/'];
  if (bare.endsWith('(/.*)?')) {
    const stem = bare.slice(0, -6);
    return [stem, `${stem}/:rest*`];
  }
  if (bare.endsWith('/?')) return [bare.slice(0, -2)];
  return [bare];
};

const hostHas = { type: 'host', value: HOST_RE };

const vercelRedirects = [
  /* Query rules first: the legacy store endpoints arrive as `/?fuseaction=…`,
     so their path is `/` and a plain `/` rule above them would swallow them. */
  ...map.queryRules.map((q) => {
    const m = q.from.match(/^\^([^=]+)=(.*)\$$/);
    if (!m) throw new Error(`queryRule not in key=value form: ${q.from}`);
    return {
      source: '/',
      has: [hostHas, { type: 'query', key: m[1], value: m[2] }],
      destination: `${NEW}${q.to}`,
      permanent: true,
    };
  }),
  ...map.rules.flatMap((r) =>
    sourcesOf(r.from).map((source) => ({
      source,
      has: [hostHas],
      destination: `${NEW}${r.to}`,
      permanent: true,
    })),
  ),
  /* Fallback. Last, and deliberately not path-preserving — see path-map.json. */
  {
    source: '/:path*',
    has: [hostHas],
    destination: `${NEW}${map.fallback.to}`,
    permanent: true,
  },
];

const vercelJson = `${JSON.stringify(
  {
    $comment: [
      'GENERATED FILE — do not hand-edit. Source: old-domain/path-map.json.',
      'Regenerate: pnpm domain:build. Verify: pnpm domain:check.',
      'These objects are copied verbatim into the `redirects` array of the root',
      'vercel.json, ahead of the canonical-host rules, and are required by',
      'apps/web/next.config.js so the Next layer cannot disagree with the edge.',
      'NOT PATH-PRESERVING, AND THAT IS DELIBERATE.',
    ],
    redirects: vercelRedirects,
  },
  null,
  2,
)}\n`;

/* ── simulate ─────────────────────────────────────────────────────────────
 *
 *   pnpm domain:build --simulate
 *
 * Runs every URL in the old site's own sitemap through the rules and prints
 * where each one lands. This is the difference between a map that covers the
 * inventory and a map that looks like it does — and it runs offline, so it
 * answers the question before anything is deployed rather than after.
 *
 * A URL landing on the FALLBACK is not automatically wrong; it is a URL nobody
 * has decided about yet. The count of them is the number to drive down.
 */
if (process.argv.includes('--simulate')) {
  const known = map.knownUrls ?? [];
  if (!known.length) {
    console.error('\n✗ path-map.json has no knownUrls to simulate against.\n');
    process.exit(1);
  }
  console.log('');
  console.log(`SIMULATION — ${known.length} URL(s) from ${map.source}`);
  console.log('');
  let fellThrough = 0;
  const tally = new Map();
  for (const raw of known) {
    const [path, query = ''] = raw.split('?');
    let dest = null;
    for (const q of map.queryRules) {
      if (query && new RegExp(q.from).test(query)) { dest = q.to; break; }
    }
    if (!dest) {
      for (const r of map.rules) {
        if (new RegExp(r.from).test(path)) { dest = r.to; break; }
      }
    }
    if (!dest) { dest = map.fallback.to; fellThrough++; }
    tally.set(dest, (tally.get(dest) ?? 0) + 1);
    console.log(`  ${raw.length > 62 ? raw.slice(0, 59) + '…' : raw.padEnd(62)}  →  ${dest}`);
  }
  console.log('');
  console.log('  destinations:');
  for (const [d, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${d}`);
  }
  console.log('');
  console.log(
    fellThrough === 0
      ? '  ✓ every known URL has a rule of its own — nothing relies on the fallback\n'
      : `  · ${fellThrough} URL(s) land on the fallback. Not wrong, but undecided — add rules to shrink it.\n`,
  );
  process.exit(0);
}

/* ── write or check ───────────────────────────────────────────────────────── */
const files = [
  ['.htaccess', htaccess],
  ['nginx.conf', nginx],
  ['_redirects', redirects],
  ['vercel-redirects.json', vercelJson],
];

let stale = 0;
for (const [name, content] of files) {
  const path = join(DIR, name);
  let current = '';
  try { current = readFileSync(path, 'utf8'); } catch { /* new file */ }
  if (current === content) {
    console.log(`  ok    old-domain/${name}`);
    continue;
  }
  if (CHECK) {
    console.error(`  STALE old-domain/${name} — hand-edited or the map changed. Run: pnpm domain:build`);
    stale++;
    continue;
  }
  writeFileSync(path, content);
  console.log(`  write old-domain/${name}`);
}

/* ── the two consumers must not drift ─────────────────────────────────────── */
/**
 * vercel.json cannot import. Its `redirects` array therefore carries a verbatim
 * copy of the generated objects above, and this is the check that makes the
 * copy safe: every generated rule must appear in vercel.json, in order, ahead
 * of the hand-maintained canonical-host rules.
 *
 * apps/web/next.config.js has it easier — it `require()`s the generated file
 * directly, so it cannot drift and is not checked here.
 */
const vercelPath = join(ROOT, 'vercel.json');
let vercelCfg = null;
try {
  vercelCfg = JSON.parse(readFileSync(vercelPath, 'utf8'));
} catch (e) {
  console.error(`  STALE vercel.json is unreadable or invalid JSON: ${e.message}`);
  stale++;
}
if (vercelCfg) {
  const live = (vercelCfg.redirects ?? []).slice(0, vercelRedirects.length);
  if (JSON.stringify(live) !== JSON.stringify(vercelRedirects)) {
    console.error(
      '  STALE vercel.json — its first ' +
        `${vercelRedirects.length} redirect(s) do not match old-domain/vercel-redirects.json.\n` +
        '        Copy that file’s `redirects` array to the TOP of vercel.json’s.',
    );
    stale++;
  } else {
    console.log('  ok    vercel.json (old-domain block)');
  }
}

console.log('');
if (CHECK && stale) {
  console.error(`✗ ${stale} generated redirect config(s) out of date with old-domain/path-map.json\n`);
  process.exit(1);
}
console.log(
  `✓ ${map.rules.length} path rule(s) + ${map.queryRules.length} query rule(s) + fallback → four targets\n` +
    `  Deploy exactly one of them, on whatever serves ecowoodshardwood.com.\n` +
    `  Which one: old-domain/EXECUTE.md. Measured 2026-08-23 as Apache — use .htaccess.\n`,
);
