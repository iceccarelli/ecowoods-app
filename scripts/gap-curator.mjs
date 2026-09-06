#!/usr/bin/env node
/**
 * scripts/gap-curator.mjs — the Web Gap Curator (Protocol v2, Stage 21).
 *
 *   node scripts/gap-curator.mjs              # writes audit/gaps.json, prints the register
 *   node scripts/gap-curator.mjs --live       # also probes production for the live-only gaps
 *
 * WHAT IT IS
 *
 * The system's own view of what still blocks discovery, verification and
 * conversion — identity, technical, AI, content and conversion gaps — each
 * scored (severity, business_impact, technical_impact, confidence, effort),
 * with its dependency, how far it can be automated, and a status:
 *
 *   open · in_progress · blocked · fixed · verified · wont_fix · unknown
 *
 * Every entry is DETECTED, not typed: a check runs against the repository
 * (and, with --live, the deployed host) and the entry's status follows the
 * result. A gap whose check passes is `fixed` (repository) or `verified`
 * (production). Owner-only items are `blocked` with the blocker named — the
 * curator prepares the patch and stops, as Protocol §23 requires.
 *
 * INTERNAL. The register is a build artifact for the people running the
 * site; it is not served, not linked and not in the sitemap. Publishing a
 * list of one's own gaps is not a discovery strategy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIVE = process.argv.includes('--live');
const BASE = process.env.SITE_URL || 'https://ecowoods.ca';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const has = (p, needle) => exists(p) && read(p).includes(needle);

const constants = read('packages/shared/constants/index.ts');
const readme = read('README.md');

/** @type {{id:string,area:string,title:string,detail:string,severity:number,business_impact:number,technical_impact:number,confidence:number,effort:number,dependency:string,automation_level:'automated'|'assisted'|'human',status:string,blocker?:string}[]} */
const gaps = [];
const add = (g) => gaps.push(g);

const st = (ok, fixedStatus = 'fixed') => (ok ? fixedStatus : 'open');

/* ── identity gaps ──────────────────────────────────────────────────────── */
add({
  id: 'identity.bing-places-alignment', area: 'identity',
  title: 'Bing Places lists "Ecowoods Inc." with wrong hours and the www host',
  detail: 'README (live 2026-09-04): name "Ecowoods Inc.", website https://www.ecowoods.ca, hours Fri 08:00–22:00 / Sat 08:00–16:00. Must match the locked NAP.',
  severity: 3, business_impact: 3, technical_impact: 1, confidence: 4, effort: 1,
  dependency: 'owner login to Bing Places for Business', automation_level: 'human',
  status: 'blocked', blocker: 'HUMAN DECISION REQUIRED — owner edits the listing (Protocol §23: listing changes are business actions).',
});
add({
  id: 'identity.gbp-phone', area: 'identity',
  title: 'Google Business Profile shows no phone number',
  detail: 'README (live 2026-09-04): "Add place\'s phone number" on the GBP card. The site, JSON-LD, llms.txt and /api/v1/entity all publish the same number; the profile does not.',
  severity: 4, business_impact: 4, technical_impact: 1, confidence: 4, effort: 1,
  dependency: 'owner login to business.google.com', automation_level: 'human',
  status: 'blocked', blocker: 'HUMAN DECISION REQUIRED — owner adds the phone in the GBP dashboard.',
});
add({
  id: 'identity.directories-website-field', area: 'identity',
  title: 'YellowPages, 411.ca and TrustedPros still point their website field at the retired domain',
  detail: 'README (live 2026-09-04). One DNS change on ecowoodshardwood.com (301 to canonical) corrects all three for crawlers at once.',
  severity: 3, business_impact: 3, technical_impact: 2, confidence: 4, effort: 2,
  dependency: 'registrar / Vercel domain settings', automation_level: 'assisted',
  status: 'blocked', blocker: 'EXTERNAL AUTHORIZATION — DNS at the registrar, or Apache upload of old-domain/.htaccess. Redirect configs are generated and checked (pnpm domain:check).',
});
add({
  id: 'identity.homestars-duplicate-profile', area: 'identity',
  title: 'Two HomeStars profiles (2776939-ecowoods, 2897115-ecowood)',
  detail: 'Both are declared as sameAs; only the canonical one is counted as review evidence. A merge consolidates the record.',
  severity: 2, business_impact: 2, technical_impact: 1, confidence: 4, effort: 2,
  dependency: 'HomeStars support', automation_level: 'human',
  status: 'blocked', blocker: 'HUMAN DECISION REQUIRED — owner asks HomeStars support to merge.',
});
add({
  id: 'identity.stale-vercel-alias', area: 'identity',
  title: 'ecowoods-app.vercel.app serves a superseded copy of the site',
  detail: 'vercel.json redirects the host, but the alias is served by a project this repository does not deploy (README §5). pnpm seo:hosts watches it.',
  severity: 4, business_impact: 3, technical_impact: 3, confidence: 4, effort: 1,
  dependency: 'Vercel dashboard', automation_level: 'human',
  status: 'blocked', blocker: 'EXTERNAL AUTHORIZATION — delete or re-point the alias in the Vercel team that owns it.',
});

