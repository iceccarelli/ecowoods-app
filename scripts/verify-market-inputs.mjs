#!/usr/bin/env node
/**
 * scripts/verify-market-inputs.mjs — the opportunity model may not be fed a
 * number nobody can point at.
 *
 * WHAT THIS PROTECTS
 *
 * The market score decides where the next page is written and where money goes.
 * Eight of its ten inputs are external facts — census income, dwelling values,
 * period of construction, structural type, permit value, search volume — and
 * every one of them is a figure a person could type from memory in four
 * seconds. A typed figure and a sourced one produce identical-looking scores,
 * and the difference only surfaces a season later in the wrong municipality.
 *
 * So: a value requires a source, a source requires a URL and a retrieval date,
 * and the date may not be in the future. There is no estimate flag, on purpose
 * — an estimate that survives one edit becomes a fact and nothing here can
 * un-believe it.
 *
 * IT ALSO GUARDS THE GATE ITSELF
 *
 * Two of the ten inputs are computed from this repository (logistics, corridor
 * value) and are worth 10 points together. MIN_CONFIDENCE must stay above that
 * share, or a market could be classified DOMINATE on highway access alone.
 * And no United States market may ever be classified above FUTURE, because a
 * model that can rank Buffalo as HIGH_PRIORITY is one edit from an American
 * commercial page for a company with no American office.
 *
 *   node scripts/verify-market-inputs.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const fail = [];
const read = (rel) => {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fail.push(`${rel} is missing`); return ''; }
  return readFileSync(p, 'utf8');
};

const src = read('content/geo/market-inputs.ts');
const opp = read('lib/geo/opportunity.ts');

/* ── 1. the ten inputs, and their weights ────────────────────────────────── */
const specs = [...src.matchAll(/id:\s*'([a-zA-Z]+)',\s*weight:\s*(\d+),\s*kind:\s*'(sourced|computed)'/g)]
  .map((m) => ({ id: m[1], weight: Number(m[2]), kind: m[3] }));

if (specs.length !== 10) {
  fail.push(
    `read ${specs.length} input spec(s) from content/geo/market-inputs.ts, expected 10. Either the model changed or ` +
      'this reader is blind — and a blind reader here validates nothing while reporting success.',
  );
}
const total = specs.reduce((n, s) => n + s.weight, 0);
if (specs.length && total !== 100) {
  fail.push(`the input weights sum to ${total}, not 100. Every score computed from them is on a different scale than it claims.`);
}

const union = /export type InputId =([\s\S]*?);/.exec(src)?.[1] ?? '';
const declared = new Set([...union.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]));
for (const s of specs) {
  if (!declared.has(s.id)) fail.push(`INPUT_SPECS carries "${s.id}", which is not in the InputId union`);
}
for (const id of declared) {
  if (!specs.some((s) => s.id === id)) fail.push(`InputId declares "${id}" but INPUT_SPECS has no entry for it — that weight is silently zero`);
}

/* ── 2. every sourced value carries a citation ───────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
const body = /MARKET_INPUTS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
/*
 * Match the INPUT block, not the market block. The first version of this reader
 * matched the outer key and reported "input oakville carries a score with no
 * source" — actionable by luck rather than by design, and useless the day a
 * market carries eight inputs and one of them is unsourced.
 *
 * An input block is the innermost object that holds a `score` and a `source`,
 * so it contains exactly one nested brace pair: the source itself.
 */
const entries = [...body.matchAll(/(\w+)\s*:\s*\{([^{}]*score:[^{}]*source:\s*\{[^{}]*\}[^{}]*)\}/g)];
if (/score:\s*-?\d/.test(body) && entries.length === 0) {
  fail.push(
    'MARKET_INPUTS contains at least one score but this reader matched no input block. It is blind, and a blind ' +
      'reader here waves through every unsourced figure in the file.',
  );
}
for (const e of entries) {
  const [, id, block] = e;
  if (!/score:\s*-?\d/.test(block)) continue;
  const url = /url:\s*'([^']*)'/.exec(block)?.[1];
  const at = /retrievedAt:\s*'(\d{4}-\d{2}-\d{2})'/.exec(block)?.[1];
  const title = /title:\s*'([^']*)'/.exec(block)?.[1];
  if (!url || !/^https:\/\//.test(url)) {
    fail.push(`input "${id}" carries a score with no https source URL. A figure without a source is a figure somebody typed.`);
  }
  if (!at) fail.push(`input "${id}" carries a score with no retrievedAt date — nothing says how stale it is`);
  else if (at > today) fail.push(`input "${id}" was retrieved on ${at}, which is in the future`);
  if (!title) fail.push(`input "${id}" carries a score with no source title`);
}

/* ── 3. the confidence gate is above the computed share ──────────────────── */
const computedWeight = specs.filter((s) => s.kind === 'computed').reduce((n, s) => n + s.weight, 0);
const min = Number(/MIN_CONFIDENCE\s*=\s*([0-9.]+)/.exec(opp)?.[1] ?? NaN);
if (Number.isNaN(min)) {
  fail.push('could not read MIN_CONFIDENCE from lib/geo/opportunity.ts — the gate that stops a market being ranked on highway access');
} else if (specs.length && min <= computedWeight / 100) {
  fail.push(
    `MIN_CONFIDENCE is ${min} and the computed inputs are worth ${computedWeight} points (${computedWeight / 100}). ` +
      'At or below that, a market can be classified — DOMINATE included — with no economic input sourced at all.',
  );
}

/* ── 4. no United States market is ever classified above FUTURE ──────────── */
if (!/country === 'US'/.test(opp) || !/classification:\s*'FUTURE'/.test(opp)) {
  fail.push(
    'lib/geo/opportunity.ts no longer forces United States markets to FUTURE. Ecowoods operates in Ontario; a model ' +
      'that can rank an American market as HIGH_PRIORITY is one edit from an American commercial page.',
  );
}
if (!/score:\s*trustworthy\s*\?/.test(opp)) {
  fail.push(
    'lib/geo/opportunity.ts no longer withholds `score` below the confidence gate. A number computed over a tenth of ' +
      'the weighting is read as a score by everyone who sees it, whatever the confidence beside it says.',
  );
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ market inputs: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
const sourced = specs.filter((s) => s.kind === 'sourced');
const filled = entries.filter((e) => /score:\s*-?\d/.test(e[2])).length;
console.log(
  `✓ market inputs verified — ${specs.length} weighted input(s) summing to ${total}, ${sourced.length} of them ` +
    `requiring a citation, ${filled} sourced value(s) on file, classification gated at ${min} confidence`,
);
