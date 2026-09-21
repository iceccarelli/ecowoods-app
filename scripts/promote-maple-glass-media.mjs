#!/usr/bin/env node
/**
 * promote-maple-glass-media.mjs — take the Maple & Glass Residence campaign
 * out of the zips and put it where the web app can serve it.
 *
 * Modeled on scripts/promote-giorgia-media.mjs, adapted for this campaign's
 * different archive layout: one wide-still zip, one detail-still zip (no
 * per-chapter split — this job is one continuous walkthrough, not a
 * before/after), and a standalone root-level mp4 rather than an mp4 bundled
 * inside each chapter archive.
 *
 * WHAT STAYS OUT OF GIT: the 4K hero zips (01-*) and the 3:2 gallery zips
 * (02-*) are masters for print/social, not what a browser needs — the same
 * decision the giorgia promotion made for its FILM_WEB masters. Only the
 * web-1920 zips (03-*) are promoted, converted to webp. The thumbs zips
 * (04-*) are redundant with what sharp derives from the 1920 source and are
 * never read here. The copy/manifest zips (05-*) are read by the content
 * registry author, never promoted as zips.
 *
 *   node scripts/promote-maple-glass-media.mjs          # promote
 *   node scripts/promote-maple-glass-media.mjs --check  # report only, write nothing
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const SLUG = 'maple-glass-residence';
const OUT_STILLS = join(WEB, 'public/proof', SLUG);
const OUT_FILMS = join(WEB, 'public/films', SLUG);
const TMP = join(ROOT, '.maple-glass-tmp');
const CHECK = process.argv.includes('--check');

const WIDE_ZIP = '03-ecowoods-maple-glass-web-1920.zip';
const DETAIL_ZIP = '03-ecowoods-maple-glass-DETAILS-web-1920.zip';
const FILM_SRC = 'ecowoods-maple-glass-residence.mp4';
const FILM_OUT = '01-residence-walkthrough.mp4';

const ARCHIVES = [WIDE_ZIP, DETAIL_ZIP, FILM_SRC];
const missing = ARCHIVES.filter((f) => !existsSync(join(ROOT, f)));
if (missing.length) {
  console.error('✗ missing source(s) at the repository root:');
  for (const m of missing) console.error(`    ${m}`);
  console.error('\n  These are the source of every photograph and the film on /projects/maple-glass-residence.');
  console.error('  If they were already deleted, restore them from git history:');
  console.error(`    git show <sha>:${missing[0]} > ${missing[0]}`);
  process.exit(1);
}

if (CHECK) {
  console.log('✓ all campaign source(s) present:');
  for (const f of ARCHIVES) {
    console.log(`    ${f}  ${(statSync(join(ROOT, f)).size / 1e6).toFixed(1)} MB`);
  }
  process.exit(0);
}

const require_ = createRequire(join(WEB, 'package.json'));
let sharp;
try {
  sharp = require_('sharp');
} catch {
  console.error('✗ sharp is not resolvable. It is an apps/web dependency — run pnpm install first.');
  process.exit(2);
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const ch1Dir = join(OUT_STILLS, 'ch1');
const detailsDir = join(OUT_STILLS, 'details');
mkdirSync(ch1Dir, { recursive: true });
mkdirSync(detailsDir, { recursive: true });
mkdirSync(OUT_FILMS, { recursive: true });

execFileSync('unzip', ['-qo', join(ROOT, WIDE_ZIP), '-d', join(TMP, 'wide')]);
execFileSync('unzip', ['-qo', join(ROOT, DETAIL_ZIP), '-d', join(TMP, 'details')]);

const wideFiles = readdirSync(join(TMP, 'wide')).filter((n) => n.endsWith('.jpg')).sort();
const detailFiles = readdirSync(join(TMP, 'details')).filter((n) => n.endsWith('.jpg')).sort();

/* Filenames are `ecowoods-maple-glass-residence-NN-<stem>.jpg` for wide
   stills and `ecowoods-maple-glass-detail-NN-<stem>.jpg` for details. The
   copy pack's manifest.json confirms wide NN and detail NN are always the
   same source photograph (same original IMG_ file), so no reordering or
   fuzzy pairing is needed here — a straight NN-to-NN match. */
