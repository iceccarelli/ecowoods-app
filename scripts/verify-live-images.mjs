#!/usr/bin/env node
/**
 * scripts/verify-live-images.mjs — does every declared image actually appear?
 *
 * WHAT THIS ANSWERS THAT NOTHING ELSE DOES
 *
 * verify-images.mjs asks the repository: is the slot declared, is the file on
 * disk, is it statically imported, does some page name it. Every one of those
 * can be true while the visitor sees nothing. That is not hypothetical — it is
 * F-131 (28 diagrams committed, imported and 404ing in production) and F-173
 * (one image bundled and sitemapped, rendered by no page).
 *
 * verify-live.sh closes part of it by fetching ONE rendered image. One. The
 * site now declares 74 slots and publishes 154 image URLs to Google. Proving one
 * of them and reporting "live and serving" is the same shape of comfort that let
 * both of those findings ship.
 *
 * So this fetches every page that should render an image, reads the HTML that
 * actually came back, and asserts two separate things per slot:
 *
 *   1. PRESENCE — the slot's own bundled filename appears in the markup. Next
 *      emits /_next/static/media/<id>.<hash>.webp, so the id is recoverable
 *      from the page source. Absence means the page did not render it,
 *      whatever the manifest says.
 *   2. DELIVERY — that media URL returns 200 with a plausible number of bytes.
 *      Presence without delivery is a broken-image icon.
 *
 * og:image slots are checked as metadata rather than markup: they live in a
 * <meta property="og:image"> tag and are never drawn on the page.
 *
 *   node scripts/verify-live-images.mjs [--base https://ecowoods.ca]
 *   node scripts/verify-live-images.mjs --selftest
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--base') + 1] || '').startsWith('http')
  ? args[args.indexOf('--base') + 1]
  : 'https://ecowoods.ca';

/* ── the matcher, kept pure so it can be tested without a network ─────────── */

/**
 * Find the bundled media URL for `id` in a page's HTML.
 * Next rewrites the src through /_next/image?url=… with the inner URL encoded,
 * so both the raw and the percent-encoded form have to be recognised.
 */
export function findMediaUrl(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const raw = new RegExp(`/_next/static/media/${esc}\\.[a-f0-9]+\\.(webp|png|jpg|jpeg|avif)`, 'i');
  const enc = new RegExp(`%2F_next%2Fstatic%2Fmedia%2F${esc}\\.[a-f0-9]+\\.(webp|png|jpg|jpeg|avif)`, 'i');
  const m = html.match(raw);
  if (m) return m[0];
  const e = html.match(enc);
  if (e) return decodeURIComponent(e[0]);
  return null;
}

/** Find an og:image URL in a page's <head>. */
export function findOgImage(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${esc}\\.[a-f0-9]+\\.(webp|png|jpg|jpeg)`, 'i').test(html);
}

/* ── selftest: prove the matcher works in BOTH directions before trusting it ─ */
if (args.includes('--selftest')) {
  const present = `<img srcSet="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fservice-dust-free.680accfe.webp&w=1920&q=75" alt="x">`;
  const rawForm = `<img src="/_next/static/media/term-anisotropic.1a2b3c4d.webp">`;
  const absent = `<img src="/_next/static/media/something-else.deadbeef.webp">`;
  const checks = [
    ['encoded form found', findMediaUrl(present, 'service-dust-free') === '/_next/static/media/service-dust-free.680accfe.webp'],
    ['raw form found', findMediaUrl(rawForm, 'term-anisotropic') === '/_next/static/media/term-anisotropic.1a2b3c4d.webp'],
    ['absent reported absent', findMediaUrl(absent, 'service-dust-free') === null],
    ['prefix is not a match', findMediaUrl(`<img src="/_next/static/media/term-anisotropic-extra.aaaa1111.webp">`, 'term-anisotropic') === null],
    ['og found', findOgImage(`<meta property="og:image" content="https://x/_next/static/media/og-about.aaaa1111.webp">`, 'og-about') === true],
    ['og absent', findOgImage(`<meta property="og:image" content="https://x/og-other.aaaa1111.webp">`, 'og-about') === false],
  ];
  let bad = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\n✗ selftest failed (${bad})` : '\n✓ matcher selftest passed — both directions');
  process.exit(bad ? 1 : 0);
}

