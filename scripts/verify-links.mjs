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

/* ── 2. the homepage must be a door, not a dead end ──────────────────────── */
/**
 * Measured 2026-08-20: the homepage body contained FIVE outbound internal links
 * — tel:, /design, #quote, /papers, /technical-library — across 875 lines. The
 * framework, the assessment, the guides, the glossary and all sixteen city
 * pages had no presence at all on the single page that receives nearly all of
 * this site's inbound crawl equity. See F-84.
 *
 * A hub reachable only from the footer is reachable. It is not surfaced. Both
 * crawlers and humans treat the two differently, and the footer is where links
 * go to be ignored.
 *
 * The graph is walked from app/page.tsx rather than from a hardcoded list of
 * components, because the homepage renders server components passed as props
 * (ContentLibraryPromo) and a name-based check would silently stop working the
 * first time one is renamed.
 */
const HOME_ENTRY = path.join(APP, 'page.tsx');
const HOME_HUBS = [
  '/resources', '/papers', '/framework', '/framework/assess', '/guides', '/glossary',
  '/technical-library', '/case-studies', '/blog', '/service-areas',
  '/glossary',
];

const EXTS = ['.ts', '.tsx'];
const resolveLocal = (fromFile, spec) => {
  let base;
  if (spec.startsWith('@/')) base = path.join(APP, '..', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  for (const e of EXTS) {
    const idx = path.join(base, 'index' + e);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
};

let homeText = '';
if (fs.existsSync(HOME_ENTRY)) {
  const seenH = new Set();
  const queue = [HOME_ENTRY];
  while (queue.length) {
    const f = queue.shift();
    if (seenH.has(f) || !fs.existsSync(f)) continue;
    seenH.add(f);
    const text = fs.readFileSync(f, 'utf8');
    homeText += '\n' + text;
    for (const m of text.matchAll(/(?:^|\n)\s*import[^'"`;]*['"`]([^'"`]+)['"`]/g)) {
      // Do not follow into lib/: a manifest mentioning a path in a comment is
      // not the homepage linking to it. Only components can render a link.
      if (/^[@.]/.test(m[1]) && !m[1].includes('/lib/')) {
        const next = resolveLocal(f, m[1]);
        if (next && !seenH.has(next)) queue.push(next);
      }
    }
  }
}

const unreachedFromHome = HOME_HUBS.filter((h) => inbound(homeText, h) === 0);
if (unreachedFromHome.length) {
  console.error('');
  console.error('✗ the homepage does not link to:');
  for (const h of unreachedFromHome) console.error(`    ${h}`);
  console.error(
    '\n  Nearly all inbound crawl equity enters at the homepage and distributes by\n' +
      '  links. A hub reachable only from the footer is reachable, not surfaced.\n' +
      '  Surface it in a homepage section, or remove it from HOME_HUBS in this\n' +
      '  script with a reason.\n',
  );
  process.exit(1);
}

/* ── 3. anchors in the chrome ────────────────────────────────────────────── */
/**
 * Two failures, one check.
 *
 * A bare `href="#services"` in the header or footer works on the homepage and
 * scrolls NOWHERE on every other route. The footer carried eight of them —
 * seven service links and the primary CTA — which meant that on 64 of this
 * site's 65 routes, the footer's entire Services column and its call to action
 * were dead. They were not broken links a crawler would report; they were
 * links that silently did nothing. See F-92.
 *
 * The header was already correct: its nav array holds bare fragments and the
 * component prefixes them with `/` at render time. That is why this checks
 * literal `href="#…"` JSX attributes rather than every occurrence of a fragment
 * — the distinction between a value that gets prefixed and one that ships as
 * written is the whole point.
 *
 * The second half catches the other shape: an anchor, absolute or not, pointing
 * at an id the homepage does not have. `#areas` survived in the footer for an
 * unknown length of time after the section that defined it was commented out.
 *
 * Comments are stripped first. verify-tokens.mjs does not do this and a comment
 * quoting a forbidden declaration reads to it as a violation (F-58); repeating
 * that mistake in a new guard would be inexcusable.
 */
const stripComments = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const HOME_CLIENT = path.join(APP, 'home-client.tsx');
const homeIds = fs.existsSync(HOME_CLIENT)
  ? new Set([...fs.readFileSync(HOME_CLIENT, 'utf8').matchAll(/id="([a-z0-9-]+)"/g)].map((m) => m[1]))
  : new Set();

const anchorProblems = [];
for (const [file, text] of sources) {
  if (!/components[/\\](Header|SiteFooter)\.tsx$/.test(file)) continue;
  const clean = stripComments(text);

  for (const m of clean.matchAll(/href="#([a-z0-9-]+)"/g)) {
    anchorProblems.push(
      `${path.relative(ROOT, file)}: href="#${m[1]}" is bare — it scrolls nowhere on every route ` +
        `except the homepage. Write it as "/#${m[1]}".`,
    );
  }
  // Both forms — the header's array and any absolute literal — must target a
  // real element.
  for (const m of clean.matchAll(/href[=:]\s*["'`]\/?#([a-z0-9-]+)["'`]/g)) {
    if (homeIds.size && !homeIds.has(m[1])) {
      anchorProblems.push(
        `${path.relative(ROOT, file)}: #${m[1]} does not exist on the homepage — ` +
          `no element carries id="${m[1]}" in home-client.tsx.`,
      );
    }
  }
}

if (anchorProblems.length) {
  console.error('');
  console.error(`✗ ${anchorProblems.length} anchor problem(s) in the site chrome:\n`);
  for (const p of anchorProblems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

const noChrome = rows.filter((r) => r.total > 0 && r.chrome === 0).length;
console.log(
  `✓ links verified — ${rows.length} public route(s), 0 orphans, ` +
    `${Object.keys(baseline).length} waived, ${noChrome} reachable but not in the chrome, ` +
    `${HOME_HUBS.length} hub(s) from the homepage, chrome anchors all resolve`,
);