const parse = (prefix) => (name) => {
  const m = name.match(new RegExp(`^ecowoods-maple-glass-${prefix}-(\\d{2})-(.+)\\.jpg$`));
  if (!m) throw new Error(`unrecognized filename in ${prefix} archive: ${name}`);
  return { order: Number(m[1]), stem: m[2], name };
};
const wide = wideFiles.map(parse('residence'));
const details = detailFiles.map(parse('detail'));

if (wide.length !== 20 || details.length !== 20) {
  console.error(`✗ expected 20 wide + 20 detail stills, found ${wide.length} wide, ${details.length} detail.`);
  console.error('  Stopping rather than promoting a partial or mismatched set.');
  process.exit(1);
}
const wideOrders = new Set(wide.map((w) => w.order));
const missingPairs = details.filter((d) => !wideOrders.has(d.order));
if (missingPairs.length) {
  console.error('✗ detail still(s) with no matching wide still by number:');
  for (const d of missingPairs) console.error(`    ${d.name}`);
  process.exit(1);
}

let stills = 0;
let films = 0;
let bytesIn = 0;
let bytesOut = 0;
const manifestStills = [];
const manifestDetails = [];

for (const w of wide) {
  const src = join(TMP, 'wide', w.name);
  const outName = `${String(w.order).padStart(2, '0')}_${w.stem}.webp`;
  const out = join(ch1Dir, outName);
  bytesIn += statSync(src).size;
  const meta = await sharp(src).webp({ quality: 82 }).toFile(out);
  bytesOut += statSync(out).size;
  stills += 1;
  manifestStills.push({
    chapter: 1,
    file: `/proof/${SLUG}/ch1/${outName}`,
    order: w.order,
    stem: w.stem,
    width: meta.width,
    height: meta.height,
  });
}

for (const d of details) {
  const src = join(TMP, 'details', d.name);
  const outName = `${String(d.order).padStart(2, '0')}-${d.stem}.webp`;
  const out = join(detailsDir, outName);
  bytesIn += statSync(src).size;
  const meta = await sharp(src).webp({ quality: 82 }).toFile(out);
  bytesOut += statSync(out).size;
  stills += 1;
  manifestDetails.push({
    file: `/proof/${SLUG}/details/${outName}`,
    order: d.order,
    stem: d.stem,
    pairsWithStillId: `ch1-${String(d.order).padStart(2, '0')}`,
    width: meta.width,
    height: meta.height,
  });
}

const filmSrc = join(ROOT, FILM_SRC);
const filmOut = join(OUT_FILMS, FILM_OUT);
copyFileSync(filmSrc, filmOut);
bytesIn += statSync(filmSrc).size;
bytesOut += statSync(filmOut).size;
films += 1;

rmSync(TMP, { recursive: true, force: true });

writeFileSync(
  join(OUT_STILLS, 'MANIFEST.json'),
  JSON.stringify(
    {
      _comment:
        'Written by scripts/promote-maple-glass-media.mjs. The typed registry that the site actually renders from is apps/web/content/projects/maple-glass-residence.ts; this file exists so the promotion is auditable and so a missing plate is obvious.',
      generatedFrom: [WIDE_ZIP, DETAIL_ZIP, FILM_SRC],
      stills: manifestStills.sort((x, y) => x.order - y.order),
      details: manifestDetails.sort((x, y) => x.order - y.order),
      films: [
        {
          file: `/films/${SLUG}/${FILM_OUT}`,
        },
      ],
    },
    null,
    2,
  ) + '\n',
);

console.log(`✓ promoted ${stills} still(s) and ${films} film(s)`);
console.log(`  ${(bytesIn / 1e6).toFixed(1)} MB of source JPEG+MP4 → ${(bytesOut / 1e6).toFixed(1)} MB of WEBP+MP4`);
console.log(`  stills: apps/web/public/proof/${SLUG}/`);
console.log(`  films:  apps/web/public/films/${SLUG}/`);
console.log('');
console.log('  The 4K/gallery/thumbs archives and copy packs at the repository root are now');
console.log('  redundant once the registry + verify gates are green. Remove them:');
console.log(`    git rm 0*-ecowoods-maple-glass*.zip ${FILM_SRC}`);
