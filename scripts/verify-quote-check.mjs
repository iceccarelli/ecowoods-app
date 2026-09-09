#!/usr/bin/env node
/**
 * scripts/verify-quote-check.mjs — the quote comparator states no price and
 * judges no company, and it stays that way.
 *
 * WHY A GUARD RATHER THAN A CODE REVIEW
 *
 * /quote-check is the one page on this site whose obvious improvement is also
 * its one unacceptable change. Every person who reads it will have the same
 * idea: "it already knows subfloor preparation is missing — just say what
 * subfloor preparation costs." That single sentence converts a scope
 * comparison into a performance claim about a market, and:
 *
 *   · Competition Act s.74.01(1)(b) requires adequate and proper testing to
 *     exist BEFORE the claim is made. There is no such test for a typical GTA
 *     line-item price and there is no way to acquire one from published data.
 *   · Bill C-59 sets the penalty at the greater of CAD 10M or 3% of worldwide
 *     gross revenue, and since 20 June 2025 a private party can bring it to the
 *     Competition Tribunal directly, without the Commissioner.
 *   · Characterising a competitor's document invites the disparagement analysis
 *     in Energizer Brands v Gillette 2023 FC 804.
 *
 * The idea will arrive as a small, reasonable-looking edit, months from now,
 * from somebody who has not read any of that. So it is checked mechanically.
 *
 * WHAT IS CHECKED
 *
 *   1. No dollar figure and no percentage in the checklist content or on the
 *      page — the only currency the tool may display is arithmetic on numbers
 *      the visitor typed, which lives in the client component and is formatted
 *      from state.
 *   2. No comparative or evaluative vocabulary about quotes or companies.
 *   3. Every item marked `published` cites a /guides/ or /papers/ page that
 *      this repository actually generates. A citation to a page that does not
 *      exist is a claim with no source.
 *   4. Every item marked `scope` cites nothing — a neutral line item that
 *      quietly acquires a citation is a claim wearing a disclaimer.
 *   5. Ids are unique and stable-looking; the benchmark rows are keyed on them.
 *   6. The comparator exports no function whose name suggests pricing, ranking
 *      or scoring, and the API handler declares its refusals in the payload.
 *
 *   node scripts/verify-quote-check.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const CONTENT = join(WEB, 'content/quote-check/scope-items.ts');
const COMPARE = join(WEB, 'lib/quote-check/compare.ts');
const PAGE = join(WEB, 'app/quote-check/page.tsx');
const CLIENT = join(WEB, 'app/quote-check/QuoteCompare.tsx');
const HANDLERS = join(WEB, 'lib/registry/handlers.ts');

const fail = [];
const read = (p) => {
  if (!existsSync(p)) {
    fail.push(`missing file: ${p.replace(ROOT + '/', '')}`);
    return '';
  }
  return readFileSync(p, 'utf8');
};

/**
 * Strip comments before checking rendered content.
 *
 * The commentary in these files has to be free to name what it forbids — it
 * explains, with figures, why a typical line-item price may not be published.
 * A guard that could not tell a warning from a claim would force the
 * explanation out of the code, which is where it is most likely to be read by
 * the person about to make the change.
 */
function rendered(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');
}

const content = read(CONTENT);
const compare = read(COMPARE);
const page = read(PAGE);
const client = read(CLIENT);
const handlers = read(HANDLERS);

/* ── 1. the checklist items ─────────────────────────────────────────────── */
/**
 * A regex reader rather than an import: this file must run with no TypeScript
 * runtime and no build, like every other guard here. Its failure mode is
 * reading too few items, which shows up immediately as a count mismatch below.
 */
const items = [];
for (const block of content.split(/\n  \{\n/).slice(1)) {
  const id = /id: '([a-z0-9-]+)'/.exec(block)?.[1];
  if (!id) continue;
  items.push({
    id,
    basis: /basis: '(published|scope)'/.exec(block)?.[1],
    cite: /cite: ([A-Z_]+|'[^']+')/.exec(block)?.[1] ?? null,
    label: /label:\s*\n?\s*'([^']*)'/.exec(block)?.[1] ?? '',
    changesScope: /changesScope: (true|false)/.exec(block)?.[1],
  });
}

if (items.length < 15) {
  fail.push(
    `read only ${items.length} checklist item(s) from content/quote-check/scope-items.ts. ` +
      'Either the file shrank or its shape changed and this guard is now blind — fix the reader.',
  );
}

const ids = items.map((i) => i.id);
for (const id of new Set(ids)) {
  if (ids.filter((x) => x === id).length > 1) fail.push(`duplicate checklist id: ${id}`);
}
for (const i of items) {
  if (!i.basis) fail.push(`${i.id}: no basis — every item is 'published' or 'scope'`);
  if (!i.changesScope) fail.push(`${i.id}: changesScope not declared`);
  if (i.basis === 'published' && !i.cite) {
    fail.push(`${i.id}: basis 'published' with no cite. A published item names the page that published it.`);
  }
  if (i.basis === 'scope' && i.cite) {
    fail.push(
      `${i.id}: basis 'scope' carries a citation. A neutral scope line that cites a source is a claim ` +
        `wearing a disclaimer — either it is 'published', or the citation comes off.`,
    );
  }
}

