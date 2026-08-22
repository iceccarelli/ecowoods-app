#!/usr/bin/env node
/**
 * scripts/verify-sitemap.mjs
 *
 * Fails when sitemap.ts stamps a URL with the build time.
 *
 * WHY THIS EXISTS
 *
 * F-141. Seventy-two of the hundred and one URLs in sitemap.xml carried
 * `lastModified: new Date()`. sitemap.ts revalidates every 86400 seconds, so
 * every one of those URLs claimed to have been modified today — today, and
 * again tomorrow, and again the day after, whether or not anything had changed.
 *
 * That is not a harmless default. lastmod is the single field in the protocol
 * that tells a crawler which of a hundred URLs is worth fetching again, and
 * Google's stated behaviour on a lastmod it finds unreliable is to stop reading
 * lastmod for the whole host. Spending it on 72 unchanged pages did not make
 * those pages look fresh; it made the dates on the pages that HAD changed
 * worthless too. On a site with 101 URLs and roughly one of them indexed, that
 * is not a detail.
 *
 * The fix is not a better default. It is that a date goes in only when
 * something dated backs it, and is omitted otherwise — `lastModified` is
 * optional, and "I don't know" is a legitimate answer that costs nothing.
 *
 * WHAT IT DOES
 *
 * Strips comments, then requires that `new Date()` with no argument appears at
 * most once in sitemap.ts, inside the branch guarded by `LIVE.has(route)`.
 * `new Date(something)` is untouched — that is a real date being parsed.
 *
 * A route may only join LIVE if its content genuinely changes without a deploy.
 * Today that is /market, which refetches the Bank of Canada hourly. Adding a
 * route to that set is a claim, and this guard prints the set on every run so
 * the claim stays visible rather than accumulating quietly.
 *
 *   node scripts/verify-sitemap.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'apps/web/app/sitemap.ts');

if (!fs.existsSync(FILE)) {
  console.error('verify-sitemap: apps/web/app/sitemap.ts not found — run from the repo root.');
  process.exit(2);
}

/* Strip comments first. This guard's own documentation says `new Date()` four
   times, and two guards in this repository have already failed by reading their
   own prose as a violation (F-58, F-106). */
const raw = fs.readFileSync(FILE, 'utf8');

/* Line numbers must survive the strip. A guard that says sitemap.ts:66 when the
   problem is on line 103 sends the reader to a line that is not wrong, which is
   worse than printing no line at all — the first version of this file did
   exactly that. So a block comment collapses to the same number of newlines it
   spanned, rather than to nothing. */
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const lines = src.split('\n');
const hits = [];
lines.forEach((line, i) => {
  if (/new Date\(\s*\)/.test(line)) hits.push({ line: i + 1, text: line.trim() });
});

const problems = [];

if (hits.length === 0) {
  problems.push({
    where: 'sitemap.ts',
    detail:
      'no `new Date()` at all — /market is supposed to carry a live timestamp. ' +
      'Either the LIVE branch was removed or this guard is now checking the wrong file.',
  });
} else if (hits.length > 1) {
  for (const h of hits.slice(1)) {
    problems.push({
      where: `sitemap.ts:${h.line}`,
      detail: `\`${h.text}\` — this stamps a URL with the build time. Pass a real date, or omit lastModified.`,
    });
  }
}

/* The one permitted hit must sit inside the LIVE branch. */
if (hits.length >= 1) {
  const near = lines.slice(Math.max(0, hits[0].line - 4), hits[0].line).join('\n');
  if (!/LIVE\.has\(/.test(near)) {
    problems.push({
      where: `sitemap.ts:${hits[0].line}`,
      detail:
        '`new Date()` is not inside the `LIVE.has(route)` branch. Only routes whose ' +
        'content changes without a deploy may carry a build-time date.',
    });
  }
}

/* ── images must be declared, or Google will not look for them ────────────── */
/**
 * F-168. Google's image-sitemap documentation is explicit that the mechanism is
 * for "images that we might not otherwise find (such as images your site
 * reaches with JavaScript code)". Every diagram here is rendered through
 * next/image into a hashed /_next/static/media/ URL. Nothing listed them, so
 * twenty-eight technical cross-sections drawn for this site were undiscoverable
 * as images.
 *
 * This checks the mechanism is wired, not the count — verify-images.mjs already
 * polices the count. What must not happen is `images` quietly disappearing from
 * sitemap.ts and nobody noticing the picture set went dark again.
 */
for (const [needle, detail] of [
  [/images\?:\s*string\[\]/, 'sitemap entries no longer accept an `images` field. Google discovers images it cannot reach through HTML only if a sitemap declares them — see F-168.'],
  [/illustrationUrls\(\)/, 'the technical diagrams are no longer declared on any route.'],
  [/brandUrls\(\)/, 'the brand marks are no longer declared. The logo is how a search engine attaches an image to the entity.'],
]) {
  if (!needle.test(src)) problems.push({ where: 'sitemap.ts', detail });
}

const liveMatch = src.match(/const LIVE = new Set\(\[([\s\S]*?)\]\)/);
const live = liveMatch
  ? [...liveMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
  : [];

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the sitemap:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  lastmod is optional. A URL with no date is treated as "unknown", which is\n' +
      '  true and free. A URL dated today when it was not touched today is what makes\n' +
      '  a crawler stop trusting every other date in the file.\n',
  );
  process.exit(1);
}

console.log(
  `✓ sitemap verified — no build-time dates; ${live.length} live route(s): ${live.join(', ') || 'none'}`,
);
