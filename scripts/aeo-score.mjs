#!/usr/bin/env node
/**
 * scripts/aeo-score.mjs — the monthly AI visibility number, from observations a
 * person actually made.
 *
 * WHY THIS DOES NOT QUERY ANYTHING
 *
 * The obvious version of this script asks ChatGPT, Gemini and Perplexity the
 * tracked questions and counts the mentions. It is not built that way, for two
 * reasons that both matter.
 *
 * The first is that automating those surfaces is governed by their terms and is
 * not something this repository is going to do quietly in a cron job.
 *
 * The second is better: an answer engine's response depends on who is asking,
 * where from, in what session, on what day. A scraped number would look precise
 * and mean very little. A person asking thirty-five questions once a month,
 * cold, and writing down what came back, produces a number that is coarse and
 * honest — and the trend in a coarse honest number is worth more than the level
 * of a precise dishonest one.
 *
 * So this reads observations, not the internet.
 *
 * THE FILE IT READS
 *
 *   audit/aeo/YYYY-MM.json
 *   {
 *     "observed_at": "2026-10-01",
 *     "observer": "who asked",
 *     "engines": ["chatgpt", "gemini", "perplexity", "google-ai"],
 *     "observations": [
 *       { "query": "d1", "engine": "chatgpt", "cited": true,  "position": 1,
 *         "competitors": ["lvflooring.ca"], "note": "cited /glossary/cupping" },
 *       { "query": "m7", "engine": "chatgpt", "cited": false, "competitors": [] }
 *     ]
 *   }
 *
 * `cited` means the answer named or linked ecowoods.ca. Not "mentioned the
 * topic". Not "would probably have". Named it.
 *
 *   node scripts/aeo-score.mjs                 # newest month on file
 *   node scripts/aeo-score.mjs --month 2026-10
 *   node scripts/aeo-score.mjs --template      # write an empty month to fill in
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIR = join(ROOT, 'audit/aeo');
const QUERIES = join(ROOT, 'apps/web/content/aeo/queries.ts');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};

/* ── the tracked set, read from the same file the site uses ──────────────── */
if (!existsSync(QUERIES)) {
  console.error('✗ apps/web/content/aeo/queries.ts is missing — there is no question set to score against');
  process.exit(1);
}
const src = readFileSync(QUERIES, 'utf8');
const tracked = [...src.matchAll(
  /\{\s*id:\s*'([a-z0-9]+)',\s*query:\s*'([^']+)',\s*family:\s*'([a-z]+)',\s*coverage:\s*(null|'[^']+')/g,
)].map((m) => ({
  id: m[1],
  query: m[2],
  family: m[3],
  coverage: m[4] === 'null' ? null : m[4].slice(1, -1),
}));

if (tracked.length < 10) {
  console.error(`✗ read only ${tracked.length} tracked quer(y|ies) — the reader is blind, fix it`);
  process.exit(1);
}

