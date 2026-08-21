#!/usr/bin/env node
/**
 * scripts/verify-indexnow.mjs
 *
 * Fails when the IndexNow submission path cannot possibly work.
 *
 * WHY THIS EXISTS
 *
 * F-144, and it is the third finding in a row with the same shape.
 *
 * `apps/web/scripts/notify-indexnow.mjs` fetched `/sitemap/0.xml` and
 * `/sitemap/1.xml`. Next serves those paths only when a sitemap route calls
 * `generateSitemaps()`; this one does not, so both were 404. The script logged
 * a WARN for each, found zero URLs, and exited **0**. It was also referenced by
 * nothing — not ship.sh, not package.json, not a workflow. A submitter that had
 * never submitted anything, reporting success, called by nobody.
 *
 * Before that, F-138: the ownership key was a file in apps/web/public, which
 * this host does not serve, so every submission Bing or Yandex ever received
 * was rejected at verification.
 *
 * Both were invisible because IndexNow has no feedback channel worth the name.
 * A rejected submission looks exactly like a successful one from here. Nothing
 * will ever tell you this is broken, which is precisely why it needs a guard
 * that reads the pieces and checks they fit together.
 *
 * WHAT IT DOES
 *
 * 1. Finds the key route — the single `app/<32 hex>.txt/route.ts` — and reads
 *    the key it serves. Fails if there is not exactly one.
 * 2. Requires the body it returns to be that key and nothing else, since the
 *    directory name is the URL and the body is what is compared against it.
 * 3. Requires the submitter to read a sitemap path that `app/sitemap.ts`
 *    actually produces: `/sitemap.xml` unless the route calls
 *    `generateSitemaps()`, in which case `/sitemap/N.xml`.
 * 4. Requires the submitter to be referenced by something that runs it.
 * 5. Requires it to have no `process.exit(0)` on a path that submitted nothing.
 *
 *   node scripts/verify-indexnow.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const SUBMITTER = path.join(ROOT, 'apps/web/scripts/notify-indexnow.mjs');

const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

const problems = [];
const notes = [];

/* ── 1 & 2. the key route ─────────────────────────────────────────────────── */
const keyDirs = fs
  .readdirSync(APP, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^[0-9a-f]{8,64}\.txt$/i.test(e.name))
  .map((e) => e.name);

let KEY = null;
if (keyDirs.length !== 1) {
  problems.push({
    where: 'apps/web/app',
    detail: `expected exactly one <key>.txt route directory, found ${keyDirs.length}${keyDirs.length ? `: ${keyDirs.join(', ')}` : ''}`,
  });
} else {
  KEY = keyDirs[0].replace(/\.txt$/i, '');
  const routeFile = path.join(APP, keyDirs[0], 'route.ts');
  if (!fs.existsSync(routeFile)) {
    problems.push({ where: `app/${keyDirs[0]}`, detail: 'directory exists but has no route.ts — nothing is served' });
  } else {
    const src = strip(fs.readFileSync(routeFile, 'utf8'));
    if (!src.includes(KEY)) {
      problems.push({
        where: `app/${keyDirs[0]}/route.ts`,
        detail: `the route does not contain the key from its own directory name (${KEY}). The URL and the body must match, or verification fails.`,
      });
    } else {
      notes.push(`key ${KEY} served from app/${keyDirs[0]}/route.ts`);
    }
    // The key must not be read from an env var here: the file has to serve the
    // same bytes whether or not the deploy has that variable set.
    if (/process\.env/.test(src)) {
      problems.push({
        where: `app/${keyDirs[0]}/route.ts`,
        detail: 'reads process.env — a missing variable would make this serve the wrong body, which fails exactly like a 404',
      });
    }
  }
}

/* ── 3. the submitter reads a sitemap that exists ─────────────────────────── */
const sitemapSrc = strip(fs.readFileSync(path.join(APP, 'sitemap.ts'), 'utf8'));
const splits = /generateSitemaps\s*\(/.test(sitemapSrc);
const expected = splits ? '/sitemap/' : '/sitemap.xml';

if (!fs.existsSync(SUBMITTER)) {
  problems.push({ where: 'apps/web/scripts/notify-indexnow.mjs', detail: 'missing — nothing submits anything' });
} else {
  const sub = strip(fs.readFileSync(SUBMITTER, 'utf8'));
  const referenced = [...sub.matchAll(/\/sitemap[^\s`'"]*/g)].map((m) => m[0]);
  const bad = referenced.filter((r) => (splits ? !r.startsWith('/sitemap/') : r !== '/sitemap.xml'));
  if (referenced.length === 0) {
    problems.push({ where: 'notify-indexnow.mjs', detail: 'references no sitemap path at all' });
  } else if (bad.length) {
    problems.push({
      where: 'notify-indexnow.mjs',
      detail: `reads ${bad.join(', ')}, but app/sitemap.ts serves ${expected}. Those URLs 404 and no URL is ever submitted.`,
    });
  } else {
    notes.push(`submitter reads ${expected}, which app/sitemap.ts serves`);
  }

  /* ── 5. no success exit on a path that submitted nothing ────────────────── */
  if (/process\.exit\(0\)/.test(sub.replace(/--dry-run[\s\S]{0,400}?process\.exit\(0\)/, ''))) {
    problems.push({
      where: 'notify-indexnow.mjs',
      detail:
        'exits 0 somewhere other than the --dry-run path. Every failure here is silent by nature; ' +
        'an unhappy path that reports success is how F-144 survived.',
    });
  }
}

/* ── 4. something calls it ────────────────────────────────────────────────── */
const callers = [];
for (const f of ['scripts/ship.sh', 'package.json', 'scripts/audit-all.sh']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('notify-indexnow')) callers.push(f);
}
if (callers.length === 0) {
  problems.push({
    where: 'notify-indexnow.mjs',
    detail: 'nothing references it — not ship.sh, not package.json. A submitter nobody calls submits nothing.',
  });
} else {
  notes.push(`called from ${callers.join(', ')}`);
}

/* ── report ───────────────────────────────────────────────────────────────── */
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the IndexNow path:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  IndexNow gives no useful feedback: a rejected submission is indistinguishable\n' +
      '  from an accepted one from this side. Nothing will tell you this is broken.\n',
  );
  process.exit(1);
}

console.log(`✓ IndexNow verified — ${notes.join('; ')}`);
