#!/usr/bin/env node
/**
 * scripts/normalise-slider-frames.mjs
 *
 * Resizes the left frame of any slider pair whose two frames disagree in size,
 * because a comparison handle cannot track across two different pixel grids.
 *
 * One pair in the delivered archives needed it: `screen-recoat` shipped a
 * 1712x1152 before against a 1168x784 after, while declaring itself
 * `status: 'slider-ready'`. verify-sliders.mjs measures the files rather than
 * believing that field, and this is the fix it points at.
 *
 * It uses sharp, which Next already depends on - 0.34.5 is in node_modules
 * whether or not anyone installed it deliberately. An earlier version of this
 * step used Pillow and died with ModuleNotFoundError on a Codespace with no
 * Python imaging library, which is the wrong reason for an install to fail.
 *
 * Idempotent: a pair that already matches is left alone, so it is safe to run
 * after every unzip.
 *
 *   node scripts/normalise-slider-frames.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'));
let sharp;
try {
  sharp = require_('sharp');
} catch {
  console.error('normalise-slider-frames: sharp is not resolvable. It is a Next dependency - run pnpm install.');
  process.exit(2);
}

const DIRS = ['apps/web/public/images/sliders', 'apps/web/public/proof']
  .map((d) => path.join(ROOT, d))
  .filter((d) => fs.existsSync(d));

const pairs = new Map();
for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.*)-(before|during|after)\.(webp|jpg)$/);
    if (!m) continue;
    const key = dir + ' ' + m[1] + ' ' + m[3];
    const rec = pairs.get(key) ?? {};
    rec[m[2] === 'after' ? 'after' : 'left'] = path.join(dir, f);
    pairs.set(key, rec);
  }
}

let fixed = 0;
let checked = 0;
for (const [key, rec] of pairs) {
  if (!rec.left || !rec.after) continue;
  checked++;
  const [a, b] = await Promise.all([sharp(rec.left).metadata(), sharp(rec.after).metadata()]);
  if (a.width === b.width && a.height === b.height) continue;
  const ext = key.split(' ')[2];
  const pipeline = sharp(rec.left).resize(b.width, b.height, { fit: 'fill' });
  const buf = await (ext === 'webp'
    ? pipeline.webp({ quality: 88 })
    : pipeline.jpeg({ quality: 90 })
  ).toBuffer();
  fs.writeFileSync(rec.left, buf);
  console.log('  ' + path.basename(rec.left) + ': ' + a.width + 'x' + a.height + ' -> ' + b.width + 'x' + b.height);
  fixed++;
}
console.log(
  fixed
    ? '\u2713 normalised ' + fixed + ' frame(s) of ' + checked + ' pair(s) - re-run node scripts/verify-sliders.mjs'
    : '\u2713 ' + checked + ' pair(s) checked, every pair already matches',
);
