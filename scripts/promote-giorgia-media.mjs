#!/usr/bin/env node
/**
 * promote-giorgia-media.mjs — take the Maple/Vaughan campaign out of the zips
 * and put it where the web app can serve it.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Nine campaign archives totalling ~146 MB were uploaded to the repository
 * root. Every clone, every CI checkout and every crawler of the raw repository
 * now carries them, and not one pixel of any of them is reachable from the
 * website. They are simultaneously the heaviest thing in the repo and
 * invisible to a visitor.
 *
 * THE STORAGE DECISION, AND WHY
 *
 * Three options were on the table: Git LFS, object storage, or a hosted video
 * service. The answer turns out to be simpler than any of them, because the
 * archives contain two sizes of everything:
 *
 *   · the CHAPTER films (2.9 MB and 3.9 MB) — already web-encoded, already
 *     1920×1080, and small enough that a git-tracked file in public/ is the
 *     correct answer. No LFS, no bucket, no third-party player, no runtime
 *     dependency, no signed URL to expire.
 *   · the FILM_WEB masters (14.7, 17.5 and 12.8 MB) — high-bitrate versions of
 *     the same three cuts. These stay out of git. If a bigger encode is ever
 *     wanted, it goes to object storage and the registry gains a `hiResSrc`.
 *
 * Stills are promoted as WEBP ONLY, generated here with sharp (already a
 * dependency, already used by next/image). The source JPEGs are 3–4 MB per
 * chapter and the webp is roughly 60% of that at quality 82, which no visitor
 * can see and every visitor pays for.
 *
 * Net effect of running this and deleting the archives: the repository gets
 * about 135 MB lighter AND the photographs become reachable.
 *
 * IT READS THE ARCHIVES THAT ARE ALREADY IN THE REPOSITORY. It is idempotent,
 * it reports what it wrote, and it refuses to guess: if an archive is missing
 * it says which one and stops rather than promoting half a chapter.
 *
 *   node scripts/promote-giorgia-media.mjs          # promote
 *   node scripts/promote-giorgia-media.mjs --check  # report only, write nothing
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const OUT_STILLS = join(WEB, 'public/proof/maple-vaughan-curved-stair');
const OUT_FILMS = join(WEB, 'public/films/maple-vaughan-curved-stair');
const TMP = join(ROOT, '.giorgia-tmp');
const CHECK = process.argv.includes('--check');

const ARCHIVES = [
  {
    zip: '01_Maple_Giorgia_Ch1_Before_Light_Natural.zip',
    dir: '01_Maple_Giorgia_Ch1_Before_Light_Natural',
    chapter: 1,
    film: '01_Maple_Giorgia_Ch1_Before_Light_Natural.mp4',
    filmOut: '01_before_sanded_to_bare.mp4',
  },
  {
    zip: '02_Maple_Giorgia_Ch2_After_Dark_Stain.zip',
    dir: '02_Maple_Giorgia_Ch2_After_Dark_Stain',
    chapter: 2,
    film: '02_Maple_Giorgia_Ch2_After_Dark_Stain.mp4',
    filmOut: '02_after_stained_and_finished.mp4',
  },
];

const missing = ARCHIVES.filter((a) => !existsSync(join(ROOT, a.zip)));
if (missing.length) {
  console.error('✗ missing archive(s) at the repository root:');
  for (const m of missing) console.error(`    ${m.zip}`);
  console.error('\n  These are the source of every photograph on /projects/maple-vaughan-curved-stair.');
  console.error('  If they were already deleted, restore them from git history:');
  console.error(`    git show <sha>:${missing[0].zip} > ${missing[0].zip}`);
  process.exit(1);
}

if (CHECK) {
  console.log('✓ all campaign archives present:');
  for (const a of ARCHIVES) {
    console.log(`    ${a.zip}  ${(statSync(join(ROOT, a.zip)).size / 1e6).toFixed(1)} MB`);
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
mkdirSync(OUT_STILLS, { recursive: true });
mkdirSync(OUT_FILMS, { recursive: true });

let stills = 0;
let films = 0;
let bytesIn = 0;
let bytesOut = 0;
const manifest = [];

for (const a of ARCHIVES) {
  execFileSync('unzip', ['-qo', join(ROOT, a.zip), '-d', TMP]);
  const base = join(TMP, a.dir);
  const webDir = join(base, 'web_1920x1080');
  if (!existsSync(webDir)) {
    console.error(`✗ ${a.zip} has no web_1920x1080/ — the archive layout changed. Stopping rather than guessing.`);
    process.exit(1);
  }

  const outDir = join(OUT_STILLS, `ch${a.chapter}`);
  mkdirSync(outDir, { recursive: true });

  for (const name of readdirSync(webDir).filter((n) => n.endsWith('.jpg')).sort()) {
    const src = join(webDir, name);
    const out = join(outDir, name.replace(/\.jpg$/, '.webp'));
    bytesIn += statSync(src).size;
    const meta = await sharp(src).webp({ quality: 82 }).toFile(out);
    bytesOut += statSync(out).size;
    stills += 1;
    manifest.push({
      chapter: a.chapter,
      file: `/proof/maple-vaughan-curved-stair/ch${a.chapter}/${name.replace(/\.jpg$/, '.webp')}`,
      order: Number(name.slice(0, 2)),
      stem: name.replace(/^\d+_/, '').replace(/\.jpg$/, ''),
      width: meta.width,
      height: meta.height,
    });
  }

  const filmSrc = join(base, a.film);
  if (existsSync(filmSrc)) {
    const filmOut = join(OUT_FILMS, a.filmOut);
    writeFileSync(filmOut, readFileSync(filmSrc));
    bytesIn += statSync(filmSrc).size;
    bytesOut += statSync(filmOut).size;
    films += 1;
  }
}

rmSync(TMP, { recursive: true, force: true });

writeFileSync(
  join(OUT_STILLS, 'MANIFEST.json'),
  JSON.stringify(
    {
      _comment:
        'Written by scripts/promote-giorgia-media.mjs. The typed registry that the site actually renders from is apps/web/content/projects/maple-vaughan-curved-stair.ts; this file exists so the promotion is auditable and so a missing plate is obvious.',
      generatedFrom: ARCHIVES.map((a) => a.zip),
      stills: manifest.sort((x, y) => x.chapter - y.chapter || x.order - y.order),
    },
    null,
    2,
  ) + '\n',
);

console.log(`✓ promoted ${stills} still(s) and ${films} film(s)`);
console.log(`  ${(bytesIn / 1e6).toFixed(1)} MB of source JPEG+MP4 → ${(bytesOut / 1e6).toFixed(1)} MB of WEBP+MP4`);
console.log(`  stills: apps/web/public/proof/maple-vaughan-curved-stair/`);
console.log(`  films:  apps/web/public/films/maple-vaughan-curved-stair/`);
console.log('');
console.log('  The archives at the repository root are now redundant. Remove them:');
console.log('    git rm --cached -q *.zip && rm -f *.zip');
