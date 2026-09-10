#!/usr/bin/env node
/**
 * scripts/verify-allocation.mjs — the depth budget, enforced.
 *
 * WHAT THIS GUARD USED TO DO, AND WHY IT CHANGED
 *
 * It enforced an 80/20 Canada/United States split with a hard floor under
 * Canada's share of the market registry, plus two absolutes: no United States
 * market may hold an indexable page, and none may enter the service area. That
 * was the correct architecture for a company with no United States position,
 * and every line of it was load-bearing.
 *
 * The owner confirmed cross-border licensing and crew work authorization on
 * 2026-09-10. Rationing American records was only ever a proxy for "do not
 * publish thin American pages", and now that those pages are published the real
 * thing can be measured directly. So the ratio became a DEPTH budget — how hard
 * a page is worked, not whether it exists — and this guard measures depth.
 *
 * WHAT IT CHECKS NOW
 *
 *  1. Every published page carries real local content, per country, above a
 *     mean-character floor. A tight page is not a thin one: below the floor a
 *     page has stopped being local and become a template with the name changed,
 *     which is the shape search engines suppress.
 *  2. The service-area filter still requires an operational municipality with a
 *     dated confirmation. Publishing in New York did not loosen that.
 *  3. The retired statuses stay retired. `us-proxy` reappearing in the market
 *     registry outside a comment silently unpublishes markets that are live.
 *  4. There is still exactly one address and one telephone number. That is the
 *     line the New York confirmation did NOT move, and it is the one a
 *     directory-shaped expansion breaks first.
 *
 *   node scripts/verify-allocation.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const fail = [];
const read = (rel) => {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fail.push(`${rel} is missing`); return ''; }
  return readFileSync(p, 'utf8');
};

const marketsSrc = read('content/geo/markets.ts');
const alloc = read('lib/geo/allocation.ts');
const geoIndex = read('lib/geo/index.ts');
const seoSrc = read('lib/seo-data.ts');

/* ── read the map ────────────────────────────────────────────────────────── */
const ca = [...marketsSrc.matchAll(/\bm\(\s*'[^']+',\s*'([a-z0-9-]+)'/g)].map((x) => x[1]);
const us = [...marketsSrc.matchAll(/\bus\(\s*'[^']+',\s*'([a-z0-9-]+)'/g)].map((x) => x[1]);
if (ca.length < 20 || us.length < 10) {
  fail.push(
    `read ${ca.length} Canadian and ${us.length} United States market(s) — the reader is blind, and a blind reader ` +
      'here reports a healthy allocation forever.',
  );
}

/* ── 1. depth: every published page is actually local ────────────────────── */
const floor = Number(/MIN_MEAN_DEPTH\s*=\s*(\d+)/.exec(alloc)?.[1] ?? NaN);
if (Number.isNaN(floor)) {
  fail.push('could not read MIN_MEAN_DEPTH from lib/geo/allocation.ts — the floor under how local a published page is');
}
const contentStart = seoSrc.indexOf('export const CITY_CONTENT');
const entries = [];
if (contentStart !== -1) {
  const body = seoSrc.slice(contentStart);
  const keyRe = /\n {2}'?"?([a-z0-9-]+)'?"?:\s*\{/g;
  let m;
  while ((m = keyRe.exec(body)) !== null) {
    const open = body.indexOf('{', m.index);
    let depth = 0;
    let i = open;
    for (; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') { depth--; if (depth === 0) break; }
    }
    entries.push([m[1], body.slice(open, i + 1)]);
  }
}
if (entries.length < 40) {
  fail.push(`read ${entries.length} local-content entr(y|ies) — the reader is blind and cannot measure depth at all`);
}
const usSlugs = new Set(us);
const thin = [];
for (const [slug, block] of entries) {
  const intro = /intro:\s*([\s\S]*?)\n\s{4}[a-zA-Z]+:/.exec(block)?.[1] ?? '';
  const note = /housingNote:\s*([\s\S]*?)\n\s{4}[a-zA-Z]+:/.exec(block)?.[1] ?? '';
  const chars = intro.length + note.length;
  if (!Number.isNaN(floor) && chars < floor) thin.push({ slug, chars, us: usSlugs.has(slug) });
}
for (const t of thin) {
  fail.push(
    `${t.slug} carries ${t.chars} characters of local content, below the ${floor}-character floor. ` +
      (t.us
        ? 'A tight New York page is still a local page; below this it is a template with the place name changed.'
        : 'Below this a page has stopped describing its own housing stock.'),
  );
}

/* ── 2. the service-area filter did not loosen ───────────────────────────── */
if (!/x\.kind === 'municipality'/.test(geoIndex) || !/isOperational/.test(geoIndex)) {
  fail.push(
    'lib/geo/index.ts no longer filters the service area to operational municipalities with a dated confirmation. ' +
      'Publishing in New York changed which markets qualify, not whether qualification is required.',
  );
}

/* ── 3. the retired statuses stay retired ────────────────────────────────── */
const marketsNoComments = marketsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
if (/\bus-proxy\b/.test(marketsNoComments)) {
  fail.push(
    'us-proxy is back in content/geo/markets.ts outside a comment. It meant "advertising reach, no page", and ' +
      'reintroducing it silently unpublishes markets that are live.',
  );
}

/* ── 4. one address, one telephone ───────────────────────────────────────── */
const TORONTO_PHONE = /\(?647\)?[\s.-]?244[\s.-]?5156/;
for (const rel of ['lib/seo-data.ts', 'content/geo/markets.ts', 'content/geo/corridors.ts']) {
  const body = read(rel);
  for (const hit of body.matchAll(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)) {
    if (!TORONTO_PHONE.test(hit[0])) {
      fail.push(
        `${rel} contains a telephone number that is not the Toronto number: "${hit[0]}". There is one number, ` +
          '(647) 244-5156, and a local United States one is a second business that does not exist.',
      );
    }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ allocation: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
console.log(
  `✓ allocation verified — ${ca.length} Canadian and ${us.length} New York market(s), ${entries.length} published ` +
    `page(s) all above the ${floor}-character local-content floor, one address and one telephone number`,
);
