#!/usr/bin/env node
/**
 * scripts/verify-job-cards.mjs — the guard that lets a proof card restate a
 * measurement it does not own.
 *
 * THE PROBLEM IT SOLVES
 *
 * apps/web/content/job-cards.ts publishes five jobs — neighbourhood, size,
 * species, substrate, year, and one measured result each — on the homepage,
 * the service pages and the area pages. Every one of those figures already
 * exists in a case study .mdx, which is the document that actually proves it.
 *
 * A second copy of a number is a number that can drift, and this one drifts in
 * the worst direction available: the card is on the high-traffic page and the
 * case study is the page nobody re-reads, so the WRONG figure is the one most
 * people see and the RIGHT one sits three clicks away contradicting it. The
 * repository already refuses this pattern for prices (verify-pricing-source)
 * and for NAP (verify-claims). Proof is not a lesser category.
 *
 * So the rule is the same one: the card may restate the case study, and the
 * moment it stops agreeing with it, the build fails.
 *
 * WHAT IT CHECKS
 *
 *   1. Every card's `slug` is a published case study.
 *   2. area / city / squareFeet / year / substrate match that file's
 *      frontmatter exactly (year is derived from `project-date`).
 *   3. Every species named on the card appears in the file's `wood-species`.
 *   4. `measurement` matches `results[index]` — metric, value AND unit.
 *   5. `serviceSlug` resolves to a real page in lib/service-pages.ts.
 *   6. NO CARD CARRIES A PERSON. A `name`, `quote`, `testimonial`, `author` or
 *      `attribution` key is a build failure, not a review comment — see the
 *      note at the head of content/job-cards.ts. The case studies carry
 *      attributions this repository has no consent record for, and the whole
 *      point of the card is that everything on it is checkable.
 *
 *   node scripts/verify-job-cards.mjs
 *   node scripts/verify-job-cards.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CARDS = path.join(ROOT, 'apps/web/content/job-cards.ts');
const STUDIES = path.join(ROOT, 'apps/web/content/case-studies');
const SERVICE_PAGES = path.join(ROOT, 'apps/web/lib/service-pages.ts');
const LIST = process.argv.includes('--list');

if (!fs.existsSync(CARDS)) {
  console.error('✗ apps/web/content/job-cards.ts not found — run from the repo root.');
  process.exit(2);
}

const src = fs.readFileSync(CARDS, 'utf8');
const problems = [];

/* ── 6. no person on a card ───────────────────────────────────────────────── */
const body = src.slice(src.indexOf('export const JOB_CARDS'));
for (const banned of ['name:', 'quote:', 'testimonial:', 'author:', 'attribution:']) {
  // `serviceSlug`/`metric` etc. are fine; we look for the bare key at field depth.
  const re = new RegExp(`^\\s{4}${banned.replace(':', '')}\\s*:`, 'm');
  if (re.test(body)) {
    problems.push(
      `content/job-cards.ts carries a "${banned}" field.\n` +
        `      A proof card publishes measurements, not people. The case-study attributions\n` +
        `      have no consent record in this repository; putting one on the homepage is the\n` +
        `      one move you cannot walk back. Record the consent first.`,
    );
  }
}

