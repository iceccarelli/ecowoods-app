#!/usr/bin/env node
/**
 * scripts/verify-markdown.mjs
 *
 * Fails when a `.md` companion URL is advertised but cannot be served.
 *
 * WHY THIS EXISTS
 *
 * The llms.txt proposal (v2) asks for clean markdown at the page's own URL with
 * `.md` appended. App Router cannot express that: a directory name is either
 * wholly dynamic (`[slug]`) or wholly literal (`llms.txt`), never `[slug].md`.
 * So the URL is produced by a rewrite in next.config.js pointing at a handler
 * under app/md/.
 *
 * That is three separate things that have to agree — the rewrite source, the
 * rewrite destination, and the directory the handler actually lives in — and
 * getting any one of them wrong produces a 404 on every one of those URLs while
 * `tsc`, every guard and `next build` all pass. It is the same shape as F-131
 * (a directory that was never served), F-138 (a key file that was never served)
 * and F-144 (a sitemap URL that does not exist). Three findings in a row where
 * the code was correct and the path was wrong.
 *
 * So the correspondence is checked rather than assumed.
 *
 * WHAT IT DOES
 *
 * 1. Reads the `rewrites()` block out of next.config.js and requires every
 *    destination to resolve to a route.ts on disk.
 * 2. Requires every source to end in `.md` and every destination to sit under
 *    /md/, so a rewrite cannot quietly point somewhere else.
 * 3. Requires each handler to call generateStaticParams — without it the route
 *    is dynamic and Vercel serves it per-request, which for a static document
 *    is a cost with no benefit.
 * 4. Requires llms.txt to name the `.md` convention and /llms-full.txt, because
 *    a machine-readable edition an agent cannot discover is not one.
 * 5. Requires /llms-full.txt to exist as a route.
 *
 *   node scripts/verify-markdown.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'apps/web');
const APP = path.join(WEB, 'app');

const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

const problems = [];
const ok = [];

/* ── 1-3. rewrites resolve to handlers ────────────────────────────────────── */
const cfg = strip(fs.readFileSync(path.join(WEB, 'next.config.js'), 'utf8'));
const block = cfg.match(/async rewrites\s*\(\)\s*\{[\s\S]*?\n {2}\}/);

if (!block) {
  problems.push({ where: 'next.config.js', detail: 'no rewrites() block — the .md URLs cannot be served at all' });
} else {
  const pairs = [...block[0].matchAll(/source:\s*'([^']+)'\s*,\s*destination:\s*'([^']+)'/g)];
  if (pairs.length === 0) {
    problems.push({ where: 'next.config.js', detail: 'rewrites() declares no source/destination pairs' });
  }
  for (const [, source, destination] of pairs) {
    if (!source.endsWith('.md')) {
      problems.push({ where: `rewrite ${source}`, detail: 'source does not end in .md — this guard only understands the markdown companions' });
      continue;
    }
    if (!destination.startsWith('/md/')) {
      problems.push({ where: `rewrite ${source}`, detail: `destination ${destination} is not under /md/` });
      continue;
    }
    // '/md/papers/:slug' → app/md/papers/[slug]/route.ts
    const segs = destination.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? `[${s.slice(1)}]` : s));
    const file = path.join(APP, ...segs, 'route.ts');
    if (!fs.existsSync(file)) {
      problems.push({
        where: `rewrite ${source} → ${destination}`,
        detail: `no handler at ${path.relative(ROOT, file)} — every one of these URLs is a 404`,
      });
      continue;
    }
    const src = strip(fs.readFileSync(file, 'utf8'));
    if (!/generateStaticParams/.test(src)) {
      problems.push({
        where: path.relative(ROOT, file),
        detail: 'no generateStaticParams — the route renders per-request instead of being prebuilt',
      });
    }
    if (!/text\/markdown/.test(src)) {
      problems.push({
        where: path.relative(ROOT, file),
        detail: 'does not send content-type: text/markdown — an agent has no way to know what it received',
      });
    }
    ok.push(source);
  }
}

/* ── 5. the corpus route ──────────────────────────────────────────────────── */
const full = path.join(APP, 'llms-full.txt', 'route.ts');
if (!fs.existsSync(full)) {
  problems.push({ where: 'app/llms-full.txt/route.ts', detail: 'missing — /llms-full.txt would 404' });
} else {
  ok.push('/llms-full.txt');
}

/* ── 4. llms.txt must advertise both ──────────────────────────────────────── */
const idx = fs.readFileSync(path.join(APP, 'llms.txt', 'route.ts'), 'utf8');
if (!idx.includes('llms-full.txt')) {
  problems.push({ where: 'app/llms.txt/route.ts', detail: 'does not name /llms-full.txt — an agent has no way to discover it' });
}
if (!/\.md/.test(idx)) {
  problems.push({ where: 'app/llms.txt/route.ts', detail: 'does not name the .md companion convention' });
}

/* ── report ───────────────────────────────────────────────────────────────── */
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the machine-readable editions:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  These URLs are advertised in /llms.txt. An advertised URL that 404s is worse\n' +
      '  than one that was never offered — it is the first thing an agent tries.\n',
  );
  process.exit(1);
}

console.log(`✓ markdown editions verified — ${ok.length} surface(s): ${ok.join(', ')}`);
