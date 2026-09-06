#!/usr/bin/env node
/**
 * scripts/verify-reviews.mjs — the twenty-fourth guard.
 *
 * WHY IT EXISTS
 *
 * This site cites a third-party review count. That is legitimate — a publication
 * quotes a statistic with its source — and it is one edit away from being the
 * thing this project has refused three times: a rating we did not collect,
 * presented as our own.
 *
 * Four rules keep the two apart, and all four are checkable:
 *
 *   1. No `aggregateRating` anywhere in the schema layer. Google's guidance is
 *      that reviews must not be aggregated from other websites and that a
 *      business rating itself is ineligible for the star feature. The repo has
 *      carried a ROOT_AGGREGATE_RATING marked "DO NOT WIRE THIS" for months;
 *      this makes that comment enforceable instead of advisory.
 *   2. Every figure lives in REVIEW_EVIDENCE and nowhere else. A count typed as
 *      a literal in a page or a caption is a number that will be wrong the next
 *      time someone leaves a review, and nothing will notice.
 *   3. `asOf` is a real past date. A figure dated in the future was not read off
 *      anything.
 *   4. Every `href` points at a specific profile, not a platform home page —
 *      the failure that PROFILE_LINKS was rewritten to end.
 *
 *   node scripts/verify-reviews.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONST = 'packages/shared/constants/index.ts';
const problems = [];
const fail = (m) => problems.push(m);

const src = fs.readFileSync(path.join(ROOT, CONST), 'utf8');

/* ── parse REVIEW_EVIDENCE ───────────────────────────────────────────────── */
const blockMatch = src.match(/export const REVIEW_EVIDENCE: ReviewEvidence\[\] = \[([\s\S]*?)\n\];/);
if (!blockMatch) fail(`${CONST} does not export REVIEW_EVIDENCE in the expected shape.`);

/**
 * A field may be a string literal — `href: 'https://…'` — or a reference into
 * another exported constant in the same file: `href: HOMESTARS_CANONICAL.reviewsUrl`,
 * `href: GOOGLE_PLACE.mapsUrl`. The second form is the better one (one URL,
 * one place) and it is what the constants module now uses; the first version
 * of this parser only read literals, so it reported both platforms as having no
 * href at all — a guard failing on the code it was written to approve.
 *
 * A reference is resolved by finding `export const IDENT = {` and reading
 * `prop: '…'` inside that block. An unresolvable reference resolves to nothing,
 * which fails rule 4 exactly as a missing literal would — the rule is not
 * relaxed, the parser just reads the file as written.
 */
const constBlock = (ident) =>
  (src.match(new RegExp(`export const ${ident}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`)) || [])[1];
const resolveRef = (b, k) => {
  const ref = b.match(new RegExp(`\\b${k}: ([A-Z][A-Z0-9_]*)\\.([A-Za-z_][A-Za-z0-9_]*)`));
  if (!ref) return undefined;
  const block = constBlock(ref[1]);
  if (!block) return undefined;
  return (block.match(new RegExp(`\\b${ref[2]}:\\s*'([^']*)'`)) || [])[1];
};

