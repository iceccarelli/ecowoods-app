#!/usr/bin/env node
/**
 * scripts/add-provenance-slots.mjs — register the provenance artwork.
 *
 * WHY THE MANIFEST AND THE ART HAVE TO ARRIVE TOGETHER
 *
 * lib/images.ts documents a `status: 'pending'` path for a slot whose file has
 * not landed yet. On this deployment that path does not work, and it is worth
 * writing down why so nobody rediscovers it the hard way.
 *
 * apps/web/public is NOT served here (F-131 — measured, not assumed). Every
 * illustration reaches the browser as a static import from
 * app/data/illustration-images.ts, and verify-images.mjs therefore requires an
 * import for EVERY manifest entry, whatever its status. That file is generated
 * from whatever .webp files exist on disk. So a pending slot with no file has no
 * import, and no import is a hard failure. `pending` is reachable only for a
 * slot whose file exists and is deliberately not shown — which is not this case.
 *
 * The sequencing that does work is the one this script performs:
 *
 *   1. the pages were wired first, naming ids the manifest does not yet carry.
 *      <Illustration> returns null for an unknown id, so those pages render
 *      today with no placeholder, no broken icon and no reserved space.
 *   2. the art lands in apps/web/public/illustrations/
 *   3. this script registers all seventeen slots and regenerates the imports
 *   4. every figure appears, in the right section, with no further edit
 *
 * WHERE THE ALT, CAPTION AND PROMPT COME FROM
 *
 * docs/illustrations/PROVENANCE_IMAGE_BRIEF.md — the brief the illustrator was
 * actually given. Parsing the brief rather than retyping it means the manifest
 * cannot describe a picture different from the one that was commissioned, and
 * the prompt stored as provenance is the prompt that was issued.
 *
 *   node scripts/add-provenance-slots.mjs --dry-run
 *   node scripts/add-provenance-slots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry-run');
const BRIEF = path.join(ROOT, 'docs/illustrations/PROVENANCE_IMAGE_BRIEF.md');
const MANIFEST = path.join(ROOT, 'apps/web/lib/images.ts');
const ART = path.join(ROOT, 'apps/web/public/illustrations');

/** Slot id → the page section that explains it. Checked by verify-images.mjs. */
const HREF = {
  'provenance-forest-to-floor': '/papers/where-toronto-hardwood-comes-from',
  'provenance-vertical-integration': '/papers/where-toronto-hardwood-comes-from#manufacturing',
  'provenance-log-breakdown': '/papers/where-toronto-hardwood-comes-from#chain',
  'provenance-kiln-moisture-journey': '/papers/where-toronto-hardwood-comes-from#why-provenance',
  'provenance-selection-system': '/papers/where-toronto-hardwood-comes-from#selection-system',
  'provenance-ontario-hardwood-zone': '/papers/where-toronto-hardwood-comes-from#ontario-forest',
  'provenance-growing-stock-species': '/papers/where-toronto-hardwood-comes-from#growing-stock',
  'provenance-ash-supply-inversion': '/papers/where-toronto-hardwood-comes-from#ash',
  'provenance-certification-chain': '/papers/where-toronto-hardwood-comes-from#certification',
  'provenance-what-you-should-receive': '/papers/where-toronto-hardwood-comes-from#what-to-ask',
  'grading-lumber-versus-flooring': '/papers/hardwood-grading-standards-nhla-nwfa',
  'grading-nhla-yield-ladder': '/papers/hardwood-grading-standards-nhla-nwfa#nhla-yield',
  'grading-flooring-character': '/papers/hardwood-grading-standards-nhla-nwfa#nwfa-appearance',
  'provenance-moisture-differential-gate': '/papers/hardwood-grading-standards-nhla-nwfa#moisture-at-manufacture',
  'provenance-sawn-face-macro': '/papers/hardwood-grading-standards-nhla-nwfa#dimensions',
  'provenance-wear-layer-budget': '/papers/hardwood-grading-standards-nhla-nwfa#engineered',
  'species-hardness-ladder': '/guides/red-oak-flooring-toronto',
};

/* ── read the brief ──────────────────────────────────────────────────────── */
if (!fs.existsSync(BRIEF)) {
  console.error(`add-provenance-slots: ${path.relative(ROOT, BRIEF)} not found.`);
  process.exit(2);
}
const brief = fs.readFileSync(BRIEF, 'utf8');

const SLOT_RE =
  /\*\*ID:\*\*\s*`([a-z0-9-]+)`\s*·\s*\*\*REGISTER ([AB])\*\*\s*\n\*\*ALT:\*\*\s*(.+)\n\*\*CAPTION:\*\*\s*(.+)\n\*\*PROMPT:\*\*\s*(.+)/g;

const slots = [...brief.matchAll(SLOT_RE)].map((m) => ({
  id: m[1],
  register: m[2],
  alt: m[3].trim(),
  caption: m[4].trim(),
  prompt: m[5].trim(),
}));

if (slots.length === 0) {
  console.error(
    '\n✗ add-provenance-slots: parsed ZERO slots out of the brief.\n\n' +
      '  This script reads the brief as text. Zero slots means its shape changed, and a\n' +
      '  guard that silently does nothing over a file it cannot read is the failure this\n' +
      '  repository has already shipped once. Failing instead.\n',
  );
  process.exit(1);
}

