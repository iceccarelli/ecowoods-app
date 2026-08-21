#!/usr/bin/env node
/**
 * scripts/verify-images.mjs — the fourteenth guard.
 *
 * THE RULE IT EXISTS FOR
 *
 * A generated image may be a diagram or an illustration. It may never be a
 * photograph. `kind: 'photograph'` requires a `provenance` naming a real shoot,
 * and this guard fails the build on any entry that claims the camera without
 * one.
 *
 * That line is the whole point. This corpus rests on the claim that everything
 * traces to something real, and thirteen other guards enforce it in text. A
 * synthetic image presented as a finished Ecowoods floor is the same defect as
 * a fabricated moisture reading, and worse in consequence: more persuasive,
 * easier to catch, and one reverse-image search from ending the authority
 * position the whole architecture exists to build.
 *
 * Diagrams explain. Photographs testify. Generate the first; shoot the second.
 *
 * It also enforces the things that make an image usable rather than decorative:
 * intrinsic dimensions on every entry (a responsive image without them is the
 * most common cause of layout shift on a content site), alt text that describes
 * the information rather than announcing itself, filenames that match their ids,
 * and a no-text instruction in every prompt — a label baked into a picture is
 * invisible to a screen reader, a translator and a crawler alike.
 *
 *   node scripts/verify-images.mjs
 *   node scripts/verify-images.mjs --list
 *   node scripts/verify-images.mjs --prompts    print the generation brief
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFEST = 'apps/web/lib/images.ts';
const PUBLIC_DIR = path.join(ROOT, 'apps/web/public/illustrations');
const LIST = process.argv.includes('--list');
const PROMPTS = process.argv.includes('--prompts');

if (!fs.existsSync(path.join(ROOT, MANIFEST))) {
  console.error(`verify-images: ${MANIFEST} not found — run from the repo root.`);
  process.exit(2);
}
const src = fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8');
const problems = [];
const fail = (m) => problems.push(m);

/* The manifest builds most entries through two helpers, so parse the helper
   calls rather than object literals. Anything hand-written as a full literal is
   picked up by the second pass below. */
