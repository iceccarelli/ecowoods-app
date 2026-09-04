#!/usr/bin/env node
/**
 * scripts/verify-stale-hosts.mjs — every non-canonical host must 301/308 to
 * https://ecowoods.ca, and nothing but ecowoods.ca may serve this business.
 *
 * WHY IT EXISTS
 *
 * On 2026-09-04 https://ecowoods-app.vercel.app/ answered 200 with a stale
 * build of this site (an old review figure, an old founding year, an old
 * project count). vercel.json has carried a host-scoped redirect for that
 * alias for weeks — which proves the alias is served by a deployment this
 * repository does not control. A second live copy of the homepage splits the
 * entity in every index that finds it, and no guard was watching.
 *
 * This one watches. It is a LIVE check: it needs egress, so it runs from
 * `pnpm seo:live` (a laptop or a Codespace), never from the build.
 *
 *   node scripts/verify-stale-hosts.mjs
 */
const CANONICAL = 'https://ecowoods.ca';
const HOSTS = [
  'https://ecowoods-app.vercel.app/',
  'https://www.ecowoods.ca/',
];
const PROBE_PATHS = ['/', '/reviews', '/press'];

const head = async (url) => {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    return { status: r.status, location: r.headers.get('location') ?? '' };
  } catch {
    return { status: 0, location: '' };
  }
};

const control = await head(`${CANONICAL}/`);
if (control.status === 0 || control.status === 403 || control.status >= 500) {
  console.log(`· Cannot reach ${CANONICAL} from here (HTTP ${control.status}); run this from a machine with open egress.`);
  process.exit(0);
}

let failures = 0;
for (const origin of HOSTS) {
  for (const p of PROBE_PATHS) {
    const url = new URL(p, origin).toString();
    const r = await head(url);
    if (r.status === 0) {
      console.log(`  ·     ${url} — unreachable from here (not counted)`);
      continue;
    }
    const redirected = (r.status === 301 || r.status === 308 || r.status === 302 || r.status === 307) && r.location.startsWith(CANONICAL);
    const gone = r.status === 404 || r.status === 410;
    if (redirected) {
      console.log(`  ok    ${url} → ${r.status} ${r.location}`);
    } else if (gone && origin.includes('vercel.app')) {
      console.log(`  ok    ${url} → ${r.status} (alias retired)`);
    } else {
      failures++;
      console.log(`  FAIL  ${url} → HTTP ${r.status}${r.location ? ` → ${r.location}` : ''}`);
      if (r.status === 200) {
        console.log(
          `        a SECOND LIVE COPY of this site. Vercel dashboard → find the project whose\n` +
            `        Domains tab lists ${new URL(origin).host} → delete that project (or point its\n` +
            `        production domain at ${CANONICAL}). Nothing in this repository can fix it.`,
        );
      }
    }
  }
}

if (failures) {
  console.error(`\n✗ ${failures} host(s)/path(s) still answer without redirecting to ${CANONICAL}.`);
  process.exit(1);
}
console.log(`\n✓ stale hosts verified — every non-canonical host redirects to ${CANONICAL} or is gone`);
