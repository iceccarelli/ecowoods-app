#!/usr/bin/env node
/**
 * scripts/verify-preload.mjs — one preloaded image per page.
 *
 * THE BUG THIS EXISTS BECAUSE OF
 *
 * `priority` on a next/image is not a hint. It writes a real
 * <link rel="preload" as="image"> into the document head, which the browser's
 * preload scanner acts on before it has parsed the body. That is exactly what
 * you want for the LCP element and exactly what you do not want for anything
 * else: a second preloaded image competes with the first for the same
 * first-round bandwidth, and on a slow connection the one that loses is the
 * one the page is judged on.
 *
 * P2.5 gave the homepage hero a real preload. It then had TWO — because
 * FigureRotator hard-coded `priority` on its first slide, and that component is
 * rendered seven sections down, after the quote form. Nothing in
 * home-client.tsx said `priority`; the preload was invisible from the page that
 * caused it. Measured on the live site: three `as="image"` preloads in the
 * head, one of them the hero.
 *
 * WHAT IT CHECKS
 *
 *   1. NO SHARED COMPONENT HARD-CODES `priority`. It must arrive as a prop, so
 *      the page that renders the component decides — which is the only place
 *      the above-the-fold question can actually be answered. Components that
 *      genuinely are always the LCP element are allowlisted here, by name, with
 *      a reason.
 *   2. NO PAGE PASSES `priority` MORE THAN ONCE. Two preloads on one page is
 *      the defect above, written explicitly.
 *
 *   node scripts/verify-preload.mjs
 *   node scripts/verify-preload.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const LIST = process.argv.includes('--list');

/**
 * Components allowed to hard-code `priority`, each with the reason it is
 * always the largest element in the viewport when it renders.
 */
const ALWAYS_LCP = new Map([
  [
    'apps/web/app/components/HeroBackdrop.tsx',
    'It IS the hero. Full-bleed, first element, one per page, and the whole point of P2.5.',
  ],
]);

if (!fs.existsSync(APP)) {
  console.error('verify-preload: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p);
    } else if (e.name.endsWith('.tsx')) files.push(p);
  }
};
walk(APP);

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
/* Comments explain; they do not render. verify-tokens shipped without this and
   a comment quoting a forbidden declaration read as a violation (F-58). */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** A JSX attribute that turns preloading ON: `priority` or `priority={true}`. */
const PRIORITY_ON = /(?:^|\s)priority(?:=\{true\}|=\{[^}]*&&[^}]*\}|(?=[\s/>]))/g;
/** The same attribute, but sourced from a prop — the safe form. */
const FROM_PROP = /priority=\{\s*priority/;

const problems = [];
const rows = [];

for (const f of files) {
  const r = rel(f);
  const raw = fs.readFileSync(f, 'utf8');
  const text = strip(raw);
  const hits = [...text.matchAll(PRIORITY_ON)];
  if (hits.length === 0) continue;

  const isComponent = r.includes('/components/');
  const declaresProp = /priority\?:\s*boolean/.test(text) || /priority\s*=\s*false/.test(text);
  const forwardsProp = FROM_PROP.test(text);

  rows.push({ r, count: hits.length, isComponent, declaresProp, forwardsProp });

  if (isComponent && !ALWAYS_LCP.has(r)) {
    /* A shared component may MENTION priority all it likes — it just has to be
       forwarding a prop rather than deciding for every page that renders it. */
    if (!(declaresProp && forwardsProp)) {
      problems.push(
        `${r}\n      hard-codes \`priority\` on an image inside a shared component.\n` +
          `      That writes <link rel=preload as=image> into the head of EVERY page that\n` +
          `      renders it, including pages where this component is far below the fold.\n` +
          `      Take it as a prop defaulting to false and let the page decide, or add this\n` +
          `      file to ALWAYS_LCP in this script with the reason it is always the hero.`,
      );
    }
  }

  if (!isComponent && hits.length > 1) {
    problems.push(
      `${r}\n      passes \`priority\` ${hits.length} times. A page gets ONE preloaded image:\n` +
        `      the LCP element. The second one competes with it for the same bandwidth.`,
    );
  }
}

if (LIST) {
  for (const row of rows.sort((a, b) => a.r.localeCompare(b.r))) {
    console.log(
      `  ${row.r.padEnd(52)} ${String(row.count).padStart(2)}  ` +
        `${row.isComponent ? (row.forwardsProp ? 'forwards prop' : ALWAYS_LCP.has(row.r) ? 'always-LCP (allowed)' : 'HARD-CODED') : 'page'}`,
    );
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} image-preload problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ preload verified — ${rows.length} file(s) use priority; no shared component preloads for pages that did not ask, no page preloads twice`,
);
