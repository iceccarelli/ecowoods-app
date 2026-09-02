#!/usr/bin/env node
/**
 * scripts/verify-sliders.mjs
 *
 * Five checks, and four of them exist because the delivered archives already
 * contained the defect.
 *
 *  1. EVERY FRAME IS BUNDLED. A key with no static import in
 *     app/data/slider-images.ts is a broken image in production while every
 *     other check passes — audit/FINDINGS.md F-131, which has now happened
 *     twice. Both slider briefs specify public/ URLs, which 404 on this host.
 *
 *  2. A PAIR IS THE SAME SIZE. A comparison handle cannot track across two
 *     different pixel grids. `screen-recoat` shipped with a 1712x1152 before
 *     against a 1168x784 after and was still marked `slider-ready`, so the
 *     declaration cannot be trusted and the files are measured instead.
 *
 *  3. NO INVENTED CASE STUDY. `jobSlug` must name a .mdx that exists. Both
 *     briefs warn specifically against inventing /case-studies/richmond-hill-*,
 *     and pair 01 — the homepage slider — is exactly the one with no published
 *     job behind it.
 *
 *  4. ROUTES ARE REAL, AND ALLOWED. Every route named must exist, and none may
 *     be /papers, /glossary, /data, /framework, /library or /design: those
 *     pages win as engineering and a beauty slider on them cheapens the corpus.
 *
 *  5. NOTHING CLAIMS TO BE A PHOTOGRAPH. These are generated illustrations of
 *     kinds of work. lib/images.ts reserves `photograph` for a camera pointed
 *     at something real, and job-cards.ts left imageSlot empty on purpose so a
 *     generated floor would never sit beside a real measurement.
 *
 *   node scripts/verify-sliders.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REG = path.join(ROOT, 'apps/web/content/proof-sliders.ts');
const IMPORTS = path.join(ROOT, 'apps/web/app/data/slider-images.ts');
const APP = path.join(ROOT, 'apps/web/app');
const CASES = path.join(ROOT, 'apps/web/content/case-studies');

for (const [p, what] of [[REG, 'the registry'], [IMPORTS, 'the import map']]) {
  if (!fs.existsSync(p)) {
    console.error(`verify-sliders: ${path.relative(ROOT, p)} is missing (${what}).`);
    process.exit(2);
  }
}
const reg = fs.readFileSync(REG, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const imports = fs.readFileSync(IMPORTS, 'utf8');
const fail = [];

/* ── parse the registry ──────────────────────────────────────────────────── */
const plates = [];
for (const m of reg.matchAll(/^  (\w+): \{([\s\S]*?)^  \},/gm)) {
  const body = m[2];
  const g = (f) => (body.match(new RegExp(`\\b${f}:\\s*'([^']*)'`)) || [])[1];
  const routes = (body.match(/routes:\s*\[([\s\S]*?)\]/) || [])[1] ?? '';
  plates.push({
    key: m[1], id: g('id'), beforeKey: g('beforeKey'), afterKey: g('afterKey'),
    jobSlug: g('jobSlug'), source: g('source'),
    routes: [...routes.matchAll(/'([^']+)'/g)].map((r) => r[1]),
  });
}
if (!plates.length) {
  console.error('verify-sliders: read no plates out of the registry — the parser is blind. Fix the reader.');
  process.exit(2);
}

/* ── 1. every frame is statically imported ───────────────────────────────── */
for (const p of plates) {
  for (const k of [p.beforeKey, p.afterKey]) {
    if (!k) { fail.push(`${p.id}: missing a frame key`); continue; }
    if (!imports.includes(`'${k}': `)) {
      fail.push(
        `${p.id}: frame "${k}" has no static import in app/data/slider-images.ts.\n` +
          `      apps/web/public is not served on this deployment (F-131), so an un-imported\n` +
          `      frame is a broken image in production. Run: node scripts/gen-slider-imports.mjs`,
      );
    }
  }
}