/* ── --template: write the month, pre-filled with the questions to ask ───── */
if (process.argv.includes('--template')) {
  const month = arg('--month') ?? new Date().toISOString().slice(0, 7);
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, `${month}.json`);
  if (existsSync(file)) {
    console.error(`✗ ${file.replace(ROOT + '/', '')} already exists. Refusing to overwrite an observation record.`);
    process.exit(1);
  }
  const engines = ['chatgpt', 'gemini', 'perplexity', 'google-ai'];
  writeFileSync(
    file,
    JSON.stringify(
      {
        observed_at: null,
        observer: null,
        engines,
        note: 'Ask each question cold, in a fresh session, without naming Ecowoods. cited = the answer named or linked ecowoods.ca.',
        observations: tracked.flatMap((q) =>
          engines.map((e) => ({ query: q.id, engine: e, cited: null, position: null, competitors: [], note: q.query })),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nWrote ${file.replace(ROOT + '/', '')} — ${tracked.length} questions × ${engines.length} engines.`);
  console.log('Ask them cold, fill in `cited`, then run: node scripts/aeo-score.mjs\n');
  process.exit(0);
}

/* ── score the month ─────────────────────────────────────────────────────── */
const months = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort()
  : [];
const wanted = arg('--month') ? `${arg('--month')}.json` : months[months.length - 1];

if (!wanted || !existsSync(join(DIR, wanted))) {
  console.log('\nNo observations on file yet.\n');
  console.log(`  ${tracked.length} questions are tracked in apps/web/content/aeo/queries.ts.`);
  console.log(`  ${tracked.filter((q) => q.coverage === null).length} of them are declared gaps — this site does not answer them yet.\n`);
  console.log('  Start the baseline:  node scripts/aeo-score.mjs --template\n');
  process.exit(0);
}

const data = JSON.parse(readFileSync(join(DIR, wanted), 'utf8'));
const obs = (data.observations ?? []).filter((o) => o.cited === true || o.cited === false);
const unanswered = (data.observations ?? []).length - obs.length;

const byId = new Map(tracked.map((q) => [q.id, q]));
const unknown = obs.filter((o) => !byId.has(o.query));
if (unknown.length) {
  console.error(`\n✗ ${unknown.length} observation(s) reference a query id that is not in the tracked set: ${[...new Set(unknown.map((o) => o.query))].join(', ')}`);
  console.error('  The set is versioned on purpose. Add the question to queries.ts, or fix the id.\n');
  process.exit(1);
}

const cited = obs.filter((o) => o.cited).length;
const score = obs.length ? Math.round((cited / obs.length) * 1000) / 10 : 0;

const families = {};
for (const o of obs) {
  const f = byId.get(o.query).family;
  families[f] ??= { n: 0, cited: 0 };
  families[f].n += 1;
  if (o.cited) families[f].cited += 1;
}
const engines = {};
for (const o of obs) {
  engines[o.engine] ??= { n: 0, cited: 0 };
  engines[o.engine].n += 1;
  if (o.cited) engines[o.engine].cited += 1;
}
const competitors = {};
for (const o of obs) for (const c of o.competitors ?? []) competitors[c] = (competitors[c] ?? 0) + 1;

const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');

console.log(`\nECOWOODS AI VISIBILITY  ·  ${wanted.replace('.json', '')}`);
console.log(`  observed ${data.observed_at ?? '(no date recorded)'} by ${data.observer ?? '(no observer recorded)'}\n`);
console.log(`  SCORE  ${score}%   (${cited} of ${obs.length} observations cited ecowoods.ca)\n`);

console.log('  by family');
for (const [f, v] of Object.entries(families).sort()) {
  console.log(`    ${f.padEnd(14)} ${String(v.cited).padStart(3)} / ${String(v.n).padEnd(3)}  ${pct(v.cited, v.n)}`);
}
console.log('\n  by engine');
for (const [e, v] of Object.entries(engines).sort()) {
  console.log(`    ${e.padEnd(14)} ${String(v.cited).padStart(3)} / ${String(v.n).padEnd(3)}  ${pct(v.cited, v.n)}`);
}

const top = Object.entries(competitors).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (top.length) {
  console.log('\n  who was cited instead');
  for (const [c, n] of top) console.log(`    ${String(n).padStart(3)}  ${c}`);
}

/* The questions this site loses AND already has a page for: the actionable set. */
const losingWithCoverage = tracked.filter((q) => {
  if (!q.coverage) return false;
  const forQuery = obs.filter((o) => o.query === q.id);
  return forQuery.length > 0 && forQuery.every((o) => !o.cited);
});
if (losingWithCoverage.length) {
  console.log(`\n  ${losingWithCoverage.length} question(s) this site ANSWERS and is cited for by nobody —`);
  console.log('  the page exists, so this is a discoverability problem, not a content one:');
  for (const q of losingWithCoverage) console.log(`    ${q.coverage.padEnd(52)} ${q.query}`);
}

const gaps = tracked.filter((q) => q.coverage === null);
if (gaps.length) {
  console.log(`\n  ${gaps.length} declared gap(s) — no page answers these yet, so losing them is expected:`);
  for (const q of gaps) console.log(`    ${q.query}`);
}

if (unanswered) console.log(`\n  ${unanswered} observation(s) left null and excluded from the score.`);

const prior = months.filter((m) => m < wanted);
if (prior.length) {
  const p = JSON.parse(readFileSync(join(DIR, prior[prior.length - 1]), 'utf8'));
  const po = (p.observations ?? []).filter((o) => o.cited === true || o.cited === false);
  if (po.length) {
    const pscore = Math.round((po.filter((o) => o.cited).length / po.length) * 1000) / 10;
    const delta = Math.round((score - pscore) * 10) / 10;
    console.log(`\n  vs ${prior[prior.length - 1].replace('.json', '')}: ${pscore}%  →  ${score}%  (${delta >= 0 ? '+' : ''}${delta})`);
  }
}
console.log('');