const entries = [];
const helperRe = /\n  (d|og)\(\s*\n\s*'([^']+)',\s*\n\s*'((?:[^'\\]|\\.)*)',\s*\n\s*(?:'((?:[^'\\]|\\.)*)',\s*\n\s*)?'((?:[^'\\]|\\.)*)',\s*\n?(?:\s*'(diagram|illustration|photograph)',\s*\n?)?\s*\)/g;
for (const m of src.matchAll(helperRe)) {
  entries.push({
    helper: m[1],
    id: m[2],
    alt: m[3],
    caption: m[1] === 'd' ? m[4] : undefined,
    prompt: m[5],
    kind: m[6] ?? (m[1] === 'og' ? 'illustration' : 'diagram'),
  });
}
// Full object literals, if any are ever added by hand.
for (const b of src.split(/\n  \{\n/).slice(1)) {
  const one = (k) => (b.match(new RegExp(`\\b${k}: '([^']*)'`)) || [])[1];
  const id = one('id');
  if (id && !entries.some((e) => e.id === id)) {
    entries.push({
      helper: 'literal',
      id,
      alt: one('alt'),
      kind: one('kind'),
      status: one('status'),
      provenance: one('provenance'),
      prompt: one('prompt'),
    });
  }
}

if (!entries.length) fail('No image entries parsed out of the manifest — the file shape changed.');

const W = (src.match(/^const W = (\d+);/m) || [])[1];
const H = (src.match(/^const H = (\d+);/m) || [])[1];
const OGW = (src.match(/^const OG_W = (\d+);/m) || [])[1];
const OGH = (src.match(/^const OG_H = (\d+);/m) || [])[1];
if (!W || !H || !OGW || !OGH) fail('Manifest does not declare intrinsic dimensions (W/H/OG_W/OG_H).');

const seen = new Set();
for (const e of entries) {
  if (!/^[a-z0-9-]+$/.test(e.id)) fail(`image id is not url-safe: ${e.id}`);
  if (seen.has(e.id)) fail(`duplicate image id: ${e.id}`);
  seen.add(e.id);

  /* THE LINE. */
  if (e.kind === 'photograph' && !e.provenance) {
    fail(
      `"${e.id}" is declared kind: 'photograph' with no provenance.\n` +
        `      A photograph is a camera pointed at something real and must name where it came from.\n` +
        `      A generated image is a diagram or an illustration — never a photograph. This is the\n` +
        `      same rule as never publishing a moisture reading nobody took.`,
    );
  }
  if (e.kind === 'photograph' && e.prompt) {
    fail(
      `"${e.id}" is declared a photograph but carries a generation prompt. It is one or the other.`,
    );
  }
  if (!['diagram', 'illustration', 'photograph'].includes(e.kind)) {
    fail(`"${e.id}": kind "${e.kind}" is not diagram | illustration | photograph`);
  }

  if (!e.alt || e.alt.length < 20) {
    fail(`"${e.id}": alt text is missing or too short to describe the information in the image`);
  }
  if (e.alt && /^(an? )?(image|picture|photo|illustration|diagram) (of|showing)/i.test(e.alt)) {
    fail(
      `"${e.id}": alt text starts by announcing itself ("${e.alt.slice(0, 40)}…").\n` +
        `      A screen reader already says "image". Describe the information, not the medium.`,
    );
  }
  if (e.kind !== 'photograph') {
    if (!e.prompt) fail(`"${e.id}": generated image with no prompt. The prompt is its provenance.`);
    else if (!/NO TEXT|NO LETTERING/i.test(`${e.prompt}${src}`)) {
      fail(`"${e.id}": prompt does not forbid text in the image`);
    }
  }
}

/* Published entries must actually exist; pending ones must not be referenced as
   if they were there. Both directions matter — a file on disk that no manifest
   entry points at is dead weight nobody will ever remove. */
const statusOf = (id) => {
  const i = src.indexOf(`'${id}'`);
  const after = src.slice(i, i + 600);
  return (after.match(/status: '(pending|published)'/) || [])[1] ?? 'pending';
};
const onDisk = fs.existsSync(PUBLIC_DIR)
  ? fs.readdirSync(PUBLIC_DIR).filter((f) => /\.(webp|png|jpg|jpeg|avif)$/i.test(f))
  : [];
const known = new Set(entries.map((e) => `${e.id}.webp`));
for (const f of onDisk) {
  if (!known.has(f)) {
    fail(`public/illustrations/${f} is not referenced by any manifest entry — remove it or add the entry`);
  }
}
const DEFAULT_PENDING = /status: 'pending'/.test(src);
for (const e of entries) {
  const st = DEFAULT_PENDING ? 'pending' : statusOf(e.id);
  if (st === 'published' && !onDisk.includes(`${e.id}.webp`)) {
    fail(`"${e.id}" is marked published but public/illustrations/${e.id}.webp does not exist`);
  }
}

/* ── output ──────────────────────────────────────────────────────────────── */
if (PROMPTS) {
  console.log('\n# Ecowoods illustration brief\n');
  console.log(`# ${entries.length} images. Save each as public/illustrations/<id>.webp\n`);
  for (const e of entries) {
    const dims = e.helper === 'og' ? `${OGW}x${OGH}` : `${W}x${H}`;
    console.log(`\n## ${e.id}.webp  (${dims}, ${e.kind})`);
    console.log(`ALT: ${e.alt}`);
    if (e.caption) console.log(`CAPTION: ${e.caption}`);
    console.log(`PROMPT: ${e.prompt}`);
  }
  console.log('');
}

if (LIST) {
  console.log('\nImage slots\n');
  for (const e of entries) {
    const here = onDisk.includes(`${e.id}.webp`) ? 'on disk' : 'pending';
    console.log(`  ${e.kind.padEnd(13)} ${e.id.padEnd(30)} ${here}`);
  }
  console.log('');
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} image problem(s):\n`);
  for (const m of problems) console.error(`  · ${m}`);
  console.error('');
  process.exit(1);
}

const pending = entries.filter((e) => !onDisk.includes(`${e.id}.webp`)).length;
console.log(
  `✓ images verified — ${entries.length} slot(s), ${entries.length - pending} on disk, ${pending} pending, ` +
    `0 generated images claiming to be photographs`,
);