/* ── 2. every citation resolves to a page this repository generates ──────── */
const consts = {};
for (const m of content.matchAll(/^const ([A-Z_]+) = '([^']+)';$/gm)) consts[m[1]] = m[2];

const slugsIn = (rel, into) => {
  const src = existsSync(join(WEB, rel)) ? readFileSync(join(WEB, rel), 'utf8') : '';
  for (const m of src.matchAll(/\bslug:\s*'([a-z0-9-]+)'/g)) into.add(m[1]);
};
const guides = new Set();
const papers = new Set();
slugsIn('lib/guides.ts', guides);
slugsIn('lib/papers.ts', papers);
if (!guides.size || !papers.size) {
  fail.push('could not read guide or paper slugs — this guard cannot check citations, fix the reader');
}

for (const i of items) {
  if (!i.cite) continue;
  const href = i.cite.startsWith("'") ? i.cite.slice(1, -1) : consts[i.cite];
  if (!href) {
    fail.push(`${i.id}: citation ${i.cite} is not a literal and not a constant in this file`);
    continue;
  }
  const g = /^\/guides\/([a-z0-9-]+)$/.exec(href);
  const p = /^\/papers\/([a-z0-9-]+)$/.exec(href);
  if (g) {
    if (!guides.has(g[1])) fail.push(`${i.id}: cites /guides/${g[1]}, which lib/guides.ts does not generate`);
  } else if (p) {
    if (!papers.has(p[1])) fail.push(`${i.id}: cites /papers/${p[1]}, which lib/papers.ts does not generate`);
  } else {
    fail.push(`${i.id}: citation "${href}" is not a /guides/ or /papers/ page`);
  }
}

/* ── 3. no price, no percentage, in anything the visitor reads ──────────── */
/**
 * The client component is exempt from the currency check for exactly one
 * construct: it formats the visitor's own arithmetic. Any dollar sign there
 * must be adjacent to an interpolation, never to a digit.
 */
const CURRENCY = /\$\s?\d/;
const PERCENT = /\b\d+(\.\d+)?\s?%/;
for (const [name, src] of [
  ['content/quote-check/scope-items.ts', rendered(content)],
  ['app/quote-check/page.tsx', rendered(page)],
]) {
  if (CURRENCY.test(src)) {
    fail.push(
      `${name}: contains a dollar figure. This tool prices nothing — a typical cost for a line item is a ` +
        'performance claim under Competition Act s.74.01(1)(b) with no adequate and proper testing behind it.',
    );
  }
  if (PERCENT.test(src)) fail.push(`${name}: contains a percentage figure. Same reason as the dollar figure.`);
}
for (const m of rendered(client).matchAll(/\$\s?\d/g)) {
  fail.push(
    `app/quote-check/QuoteCompare.tsx: literal currency "${m[0]}" at index ${m.index}. The only money this ` +
      'component may render is the visitor\'s own numbers, interpolated from state.',
  );
}

/* ── 4. no evaluative vocabulary about quotes or companies ──────────────── */
const BANNED = [
  'cheaper', 'cheapest', 'overpriced', 'underpriced', 'best quote', 'worst quote',
  'better quote', 'bad quote', 'good quote', 'rip-off', 'ripoff', 'scam', 'dishonest',
  'inferior', 'superior', 'recommend you accept', 'you should choose', 'winner',
];
for (const [name, src] of [
  ['content/quote-check/scope-items.ts', content],
  ['app/quote-check/page.tsx', page],
  ['app/quote-check/QuoteCompare.tsx', client],
  ['lib/quote-check/compare.ts', compare],
]) {
  const visible = rendered(src).toLowerCase();
  for (const word of BANNED) {
    if (visible.includes(word)) {
      fail.push(`${name}: renders "${word}". This page judges no quote and no company.`);
      break;
    }
  }
}

/* ── 5. the comparator exposes no pricing or ranking ────────────────────── */
for (const m of compare.matchAll(/export function ([A-Za-z0-9_]+)/g)) {
  if (/(price|cost|rank|score|estimate|recommend|best)/i.test(m[1])) {
    fail.push(
      `lib/quote-check/compare.ts exports ${m[1]}(). A function that prices, ranks or scores a quote is the ` +
        'one thing this tool must not do.',
    );
  }
}

/* ── 6. the API declares its refusals rather than leaving them inferred ─── */
if (!/handleQuoteCheck/.test(handlers)) {
  fail.push('lib/registry/handlers.ts has no handleQuoteCheck — /api/v1/quote-check is unserved');
} else {
  const block = handlers.slice(handlers.indexOf('export async function handleQuoteCheck'));
  const body = block.slice(0, block.indexOf('\nexport '));
  if (!/refuses:\s*\[/.test(body)) {
    fail.push(
      'handleQuoteCheck does not publish a `refuses` array. A consumer that cannot see what is deliberately ' +
        'absent will go and find a worse number somewhere else.',
    );
  }
  if (CURRENCY.test(rendered(body))) fail.push('handleQuoteCheck response contains a dollar figure');
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ quote-check: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}

const published = items.filter((i) => i.basis === 'published').length;
console.log(
  `✓ quote-check verified — ${items.length} scope item(s), ${published} citing a page this repository ` +
    `generates, no price, no percentage, no ranking, no judgement of any company`,
);
