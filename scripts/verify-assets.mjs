#!/usr/bin/env node
/**
 * scripts/verify-assets.mjs
 *
 * Fails when the site claims an asset URL that cannot be served.
 *
 * WHY THIS EXISTS
 *
 * F-162. The organisation's structured data declared:
 *
 *     logo:  https://ecowoods.ca/icon-512.png
 *     image: https://ecowoods.ca/og-image.jpg
 *
 * Both return 404. `icon-512.png` exists only in apps/web/public, which this
 * deployment has never served — established by measurement in F-131 and
 * asserted on every run of verify-live.sh. `og-image.jpg` does not exist
 * anywhere in the repository.
 *
 * Every structured-data validator in the world passes that markup, because a
 * validator asks whether a URL is well-formed, never whether it resolves. And
 * `logo` on the Organization node is what Google reads to put a brand mark on a
 * Knowledge Panel. A 404 there is not a smaller logo; it is no logo, on the
 * most important object the site emits, silently, for the life of the project.
 *
 * This is the fourth finding of one shape — F-131 (a directory never served),
 * F-138 (a key file at that path), F-144 (a sitemap URL that does not exist),
 * now this. The code was right every time. The path was wrong every time.
 *
 * WHAT IT DOES
 *
 * Scans the schema and metadata layer for absolute, site-relative asset URLs —
 * anything ending in an image, font, or document extension — and requires each
 * one to resolve somewhere that is actually served:
 *
 *   · the REPO-ROOT public/ directory, which is served (proven: /qr-app.jpg);
 *   · a Next metadata-file convention in apps/web/app (icon.png,
 *     apple-icon.png, opengraph-image.jpg, and friends);
 *   · a route handler at that path.
 *
 * And it fails outright on any reference into apps/web/public, which is served
 * by nothing.
 *
 * Assets reached by static import are not checked here and do not need to be:
 * an import of a missing file fails the build, which is the whole reason
 * lib/brand-assets.ts imports rather than hand-writes these two URLs.
 *
 *   node scripts/verify-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WEB = path.join(ROOT, 'apps/web');
const APP = path.join(WEB, 'app');

/* Where a URL path can legitimately come from. */
const ROOT_PUBLIC = path.join(ROOT, 'public');
const WEB_PUBLIC = path.join(WEB, 'public');

const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|woff2?|mp4|webm)$/i;

/* Files scanned. The schema and metadata layer — the surfaces that make claims
   a machine will follow without a human ever looking at the result. */
const TARGETS_DIRS = ['apps/web/lib/schema', 'apps/web/lib/graph'];
const TARGETS_FILES = [
  // The brand mark lives here. It was a base64 data URI until F-167 — an image
  // with no URL, which no crawler can index and this guard could not have
  // checked. Now it is a path, and a path is checkable.
  'apps/web/lib/brand.ts',
  'apps/web/lib/structured-data.ts',
  'apps/web/lib/seo-data.ts',
  'apps/web/lib/brand-assets.ts',
  'apps/web/app/layout.tsx',
  'apps/web/app/manifest.ts',
  'apps/web/lib/ai.ts',
];

/** Every .ts/.tsx under the schema directories, plus the named files. */
const collect = () => {
  const out = [...TARGETS_FILES];
  for (const d of TARGETS_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) out.push(path.relative(ROOT, p));
      }
    };
    walk(abs);
  }
  return [...new Set(out)];
};

const TARGETS = collect();

const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');

const lineOf = (src, i) => src.slice(0, i).split('\n').length;

const problems = [];
const ok = [];

/** Does this URL path resolve to something this host will serve? */
function resolves(urlPath) {
  const rel = urlPath.replace(/^\//, '').split('?')[0];

  // 1. repo-root public/ — served.
  if (fs.existsSync(path.join(ROOT_PUBLIC, rel))) return 'public/';

  // 2. a Next metadata file convention in app/.
  if (fs.existsSync(path.join(APP, rel))) return 'app/ (metadata convention)';

  // 3. a route handler serving that exact path.
  if (fs.existsSync(path.join(APP, rel, 'route.ts'))) return 'route handler';

  // 4. bundled output — never hand-written, always from an import.
  if (rel.startsWith('_next/')) return '_next (bundled)';

  return null;
}

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const src = strip(fs.readFileSync(abs, 'utf8'));

  // `${SITE_URL}/foo.png`, 'https://ecowoods.ca/foo.png', and bare '/foo.png'.
  /**
   * F-166. The first version matched `${SITE_URL}/…` by name. The bug it was
   * written to catch was spelled `${baseUrl}/icon-512.png`, so the guard passed
   * with "0 claimed URL(s)" while the deployed homepage served that exact 404.
   *
   * Any interpolation followed by a path is now matched, whatever the variable
   * is called. A guard that only recognises one spelling of the thing it
   * polices is a guard that reports clean and means nothing — the third time
   * that has been written in this repository (F-117, F-149, now this).
   */
  const patterns = [
    // `${anything}/path.ext` — any interpolated base, any variable name.
    /\$\{[A-Za-z0-9_.]+\}(\/[A-Za-z0-9._\/-]+)/g,
    /https:\/\/ecowoods\.ca(\/[A-Za-z0-9._\/-]+)/g,
    // A bare absolute path in any quote style.
    /['"`](\/[A-Za-z0-9._\/-]+\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|woff2?|mp4|webm))['"`]/gi,
  ];

  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const urlPath = m[1];
      if (!ASSET_EXT.test(urlPath)) continue;

      const where = `${rel}:${lineOf(src, m.index)}`;

      // Served location wins. The first version tested apps/web/public FIRST,
      // so a file present in BOTH — the served repo-root public/ and the
      // unserved apps/web/public/ — was reported as a 404 it demonstrably was
      // not. Ask "can this be served?" before "is it somewhere useless?".
      const how = resolves(urlPath);
      if (how) {
        ok.push(`${urlPath} → ${how}`);
        continue;
      }

      if (fs.existsSync(path.join(WEB_PUBLIC, urlPath.replace(/^\//, '')))) {
        problems.push({
          where,
          detail:
            `${urlPath} exists only in apps/web/public, which this deployment does not serve ` +
            `(F-131). It returns 404. Import the file instead — see lib/brand-assets.ts.`,
        });
        continue;
      }

      problems.push({
        where,
        detail: `${urlPath} does not exist anywhere that is served. This URL is a 404.`,
      });
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} asset URL(s) that cannot be served:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  A structured-data validator passes all of these: it checks that a URL is\n' +
      '  well-formed, never that it resolves. Nothing but a fetch can tell you.\n',
  );
  process.exit(1);
}

const unique = [...new Set(ok)];
console.log(`✓ assets verified — ${unique.length} claimed URL(s), all served: ${unique.join(', ') || 'none'}`);
