#!/usr/bin/env node
/**
 * scripts/verify-links.mjs
 *
 * Fails the build when a public route has no way in.
 *
 * WHY THIS EXISTS
 *
 * F-65: /papers shipped with a full index page, three papers, schema, sitemap
 * entries and machine-file entries — and no link to it from the site chrome.
 * It was in the sitemap and unreachable by a human. That was not a hard bug to
 * find; it was a bug nobody was looking for, because "the page renders" and
 * "the page is reachable" are different questions and only the first one had a
 * check.
 *
 * It had already happened twice before anyone named it. /authority — the page
 * whose entire job is to be cited by answer engines — has never had a single
 * inbound link. /service-areas and its 16 city pages, the highest-commercial-
 * intent surface on a local trade site, were reachable from one place.
 *
 * A link in the sitemap is a claim. A link in the chrome is a path. Crawlers
 * and answer engines both weight internal links; a page with no inbound link
 * reads as unimportant no matter what the sitemap says about it.
 *
 * RATCHET, NOT A WALL. Routes that are legitimately unlinked — auth callbacks,
 * document viewers — live in scripts/links-baseline.json with a reason. The
 * guard fails on anything NEW that has no way in. Adding to the baseline is a
 * deliberate act with a written justification, the same shape as
 * verify-tokens.mjs and verify-schema.mjs.
 *
 *   node scripts/verify-links.mjs
 *   node scripts/verify-links.mjs --list    print every route with its inbound count
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const BASELINE = path.join(ROOT, 'scripts/links-baseline.json');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(APP)) {
  console.error('verify-links: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

/* ── collect every source file once ──────────────────────────────────────── */
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(APP);

const sources = files.map((f) => [f, fs.readFileSync(f, 'utf8')]);
const everything = sources.map(([, s]) => s).join('\n');
// The chrome is the header and the footer: the two components on every page.
// A route linked ONLY from inside one article is reachable in principle and
// invisible in practice, so the two counts are reported separately.
const chrome = sources
  .filter(([f]) => /components[/\\](Header|SiteFooter)\.tsx$/.test(f))
  .map(([, s]) => s)
  .join('\n');

/* ── public routes ───────────────────────────────────────────────────────── */
// Route groups in parentheses do not appear in the URL, so (portal)/mypage is
// /mypage. Private trees are excluded outright — they are behind auth and their
// entry points are the portal nav, not the marketing chrome.
const routes = sources
  .map(([f]) => f)
  .filter((f) => f.endsWith(`${path.sep}page.tsx`))
  .map((f) => f.slice(APP.length).split(path.sep).join('/').replace(/\/page\.tsx$/, '') || '/')
  .filter((r) => !/^\/(admin|\(portal\)|\(auth\)|docs)(\/|$)/.test(r))
  .filter((r) => !r.includes('['))
  .filter((r) => r !== '/')
  .sort();

/* ── count inbound references ────────────────────────────────────────────── */
// Matches href="/x", href='/x', href={`/x`} and the object form href: '/x' that
// the nav arrays use. The trailing character class stops /blog from matching
// /blog-archive while still allowing /blog#foo, /blog?x and /blog/y.
const inbound = (haystack, route) => {
  const esc = route.replace(/[/]/g, '\\/');
  return (haystack.match(new RegExp(`href[=:]\\s*[{]?\\s*["'\`]${esc}(["'\`?#/])`, 'g')) || []).length;
};

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const rows = routes.map((r) => ({
  route: r,
  total: inbound(everything, r),
  chrome: inbound(chrome, r),
  waived: Object.prototype.hasOwnProperty.call(baseline, r),
}));

if (LIST) {
  console.log('\nroute                                 total  chrome  status');
  for (const r of rows) {
    const status = r.total === 0 ? (r.waived ? 'waived' : 'ORPHAN') : r.chrome === 0 ? 'not in chrome' : 'ok';
    console.log(`  ${r.route.padEnd(36)}${String(r.total).padEnd(7)}${String(r.chrome).padEnd(8)}${status}`);
  }
  console.log('');
}

const orphans = rows.filter((r) => r.total === 0 && !r.waived);
// A baseline entry that is no longer orphaned is stale — it grants a waiver
// nobody needs, and the next real orphan at that path would inherit it.
const stale = Object.keys(baseline).filter(
  (r) => !rows.some((x) => x.route === r) || rows.some((x) => x.route === r && x.total > 0),
);

if (orphans.length || stale.length) {
  console.error('');
  for (const o of orphans) {
    console.error(`✗ ${o.route} has no inbound link anywhere in the app.`);
    console.error(`    It is in the sitemap and unreachable by a human. Link it from the header or`);
    console.error(`    the footer, or add it to scripts/links-baseline.json with a reason.`);
  }
  for (const s of stale) {
    console.error(`✗ scripts/links-baseline.json waives "${s}", which is no longer an orphan.`);
    console.error(`    Remove the entry — a stale waiver hides the next real one.`);
  }
  console.error('');
  process.exit(1);
}

const noChrome = rows.filter((r) => r.total > 0 && r.chrome === 0).length;
console.log(
  `✓ links verified — ${rows.length} public route(s), 0 orphans, ` +
    `${Object.keys(baseline).length} waived, ${noChrome} reachable but not in the chrome`,
);
