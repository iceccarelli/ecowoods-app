#!/usr/bin/env node
/**
 * scripts/verify-client-boundary.mjs
 *
 * Fails when a client component can reach a Node builtin through its imports.
 *
 * WHY THIS EXISTS
 *
 * F-80. `AssessClient.tsx` is a client component. It imported `lib/framework.ts`
 * for the pillars and the scoring function. `lib/framework.ts` imported
 * `getPaper` from `lib/papers.ts` — one function, used on one server-rendered
 * page — and `lib/papers.ts` reaches for `node:fs` to decide whether a PDF has
 * been published.
 *
 * Webpack followed that chain into the browser bundle and failed the production
 * build. Every guard in this repository passed. `tsc --noEmit` passed. The
 * failure was three modules deep and invisible to every check except the build
 * itself, and it reached `origin/main` and broke a deploy.
 *
 * The build catches it, so this guard is not about detection — it is about
 * catching it in two seconds instead of two minutes, and in an environment
 * where `next build` cannot run at all. That environment is not hypothetical:
 * `prisma generate` requires binaries.prisma.sh, so a sandbox without it cannot
 * build this app and therefore could not have caught F-80 before shipping it.
 *
 * WHAT IT DOES
 *
 * Finds every file whose first non-comment line is 'use client', walks its
 * relative and @/ imports transitively, and fails if any module in that graph
 * imports or requires a Node builtin. Reports the full chain, because the chain
 * is the part that is hard to see by reading one file.
 *
 *   node scripts/verify-client-boundary.mjs
 *   node scripts/verify-client-boundary.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'apps/web');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(WEB)) {
  console.error('verify-client-boundary: apps/web not found — run from the repo root.');
  process.exit(2);
}

/* Node builtins that have no browser equivalent. `node:`-prefixed forms and the
   bare forms are both matched; webpack treats them the same way. */
const BUILTINS = [
  'fs', 'path', 'os', 'child_process', 'crypto', 'net', 'tls', 'http', 'https',
  'stream', 'zlib', 'worker_threads', 'dns', 'cluster', 'readline', 'v8', 'vm',
  'perf_hooks', 'async_hooks', 'module',
];
const BUILTIN_RE = new RegExp(
  `(?:from|require\\()\\s*['"\`](?:node:)?(${BUILTINS.join('|')})['"\`]`,
);

/* ── collect source files ─────────────────────────────────────────────────── */
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p);
  }
})(WEB);

const src = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

/* A module marked 'use server' is a server-action boundary. Next replaces its
   exports with an RPC stub in the client bundle, so a client component may
   import one and nothing behind it is bundled for the browser. Traversal stops
   there — walking through it produced three false positives on the admin
   invoice forms, which import lib/actions/invoices.ts and build fine. */
const isServerAction = (text) => {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    return /^['"]use server['"]/.test(line);
  }
  return false;
};

/* A file is a client module if it declares 'use client' before any real code.
   Leading comments and blank lines are allowed above the directive. */
const isClient = (text) => {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
    return /^['"]use client['"]/.test(line);
  }
  return false;
};

/* ── resolve one import specifier to a file on disk ───────────────────────── */
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
function resolve(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // a package, not our source — webpack handles its own shims
  for (const e of EXTS) if (src.has(base + e)) return base + e;
  for (const e of EXTS) if (src.has(path.join(base, 'index' + e))) return path.join(base, 'index' + e);
  return null;
}

const importsOf = (text) =>
  [
    ...[...text.matchAll(/(?:^|\n)\s*import[^'"`;]*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    ...[...text.matchAll(/(?:^|\n)\s*export\s+[^'"`;]*from\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
  ];

/* ── walk each client component's graph ───────────────────────────────────── */
const clients = files.filter((f) => isClient(src.get(f)));
const problems = [];
const rel = (f) => path.relative(ROOT, f);

for (const entry of clients) {
  const seen = new Set([entry]);
  // Breadth-first, carrying the chain so the report can show how it got there.
  const queue = [[entry, [entry]]];
  while (queue.length) {
    const [file, chain] = queue.shift();
    const text = src.get(file);
    const hit = text.match(BUILTIN_RE);
    // The entry itself declaring 'use client' AND importing fs is its own,
    // louder bug — but it is the same finding, so report it the same way.
    if (hit) {
      problems.push({ entry, chain, builtin: hit[1] });
      break; // one finding per client component is enough to act on
    }
    for (const spec of importsOf(text)) {
      const next = resolve(file, spec);
      if (next && !seen.has(next) && !isServerAction(src.get(next))) {
        seen.add(next);
        queue.push([next, [...chain, next]]);
      }
    }
  }
}

if (LIST) {
  console.log(`\n${clients.length} client component(s):\n`);
  for (const c of clients) console.log(`  ${rel(c)}`);
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} client component(s) can reach a Node builtin:\n`);
  for (const p of problems) {
    console.error(`  · ${rel(p.entry)}  →  node:${p.builtin}`);
    for (const [i, f] of p.chain.entries()) {
      console.error(`      ${'  '.repeat(i)}${i === 0 ? '' : '└─ '}${rel(f)}`);
    }
    console.error(
      `      ${'  '.repeat(p.chain.length)}└─ node:${p.builtin}   ← webpack follows this into the browser bundle`,
    );
    console.error('');
  }
  console.error(
    '  Fix by narrowing the import, not by adding a webpack fallback: move the\n' +
      '  server-only function out of the shared module, or drop the import if the\n' +
      '  check it performs is already enforced by a build guard.\n',
  );
  process.exit(1);
}

console.log(
  `✓ client boundary verified — ${clients.length} client component(s), ` +
    `none can reach a Node builtin`,
);