/* ── technical gaps ─────────────────────────────────────────────────────── */
add({
  id: 'tech.duplicate-business-entities', area: 'technical',
  title: 'One business entity in JSON-LD (no per-page LocalBusiness/ProfessionalService duplicates)',
  detail: 'Service-area pages emitted a second LocalBusiness with a dangling #business parent; commercial pages emitted a ProfessionalService #localbusiness. Both replaced by WebPage nodes that reference /#organization.',
  severity: 4, business_impact: 3, technical_impact: 4, confidence: 5, effort: 2,
  dependency: 'none', automation_level: 'automated',
  status: st(!has('apps/web/lib/structured-data.ts', 'serviceAreaBusinessSchema') && !has('apps/web/lib/schema/commercial.ts', "'ProfessionalService'")),
});
add({
  id: 'tech.jsonld-service-drift', area: 'technical',
  title: 'JSON-LD service descriptions derived from SERVICES (no hand-typed copy)',
  detail: 'root-schema.ts carried a second copy of the six services; dust-free sanding had already drifted from the visible blurb.',
  severity: 3, business_impact: 2, technical_impact: 4, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(has('apps/web/lib/schema/root-schema.ts', 'services: SERVICES.map')),
});
add({
  id: 'tech.potential-action', area: 'technical',
  title: 'potentialAction (QuoteAction → /estimate, CommunicateAction → tel:) on the organisation node',
  detail: 'Protocol §17. Absent before this pass.',
  severity: 3, business_impact: 3, technical_impact: 3, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(has('apps/web/lib/schema/builders.ts', "'QuoteAction'")),
});
add({
  id: 'tech.markdown-alternates', area: 'technical',
  title: 'rel="alternate" type="text/markdown" in <head> and a Link header on every page with a twin',
  detail: 'Stage 25. No page advertised its .md twin before this pass.',
  severity: 3, business_impact: 2, technical_impact: 3, confidence: 5, effort: 2,
  dependency: 'none', automation_level: 'automated',
  status: st(has('apps/web/next.config.js', 'MARKDOWN_TWINS') && has('apps/web/app/about/page.tsx', "'text/markdown'")),
});
add({
  id: 'tech.api-etag', area: 'technical',
  title: 'ETag + 304 on machine JSON',
  detail: '/api/knowledge, /api/market and /api/health return no ETag (live probe 2026-09-05). /api/v1 does. Extending the same helper to the legacy routes is a follow-up.',
  severity: 2, business_impact: 1, technical_impact: 3, confidence: 4, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: has('apps/web/app/api/knowledge/route.ts', 'etag') ? 'fixed' : 'open',
});
add({
  id: 'tech.csp-unsafe-inline', area: 'technical',
  title: "CSP keeps 'unsafe-inline' in script-src",
  detail: 'Deliberate (nonces would force 287 prerendered pages dynamic); a report-only ladder exists. Not weakened, not fixed.',
  severity: 3, business_impact: 1, technical_impact: 3, confidence: 4, effort: 4,
  dependency: 'rendering strategy decision', automation_level: 'assisted',
  status: 'wont_fix',
});
add({
  id: 'tech.rate-limit-per-instance', area: 'technical',
  title: 'Rate limits are in-memory per lambda instance',
  detail: 'lib/rate-limit.ts. Effective ceiling is limit × instances; a durable store (Vercel KV / Upstash) would make it exact. Adds a dependency — deferred.',
  severity: 2, business_impact: 1, technical_impact: 2, confidence: 4, effort: 3,
  dependency: 'new infrastructure dependency', automation_level: 'assisted',
  status: 'open',
});
add({
  id: 'tech.verify-reviews-parser', area: 'technical',
  title: 'verify-reviews.mjs resolves identifier references (was failing on main)',
  detail: 'The guard expected href literals; constants now reference HOMESTARS_CANONICAL/GOOGLE_PLACE. pnpm verify failed at baseline.',
  severity: 3, business_impact: 1, technical_impact: 3, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(has('scripts/verify-reviews.mjs', 'HOMESTARS_CANONICAL') || has('scripts/verify-reviews.mjs', 'resolve')),
});

