#!/usr/bin/env node
/**
 * scripts/verify-quote-impact.mjs — the guard on the commercial box that sits
 * under a technical paper.
 *
 * WHAT IT PROTECTS
 *
 * content/quote-impact.ts adds one short commercial paragraph to the end of
 * each technical paper. That paragraph is the highest-risk copy on the site:
 * it is the one place where a sales sentence sits directly beneath 4,000 words
 * of sourced technical writing, and it borrows that writing's credibility. If
 * it grows, drifts off the paper it follows, or starts quoting figures the
 * paper does not publish, it does not merely fail on its own terms — it
 * discredits the document above it.
 *
 * So:
 *   1. Every entry names a paper that exists in lib/papers.ts.
 *   2. Every entry's `anchor` is a real section id inside THAT paper, so
 *      "given what you have just read" points at something that was read.
 *   3. Every `body` is ≤ 120 words. The limit is the brief's and it is the
 *      reason the box works.
 *   4. Every published paper HAS one. A paper without the box is a page that
 *      informs a buyer and then lets them leave, which is the condition this
 *      whole module exists to end.
 *   5. The signer is a desk, not a name. Inventing an author to sign
 *      commercial copy is the small fiction this project refuses; if a real
 *      person is ever recorded in /team, this check is what you update.
 *
 *   node scripts/verify-quote-impact.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'apps/web/content/quote-impact.ts');
const PAPERS = path.join(ROOT, 'apps/web/lib/papers.ts');
const WORD_LIMIT = 120;

if (!fs.existsSync(FILE)) {
  console.error('✗ apps/web/content/quote-impact.ts not found — run from the repo root.');
  process.exit(2);
}

const src = fs.readFileSync(FILE, 'utf8');
const papersSrc = fs.readFileSync(PAPERS, 'utf8');
const problems = [];

/* ── the papers, and the section ids inside each ──────────────────────────── */
const paperSections = new Map();
for (const block of papersSrc.split(/\n {2}\{\n {4}slug: '/).slice(1)) {
  const slug = block.slice(0, block.indexOf("'"));
  const ids = new Set([...block.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]));
  paperSections.set(slug, ids);
}

/* ── the entries ──────────────────────────────────────────────────────────── */
const arr = src.slice(src.indexOf('export const QUOTE_IMPACTS'));
const chunks = arr.split(/\n {2}\{\n/).slice(1);
const entries = chunks.map((c) => ({
  paper: (c.match(/paper:\s*'([^']+)'/) ?? [])[1],
  anchor: (c.match(/anchor:\s*'([^']+)'/) ?? [])[1],
  body: (c.match(/body:\s*\n?\s*'([\s\S]*?)',\n\s*cta:/) ?? [])[1],
  href: (c.match(/href:\s*'([^']+)'/) ?? [])[1],
}));

if (entries.length === 0) {
  console.error('✗ verify-quote-impact: parsed zero entries — the literal shape changed.');
  process.exit(1);
}

const covered = new Set();
for (const e of entries) {
  const where = `quote-impact.ts "${e.paper}"`;
  if (!paperSections.has(e.paper)) {
    problems.push(`${where}\n      names a paper that does not exist in lib/papers.ts.`);
    continue;
  }
  covered.add(e.paper);

  if (!paperSections.get(e.paper).has(e.anchor)) {
    problems.push(
      `${where}\n      anchor "#${e.anchor}" is not a section in that paper.\n` +
        `      The box says "what you have just read" — it must point at something that was.`,
    );
  }

  const words = (e.body ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (!e.body) {
    problems.push(`${where}\n      has no body, or the literal could not be parsed.`);
  } else if (words > WORD_LIMIT) {
    problems.push(
      `${where}\n      body is ${words} words; the limit is ${WORD_LIMIT}.\n` +
        `      A commercial box that grows into an essay stops being read at all.`,
    );
  }

  if (!e.href || !e.href.startsWith('/')) {
    problems.push(`${where}\n      cta.href "${e.href}" is not a site-relative path.`);
  }
}

for (const slug of paperSections.keys()) {
  if (!covered.has(slug)) {
    problems.push(
      `lib/papers.ts "${slug}"\n      is published with no quote-impact box.\n` +
        `      A paper that informs a buyer and then lets them leave is the gap this module closes.`,
    );
  }
}

if (!/QUOTE_IMPACT_SIGNER\s*=\s*'the Ecowoods estimating desk'/.test(src)) {
  problems.push(
    `quote-impact.ts\n      QUOTE_IMPACT_SIGNER is not the estimating desk.\n` +
      `      Only a person recorded in /team, with consent, may sign commercial copy here.`,
  );
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the quote-impact boxes:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ quote impact verified — ${entries.length} box(es), one per paper, each ≤${WORD_LIMIT} words and anchored to a real section`,
);
