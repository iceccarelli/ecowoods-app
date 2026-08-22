#!/usr/bin/env node
/**
 * scripts/verify-schema.mjs
 *
 * Guards the surface this business presents to machines.
 *
 * WHY THIS EXISTS
 *
 * F-23 is the most serious thing this audit found. `public/ai.txt` was shipping
 *
 *     Authority Level: ⭐⭐⭐⭐⭐ Verified Specialist
 *     Total Word Count: 25,000+
 *     Years of Data: 27
 *     Installer certification (NWFA, IHSCA, etc. where applicable)
 *
 * — a self-awarded star rating and an invented trade certification, delivered
 * straight to the systems most likely to repeat them verbatim. `verify:facts`
 * was green the entire time, because its retired-claims list is a list of
 * literals and had never heard of those strings. A guard that only knows the
 * lies it has already been told cannot catch the next one.
 *
 * WHAT IT CHECKS
 *
 * 1. ONE FAQ SOURCE. The same four questions are currently answered differently
 *    depending on which page a crawler lands on: `/` says "HEPA-sealed Festool
 *    and Bona Atomic systems" and "No runaround."; the 16 service-area pages
 *    and /llms.txt say neither. No single page contradicts itself, so Google's
 *    FAQ rule is satisfied and nothing flagged it — but an answer engine that
 *    reads two Ecowoods pages gets two different answers from one business, and
 *    inconsistent self-description is what makes a model hedge instead of
 *    recommend. This finds every FAQ array in the repo and compares them.
 *
 * 2. FAQPage STAYS WHERE IT BELONGS. F-27: FAQPage was declared on all 67
 *    routes and twice on the homepage. Google requires the markup to sit on a
 *    page whose main content is that FAQ. Emitters are allowlisted here.
 *
 * 3. NO UNSOURCED NUMBERS IN MACHINE-FACING FILES. Any figure in the files
 *    written for crawlers must derive from `packages/shared/constants`, or be
 *    marked `(facts-allow)` deliberately. This is the rule that would have
 *    caught all four F-23 strings before they shipped.
 *
 * HOW IT BEHAVES
 *
 * A ratchet, not a wall — the same shape as verify-tokens.mjs. Divergences that
 * existed when this landed are recorded in `scripts/schema-baseline.json` and
 * pass; anything new fails; a baseline entry that no longer applies is reported
 * as removable so the baseline can only shrink.
 *
 * The FAQ divergence is baselined rather than fixed on purpose. Choosing which
 * wording survives means deciding whether Ecowoods names two supplier brands
 * across all 16 service-area pages and in /llms.txt. That is a positioning
 * call, it belongs to the owner, and it is DEFERRED.md Q5. The mechanism is
 * here; the sentence is his.
 *
 *   node scripts/verify-schema.mjs            check (used by pnpm verify)
 *   node scripts/verify-schema.mjs --list     show everything, baselined or not
 *   node scripts/verify-schema.mjs --update   rewrite the baseline deliberately
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = path.resolve('scripts/schema-baseline.json');
const LIST = process.argv.includes('--list');
const UPDATE = process.argv.includes('--update');

if (!fs.existsSync(path.join(ROOT, 'apps/web/app'))) {
  console.error('verify-schema: apps/web/app not found — run from the repo root.');
  process.exit(2);
}

/* ── file walk (no deps) ─────────────────────────────────────────────────── */
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
const FILES = [...walk(path.join(ROOT, 'apps/web')), ...walk(path.join(ROOT, 'packages'))];
const rel = (p) => path.relative(ROOT, p);

/* ── 1. one FAQ source ───────────────────────────────────────────────────── */
// Matches both `{ q: '…', a: '…' }` and the multi-line object form.
const FAQ_PAIR = /\bq:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*a:\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3/g;

const norm = (s) =>
  s
    .replace(/\\u2019/g, '\u2019')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** question -> [{ file, answer }] */
const answers = new Map();
for (const f of FILES) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/\bq:\s*['"`]/.test(src)) continue;
  for (const m of src.matchAll(FAQ_PAIR)) {
    const q = norm(m[2]);
    const a = norm(m[4]);
    if (!answers.has(q)) answers.set(q, []);
    answers.get(q).push({ file: rel(f), answer: a });
  }
}

const faqIssues = [];
for (const [q, list] of answers) {
  const distinct = [...new Set(list.map((x) => x.answer))];
  if (distinct.length < 2) continue;
  faqIssues.push({
    check: 'faq-divergence',
    key: q.slice(0, 90),
    detail: list.map((x) => x.file).join(' vs '),
    variants: distinct,
    files: [...new Set(list.map((x) => x.file))],
  });
}

/* ── 2. FAQPage emitter allowlist ────────────────────────────────────────── */
const FAQPAGE_ALLOWED = new Set([
  'apps/web/app/home-client.tsx',                 // the homepage FAQ it renders
  'apps/web/app/products/floorforge/page.tsx',    // that page's own FAQ
  'apps/web/app/service-areas/[city]/page.tsx',   // renders FAQ_ITEMS visibly
  // Renders its FAQ visibly, in the "questions this service turns on" section,
  // and — the reason it qualifies under F-27 rather than merely being added
  // here — the questions are not written for the schema block. Each one is the
  // `question` and `recommendation` of a decision guide already published at
  // /guides, shown on the page with a link back to it. The markup describes
  // content that is on the page and true elsewhere, which is the whole test.
  'apps/web/app/services/[slug]/page.tsx',
  'apps/web/lib/structured-data.ts',              // faqPageSchema() builder
  'apps/web/lib/schema/builders.ts',              // buildFAQPage() builder
  'apps/web/lib/schema/types.ts',                 // the type
  'apps/web/lib/schema/index.ts',                 // re-export
  'apps/web/lib/schema/components.tsx',           // re-export
  'apps/web/lib/schema/root-schema.ts',           // HOMEPAGE_FAQ_SCHEMA (not injected)
]);

