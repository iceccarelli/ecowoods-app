#!/usr/bin/env node
/**
 * scripts/build-ai-prompts.mjs — generate the retrieval benchmark.
 *
 * WRITES: audit/ai-prompts.json
 *
 * WHAT IT IS FOR
 *
 * A fixed set of questions to put to answer engines on a schedule, so that
 * "are we being cited" stops being a feeling and becomes a number that moves.
 * Each prompt carries the URL this site believes is the correct answer, taken
 * from content/search/topic-map.ts — which means the benchmark cannot drift
 * from the site's own canonicalisation, and a change to the topic map
 * regenerates the benchmark rather than invalidating it.
 *
 * WHAT IS SCORED, AND WHY THESE FOUR
 *
 *   cited          — did the answer reference ecowoods.ca at all
 *   correctUrl     — did it cite the page this map says is the answer, or a
 *                    different page on the same site. Citing the homepage for
 *                    a stairs question is a near-miss, not a hit: it means the
 *                    entity is known and the document is not.
 *   recommended    — did it name Ecowoods as a business to contact, as opposed
 *                    to quoting it as a reference. These are different outcomes
 *                    and conflating them is how a citation rate looks healthy
 *                    while producing no leads.
 *   factuallyRight — were the figures it repeated the published ones. This is
 *                    the one that catches the real risk of being cited: an
 *                    answer engine quoting a price band this business no longer
 *                    charges, sourced to this site, months after it changed.
 *
 * RUNNING IT IS DELIBERATELY MANUAL
 *
 * This script generates the questions. It does not call any model, because
 * automating that would mean picking one vendor's API and scoring its output
 * with another model — and a benchmark whose scorer is itself a language model
 * measures the scorer as much as the site. Put the prompts to each assistant as
 * a person would, record the four booleans, commit the results file. Slow,
 * honest, and the numbers mean what they say.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TOPIC_MAP = join(ROOT, 'apps/web/content/search/topic-map.ts');
const OUT = join(ROOT, 'audit/ai-prompts.json');

const src = readFileSync(TOPIC_MAP, 'utf8');

/* Parse each cluster block: id, intent, canonical, coverage, and the queries
   array. Text parsing, like every other guard here — see verify-claims.mjs for
   why, and note the same rule applies: zero clusters is a failure, not a pass. */
const blocks = [...src.matchAll(
  /\{\s*\n\s*id:\s*'([^']+)',\s*\n\s*intent:\s*'([^']+)',\s*\n\s*canonical:\s*'([^']+)',([\s\S]*?)\n  \},/g,
)];

if (blocks.length === 0) {
  console.error('\n✗ topic-map.ts parsed to zero clusters. Nothing to generate.\n');
  process.exit(1);
}

