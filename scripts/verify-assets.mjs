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
const TARGETS = [
  'apps/web/lib/schema/root-schema.ts',
  'apps/web/lib/schema/builders.ts',
  'apps/web/lib/structured-data.ts',
  'apps/web/lib/seo-data.ts',
  'apps/web/app/layout.tsx',
  'apps/web/app/manifest.ts',
  'apps/web/lib/ai.ts',
];

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
  const patterns = [
    /\$\{SITE_URL\}(\/[A-Za-z0-9._\/-]+)/g,
    /https:\/\/ecowoods\.ca(\/[A-Za-z0-9._\/-]+)/g,
    /['"`](\/[A-Za-z0-9._\/-]+\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|woff2?|mp4|webm))['"`]/gi,
  ];

  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const urlPath = m[1];
      if (!ASSET_EXT.test(urlPath)) continue;

      const where = `${rel}:${lineOf(src, m.index)}`;

      if (fs.existsSync(path.join(WEB_PUBLIC, urlPath.replace(/^\//, '')))) {
        problems.push({
          where,
          detail:
            `${urlPath} exists only in apps/web/public, which this deployment does not serve ` +
            `(F-131). It returns 404. Import the file instead — see lib/brand-assets.ts.`,
        });
        continue;
      }

      const how = resolves(urlPath);
      if (!how) {
        problems.push({
          where,
          detail: `${urlPath} does not exist anywhere that is served. This URL is a 404.`,
        });
      } else {
        ok.push(`${urlPath} → ${how}`);
      }
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