/* ── parse the cards ──────────────────────────────────────────────────────── */
const arrayStart = src.indexOf('export const JOB_CARDS');
const arrayEnd = src.indexOf('\n];', arrayStart);
const arraySrc = src.slice(arrayStart, arrayEnd);
const chunks = arraySrc.split(/\n {2}\{\n/).slice(1);

const str = (chunk, key) => (chunk.match(new RegExp(`${key}:\\s*'([^']*)'`)) ?? [])[1];
const num = (chunk, key) => {
  const m = chunk.match(new RegExp(`${key}:\\s*([0-9.]+)`));
  return m ? Number(m[1]) : undefined;
};

const cards = chunks.map((c) => ({
  slug: str(c, 'slug'),
  area: str(c, 'area'),
  city: str(c, 'city'),
  squareFeet: num(c, 'squareFeet'),
  year: num(c, 'year'),
  serviceSlug: str(c, 'serviceSlug'),
  species: str(c, 'species'),
  substrate: str(c, 'substrate'),
  measurement: {
    index: num(c, 'index'),
    metric: str(c, 'metric'),
    value: num(c, 'value'),
    unit: str(c, 'unit'),
  },
}));

if (cards.length === 0) {
  console.error('✗ verify-job-cards: parsed zero cards — the JOB_CARDS literal shape changed.');
  process.exit(1);
}

/* ── the service slugs that exist ─────────────────────────────────────────── */
const servicePagesSrc = fs.existsSync(SERVICE_PAGES) ? fs.readFileSync(SERVICE_PAGES, 'utf8') : '';
const serviceSlugs = new Set([...servicePagesSrc.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));

/* ── frontmatter reader ───────────────────────────────────────────────────── */
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}
const scalar = (fm, key) => {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
const nested = (fm, parent, key) => {
  const block = fm.match(new RegExp(`^${parent}:\\n((?:\\s{2}.+\\n?)+)`, 'm'));
  if (!block) return undefined;
  const m = block[1].match(new RegExp(`^\\s{2}${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
/** The `results:` list, as [{metric, value, unit}] in file order. */
function results(fm) {
  const block = fm.match(/^results:\n((?:\s{2}.*\n?)+)/m);
  if (!block) return [];
  const out = [];
  // The block's first row has no leading newline; add one so every row splits alike.
  for (const item of `\n${block[1]}`.split(/\n\s{2}- /).slice(1)) {
    const metric = (item.match(/metric:\s*(.+)/) ?? [])[1]?.trim().replace(/^["']|["']$/g, '');
    const value = (item.match(/\n?\s*value:\s*([0-9.]+)/) ?? [])[1];
    const unit = (item.match(/\n?\s*unit:\s*(.+)/) ?? [])[1]?.trim().replace(/^["']|["']$/g, '');
    out.push({ metric, value: value === undefined ? undefined : Number(value), unit });
  }
  return out;
}
const speciesBlock = (fm) => {
  // `[ \t]` not `\s`: \s eats the newline and turns a YAML list into its first item.
  const single = fm.match(/^wood-species:[ \t]+(\S.*)$/m);
  if (single) return single[1];
  const list = fm.match(/^wood-species:\n((?:\s{2}- .+\n?)+)/m);
  return list ? list[1] : '';
};

/* ── check every card against its case study ──────────────────────────────── */
const rows = [];
for (const card of cards) {
  const where = `job-cards.ts "${card.slug}"`;
  const file = path.join(STUDIES, `${card.slug}.mdx`);
  if (!fs.existsSync(file)) {
    problems.push(`${where}\n      names a case study that does not exist: content/case-studies/${card.slug}.mdx`);
    continue;
  }
  const fm = frontmatter(file);

  const expect = (label, cardValue, fileValue) => {
    if (String(cardValue) !== String(fileValue)) {
      problems.push(
        `${where}\n      ${label}: card says "${cardValue}", the case study says "${fileValue}".\n` +
          `      The case study is the source. Change it there, or fix the card.`,
      );
    }
  };

  expect('area', card.area, nested(fm, 'location', 'neighbourhood'));
  expect('city', card.city, nested(fm, 'location', 'city'));
  expect('squareFeet', card.squareFeet, scalar(fm, 'square-footage'));
  expect('substrate', card.substrate, scalar(fm, 'substrate-type'));

  const projectDate = scalar(fm, 'project-date');
  const fileYear = projectDate ? new Date(projectDate).getUTCFullYear() : undefined;
  expect('year', card.year, fileYear);

  const species = speciesBlock(fm).toLowerCase();
  for (const s of (card.species ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!species.includes(s.toLowerCase())) {
      problems.push(
        `${where}\n      species "${s}" does not appear in the case study's wood-species.`,
      );
    }
  }

  const rs = results(fm);
  const row = rs[card.measurement.index];
  if (!row) {
    problems.push(
      `${where}\n      measurement.index ${card.measurement.index} — the case study publishes ${rs.length} result row(s).`,
    );
  } else {
    expect(`measurement.metric`, card.measurement.metric, row.metric);
    expect(`measurement.value`, card.measurement.value, row.value);
    expect(`measurement.unit`, card.measurement.unit, row.unit);
  }

  if (!serviceSlugs.has(card.serviceSlug)) {
    problems.push(
      `${where}\n      serviceSlug "${card.serviceSlug}" has no page in lib/service-pages.ts.`,
    );
  }

  rows.push(card);
}

if (LIST) {
  for (const c of rows) {
    console.log(
      `  ${c.area.padEnd(20)} ${String(c.squareFeet).padStart(5)} sqft  ${String(c.year)}  ` +
        `${c.serviceSlug.padEnd(22)} ${c.measurement.metric} = ${c.measurement.value} ${c.measurement.unit}`,
    );
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the job-card proof set:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✓ job cards verified — ${rows.length} card(s), every figure matching its case study; ` +
    `no card publishes a person`,
);
