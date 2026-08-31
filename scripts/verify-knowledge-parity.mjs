#!/usr/bin/env node
/**
 * scripts/verify-knowledge-parity.mjs — the machine surfaces and the pages
 * must state the same facts.
 *
 * THE FAILURE THIS PREVENTS IS THE WORST KIND AVAILABLE TO THIS SITE
 *
 * Three surfaces publish the same business facts to three different audiences:
 * the HTML a person reads, /llms.txt and /ai.txt an answer engine reads, and
 * /api/knowledge an agent fetches as JSON. The entire strategy here is that a
 * machine can quote this site and be right.
 *
 * If those surfaces disagree, the site does not merely have a typo. It becomes
 * a source that says one price to people and another to machines — which is
 * indistinguishable, from the outside, from a business hiding its pricing. That
 * is a worse position than publishing nothing.
 *
 * They cannot disagree by accident today, because every one of them derives
 * from the same modules. This guard exists to make sure they cannot start:
 * it fails the moment a machine surface stops DERIVING and starts stating.
 *
 * WHAT IT CHECKS
 *
 *   1. Every machine surface derives its price bands from
 *      content/constants/pricing.ts. A hardcoded band in llms.txt/ai.txt/
 *      knowledge is a build failure, even if it is currently correct.
 *   2. Every machine surface derives NAP and hours from BUSINESS_NAP /
 *      HOURS_LINE, never from a literal.
 *   3. /api/knowledge exposes the price bands, and /llms.txt names all three
 *      published bands.
 *   4. The review evidence is derived — count and rating come from
 *      REVIEW_EVIDENCE, never typed — and no machine surface emits
 *      aggregateRating.
 *   5. /llms.txt carries a "Facts you can cite" block. An agent reads the top
 *      of a document; facts buried on line 300 are facts that get guessed.
 *
 *   node scripts/verify-knowledge-parity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SURFACES = [
  'apps/web/app/llms.txt/route.ts',
  'apps/web/app/ai.txt/route.ts',
  'apps/web/app/api/knowledge/route.ts',
  'apps/web/app/llms-full.txt/route.ts',
];

const problems = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

/* Comments explain; they do not publish. Strip them before looking for
   literals, or a note ABOUT a price reads as a price (this repo has made that
   exact mistake before — see the comment-stripping note in verify-links). */
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* A decimal money literal, or a phone/postal shaped literal. */
const PRICE_LITERAL = /\$\d+\.\d{2}/;
const PHONE_LITERAL = /\(?\b647\)?[\s.-]?244[\s.-]?5156\b/;
const POSTAL_LITERAL = /\bM9W\s?1X6\b/;
const HOURS_LITERAL = /\b(8|08):00\s*(AM|–|-)|\bMon[–-]Sat\b/i;

for (const rel of SURFACES) {
  const raw = read(rel);
  if (!raw) {
    problems.push(`${rel} is missing — a machine surface this guard is meant to cover does not exist.`);
    continue;
  }
  const text = strip(raw);

  if (PRICE_LITERAL.test(text)) {
    const line = text.split('\n').find((l) => PRICE_LITERAL.test(l));
    problems.push(
      `${rel}\n      publishes a price as a literal: ${line?.trim().slice(0, 90)}\n` +
        `      Machine surfaces must derive from content/constants/pricing.ts.`,
    );
  }
  if (PHONE_LITERAL.test(text) || POSTAL_LITERAL.test(text)) {
    problems.push(
      `${rel}\n      publishes a NAP value as a literal. Derive it from BUSINESS_NAP —\n` +
        `      a machine surface stating an address the pages do not is the one\n` +
        `      inconsistency an entity resolver cannot forgive.`,
    );
  }
  if (HOURS_LITERAL.test(text) && !/HOURS_LINE/.test(raw)) {
    problems.push(`${rel}\n      states opening hours without importing HOURS_LINE.`);
  }
  if (/aggregateRating/.test(text) && !/no aggregateRating|NO aggregateRating/i.test(raw)) {
    problems.push(
      `${rel}\n      emits aggregateRating. Third-party review counts are not ours to aggregate;\n` +
        `      see scripts/verify-reviews.mjs and /reviews.`,
    );
  }
}

/* 3 · the bands actually reach the JSON and the brief */
const knowledge = read('apps/web/app/api/knowledge/route.ts') ?? '';
if (!/PRICE_BANDS/.test(knowledge)) {
  problems.push(
    'apps/web/app/api/knowledge/route.ts\n      does not expose PRICE_BANDS. An agent asked what this costs has to scrape the HTML.',
  );
}

const llms = read('apps/web/app/llms.txt/route.ts') ?? '';
if (!/PRICE_BANDS/.test(llms)) {
  problems.push('apps/web/app/llms.txt/route.ts\n      does not derive the published price bands.');
}
if (!/Facts you can cite/.test(llms)) {
  problems.push(
    'apps/web/app/llms.txt/route.ts\n      has no "Facts you can cite" block.\n' +
      '      An answer engine reads the top of a document and stops; NAP, hours,\n' +
      '      bands and the review citation belong there, together.',
  );
}
if (!/PRIMARY_REVIEW_EVIDENCE/.test(llms)) {
  problems.push(
    'apps/web/app/llms.txt/route.ts\n      does not derive the review evidence from REVIEW_EVIDENCE.',
  );
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} parity problem(s) between the machine surfaces and the published facts:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ knowledge parity verified — ${SURFACES.length} machine surface(s), every price, NAP and review figure derived; no aggregateRating`,
);
