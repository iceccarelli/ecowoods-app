#!/usr/bin/env node
/**
 * scripts/verify-assistant.mjs — one assistant, one name, one closing rule.
 *
 *   pnpm seo:assistant
 *
 * WHY THIS IS AN SEO GUARD AND NOT A BRANDING ONE
 *
 * Every other surface on this site is relentlessly one entity. The schema graph,
 * llms.txt, ai.txt, the citation guide and the framework all say Ecowoods,
 * because the entire retrieval strategy is making one entity unmistakable to
 * machines and to people.
 *
 * Then the one thing a visitor actually talks to introduced itself as
 * "RenoGuide" — a second brand, in the highest-intent moment on the site, in a
 * window a person opened because they were ready to ask a question. It is the
 * same class of leak as two live domains, at a smaller scale.
 *
 * THREE CHECKS
 *
 *   1. The retired name appears nowhere.
 *   2. No customer-facing surface types the assistant's name as a literal —
 *      it comes from lib/assistant-identity.ts, so the next rename is one edit.
 *   3. The system prompt still carries the always-close rule. That rule is the
 *      difference between an assistant that answers questions and one that
 *      produces work, and it is exactly the kind of instruction that gets
 *      quietly trimmed when someone shortens a prompt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const IDENTITY = 'apps/web/lib/assistant-identity.ts';
const PROMPT = 'packages/shared/ai/index.ts';
const OPT_OUT = 'assistant-allow';

const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

const identity = read(IDENTITY);
if (!identity) {
  console.error(`\n✗ ${IDENTITY} is missing. Every surface renders the name from it.\n`);
  process.exit(1);
}
const NAME = (identity.match(/name:\s*'([^']+)'/) || [, null])[1];
if (!NAME) {
  console.error(`\n✗ could not read the assistant's name out of ${IDENTITY}.\n`);
  process.exit(1);
}

/** The retired name. Kept here, and only here, so the guard can name it. */
const RETIRED = ['Reno' + 'Guide', 'reno' + 'guide', 'RENO' + 'GUIDE'];

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const EXT = new Set(['.ts', '.tsx', '.md', '.mdx', '.json']);
function walk(dir, out = []) {
  let e;
  try { e = readdirSync(dir); } catch { return out; }
  for (const n of e) {
    if (SKIP.has(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (EXT.has(extname(n))) out.push(f);
  }
  return out;
}

const files = ['apps/web', 'packages'].flatMap((d) => walk(join(ROOT, d)));
const problems = [];

/* ── 1 + 2 ────────────────────────────────────────────────────────────── */
for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel === IDENTITY) continue;               // documents the rename
  const src = readFileSync(file, 'utf8');
  if (src.includes(OPT_OUT)) continue;

  src.split('\n').forEach((line, i) => {
    for (const r of RETIRED) {
      if (line.includes(r)) {
        problems.push({
          rel, line: i + 1,
          what: `the retired name "${r}" is still here`,
          why: 'Two names for one assistant is a second brand in the one window a buyer opens deliberately.',
          text: line.trim().slice(0, 110),
        });
      }
    }
    /* The current name typed as a literal in a component. Comments are fine —
       explaining the rename requires naming it. */
    if (!/\.tsx?$/.test(file)) return;
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (rel === PROMPT) return;                 // the prompt states its own name to the model
    if (new RegExp(`['"\`>]${NAME}`).test(line)) {
      problems.push({
        rel, line: i + 1,
        what: `"${NAME}" typed as a literal`,
        why: `Import ASSISTANT from ${IDENTITY}. That is the whole reason the constant exists.`,
        text: t.slice(0, 110),
      });
    }
  });
}

/* ── 3 ────────────────────────────────────────────────────────────────── */
const prompt = read(PROMPT);
const REQUIRED = [
  { needle: 'ALWAYS CLOSE ON WHAT ECOWOODS WOULD DO', what: 'the always-close rule' },
  { needle: 'WHAT ECOWOODS ACTUALLY OFFERS', what: 'the service list the assistant may name' },
  { needle: 'make that step something Ecowoods does', what: 'the closing instruction' },
];
for (const r of REQUIRED) {
  if (!prompt.includes(r.needle)) {
    problems.push({
      rel: PROMPT, line: 0,
      what: `${r.what} is gone from the system prompt`,
      why:
        'An assistant that answers the question and stops has spent the visit and produced ' +
        'nothing. Every reply must end on a specific thing Ecowoods would do about what was ' +
        'just described.',
      text: `expected to find: ${r.needle}`,
    });
  }
}

console.log('');
console.log(`ASSISTANT — "${NAME}", ${files.length} file(s) scanned`);
console.log('');

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.rel}${p.line ? ':' + p.line : ''}`);
    console.error(`    ${p.text}`);
    console.error(`    → ${p.what}. ${p.why}\n`);
  }
  process.exit(1);
}

console.log(`✓ assistant verified — one name, sourced from the constant, and the prompt still closes on Ecowoods\n`);
process.exit(0);