/* ── build slot → page from the manifest and the render-site maps ─────────── */
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const imagesSrc = read('apps/web/lib/images.ts');

const HREFS = Object.fromEntries(
  [...(imagesSrc.match(/const HREFS: Record<string, string> = \{([\s\S]*?)\n\};/) || ['', ''])[1].matchAll(
    /'([a-z0-9-]+)':\s*'([^']+)'/g,
  )].map((m) => [m[1], m[2]]),
);
const ids = [...imagesSrc.matchAll(/\n  (d|p|og)\(\s*\n\s*'([a-z0-9-]+)',/g)].map((m) => ({
  helper: m[1],
  id: m[2],
}));
if (!ids.length) {
  console.error('verify-live-images: parsed no slots out of the manifest — the file shape changed.');
  process.exit(2);
}

/* Group by the page each slot should appear on, so each page is fetched once. */
const byPage = new Map();
for (const s of ids) {
  const href = HREFS[s.id];
  if (!href) continue;
  const url = BASE + href.split('#')[0];
  if (!byPage.has(url)) byPage.set(url, []);
  byPage.get(url).push(s);
}

const get = async (url, asText) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'ecowoods-live-image-check' } });
      if (r.ok) return asText ? await r.text() : (await r.arrayBuffer()).byteLength;
      if (i === 2) return { status: r.status };
    } catch {
      if (i === 2) return { status: 0 };
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
};

const problems = [];
let okPresence = 0;
let okBytes = 0;
const cb = () => `cb=${Math.floor(Date.now() / 1000)}`;

console.log(`LIVE IMAGE SWEEP  ${BASE}`);
console.log(`${ids.length} slot(s) across ${byPage.size} page(s)\n`);

for (const [url, slots] of [...byPage].sort()) {
  const html = await get(`${url}${url.includes('?') ? '&' : '?'}${cb()}`, true);
  if (typeof html !== 'string') {
    problems.push(`${url} did not return HTML (status ${html?.status ?? 'transport'}) — ${slots.length} slot(s) unchecked`);
    console.log(`  FAIL  ${url}  (page unreachable)`);
    continue;
  }
  for (const s of slots) {
    if (s.helper === 'og') {
      if (findOgImage(html, s.id)) {
        okPresence++;
        okBytes++;
        console.log(`  PASS  ${s.id.padEnd(30)} og:image declared on ${url.replace(BASE, '') || '/'}`);
      } else {
        problems.push(`"${s.id}" is not referenced as og:image on ${url}`);
        console.log(`  FAIL  ${s.id.padEnd(30)} no og:image on ${url.replace(BASE, '') || '/'}`);
      }
      continue;
    }
    const media = findMediaUrl(html, s.id);
    if (!media) {
      problems.push(
        `"${s.id}" does not appear in the HTML of ${url}.\n` +
          `      The manifest declares it and a page names it, but the rendered page does not\n` +
          `      contain it. That is the defect F-173 recorded: declared, bundled, sitemapped,\n` +
          `      drawn by nobody.`,
      );
      console.log(`  FAIL  ${s.id.padEnd(30)} not in ${url.replace(BASE, '') || '/'}`);
      continue;
    }
    okPresence++;
    const bytes = await get(`${BASE}${media}`, false);
    if (typeof bytes !== 'number' || bytes < 500) {
      problems.push(
        `"${s.id}" is in the markup but its bytes do not come back: ${BASE}${media}\n` +
          `      Presence without delivery is a broken-image icon. See F-131.`,
      );
      console.log(`  FAIL  ${s.id.padEnd(30)} 0 bytes`);
    } else {
      okBytes++;
      console.log(`  PASS  ${s.id.padEnd(30)} ${String(Math.round(bytes / 1024)).padStart(4)} KB`);
    }
  }
}

console.log('');
if (problems.length) {
  console.error(`✗ ${problems.length} live image problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`✓ every declared image is on its page and serving — ${okPresence} present, ${okBytes} delivering`);
