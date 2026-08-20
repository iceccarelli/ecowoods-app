#!/usr/bin/env node
/**
 * scripts/verify-figures.mjs
 *
 * A figure must show the numbers the paper it cites actually publishes.
 *
 * WHY THIS IS STRICTER THAN THE OTHER PROVENANCE GUARDS
 *
 * verify-framework and verify-glossary check that a cited paper SECTION exists.
 * That is enough for prose, because prose restates and a human reviews the
 * restatement. It is not enough for a chart. A figure is the most shareable
 * artifact this site produces — it gets screenshotted into slide decks and
 * quoted in articles, detached from the page that explains it — and a bar drawn
 * at the wrong height is a confident, portable, wrong claim carrying this
 * business's name on it.
 *
 * So this extracts every numeric value from every figure and requires each one
 * to appear in the cited section of lib/papers.ts. If a paper's table is edited
 * and a figure is not, the build fails. That is the only relationship between
 * the two that can be trusted over time.
 *
 * It also enforces:
 *   · unique figure ids and unique, gapless figure numbers — "Figure 2" is a
 *     citation, and two of them, or a missing one, breaks every reference to it
 *   · axisMax >= every plotted value, or the chart silently clips a bar
 *   · ticks inside the axis, and sorted
 *   · a caption on every figure, since the caption is what travels with the
 *     screenshot
 *
 *   node scripts/verify-figures.mjs
 *   node scripts/verify-figures.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

for (const f of ['apps/web/lib/papers.ts', 'apps/web/lib/figures.ts']) {
  if (!exists(f)) {
    console.error(`verify-figures: ${f} not found — run from the repo root.`);
    process.exit(2);
  }
}

const papersSrc = read('apps/web/lib/papers.ts');
const figSrc = read('apps/web/lib/figures.ts');
const problems = [];
const fail = (m) => problems.push(m);

/* ── the text of every paper section, so numbers can be looked up in it ──── */
const sectionText = new Map(); // "slug#id" -> raw source of that section
for (const b of papersSrc.split(/\n  \{\n/).slice(1)) {
  const slug = (b.match(/\bslug: '([^']*)'/) || [])[1];
  if (!slug) continue;
  // Split the paper body on section boundaries and keep each chunk whole, so a
  // table's rows stay with the id that owns them.
  const parts = b.split(/\n      \{\n/);
  for (const p of parts) {
    const id = (p.match(/^\s*id: '([^']+)'/) || [])[1];
    if (id) sectionText.set(`${slug}#${id}`, p);
  }
}

/* ── parse figures ───────────────────────────────────────────────────────── */
const consts = new Map([...figSrc.matchAll(/const (P_[A-Z_]+) = '([^']+)';/g)].map((m) => [m[1], m[2]]));
const blocks = figSrc.split(/\n  \{\n/).slice(1);

const figures = blocks
  .map((b) => {
    const one = (k) => {
      const m = b.match(new RegExp(`\\b${k}:\\s*'([^']*)'`)) || b.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`));
      return m ? m[1] : undefined;
    };
    const num = (k) => {
      const m = b.match(new RegExp(`\\b${k}:\\s*(\\d+)`));
      return m ? Number(m[1]) : undefined;
    };
    const srcM = b.match(/source: \{\s*paper:\s*(P_[A-Z_]+|'[^']+'),\s*section:\s*'([^']+)'\s*\}/);
    const rawPaper = srcM ? srcM[1] : undefined;

    // Every plotted number, with the field it came from so the error can say.
    const values = [];
    for (const m of b.matchAll(/\bfrom:\s*(\d+)/g)) values.push(['from', Number(m[1])]);
    for (const m of b.matchAll(/\bto:\s*(\d+)/g)) values.push(['to', Number(m[1])]);
    for (const m of b.matchAll(/\bvalue:\s*(\d+)/g)) values.push(['value', Number(m[1])]);

    const ticksM = b.match(/axisTicks:\s*\[([^\]]*)\]/);
    const ticks = ticksM ? [...ticksM[1].matchAll(/(\d+)/g)].map((m) => Number(m[1])) : [];

    // A row flagged openEnded has an upper bound the source does not publish;
    // its `to` is a drawing decision, not a claim, and is exempt from the
    // number check. Capture which values those are.
    const openEndedTos = [];
    for (const m of b.matchAll(/from:\s*(\d+),\s*\n?\s*to:\s*(\d+),\s*\n?\s*openEnded: true/g)) {
      openEndedTos.push(Number(m[2]));
    }

    return {
      id: one('id'),
      number: num('number'),
      title: one('title'),
      caption: one('caption'),
      axisMax: num('axisMax'),
      ticks,
      values,
      openEndedTos,
      source: srcM
        ? { paper: rawPaper.startsWith("'") ? rawPaper.slice(1, -1) : consts.get(rawPaper), section: srcM[2] }
        : undefined,
    };
  })
  .filter((f) => f.id);

if (!figures.length) fail('No figures parsed out of lib/figures.ts — the file shape changed.');

/* ── checks ──────────────────────────────────────────────────────────────── */
const nums = figures.map((f) => f.number);
for (const f of figures) {
  if (!/^[a-z0-9-]+$/.test(f.id)) fail(`figure id is not url-safe: ${f.id}`);
  if (figures.filter((x) => x.id === f.id).length > 1) fail(`duplicate figure id: ${f.id}`);
  if (nums.filter((n) => n === f.number).length > 1) {
    fail(`two figures numbered ${f.number} — "Figure ${f.number}" is a citation and must resolve to one thing`);
  }
  if (!f.caption) fail(`${f.id}: no caption. The caption is what travels with a screenshot.`);
  if (!f.title) fail(`${f.id}: no title`);

  for (const [field, v] of f.values) {
    if (f.axisMax !== undefined && v > f.axisMax) {
      fail(`${f.id}: ${field}=${v} exceeds axisMax ${f.axisMax} — the chart would clip it silently`);
    }
  }
  for (const t of f.ticks) {
    if (f.axisMax !== undefined && t > f.axisMax) fail(`${f.id}: tick ${t} is beyond axisMax ${f.axisMax}`);
  }
  if (f.ticks.some((t, i) => i > 0 && t <= f.ticks[i - 1])) fail(`${f.id}: axisTicks are not ascending`);

  if (!f.source || !f.source.paper) {
    fail(`${f.id}: no source citation`);
    continue;
  }
  const key = `${f.source.paper}#${f.source.section}`;
  const text = sectionText.get(key);
  if (!text) {
    fail(`${f.id}: cites ${key}, which is not a section of any paper in lib/papers.ts`);
    continue;
  }
  // The number check. Values are matched with a digit boundary so 25 does not
  // match inside 250.
  for (const [field, v] of f.values) {
    if (f.openEndedTos.includes(v)) continue;
    if (!new RegExp(`(^|[^\\d.,])${v}([^\\d]|$)`).test(text)) {
      fail(
        `${f.id}: plots ${field}=${v}, which does not appear in ${key}.\n` +
          `      A figure must show the numbers its source publishes. Either the paper changed\n` +
          `      and this figure did not, or the figure invented a value.`,
      );
    }
  }
}
// Numbers must be 1..n with no gaps.
const sorted = [...nums].sort((a, b) => a - b);
sorted.forEach((n, i) => {
  if (n !== i + 1) fail(`figure numbers must run 1..${nums.length} with no gaps — found ${sorted.join(', ')}`);
});

/* ── derived surfaces ────────────────────────────────────────────────────── */
for (const [file, needle, why] of [
  ['apps/web/app/sitemap.ts', '/data', 'sitemap.ts does not emit /data'],
  ['apps/web/app/llms.txt/route.ts', '/data', '/llms.txt does not advertise the figures'],
  ['apps/web/app/api/knowledge/route.ts', 'getFigures', '/api/knowledge no longer serves the figures'],
]) {
  if (!exists(file)) fail(`missing file: ${file}`);
  else if (!read(file).includes(needle)) fail(why);
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (LIST) {
  console.log('\nFigures\n');
  for (const f of figures.sort((a, b) => a.number - b.number)) {
    console.log(`  Figure ${f.number}  ${f.title}`);
    console.log(`    /data#fig-${f.id}   ${f.values.length} values, source ${f.source?.paper}#${f.source?.section}\n`);
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} figure problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

const total = figures.reduce((n, f) => n + f.values.length, 0);
console.log(
  `✓ figures verified — ${figures.length} figure(s), ${total} plotted value(s), all present in their source papers`,
);
