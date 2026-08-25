#!/usr/bin/env node
/**
 * scripts/verify-pricing-source.mjs — one price, one file.
 *
 *   pnpm seo:pricing
 *
 * THE RULE
 *
 * Every published price band on this site lives in
 * apps/web/content/constants/pricing.ts. Nothing else may contain a decimal
 * price literal in a shape a customer could be shown.
 *
 * WHY THIS IS WORTH A BUILD FAILURE
 *
 * When this guard was written, the three bands were typed by hand in four
 * places besides the constants module:
 *
 *   lib/seo-data.ts     FAQ_ITEMS — emitted as FAQPage JSON-LD on EVERY page
 *   app/home-client.tsx the homepage FAQ, same answer, separately typed
 *   lib/guides.ts       the cost guide's price table
 *   lib/papers.ts       the selection-and-cost paper, also served as a PDF
 *
 * All four happened to agree on the day this ran. That is the dangerous state,
 * not the safe one: four copies that agree look exactly like one source of
 * truth right up to the moment someone changes one of them. And the surfaces
 * they feed are the worst possible place to find out — a price inside FAQPage
 * JSON-LD is read by Google and quoted back by answer engines as a fact about
 * this business, and a price inside a downloadable PDF is quoted for years.
 *
 * WHAT IS ALLOWED, AND WHY
 *
 * Worked examples in EDITORIAL content — a case study saying "this job came to
 * $6.20/sq ft" — are not the published band and must not be rewritten to
 * follow it. `.mdx` under content/ is therefore exempt. Documentation comments
 * that quote the format ("returns \"$11.00–$18.00 per sq ft\"") are exempt via
 * the same `pricing-allow` marker the other guards use.
 *
 * Everything under app/ and lib/ is code that renders to a customer, and is not
 * exempt from anything.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const SOURCE = 'apps/web/content/constants/pricing.ts';
const OPT_OUT = 'pricing-allow';

/** Code that renders to a customer. Zero tolerance. */
const ENFORCED = ['apps/web/app', 'apps/web/lib', 'packages/shared'];
/** Editorial. A worked example is legitimate here; reported, never failed. */
const ADVISORY = ['apps/web/content'];

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const ADVISORY_EXT = new Set(['.mdx', '.md']);
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);

/**
 * THREE SHAPES, AND THE FIRST VERSION OF THIS GUARD ONLY CAUGHT ONE.
 *
 * It matched `$4.75` and passed a clean run — while the live homepage carried
 * four hand-typed copies of the bands and one figure that was arithmetically
 * wrong, none of which look like `$4.75`:
 *
 *   `pricePerSqFt: '4.75–7.50'`   the $ and the unit are rendered as separate
 *                                 spans, so the literal has no dollar sign on it
 *   `$4,500–$7,000`               a worked total, comma-grouped, no cents — and
 *                                 the correct answer was $4,750–$7,500
 *
 * A guard that only sees one of the shapes a price can take reports the tree as
 * clean and is worse than no guard, because someone then trusts it. All three
 * are matched now.
 *
 * Still deliberately NOT matched: a bare `$13` or `$8`. An integer dollar figure
 * in prose is far more often a general amount than one of these bands, and a
 * guard that fires on every "$50 deposit" collects an allowlist entry per line
 * until it means nothing.
 */