/* ── 2. the two frames of a pair are the same size ───────────────────────── */
/** Minimal WebP header read — enough for VP8, VP8L and VP8X. */
function dims(file) {
  if (!fs.existsSync(file)) return null;
  const b = fs.readFileSync(file, { length: 40 });
  const tag = b.slice(12, 16).toString('ascii');
  if (tag === 'VP8X') return [(b.readUIntLE(24, 3) & 0xffffff) + 1, (b.readUIntLE(27, 3) & 0xffffff) + 1];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (tag === 'VP8L') {
    const n = b.readUInt32LE(21);
    return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1];
  }
  return null;
}
const DIRS = ['apps/web/public/images/sliders', 'apps/web/public/proof'];
const find = (key) => {
  for (const d of DIRS) {
    const f = path.join(ROOT, d, `${key}.webp`);
    if (fs.existsSync(f)) return f;
  }
  return null;
};
for (const p of plates) {
  const bf = find(p.beforeKey);
  const af = find(p.afterKey);
  if (!bf || !af) { fail.push(`${p.id}: a frame file is missing on disk (${p.beforeKey} / ${p.afterKey})`); continue; }
  const a = dims(bf), b = dims(af);
  if (!a || !b) { fail.push(`${p.id}: a frame is not a readable WebP`); continue; }
  if (a[0] !== b[0] || a[1] !== b[1]) {
    fail.push(
      `${p.id}: the two frames are ${a[0]}x${a[1]} and ${b[0]}x${b[1]}. A comparison handle ` +
        'cannot track across two different pixel grids. Fix: pnpm fix:sliderframes',
    );
  }
}

/* ── 3. no invented case study ───────────────────────────────────────────── */
for (const p of plates) {
  if (p.jobSlug && !fs.existsSync(path.join(CASES, `${p.jobSlug}.mdx`))) {
    fail.push(`${p.id}: jobSlug "${p.jobSlug}" has no case study. Do not invent one — omit the slug.`);
  }
}

/* ── 4. routes exist, and are allowed ────────────────────────────────────── */
const routes = new Set(['/']);
(function walk(dir, seg) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'components' || e.name === 'api' || e.name.startsWith('_')) continue;
      walk(path.join(dir, e.name), e.name.startsWith('(') ? seg : `${seg}/${e.name}`);
    } else if (e.name === 'page.tsx') routes.add(seg || '/');
  }
})(APP, '');
const dynamic = [...routes].filter((r) => r.includes('['))
  .map((r) => new RegExp('^' + r.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '$'));
const FORBIDDEN = ['/papers', '/glossary', '/data', '/framework', '/library', '/design'];
for (const p of plates) {
  for (const r of p.routes) {
    if (FORBIDDEN.some((f) => r === f || r.startsWith(`${f}/`))) {
      fail.push(`${p.id}: route "${r}" is off-limits for sliders — those pages win as engineering.`);
      continue;
    }
    if (!routes.has(r) && !dynamic.some((re) => re.test(r))) {
      fail.push(`${p.id}: route "${r}" does not exist.`);
    }
  }
}

/* ── 5. nothing claims to be a photograph ────────────────────────────────── */
if (/kind:\s*'photograph'/.test(reg)) {
  fail.push('the registry declares kind: photograph. These are generated illustrations — see lib/images.ts.');
}
{
  const jc = fs.readFileSync(path.join(ROOT, 'apps/web/content/job-cards.ts'), 'utf8');
  for (const m of jc.matchAll(/imageSlot:\s*'([^']*)'/g)) {
    if (/\/(proof|images\/sliders)\//.test(m[1])) {
      fail.push(
        `job-cards.ts sets imageSlot to "${m[1]}". That field is reserved for real job photography, ` +
          'and a public/ path is a 404 here anyway (F-131). Leave it empty until photographs exist.',
      );
    }
  }
}

if (fail.length) {
  console.error(`✗ sliders: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}
const bySrc = plates.reduce((a, p) => ((a[p.source] = (a[p.source] ?? 0) + 1), a), {});
console.log(
  `✓ sliders verified — ${plates.length} plate(s) ` +
    `(${bySrc['slider-pack'] ?? 0} from the slider packs, ${bySrc['proof-pack'] ?? 0} from the proof packs); ` +
    'every frame statically imported, every pair the same size, no invented case study, no forbidden route',
);