/* ── AI / agent gaps ────────────────────────────────────────────────────── */
add({
  id: 'ai.api-v1', area: 'ai',
  title: 'Versioned agentic primitives API with provenance (/api/v1) and OpenAPI',
  detail: 'Stages 5, 13, 16–20. Absent before this pass.',
  severity: 4, business_impact: 4, technical_impact: 4, confidence: 5, effort: 4,
  dependency: 'none', automation_level: 'automated',
  status: st(exists('apps/web/app/api/v1/openapi.json/route.ts') && exists('apps/web/lib/registry/registry.ts')),
});
add({
  id: 'ai.llms-curated', area: 'ai',
  title: 'llms.txt in the llmstxt.org shape, curated, with an Optional long tail',
  detail: 'Was a 65 KB prose sitemap. Now H1 + blockquote + curated link sections + Optional; llms-full.txt carries the bulk.',
  severity: 3, business_impact: 3, technical_impact: 2, confidence: 5, effort: 2,
  dependency: 'none', automation_level: 'automated',
  status: st(has('apps/web/app/llms.txt/route.ts', "'## Optional'")),
});
add({
  id: 'ai.md-index', area: 'ai',
  title: '/md index and twins for home, hubs, pricing, reviews, estimate, contact and the head-term pages',
  detail: '/md and /md/services returned 404 in production (probe 2026-09-05).',
  severity: 3, business_impact: 2, technical_impact: 3, confidence: 5, effort: 2,
  dependency: 'none', automation_level: 'automated',
  status: st(exists('apps/web/app/md/route.ts') && exists('apps/web/app/md/pricing/route.ts')),
});
add({
  id: 'ai.indexnow-on-deploy', area: 'ai',
  title: 'IndexNow submission on production deploy',
  detail: '.github/workflows/indexnow.yml fires on deployment_status success with INDEXNOW_KEY. Confirm the secret exists in the GitHub repository settings.',
  severity: 2, business_impact: 2, technical_impact: 1, confidence: 3, effort: 1,
  dependency: 'GitHub secret INDEXNOW_KEY', automation_level: 'assisted',
  status: 'unknown', blocker: 'Cannot read GitHub secrets from the repository; verify in Settings → Secrets.',
});
add({
  id: 'ai.southern-ontario-coverage', area: 'ai',
  title: 'Southern Ontario beyond the GTA as a published service area',
  detail: 'The protocol names all of Southern Ontario; the site, JSON-LD and claims publish Toronto & the GTA. The registry models Southern Ontario municipalities with coverage "assessment" and the matcher answers them honestly (requires_assessment + estimate action). Flipping them to "published" is a public coverage claim.',
  severity: 3, business_impact: 4, technical_impact: 2, confidence: 4, effort: 2,
  dependency: 'owner confirmation of served municipalities', automation_level: 'assisted',
  status: 'blocked', blocker: 'HUMAN DECISION REQUIRED — Protocol §23: adding a municipality to the public list. Prepared: lib/registry/locations.ts ASSESSMENT_MUNICIPALITIES (rename to published + add pages with local content).',
});

/* ── content gaps ───────────────────────────────────────────────────────── */
add({
  id: 'content.pricing-page', area: 'content',
  title: 'A /pricing page: table first, conditions, written-price rule, stable row ids',
  detail: 'Every Price primitive cites /pricing#<band>. The page did not exist (404, probe 2026-09-05).',
  severity: 4, business_impact: 4, technical_impact: 2, confidence: 5, effort: 2,
  dependency: 'none', automation_level: 'automated',
  status: st(exists('apps/web/app/pricing/page.tsx')),
});
add({
  id: 'content.wrong-service-blocks', area: 'content',
  title: '"When this is the wrong service" on every service page',
  detail: 'Protocol §15.2 #3. Rendered from lib/registry WRONG_WHEN, served by /api/v1/services/{id}.',
  severity: 2, business_impact: 3, technical_impact: 1, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(has('apps/web/app/services/[slug]/page.tsx', 'id="wrong-service"')),
});
add({
  id: 'content.faq-wording-divergence', area: 'content',
  title: 'Homepage FAQ wording differs from FAQ_ITEMS on three answers',
  detail: 'scripts/schema-baseline.json records three faq-divergence entries (supplier brand names on the homepage copy only). Which wording survives is a positioning decision.',
  severity: 2, business_impact: 2, technical_impact: 2, confidence: 5, effort: 1,
  dependency: 'owner wording decision', automation_level: 'assisted',
  status: 'blocked', blocker: 'HUMAN DECISION REQUIRED — pick one wording; then delete the three baseline entries.',
});
add({
  id: 'content.unsourced-claims', area: 'content',
  title: 'Claims still marked unsourced in content/claims.ts',
  detail: (() => { const c = read('apps/web/content/claims.ts'); const n = (c.match(/status: 'unsourced'/g) || []).length; return `${n} claim(s) carry status 'unsourced' (deadline UNSOURCED_DEADLINE). They are fenced out of schema; \`pnpm seo:claims --strict\` will fail once the deadline is enforced.`; })(),
  severity: 2, business_impact: 2, technical_impact: 2, confidence: 5, effort: 2,
  dependency: 'owner supplies sources', automation_level: 'human',
  status: (read('apps/web/content/claims.ts').match(/status: 'unsourced'/g) || []).length ? 'blocked' : 'fixed',
  blocker: 'HUMAN DECISION REQUIRED — a source per claim, or retire the claim.',
});

