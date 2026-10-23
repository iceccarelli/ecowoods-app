#!/usr/bin/env node
/**
 * scripts/verify-area-overlap.mjs — a ratchet on how much the published
 * service-area pages say the same thing.
 *
 * verify-cities.mjs guarantees every area HAS local copy and that no two
 * entries are near-duplicates. It does not look at the rest of what a page
 * says in its first screens — the opening answer is templated from registries
 * — and it only compares CITY_CONTENT entries to each other. This measures the
 * published pages' substantive copy, section by section, as one number a build
 * can hold steady. The metric is defined in scripts/lib/area-overlap.mjs.
 *
 * WHAT IT IS NOT. The committed baseline (scripts/area-overlap-baseline.json)
 * is a quality FLOOR measured from the content at the commit that added it. It
 * is not evidence that the pages are good, and a pass means "no worse", not
 * "differentiated enough". It falls only when real local copy is added.
 *
 *   node scripts/verify-area-overlap.mjs              # check against the baseline
 *   node scripts/verify-area-overlap.mjs --json       # machine-readable summary
 *   node scripts/verify-area-overlap.mjs --update     # ratchet DOWN to current (refuses to raise anything)
 *   node scripts/verify-area-overlap.mjs --rebaseline # write current unconditionally (metric change; review the diff)
 *
 * The page model below is built from the same functions the page calls
 * (apps/web/app/service-areas/[city]/page.tsx); a drift guard at the bottom
 * fails if the page stops calling one of them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { measure, compare, METRIC } from './lib/area-overlap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts/area-overlap-baseline.json');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);

/* Re-exec once with warnings off (Node notes every typeless .ts it strips) and,
   on Node 22.6–22.17, the flag that enables type stripping (default from 22.18). */
