#!/usr/bin/env node
/**
 * Post-deploy IndexNow submission.
 *
 * WHY THIS FILE WAS REWRITTEN
 *
 * F-144. The previous version read:
 *
 *     const sitemaps = [`${SITE}/sitemap/0.xml`, `${SITE}/sitemap/1.xml`];
 *
 * Neither URL exists. Next splits a sitemap into `/sitemap/N.xml` only when the
 * route uses `generateSitemaps()`, and this site's `app/sitemap.ts` does not —
 * it serves one file at `/sitemap.xml`. Both fetches returned 404, the loop
 * logged a WARN and continued, `urls.length` was 0, and the script did this:
 *
 *     console.error("No URLs found in sitemaps; skipping.");
 *     process.exit(0);
 *
 * Exit 0. Success. Nothing had been submitted to anything, ever. It was also
 * never called: no line in ship.sh, no npm script, no CI step referenced it.
 *
 * That is the same failure as F-140 in a different costume — a script whose
 * unhappy path reports success, wired to nothing, in a repository that had no
 * way to notice. So this version: reads the sitemap that actually exists, fails
 * loudly on every condition that means nothing was submitted, and is called
 * from ship.sh's deploy line.
 *
 * WHY INDEXNOW AT ALL
 *
 * Bing, Yandex, Seznam and Naver share one IndexNow endpoint, and Bing's index
 * is what Copilot and several answer engines read. Submitting is the difference
 * between "a crawler will find this eventually" and "the index knows now".
 * Google does not participate; for Google the sitemap and Search Console are
 * the channel, which is why the honest lastmod work in F-141 mattered.
 *
 * USAGE
 *
 *   INDEXNOW_KEY=<key> node apps/web/scripts/notify-indexnow.mjs
 *   INDEXNOW_KEY=<key> node apps/web/scripts/notify-indexnow.mjs --dry-run
 *
 * The key MUST equal the basename of the key file the site serves. That file is
 * app/<key>.txt/route.ts, not apps/web/public — public is not served on this
 * host (F-131). scripts/verify-indexnow.mjs checks the two agree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.SITE_URL ?? 'https://ecowoods.ca').replace(/\/$/, '');
const DRY = process.argv.includes('--dry-run');

const die = (msg) => {
  console.error(`\n✗ IndexNow: ${msg}\n`);
  process.exit(1);
};

/**
 * The key is not read from an environment variable, and that is a deliberate
 * reversal.
 *
 * It used to be `process.env.INDEXNOW_KEY`, which meant the submission worked
 * only if a variable was set correctly in whatever shell happened to run this —
 * a variable nothing validated, that no error message mentioned, and whose
 * absence made the script exit 0. One more way for the whole path to be broken
 * and look fine.
 *
 * The key is already in the repository. It has to be: the site serves it at
 * app/<key>.txt/route.ts, and IndexNow's entire ownership check is that the URL
 * and the body agree. It is a public value by construction — anyone can read it
 * at the URL — so there is nothing to protect by hiding it in an env var, and a
 * great deal to lose. Reading it from the directory name makes the key that is
 * submitted and the key that is served the same fact, not two facts that have
 * to be kept in sync by hand.
 *
 * INDEXNOW_KEY still overrides, for testing against another host.
 */
const APP_DIR = path.resolve(fileURLToPath(import.meta.url), '../../app');
const keyFromRepo = () => {
  const dirs = fs
    .readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^[0-9a-f]{8,64}\.txt$/i.test(e.name))
    .map((e) => e.name.replace(/\.txt$/i, ''));
  if (dirs.length !== 1) {
    die(`expected exactly one <key>.txt route under apps/web/app, found ${dirs.length}.

     The key route is what IndexNow fetches to verify ownership. Without
     exactly one, this script cannot know which key to submit.`);
  }
  return dirs[0];
};

const KEY = process.env.INDEXNOW_KEY || keyFromRepo();

/* ── 1. the key file must be live and must contain the key ────────────────── */
const keyUrl = `${SITE}/${KEY}.txt`;
let keyRes;
try {
  keyRes = await fetch(keyUrl, { cache: 'no-store' });
} catch (e) {
  die(`could not reach ${keyUrl} — ${e.message}`);
}
if (!keyRes.ok) {
  die(`${keyUrl} returned ${keyRes.status}.

     IndexNow verifies ownership by fetching this file. A submission with an
     unverifiable key is rejected silently, so this is checked first.`);
}
const keyBody = (await keyRes.text()).trim();
if (keyBody !== KEY) {
  die(`${keyUrl} is served, but its body is not the key.

     got:  ${JSON.stringify(keyBody.slice(0, 80))}
     want: ${JSON.stringify(KEY)}

     A 200 serving the wrong bytes fails verification exactly as completely
     as a 404.`);
}

/* ── 2. read the sitemap that actually exists ─────────────────────────────── */
const smUrl = `${SITE}/sitemap.xml`;
let xml;
try {
  const res = await fetch(smUrl, { cache: 'no-store' });
  if (!res.ok) die(`${smUrl} returned ${res.status} — no URLs to submit.`);
  xml = await res.text();
} catch (e) {
  die(`could not reach ${smUrl} — ${e.message}`);
}

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urls.length === 0) {
  die(`${smUrl} is served but contains no <loc> elements.

     This is the condition the previous version treated as success.`);
}

console.log(`  key      ${keyUrl}  verified`);
console.log(`  sitemap  ${smUrl}  ${urls.length} URL(s)`);

if (DRY) {
  console.log('\n  --dry-run — nothing submitted.\n');
  process.exit(0);
}

/* ── 3. submit, in chunks, and report every response ──────────────────────── */
// The protocol caps a single submission at 10,000 URLs. This site is nowhere
// near that, but a cap that is not enforced is a cap that fails on the day it
// is reached, silently, in a script nobody is watching.
const CHUNK = 10_000;
const host = new URL(SITE).host;
let failed = 0;

for (let i = 0; i < urls.length; i += CHUNK) {
  const batch = urls.slice(i, i + CHUNK);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: keyUrl, urlList: batch }),
  }).catch((e) => ({ ok: false, status: 0, statusText: e.message }));

  // 200 accepted · 202 accepted, key pending validation · 4xx rejected.
  if (res.ok || res.status === 202) {
    console.log(`  submit   ${batch.length} URL(s) → HTTP ${res.status}`);
  } else {
    console.error(`  submit   ${batch.length} URL(s) → HTTP ${res.status} ${res.statusText ?? ''}`);
    failed += 1;
  }
}

if (failed) die(`${failed} batch(es) rejected. Nothing above should be assumed submitted.`);
console.log(`\n✓ IndexNow: ${urls.length} URL(s) submitted for ${host}\n`);