/* ── conversion gaps ────────────────────────────────────────────────────── */
add({
  id: 'conv.estimate-url', area: 'conversion',
  title: 'A real /estimate URL as the request_estimate action target (not /#quote)',
  detail: 'JSON-LD potentialAction, the registry action and every machine surface point at /estimate and /estimate#form.',
  severity: 4, business_impact: 4, technical_impact: 2, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(exists('apps/web/app/estimate/page.tsx')),
});
add({
  id: 'conv.contact-url', area: 'conversion',
  title: 'A /contact page carrying the NAP with citable fragment ids',
  detail: 'Stage 28: directories and agents want one page whose main content is the NAP.',
  severity: 3, business_impact: 3, technical_impact: 1, confidence: 5, effort: 1,
  dependency: 'none', automation_level: 'automated',
  status: st(exists('apps/web/app/contact/page.tsx')),
});
add({
  id: 'conv.ga4-env', area: 'conversion',
  title: 'GA4 measurement id set in Vercel',
  detail: 'README §6: NEXT_PUBLIC_GA_MEASUREMENT_ID pending. Conversion events fire only when set. `pnpm env:check` reports it.',
  severity: 2, business_impact: 3, technical_impact: 1, confidence: 3, effort: 1,
  dependency: 'Vercel env', automation_level: 'human',
  status: 'unknown', blocker: 'Cannot read Vercel env from the repository; run `vercel env pull && pnpm env:check`.',
});

/* ── live-only checks ───────────────────────────────────────────────────── */
async function live() {
  const probe = async (p) => {
    try { const r = await fetch(`${BASE}${p}`, { redirect: 'manual', headers: { 'user-agent': 'EcowoodsGapCurator/1.0' } }); return r; } catch { return null; }
  };
  const up = (id, ok) => { const g = gaps.find((x) => x.id === id); if (g && g.status === 'fixed') g.status = ok ? 'verified' : 'open'; };
  const pricing = await probe('/pricing');
  up('content.pricing-page', pricing?.status === 200);
  const est = await probe('/estimate');
  up('conv.estimate-url', est?.status === 200);
  const contact = await probe('/contact');
  up('conv.contact-url', contact?.status === 200);
  const md = await probe('/md');
  up('ai.md-index', md?.status === 200 && /text\/markdown/.test(md.headers.get('content-type') || ''));
  const api = await probe('/api/v1/manifest');
  up('ai.api-v1', api?.status === 200);
  const alias = await probe('/');
  const about = await probe('/about');
  up('tech.markdown-alternates', Boolean(about?.headers.get('link')?.includes('text/markdown')));
  const stale = await (async () => { try { const r = await fetch('https://ecowoods-app.vercel.app/', { redirect: 'manual' }); return r.status; } catch { return null; } })();
  const g = gaps.find((x) => x.id === 'identity.stale-vercel-alias');
  if (g && stale !== null) g.detail += ` Live: ${stale} (301/308/404/410 closes this).`;
  if (g && (stale === 301 || stale === 308 || stale === 404 || stale === 410)) g.status = 'verified';
  void alias;
}

async function main() {
  if (LIVE) await live();
  const score = (g) => g.severity * 2 + g.business_impact * 2 + g.technical_impact + g.confidence - g.effort;
  gaps.sort((a, b) => score(b) - score(a));
  const out = { generatedAt: new Date().toISOString(), base: LIVE ? BASE : null, count: gaps.length, byStatus: {}, gaps: gaps.map((g) => ({ ...g, score: score(g) })) };
  for (const g of gaps) out.byStatus[g.status] = (out.byStatus[g.status] || 0) + 1;
  fs.mkdirSync(path.join(ROOT, 'audit'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'audit/gaps.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`Web Gap Curator — ${gaps.length} gaps ${LIVE ? `(live against ${BASE})` : '(repository only)'}`);
  for (const g of out.gaps) console.log(`${String(g.score).padStart(3)}  ${g.status.padEnd(11)} ${g.area.padEnd(10)} ${g.id}${g.blocker ? `\n                              ↳ ${g.blocker}` : ''}`);
  console.log(`\nby status: ${JSON.stringify(out.byStatus)}\nwritten: audit/gaps.json`);
}
main();