if (!process.execArgv.includes('--no-warnings')) {
  const flags = ['--no-warnings', ...(process.features.typescript ? [] : ['--experimental-strip-types'])];
  const r = spawnSync(process.execPath, [...flags, ...process.argv.slice(1)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
await import('./lib/ts-register.mjs');

const web = (p) => import(path.join(ROOT, 'apps/web', p));
const seo = await web('lib/seo-data.ts');
const open = await web('lib/opening-answers.ts');
const groups = await web('lib/area-groups.ts');
const svcPages = await web('lib/service-pages.ts');
const constants = await import(path.join(ROOT, 'packages/shared/constants/index.ts'));
const { PRICE_PROMISE } = await web('lib/pricing.ts');

const { SERVICE_AREAS, SERVICES, US_AREA_SLUGS, areaDisplayName, cityContent, faqItemsForArea } = seo;
const { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } = constants;

/* The placement sentence, as the page renders it (the <Link>s are text). */
function placementText(city) {
  const p = groups.areaPlacement(city.slug);
  if (!p) return '';
  const nb = p.neighbours.map((n) => areaDisplayName(n));
  const list = nb.length > 1 ? `${nb.slice(0, -1).join(', ')} and ${nb[nb.length - 1]}` : nb.join('');
  return (
    `${areaDisplayName(city)} is part of ${p.parent.page ? areaDisplayName(p.parent.page) : p.parent.name}` +
    `${nb.length ? ` and borders ${list}` : ''}.` +
    `${p.corridors.length ? ` Crews reach it on the ${p.corridors.map((c) => c.name).join(' and ')} ${p.corridors.length > 1 ? 'routes' : 'route'}, from the Etobicoke shop.` : ''}`
  );
}

/** Text every page legitimately shares — subtracted from local sections. */
function sharedSections(city) {
  const isUS = US_AREA_SLUGS.has(city.slug);
  const where = areaDisplayName(city);
  const country = isUS ? 'US' : 'CA';
  return [
    ['hero', `Ecowoods serves ${where}. Book the measure. ${isUS ? `The showroom is Toronto. The job is in ${where}. We take this work.` : ''} Dust-free sanding that keeps you living at home, and fixed written estimates with no unforeseen conditions. Book your free in-home estimate. See it in your room, priced in ${isUS ? 'US dollars' : 'Canadian dollars'}`],
    ['services', `What we do in ${where}. Every service, one crew. ${svcPages.SERVICE_PAGES.map((sp) => {
      const s = SERVICES.find((x) => x.slug === sp.slug);
      return `${s?.name ?? sp.h1}. ${s?.blurb ?? ''} ${svcPages.priceBandIn(sp, country) ?? ''}`;
    }).join(' ')}`],
    ['why', `Why ${where} homeowners choose Ecowoods. Fixed price. Dust-free. In writing. Fixed written estimates. Moisture-tested and inspected up front — the number on paper is the number on your invoice. Dust-free sanding. HEPA-sealed extraction at the machine and containment at the room, so most clients stay home during the work. Salaried craftsmen. No day-labour subcontractors — the same crew from first board to final coat. See the floors we install and the machines behind the finish.`],
    ['faq', `Common questions. Straight answers. ${faqItemsForArea(city.slug).map((f) => `${f.q} ${f.a}`).join(' ')}`],
    ['estimate', `Get a fixed written price in ${where}. A senior estimator measures, then writes one price. It does not move afterwards. Request an estimate in ${where}. Get your fixed-price estimate in ${where}. Also serving. Nearby. Read next.`],
    ['company', `${BUSINESS_NAP.legalName} ${BUSINESS_ADDRESS_LINE} ${BUSINESS_NAP.phoneDisplay} ${BUSINESS_NAP.email} ${HOURS_LINE} Serving ${where} from the Etobicoke shop — we come to you. ${PRICE_PROMISE} ${constants.yearsInBusiness ? `${constants.yearsInBusiness()} years` : ''}`],
  ].map(([id, text]) => ({ id, text, local: false }));
}

function pageModel(city) {
  const cc = cityContent(city.slug);
  const local = [
    ['opening', open.areaOpening(city)],
    ['intro', cc?.intro ?? ''],
    ['housing', cc?.housingNote ?? ''],
    ['neighbourhoods', (cc?.neighbourhoods ?? []).join(' · ')],
    ['consideration', cc?.localConsideration ?? ''],
    ['placement', placementText(city)],
  ].map(([id, text]) => ({ id, text, local: true }));
  return {
    slug: city.slug,
    names: [areaDisplayName(city), city.name].filter(Boolean),
    sections: [...local, ...sharedSections(city)],
  };
}

/* Drift guard: the model above mirrors these calls in the page template. */
const pageSrc = fs.readFileSync(path.join(ROOT, 'apps/web/app/service-areas/[city]/page.tsx'), 'utf8');
const drift = ['areaOpening(city)', 'cc?.intro', 'cc?.housingNote', 'cc.localConsideration', 'areaPlacement(city.slug)', 'faqItemsForArea(city.slug)']
  .filter((needle) => !pageSrc.includes(needle));

const result = measure(SERVICE_AREAS.map(pageModel));

if (flag('--full-body')) {
  /* Informational: treat every section — shared components included — as
     comparable, with nothing subtracted. This is the number a naive
     "how similar are the pages" tool reports; it is dominated by components
     every page is meant to share, which is why it is not the gate. */
  const full = measure(SERVICE_AREAS.map((c) => {
    const m = pageModel(c);
    return { ...m, sections: m.sections.map((s) => ({ ...s, local: true })) };
  }));
  console.log(JSON.stringify({ full_body_mean: full.mean, full_body_max: full.max }));
  process.exit(0);
}
const summary = {
  metric: result.metric,
  pages: result.pages,
  compared_pages: result.compared_pages,
  pairs: result.pairs,
  mean: result.mean,
  max: result.max,
  thin: result.thin,
  worst_by_page: result.worst_by_page,
};

if (flag('--rebaseline') || (flag('--update') && !fs.existsSync(BASELINE))) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`✓ wrote ${path.relative(ROOT, BASELINE)}: mean ${summary.mean}, max ${summary.max}, ${summary.thin.length} thin, ${summary.pages} pages`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

if (flag('--update')) {
  const problems = compare(result, baseline, 0);
  if (problems.length) {
    console.error('✗ --update only ratchets down; these values would rise:');
    for (const p of problems) console.error(`  · ${p.detail}`);
    process.exit(1);
  }
  fs.writeFileSync(BASELINE, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`✓ ratcheted: mean ${baseline.mean} → ${summary.mean}, max ${baseline.max} → ${summary.max}`);
  process.exit(0);
}

if (flag('--json')) {
  const { pairsOver, ...rest } = result;
  console.log(JSON.stringify({ baseline: { mean: baseline.mean, max: baseline.max, thin: baseline.thin }, current: { mean: rest.mean, max: rest.max, thin: rest.thin, pairs: rest.pairs, compared_pages: rest.compared_pages }, top_pairs: rest.top_pairs, drift }, null, 2));
  process.exit(0);
}

const problems = compare(result, baseline);
if (drift.length) problems.push({ kind: 'drift', detail: `page.tsx no longer contains ${drift.map((d) => `\`${d}\``).join(', ')}; update the page model in this script` });

if (problems.length) {
  console.error(`\n✗ service-area overlap regressed (metric v${METRIC.version}, ${result.compared_pages} pages, ${result.pairs} pairs)\n`);
  for (const p of problems) console.error(`  · ${p.detail}`);
  const offenders = result.pairsOver(Math.max(0, baseline.max));
  console.error('\n  highest-overlap pairs and the sections they share:');
  for (const p of (offenders.length ? offenders : result.top_pairs).slice(0, 8)) {
    console.error(`    ${p.a} ↔ ${p.b}  ${p.overlap}  [${p.sections.map((s) => `${s.section}:${s.shared_shingles}`).join(' ')}]`);
  }
  console.error('\n  The baseline is a floor, not a target. Fix it by writing real local copy; never by raising the baseline.\n');
  process.exit(1);
}

const better = result.mean < baseline.mean - 0.0005 || result.max < baseline.max - 0.0005;
console.log(
  `✓ area overlap holds — mean ${result.mean} (floor ${baseline.mean}), max ${result.max} (floor ${baseline.max}), ` +
    `${result.thin.length} thin, ${result.compared_pages} pages / ${result.pairs} pairs${better ? ' — improved: run with --update to lower the floor' : ''}`,
);
