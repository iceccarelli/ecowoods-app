#!/usr/bin/env node
/**
 * scripts/verify-services.mjs
 *
 * Fails when a service the schema graph identifies has no page, or when a page
 * exists for a service that is not published.
 *
 * WHY THIS EXISTS
 *
 * F-146. `lib/schema/builders.ts` has emitted, inside the LocalBusiness graph,
 * one `Service` node per entry in `SERVICES`, each carrying:
 *
 *     '@id': `${siteUrl}/services/${config.id}#service`
 *
 * since that file was written. There was no `/services` route. All six of those
 * identifiers resolved to a 404.
 *
 * An `@id` is not decoration. It is the string a crawler uses to decide that
 * the Service mentioned in the organisation graph and the Service described on
 * a page are the same entity. Pointing it at nothing asks Google to hang six
 * service entities off a URL that does not exist — on the site whose entire
 * strategy is being an entity that resolves cleanly.
 *
 * The footer was failing from the other side at the same time: seven links in
 * its Services column, every one of them `/#services`, an anchor on the
 * homepage. The highest-intent phrases this business could rank for had no URL.
 *
 * Both halves are one bug — the slug list and the route tree were never checked
 * against each other. This is that check.
 *
 * WHAT IT DOES
 *
 * 1. Every slug in SERVICES has an entry in SERVICE_PAGES, and vice versa. The
 *    schema `@id` is built from the SERVICES slug, so a SERVICE_PAGES entry
 *    under a different name is a page no identifier points at.
 * 2. The route files exist: app/services/page.tsx and app/services/[slug]/page.tsx.
 * 3. The detail route declares generateStaticParams, or the pages are not built.
 * 4. Nothing in the footer still points at /#services.
 * 5. The `@id` template in builders.ts still matches the route this guard
 *    checked — if someone changes it to /service/ or /offerings/, the six
 *    identifiers silently start 404ing again.
 *
 *   node scripts/verify-services.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const LIB = path.join(ROOT, 'apps/web/lib');

const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p) => strip(fs.readFileSync(p, 'utf8'));

const problems = [];

/* ── 1. slug parity ───────────────────────────────────────────────────────── */
const seo = read(path.join(LIB, 'seo-data.ts'));
const servicesBlock = seo.match(/export const SERVICES:[\s\S]*?\n\];/);
const published = servicesBlock ? [...servicesBlock[0].matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]) : [];

const pagesSrc = read(path.join(LIB, 'service-pages.ts'));
const pagesBlock = pagesSrc.match(/export const SERVICE_PAGES:[\s\S]*?\n\];/);
const paged = pagesBlock ? [...pagesBlock[0].matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]) : [];

if (published.length === 0) problems.push({ where: 'lib/seo-data.ts', detail: 'could not read SERVICES' });
if (paged.length === 0) problems.push({ where: 'lib/service-pages.ts', detail: 'could not read SERVICE_PAGES' });

for (const s of published) {
  if (!paged.includes(s)) {
    problems.push({
      where: `SERVICES '${s}'`,
      detail: `published as a service, and the schema emits /services/${s}#service for it, but there is no SERVICE_PAGES entry — that @id resolves to a 404`,
    });
  }
}
for (const s of paged) {
  if (!published.includes(s)) {
    problems.push({
      where: `SERVICE_PAGES '${s}'`,
      detail: 'has a page but is not in SERVICES — nothing in the schema graph identifies it, and the page carries no service description',
    });
  }
}

/* ── 2 & 3. the routes ────────────────────────────────────────────────────── */
const index = path.join(APP, 'services', 'page.tsx');
const detail = path.join(APP, 'services', '[slug]', 'page.tsx');
if (!fs.existsSync(index)) problems.push({ where: 'app/services/page.tsx', detail: 'missing — /services is a 404' });
if (!fs.existsSync(detail)) {
  problems.push({ where: 'app/services/[slug]/page.tsx', detail: 'missing — every /services/{slug} is a 404' });
} else if (!/generateStaticParams/.test(read(detail))) {
  problems.push({ where: 'app/services/[slug]/page.tsx', detail: 'no generateStaticParams — the pages are not prebuilt' });
}

/* ── 4. the footer ────────────────────────────────────────────────────────── */
const footer = read(path.join(APP, 'components', 'SiteFooter.tsx'));
const stale = (footer.match(/["'`]\/#services["'`]/g) || []).length;
if (stale > 0) {
  problems.push({
    where: 'app/components/SiteFooter.tsx',
    detail: `${stale} link(s) still point at /#services instead of a service page`,
  });
}

/* ── 5. the @id template ──────────────────────────────────────────────────── */
const builders = read(path.join(LIB, 'schema', 'builders.ts'));
if (!/\/services\/\$\{config\.id\}#service/.test(builders)) {
  problems.push({
    where: 'lib/schema/builders.ts',
    detail:
      'the Service @id template in buildService no longer resolves to /services/<slug>#service. ' +
      'This guard checks the route tree against that exact shape; change one without the other ' +
      'and six identifiers silently start 404ing again.',
  });
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) between the service slugs and the routes:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error('  An @id that does not resolve is worse than no @id: it asks a crawler to\n  identify an entity by a URL that is not there.\n');
  process.exit(1);
}

console.log(`✓ services verified — ${published.length} service(s), each with a page its schema @id resolves to`);