const PRICE_SHAPES = [
  /** `$4.75`, `$ 11.00` — a rate with cents. */
  { re: /(?<![\w.])\$\s?\d{1,3}\.\d{2}(?![\d])/, what: 'a rate with cents' },
  /** `$4,500` — a comma-grouped total. Almost always a worked example. */
  { re: /(?<![\w.])\$\s?\d{1,3},\d{3}(?![\d])/, what: 'a comma-grouped dollar total' },
  /**
   * `'4.75–7.50'` — a bare decimal range in a string or JSX, no currency symbol
   * attached because the markup renders it separately. En dash, hyphen or the
   * word "to", because all three appear in this codebase.
   */
  { re: /['"`>]\s*\d{1,3}\.\d{2}\s*(?:–|—|-|to)\s*\d{1,3}\.\d{2}\s*['"`<]/, what: 'a bare decimal range' },
];
const matchesPrice = (line) => PRICE_SHAPES.find((s) => s.re.test(line));

/**
 * Reasoned exemptions, by file and by the text on the line.
 *
 * A `pricing-allow` marker is the normal escape hatch, but it does not work
 * inside a template literal that is itself shipped as content — writing
 * `pricing-allow` into RENOGUIDE_SYSTEM_PROMPT would put the marker in the
 * prompt the model reads. So that one exemption is recorded here instead,
 * where it is visible to anyone auditing this guard rather than buried in the
 * string it exempts.
 *
 * An entry needs a reason. "It was noisy" is not one.
 */
const ALLOWLIST = [
  {
    file: 'packages/shared/ai/index.ts',
    contains: 'Give a range as one sentence',
    why:
      'An illustration of SENTENCE SHAPE inside the RenoGuide system prompt — it teaches ' +
      'the model to write a range as prose rather than a table. It is not a published ' +
      'price and is never shown to anyone: every real figure RenoGuide states comes from ' +
      'the estimate_project tool, and the prompt\'s own HARD RULES forbid inventing one.',
  },
];

const allowed = (rel, line) =>
  ALLOWLIST.some((a) => rel === a.file && line.includes(a.contains));

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * In a SOURCE file a `//` or `*` line is a comment. It ships to nobody, and a
 * comment explaining why a figure was removed is documentation, not a
 * violation — but the first version of this scanner read it as one, so writing
 * down why a price was wrong failed the guard that found it. That is F-58 and
 * F-106 for the fourth time in this repository, and the fix is the same one
 * verify-business-facts.mjs already ships.
 *
 * Markdown and MDX are NOT stripped: there, a line beginning `//` or `*` is
 * something a reader sees.
 */
const isCode = (f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f);
const isComment = (line) => {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/');
};

const scan = (roots, exts) => {
  const hits = [];
  for (const r of roots) {
    for (const f of walk(join(ROOT, r))) {
      if (!exts.has(extname(f))) continue;
      const rel = relative(ROOT, f);
      if (rel === SOURCE) continue;
      const code = isCode(f);
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes(OPT_OUT)) return;
        if (allowed(rel, line)) return;
        if (code && isComment(line)) return;
        const shape = matchesPrice(line);
        if (shape) hits.push({ rel, line: i + 1, text: line.trim().slice(0, 130), what: shape.what });
      });
    }
  }
  return hits;
};

const violations = scan(ENFORCED, EXT);
const advisory = scan(ADVISORY, new Set([...EXT, ...ADVISORY_EXT]));

if (advisory.length) {
  console.log(`\n· ${advisory.length} price literal(s) in editorial content (advisory, not failed):`);
  for (const v of advisory.slice(0, 20)) console.log(`    ${v.rel}:${v.line}  ${v.text}`);
  if (advisory.length > 20) console.log(`    … and ${advisory.length - 20} more`);
}

if (violations.length === 0) {
  console.log(`\n✓ pricing source verified — every published band comes from ${SOURCE}\n`);
  process.exit(0);
}

console.error(`\n✗ ${violations.length} price literal(s) outside ${SOURCE}:\n`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}  (${v.what})`);
  console.error(`    ${v.text}\n`);
}
console.error(
  `Import the band and interpolate it:\n\n` +
    `    import { NEW_INSTALL, formatBandBare } from '@/content/constants/pricing';\n` +
    `    \`Installed runs \${formatBandBare(NEW_INSTALL)} per sq ft\`\n\n` +
    `If the figure is a worked example rather than the published band, move it into\n` +
    `editorial content, or mark the line \`${OPT_OUT}\` and say in the same comment why.\n`,
);
process.exit(1);