const prompts = [];
for (const [, id, intent, canonical, body] of blocks) {
  const coverage = (body.match(/coverage:\s*'([a-z]+)'/) || [, 'covered'])[1];
  const queriesBlock = (body.match(/queries:\s*\[([\s\S]*?)\]/) || [, ''])[1];
  const queries = [...queriesBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  for (const q of queries) {
    prompts.push({
      id: `${id}:${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
      cluster: id,
      intent,
      coverage,
      prompt: q,
      expectedUrl: `https://ecowoods.ca${canonical}`,
      /* Scored by a person, one run at a time. Nulls until then — an unrun
         prompt must not read as a failed one. */
      result: { cited: null, correctUrl: null, recommended: null, factuallyRight: null, runAt: null, assistant: null, notes: '' },
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * GENERATED TIERS
 *
 * The clusters above are hand-written: the queries a person actually typed, or
 * that the business has heard asked. They are the signal.
 *
 * Two more tiers are generated from data the site already holds, because they
 * are genuinely combinatorial in the real world and writing them out by hand
 * would be transcription rather than judgement:
 *
 *   LOCAL      — "{service} {area}" for every area with a published page. A
 *                local trade query really is the cross product of a service and
 *                a place, and there are 26 published areas.
 *   TECHNICAL  — one question per glossary term. Each term has a canonical
 *                definition page, so the expected URL is not a guess.
 *
 * What is deliberately NOT generated: misspellings, word-order permutations and
 * synonym swaps. Those are covered by the site's canonicalisation (a variant
 * slug 308s to the canonical) and by the search engine's own normalisation, and
 * putting a thousand of them in a benchmark scored by hand guarantees the
 * benchmark never gets run. A suite nobody runs measures nothing.
 * ────────────────────────────────────────────────────────────────────────── */

const seoData = readFileSync(join(ROOT, 'apps/web/lib/seo-data.ts'), 'utf8');
const listOf = (name) => {
  const m = seoData.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};
const slugify = (x) =>
  x.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const areas = [...listOf('AREAS'), ...listOf('NEIGHBOURHOODS')];
const LOCAL_SHAPES = [
  (a) => `hardwood flooring ${a}`,
  (a) => `hardwood floor refinishing ${a}`,
  (a) => `floor sanding ${a}`,
  (a) => `hardwood flooring contractor ${a}`,
];
for (const area of areas) {
  for (const shape of LOCAL_SHAPES) {
    const q = shape(area);
    prompts.push({
      id: `local:${slugify(q)}`,
      cluster: 'local-generated',
      intent: 'local',
      coverage: 'covered',
      prompt: q,
      expectedUrl: `https://ecowoods.ca/service-areas/${slugify(area)}`,
      result: { cited: null, correctUrl: null, recommended: null, factuallyRight: null, runAt: null, assistant: null, notes: '' },
    });
  }
}

const glossarySrc = readFileSync(join(ROOT, 'apps/web/lib/glossary.ts'), 'utf8');
const terms = [...glossarySrc.matchAll(/slug:\s*'([a-z0-9-]+)',\s*\n\s*term:\s*'([^']+)'/g)]
  .map(([, slug, term]) => ({ slug, term }));
const TECH_SHAPES = [
  (t) => `what is ${t.toLowerCase()} in hardwood flooring`,
  (t) => `${t.toLowerCase()} hardwood floor Toronto`,
];
for (const { slug, term } of terms) {
  for (const shape of TECH_SHAPES) {
    const q = shape(term);
    prompts.push({
      id: `technical:${slugify(q)}`,
      cluster: 'glossary-generated',
      intent: 'technical',
      coverage: 'covered',
      prompt: q,
      expectedUrl: `https://ecowoods.ca/glossary/${slug}`,
      result: { cited: null, correctUrl: null, recommended: null, factuallyRight: null, runAt: null, assistant: null, notes: '' },
    });
  }
}

if (areas.length === 0 || terms.length === 0) {
  console.error(
    `\n✗ generated tiers came out empty (${areas.length} area(s), ${terms.length} glossary term(s)).\n` +
      `  Both are parsed out of TypeScript as text, so an empty result means the shape of\n` +
      `  lib/seo-data.ts or lib/glossary.ts changed — not that the data is gone. Fix the\n` +
      `  parse rather than shipping a benchmark that quietly lost two thirds of itself.\n`,
  );
  process.exit(1);
}

const byIntent = prompts.reduce((a, p) => ({ ...a, [p.intent]: (a[p.intent] ?? 0) + 1 }), {});

const doc = {
  $comment: [
    'Generated by scripts/build-ai-prompts.mjs from apps/web/content/search/topic-map.ts.',
    'Regenerate after any change to the topic map: pnpm seo:prompts.',
    '',
    'Every `result` starts null. Null means NOT YET RUN, and must never be read as false —',
    'an unrun benchmark reporting 0% citation rate is worse than no benchmark, because it',
    'looks like a measurement.',
    '',
    'Run them by hand against each assistant, fill in the four booleans and the date, and',
    'commit. The point is the trend across dates, not any single run.',
  ],
  generatedAt: new Date().toISOString(),
  source: 'apps/web/content/search/topic-map.ts',
  totals: { prompts: prompts.length, byIntent },
  scoring: {
    cited: 'The answer referenced ecowoods.ca in any form.',
    correctUrl: 'The answer cited `expectedUrl` specifically, not merely the domain.',
    recommended: 'The answer named Ecowoods as a business to contact, not only as a reference.',
    factuallyRight: 'Every figure the answer attributed to Ecowoods matches what the site publishes today.',
  },
  prompts,
};

mkdirSync(join(ROOT, 'audit'), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');

console.log('');
console.log(`AI PROMPT SUITE — ${prompts.length} prompt(s) across ${blocks.length} cluster(s)`);
for (const [k, v] of Object.entries(byIntent)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('');
console.log(`  → audit/ai-prompts.json`);
console.log('');