/* Line-by-line, skipping comments: a file that only EXPLAINS why FAQPage is
   absent (app/layout.tsx does exactly that, and it is the fix for F-27) must
   not be reported as emitting it. Emission means the literal @type, or a call
   to one of the two builders. */
const EMITS = /(['"]@type['"]\s*:\s*['"]FAQPage['"])|\bfaqPageSchema\s*\(|\bbuildFAQPage\s*\(/;
const emitterIssues = [];
for (const f of FILES) {
  const r = rel(f);
  if (FAQPAGE_ALLOWED.has(r)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const hit = lines.findIndex((line) => {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    return EMITS.test(line);
  });
  if (hit === -1) continue;
  emitterIssues.push({
    check: 'faqpage-emitter',
    key: r,
    detail: `${r}:${hit + 1} — emits FAQPage from a file not on the allowlist`,
  });
}

/* ── 3. unsourced numbers in machine-facing files ────────────────────────── */
const MACHINE_FACING = [
  'apps/web/app/llms.txt/route.ts',
  'apps/web/app/ai.txt/route.ts',
  'apps/web/app/robots.ts',
  'apps/web/app/sitemap.ts',
  'apps/web/lib/structured-data.ts',
  'apps/web/lib/seo-data.ts',
  'apps/web/lib/schema/root-schema.ts',
  'apps/web/lib/schema/builders.ts',
];

/** A figure a crawler could quote as a claim about this business's AUTHORITY.
 *  Deliberately NOT service description — "1,000-1,500 sq ft" and "5 to 7
 *  working days" describe the job, not the company, and flagging them would
 *  bury the signal. This targets the F-23 shape: ratings, counts, tenure,
 *  volume, and percentages presented as measured. */
const CLAIM = /(⭐|\b\d[\d,.]*\s*%|\b\d[\d,.]*\s*(?:stars?|reviews?|ratings?|projects?|jobs?|homes?|clients?|customers?|words?)\b|\b\d+\+?\s*years?\s+(?:of|in)\b)/i;
/** Signals the figure is derived rather than asserted. */
const SOURCED = /\$\{|BUSINESS_NAP|BUSINESS_ADDRESS|yearsInBusiness|foundedYear|CITIES|SERVICES|PROFILE_LINKS|REVIEW_PROFILES|\(facts-allow\)/;

const numberIssues = [];
for (const r of MACHINE_FACING) {
  const p = path.join(ROOT, r);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (SOURCED.test(line)) return;
    const m = line.match(CLAIM);
    if (!m) return;
    numberIssues.push({
      check: 'unsourced-number',
      key: `${r}:${m[0].trim()}`,
      detail: `${r}:${i + 1}  ${t.slice(0, 110)}`,
    });
  });
}

/* ── baseline ────────────────────────────────────────────────────────────── */
const all = [...faqIssues, ...emitterIssues, ...numberIssues];
const keyOf = (x) => `${x.check}::${x.key}`;

let baseline = [];
if (fs.existsSync(BASELINE)) {
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).entries ?? [];
  } catch {
    console.error(`verify-schema: ${rel(BASELINE)} is not valid JSON.`);
    process.exit(2);
  }
}
const baseSet = new Set(baseline);

if (UPDATE) {
  const entries = [...new Set(all.map(keyOf))].sort();
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Machine-surface issues that existed when verify-schema landed. A ratchet: entries may be removed, never added silently. Regenerate with `node scripts/verify-schema.mjs --update` and say why in the commit.',
        entries,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`verify-schema: baseline rewritten — ${entries.length} entry(ies).`);
  process.exit(0);
}

if (LIST) {
  for (const x of all) {
    console.log(`${baseSet.has(keyOf(x)) ? 'baselined' : 'NEW      '}  ${x.check}  ${x.detail}`);
    for (const v of x.variants ?? []) console.log(`             · ${v.slice(0, 120)}`);
  }
}

const fresh = all.filter((x) => !baseSet.has(keyOf(x)));
const stale = baseline.filter((k) => !all.some((x) => keyOf(x) === k));

if (fresh.length) {
  console.error(`\n✗ ${fresh.length} new machine-surface issue(s).\n`);
  for (const x of fresh) {
    console.error(`  [${x.check}]  ${x.detail}`);
    for (const v of x.variants ?? []) console.error(`      · ${v.slice(0, 120)}`);
  }
  console.error(`
faq-divergence    the same question answered differently in two files. Pick one
                  source and import it; do not copy the array.
faqpage-emitter   FAQPage belongs only on a page whose main content IS that FAQ
                  (F-27). Add the file to FAQPAGE_ALLOWED only with a reason.
unsourced-number  a figure a crawler can quote must derive from
                  packages/shared/constants, or carry (facts-allow) because a
                  human confirmed it. See audit/FINDINGS.md F-23.
`);
  process.exit(1);
}

if (stale.length) {
  console.log(`\nverify-schema: ${stale.length} baseline entry(ies) no longer apply — run --update to shrink:`);
  for (const k of stale) console.log(`  ${k}`);
}

console.log(
  `✓ schema surface verified — ${answers.size} FAQ question(s) across ${FILES.length} file(s), ` +
    `${all.length} known issue(s), 0 new`
);
