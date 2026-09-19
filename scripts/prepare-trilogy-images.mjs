#!/usr/bin/env node
/**
 * scripts/prepare-trilogy-images.mjs
 *
 * One-time (but reusable) asset-prep step for the 20-trilogy photo set:
 * unzips the three phase deliveries at the repo root, converts the delivered
 * `-web.jpg` into the site's runtime format (WebP, via `sharp` — already a
 * project dependency, no new one added), and copies the branded master JPEG
 * alongside as the archive/source copy. Mirrors
 * scripts/gen-color-matching-imports.mjs's sibling,
 * scripts/gen-trilogy-imports.mjs, which then static-imports the WebP output
 * this script produces.
 *
 * WHY "PHASE" MEANS "FRAME NUMBER" HERE, NOT "DUPLICATE DELIVERY"
 *
 * Unlike the earlier colour-matching pack (six zips, two overlapping
 * packagings of the SAME 47 images), these three phases are NOT duplicates:
 * phase 1 (bare filenames, e.g. `01_homepage_hero.zip`) is frame 01 — the
 * room. `phase2_*.zip` is frame 02 — the approach, filenames prefixed `02-`.
 * `phase3_*.zip` is frame 03 — the fingertip, filenames prefixed `03-`. Every
 * trilogy's three frames are split across the three phase zips of its own
 * category, confirmed by inspecting each zip's actual file listing before
 * writing this table — do not assume it holds for a future delivery without
 * checking again.
 *
 * CANONICAL ON-DISK LAYOUT
 *
 *   apps/web/public/images/trilogies/<slug>/01.webp  (+ 01.jpg archive)
 *   apps/web/public/images/trilogies/<slug>/02.webp  (+ 02.jpg archive)
 *   apps/web/public/images/trilogies/<slug>/03.webp  (+ 03.jpg archive)
 *
 * "public/films/<slug>" WAS NOT USED FOR STAIRS. The brief that produced this
 * pack assumed apps/web/public/films/ was an existing convention for stair
 * image trilogies. It exists, but it holds .mp4 chapter videos for exactly
 * one real job (maple-vaughan-curved-stair) — a different medium for a
 * different content type. Reusing it for WebP stills would misuse an
 * established convention rather than extend it, so the four stair trilogies
 * live under the same trilogies/<slug>/ layout as every other trilogy.
 *
 *   node scripts/prepare-trilogy-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'apps/web/public/images/trilogies');
const WEBP_QUALITY = 82;

/** slug → [zip category number+name, source filename stem] */
const SLUGS = [
  ['salon-dark-oak-chandelier', '01_homepage_hero', 'hero-salon-dark-oak-chandelier'],
  ['salon-fireplace-continuous-floor', '01_homepage_hero', 'hero-salon-fireplace-continuous-floor'],
  ['geometric-parquet-french-doors', '01_homepage_hero', 'hero-geometric-parquet-french-doors'],
  ['floral-medallion-inlay', '02_custom_inlays', 'custom-floral-medallion-inlay'],
  ['geometric-border-parquet-study', '02_custom_inlays', 'custom-geometric-border-parquet-study'],
  ['library-chevron-wide-band-parquet', '02_custom_inlays', 'library-chevron-wide-band-parquet'],
  ['geometric-versailles-parquet-estate', '02_custom_inlays', 'geometric-versailles-parquet-estate'],
  ['curved-oak-iron-balustrade', '03_hardwood_stairs', 'stairs-curved-oak-iron-balustrade'],
  ['sculptural-handrail-curve', '03_hardwood_stairs', 'stairs-sculptural-handrail-curve'],
  ['foyer-oak-treads-iron', '03_hardwood_stairs', 'stairs-foyer-oak-treads-iron'],
  ['spiral-looking-down', '03_hardwood_stairs', 'stairs-spiral-looking-down'],
  ['dark-oak-plank-living', '04_residential_floors', 'residential-dark-oak-plank-living'],
  ['oak-hallway-closet-transition', '04_residential_floors', 'residential-oak-hallway-closet-transition'],
  ['herringbone-dormer-room', '04_residential_floors', 'residential-herringbone-dormer-room'],
  ['loft-kitchen-light-strip', '04_residential_floors', 'residential-loft-kitchen-light-strip'],
  ['rickis-store-maple-strip', '05_commercial', 'commercial-rickis-store-maple-strip'],
  ['rickis-storefront', '05_commercial', 'commercial-rickis-storefront'],
  ['geometric-inlay-borders', '06_craftsmanship_details', 'detail-geometric-inlay-borders'],
  ['herringbone-oak-border', '06_craftsmanship_details', 'detail-herringbone-oak-border'],
  ['paneled-oval-room-herringbone', '07_grand_rooms', 'grand-paneled-oval-room-herringbone'],
];

const FRAME_ZIP_PREFIX = { 1: '', 2: 'phase2_', 3: 'phase3_' };
const FRAME_FILE_PREFIX = { 1: '', 2: '02-', 3: '03-' };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trilogy-prep-'));
const extractedZips = new Set();

function extractZip(zipName) {
  if (extractedZips.has(zipName)) return;
  const zipPath = path.join(ROOT, zipName);
  if (!fs.existsSync(zipPath)) {
    console.error(`✗ missing zip: ${zipName}`);
    process.exit(2);
  }
  const dest = path.join(tmp, zipName.replace(/\.zip$/, ''));
  fs.mkdirSync(dest, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', dest]);
  extractedZips.add(zipName);
}

let converted = 0;
for (const [slug, category, stem] of SLUGS) {
  const outDir = path.join(OUT_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  for (const frame of [1, 2, 3]) {
    const zipName = `${FRAME_ZIP_PREFIX[frame]}${category}.zip`;
    extractZip(zipName);
    const filePrefix = FRAME_FILE_PREFIX[frame];
    const srcDir = path.join(tmp, zipName.replace(/\.zip$/, ''), category);
    const webSrc = path.join(srcDir, `${filePrefix}${stem}-web.jpg`);
    const masterSrc = path.join(srcDir, `${filePrefix}${stem}.jpg`);
    if (!fs.existsSync(webSrc) || !fs.existsSync(masterSrc)) {
      console.error(`✗ ${slug} frame ${frame}: expected files not found in ${zipName}`);
      console.error(`    ${webSrc}`);
      console.error(`    ${masterSrc}`);
      process.exit(2);
    }

    const frameNum = String(frame).padStart(2, '0');
    const webpOut = path.join(outDir, `${frameNum}.webp`);
    const jpgOut = path.join(outDir, `${frameNum}.jpg`);

    fs.copyFileSync(masterSrc, jpgOut);
    // eslint-disable-next-line no-await-in-loop -- sequential is fine; 60 small JPEGs, one-time script
    await sharp(webSrc).webp({ quality: WEBP_QUALITY }).toFile(webpOut);
    process.stdout.write(`  ${slug}/${frameNum}.webp + .jpg\n`);
    converted += 1;
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n✓ prepared ${converted} WebP frame(s) across ${SLUGS.length} trilogies → ${path.relative(ROOT, OUT_DIR)}`);