/* ── the art must exist, and nothing may be missing ──────────────────────── */
const missing = slots.filter((s) => !fs.existsSync(path.join(ART, `${s.id}.webp`)));
if (missing.length) {
  console.error(
    `\n✗ ${missing.length} of ${slots.length} slot(s) have no file in apps/web/public/illustrations:\n\n` +
      missing.map((s) => `    ${s.id}.webp`).join('\n') +
      '\n\n  public/ is not served on this deployment, so a manifest entry without a file is a\n' +
      '  broken image in production and a hard verify-images failure. Land the art first.\n',
  );
  process.exit(1);
}

const noHref = slots.filter((s) => !HREF[s.id]);
if (noHref.length) {
  console.error(
    `\n✗ no href recorded for: ${noHref.map((s) => s.id).join(', ')}\n` +
      '  Add it to the HREF table at the top of this script.\n',
  );
  process.exit(1);
}

/* ── real dimensions, read from the files themselves ─────────────────────── */
function webpSize(file) {
  const b = fs.readFileSync(file).subarray(0, 40);
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fmt = b.toString('ascii', 12, 16);
  if (fmt === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  if (fmt === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  if (fmt === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
for (const s of slots) {
  const size = webpSize(path.join(ART, `${s.id}.webp`));
  if (!size) {
    console.error(`\n✗ ${s.id}.webp is not a readable WebP. Re-export it.\n`);
    process.exit(1);
  }
  s.width = size[0];
  s.height = size[1];
}

/* ── splice into the manifest ────────────────────────────────────────────── */
let src = fs.readFileSync(MANIFEST, 'utf8');

/* Escape for a single-quoted TypeScript literal on ONE line. verify-images.mjs
   parses helper arguments with /'((?:[^'\\]|\\.)*)'/ — a backslash-escaped
   apostrophe is fine, a double-quoted string or a template literal is invisible
   to it, and an invisible entry is an unverified entry. */
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim();

const already = slots.filter((s) => new RegExp(`'${s.id}',`).test(src));
if (already.length === slots.length) {
  console.log(`✓ all ${slots.length} slot(s) are already registered — nothing to do.`);
  process.exit(0);
}
if (already.length) {
  console.error(
    `\n✗ ${already.length} slot(s) are already in the manifest and ${slots.length - already.length} are not.\n` +
      '  A partial registration means someone edited by hand. Resolve it there; this script\n' +
      '  will not write over a half-applied state.\n',
  );
  process.exit(1);
}

/* 1. HREFS */
{
  const m = src.match(/const HREFS: Record<string, string> = \{[\s\S]*?\n\};/);
  if (!m) throw new Error('add-provenance-slots: HREFS table not found.');
  const lines = slots.map((s) => `  '${s.id}': '${HREF[s.id]}',`).join('\n');
  src = src.replace(m[0], m[0].replace(/\n\};$/, `\n\n  /* Provenance and grading, ${slots.length} slots. */\n${lines}\n};`));
}

/* 2. DIMS — written for every slot, from the file, not from the brief. The
      preparation script re-borders each image, so the delivered canvas is not
      the final canvas and only the file knows its own size. */
{
  const m = src.match(/const DIMS: Record<string, \[number, number\]> = \{[\s\S]*?\n\};/);
  if (!m) throw new Error('add-provenance-slots: DIMS table not found.');
  const lines = slots.map((s) => `  '${s.id}': [${s.width}, ${s.height}],`).join('\n');
  src = src.replace(m[0], m[0].replace(/\n\};$/, `\n\n  /* Provenance and grading, measured from the delivered files. */\n${lines}\n};`));
}

/* 3. the slots themselves. Register A is a flat diagram — d(). Register B is a
      photorealistic render whose labels are drawn INTO the image — p(), which
      appends DETAIL_STYLE_SUFFIX and requires a caption of at least 40
      characters, because the caption is what a screen reader gets instead of
      the labels. */
{
  const entries = slots
    .map((s) => {
      const fn = s.register === 'B' ? 'p' : 'd';
      return (
        `  ${fn}(\n` +
        `    '${s.id}',\n` +
        `    '${q(s.alt)}',\n` +
        `    '${q(s.caption)}',\n` +
        `    '${q(s.prompt)}',\n` +
        `  ),`
      );
    })
    .join('\n');
  const header =
    `\n  /* ── provenance and grading ─────────────────────────────────── */\n` +
    `  /* Generated by scripts/add-provenance-slots.mjs from\n` +
    `     docs/illustrations/PROVENANCE_IMAGE_BRIEF.md. Alt, caption and prompt are the\n` +
    `     brief verbatim, so what the manifest describes is what was commissioned. */\n`;
  const anchor = '\n];\n\nexport const getImages';
  if (!src.includes(anchor)) throw new Error('add-provenance-slots: end of the IMAGES array not found.');
  src = src.replace(anchor, `\n${header}${entries}\n];\n\nexport const getImages`);
}

if (DRY) {
  console.log(`✓ dry run — ${slots.length} slot(s) parsed, all files present, nothing written.`);
  for (const s of slots) console.log(`    ${s.id.padEnd(40)} register ${s.register}  ${s.width}x${s.height}`);
  process.exit(0);
}

fs.writeFileSync(MANIFEST, src);
console.log(`✓ registered ${slots.length} slot(s) in apps/web/lib/images.ts`);
console.log('  next:  node scripts/gen-illustration-imports.mjs && node scripts/verify-images.mjs');