const entries = [];
for (const b of (blockMatch?.[1] ?? '').split(/\n  \{/).slice(1)) {
  const str = (k) => (b.match(new RegExp(`\\b${k}: '([^']*)'`)) || [])[1] ?? resolveRef(b, k);
  const num = (k) => {
    const m = b.match(new RegExp(`\\b${k}: ([0-9.]+)`));
    return m ? Number(m[1]) : undefined;
  };
  entries.push({
    platform: str('platform'),
    href: str('href'),
    rating: num('rating'),
    outOf: num('outOf'),
    count: num('count'),
    asOf: str('asOf'),
    latestReviewAt: str('latestReviewAt'),
  });
}
if (!entries.length) fail('REVIEW_EVIDENCE is empty — nothing to verify.');

const today = new Date().toISOString().slice(0, 10);
for (const e of entries) {
  const who = e.platform ?? '(unnamed)';
  for (const k of ['platform', 'href', 'asOf']) {
    if (!e[k]) fail(`REVIEW_EVIDENCE "${who}" is missing ${k}.`);
  }
  for (const k of ['rating', 'outOf', 'count']) {
    if (typeof e[k] !== 'number' || Number.isNaN(e[k])) fail(`REVIEW_EVIDENCE "${who}": ${k} is not a number.`);
  }
  if (e.rating > e.outOf) fail(`REVIEW_EVIDENCE "${who}": rating ${e.rating} exceeds outOf ${e.outOf}.`);
  if (e.asOf && e.asOf > today) {
    fail(
      `REVIEW_EVIDENCE "${who}": asOf is ${e.asOf}, which is in the future.\n` +
        `      asOf is the date a person opened the profile and read the figures. It cannot be\n` +
        `      a date that has not happened.`,
    );
  }
  if (e.latestReviewAt && e.asOf && e.latestReviewAt > e.asOf) {
    fail(`REVIEW_EVIDENCE "${who}": latestReviewAt ${e.latestReviewAt} is after asOf ${e.asOf}.`);
  }
  /* A profile URL, not a platform front door. */
  if (e.href && !/\/[^/]+\/[^/]+/.test(e.href.replace(/^https?:\/\/[^/]+/, ''))) {
    fail(
      `REVIEW_EVIDENCE "${who}": ${e.href} does not look like a specific profile.\n` +
        `      A link to a platform home page sends a prospect looking for proof to a front door.`,
    );
  }
}

/* ── rule 1: no aggregateRating in the schema layer ──────────────────────── */
{
  const dirs = ['apps/web/lib', 'apps/web/app'];
  const hits = [];
  const scan = (dir) => {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return;
    for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules') scan(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue;
      /* Type declarations are not emissions. `aggregateRating: AggregateRating`
         inside an interface describes a shape schema.org has; it does not put
         one on a page. Only an object literal does. */
      if (p.endsWith('lib/schema/types.ts')) continue;
      const body = fs.readFileSync(path.join(ROOT, p), 'utf8');
      /* Strip comments — the repo deliberately DISCUSSES aggregateRating in
         prose, and flagging our own explanation of why we do not use it is the
         F-58 / F-106 / F-163 mistake for the fourth time. */
      const code = body
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      body.split('\n').forEach((_, i) => void i);
      code.split('\n').forEach((line, i) => {
        if (/aggregateRating\s*:\s*\{/.test(line) && !/ROOT_AGGREGATE_RATING/.test(line)) {
          hits.push(`${p}:${i + 1}`);
        }
      });
    }
  };
  dirs.forEach(scan);
  if (hits.length) {
    fail(
      `aggregateRating is emitted in ${hits.length} place(s):\n` +
        hits.map((h) => `        ${h}`).join('\n') +
        `\n      Google: do not aggregate reviews or ratings from other websites, and a business\n` +
        `      rating itself is ineligible for the star feature. Cite the figure with a link and\n` +
        `      a date instead — see /reviews and docs/outreach/WHY_NO_AGGREGATE_RATING.md.`,
    );
  }
}

/* ── rule 2: the figures appear as literals nowhere else ─────────────────── */
{
  const numbers = [...new Set(entries.flatMap((e) => [e.count]).filter(Boolean))];
  const hits = [];
  const scan = (dir) => {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return;
    for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!['node_modules', '.next', 'dist'].includes(ent.name)) scan(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue;
      if (p.endsWith(CONST)) continue;
      const body = fs.readFileSync(path.join(ROOT, p), 'utf8');
      const code = body
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      code.split('\n').forEach((line, i) => {
        for (const n of numbers) {
          /* Only flag the number next to review language — bare integers are
             everywhere and flagging all of them would make this guard noise. */
          if (new RegExp(`\\b${n}\\b`).test(line) && /review/i.test(line)) {
            hits.push(`${p}:${i + 1}  ${line.trim().slice(0, 90)}`);
          }
        }
      });
    }
  };
  ['apps/web/lib', 'apps/web/app', 'packages'].forEach(scan);
  if (hits.length) {
    fail(
      `A review count is typed as a literal in ${hits.length} place(s):\n` +
        hits.map((h) => `        ${h}`).join('\n') +
        `\n      Interpolate from REVIEW_EVIDENCE. A typed count is wrong the next time someone\n` +
        `      leaves a review, and nothing here would notice.`,
    );
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} review problem(s):\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}
const e = entries[0];
console.log(
  `✓ reviews verified — ${entries.length} cited platform(s); ` +
    `${e.platform} ${e.count} at ${e.rating}/${e.outOf}, read ${e.asOf}; ` +
    `no aggregateRating emitted; no counts typed as literals`,
);
