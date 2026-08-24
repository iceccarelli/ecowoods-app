#!/usr/bin/env node
/**
 * scripts/audit-ai-discoverability.mjs — can a retrieval system find the money?
 *
 *   pnpm seo:ai
 *
 * THE QUESTION THIS ANSWERS
 *
 * Not "is the site crawlable" — robots.txt already names fourteen AI user
 * agents and allows them everything. The question is narrower and much more
 * useful: when one of those agents reads this site's machine surfaces, does the
 * COMMERCIAL material reach it first, or does it have to get through the
 * technical corpus to find out that this is a business that can be hired?
 *
 * That distinction is not academic. This repository already records the exact
 * failure: an AI agent asked to rank Toronto hardwood contractors in August
 * 2026 left this company off the list, and its stated reason was what the
 * local-business listing showed. A site can be perfectly citable for "define
 * cupping" and invisible for "who should I hire", and every generic
 * crawlability check passes in both states.
 *
 * SEVEN CHECKS, EACH ONE A THING THAT HAS ACTUALLY GONE WRONG SOMEWHERE
 *
 *   1. robots names the AI agents explicitly, not just `*`.
 *   2. Every expected machine surface has an implementation.
 *   3. llms.txt puts a preferred-citation-target section BEFORE its content
 *      indexes, and names every commercial canonical in it.
 *   4. /api/knowledge lists commercial collections first in meta.collections.
 *   5. Every commercial canonical appears in the sitemap source.
 *   6. Every commercial canonical is reachable from llms.txt AND ai.txt.
 *   7. No machine surface hard-codes a price or a NAP value.
 *
 * STATIC, like audit-current-state.mjs, and for the same reason: it reads the
 * source, so it cannot be defeated by an egress proxy and cannot report a
 * result it did not measure. `scripts/crawl-site.mjs` is the live half.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

const results = [];
const ok = (name, detail) => results.push({ name, pass: true, detail });
const bad = (name, detail, why) => results.push({ name, pass: false, detail, why });

/* ── the commercial canonicals, from the topic map ────────────────────────── */
const mapSrc = read('apps/web/content/search/topic-map.ts');
const commercial = [...mapSrc.matchAll(
  /id:\s*'([^']+)',\s*\n\s*intent:\s*'(commercial)',\s*\n\s*canonical:\s*'([^']+)'/g,
)].map(([, id, , canonical]) => ({ id, canonical }));

if (commercial.length === 0) {
  console.error('\n✗ no commercial clusters found in the topic map — this audit would pass over nothing.\n');
  process.exit(1);
}

/* ── 1. robots names the agents ───────────────────────────────────────────── */
const robots = read('apps/web/app/robots.ts');
const AGENTS = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];
const missingAgents = AGENTS.filter((a) => !robots.includes(a));
if (missingAgents.length === 0) ok('robots names AI agents', `${AGENTS.length} agent token(s) named explicitly`);
else bad('robots names AI agents', `missing: ${missingAgents.join(', ')}`,
  'Several operators document that they do not follow `*` reliably. Naming the token removes the doubt for one line each.');

/* ── 2. machine surfaces exist ────────────────────────────────────────────── */
const SURFACES = {
  '/robots.txt': 'apps/web/app/robots.ts',
  '/sitemap.xml': 'apps/web/app/sitemap.ts',
  '/llms.txt': 'apps/web/app/llms.txt/route.ts',
  '/llms-full.txt': 'apps/web/app/llms-full.txt/route.ts',
  '/ai.txt': 'apps/web/app/ai.txt/route.ts',
  '/feed.xml': 'apps/web/app/feed.xml/route.ts',
  '/api/knowledge': 'apps/web/app/api/knowledge/route.ts',
};
const missingSurfaces = Object.entries(SURFACES).filter(([, impl]) => !existsSync(join(ROOT, impl)));
if (missingSurfaces.length === 0) ok('machine surfaces present', `${Object.keys(SURFACES).length}/${Object.keys(SURFACES).length}`);
else bad('machine surfaces present', missingSurfaces.map(([p]) => p).join(', '), 'A surface named in robots.txt or llms.txt that does not exist is a 404 handed to every agent that reads the file.');

/* ── 3. llms.txt leads with citation targets ──────────────────────────────── */
const llms = read('apps/web/app/llms.txt/route.ts');
const citationIdx = llms.indexOf('Preferred citation targets');
const papersIdx = llms.indexOf('## Technical papers');
if (citationIdx === -1) {
  bad('llms.txt leads with citation targets', 'no "Preferred citation targets" section',
    'This is the section an agent reads before deciding which URL to quote. Without it the first URL it meets is whatever comes first in the file.');
} else if (papersIdx !== -1 && citationIdx > papersIdx) {
  bad('llms.txt leads with citation targets', 'the citation section comes after the technical papers',
    'An agent that has already picked a paper to cite does not read further. Commercial intent must come first.');
} else {
  ok('llms.txt leads with citation targets', `section at byte ${citationIdx}`);
}

const notInLlms = commercial.filter((c) => !llms.includes(c.canonical));
if (notInLlms.length === 0) ok('llms.txt names every commercial canonical', `${commercial.length}/${commercial.length}`);
else bad('llms.txt names every commercial canonical', notInLlms.map((c) => c.canonical).join(', '),
  'A commercial page absent from llms.txt is a page an agent has no reason to prefer over any other URL on the site.');

/* ── 4. knowledge API orders collections commercially ─────────────────────── */
const knowledge = read('apps/web/app/api/knowledge/route.ts');
const collectionsList = (knowledge.match(/collections:\s*\[([\s\S]*?)\]/) || [, ''])[1];
const collections = [...collectionsList.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
const COMMERCIAL_COLLECTIONS = ['commercialPages', 'services', 'pricing', 'locations'];
const missingCollections = COMMERCIAL_COLLECTIONS.filter((c) => !collections.includes(c));
if (missingCollections.length) {
  bad('knowledge API exposes commercial collections', `missing: ${missingCollections.join(', ')}`,
    'Nested under `business`, these cannot be fetched with ?collection= — an agent has to pull the whole corpus to answer one question about one service.');
} else {
  const firstTechnical = collections.findIndex((c) => ['papers', 'glossary', 'figures'].includes(c));
  const lastCommercial = Math.max(...COMMERCIAL_COLLECTIONS.map((c) => collections.indexOf(c)));
  if (firstTechnical !== -1 && lastCommercial > firstTechnical) {
    bad('knowledge API orders collections commercially', collections.join(', '),
      'The technical collections come first. This array is the only steer an agent gets about what to fetch.');
  } else {
    ok('knowledge API orders collections commercially', collections.slice(0, 5).join(', ') + ' …');
  }
}

/* ── 5. sitemap contains every commercial canonical ───────────────────────── */
const sitemap = read('apps/web/app/sitemap.ts');
const dynamicParents = ['/services/', '/guides/', '/papers/', '/glossary/', '/service-areas/', '/case-studies/', '/blog/'];
const notInSitemap = commercial.filter((c) => {
  if (sitemap.includes(`'${c.canonical}'`)) return false;
  // dynamic collections are enumerated from their loaders, not listed literally
  return !dynamicParents.some((p) => c.canonical.startsWith(p));
});
if (notInSitemap.length === 0) ok('sitemap covers every commercial canonical', `${commercial.length}/${commercial.length}`);
else bad('sitemap covers every commercial canonical', notInSitemap.map((c) => c.canonical).join(', '),
  'A page absent from the sitemap is discovered only by following a link, which for a new URL can take weeks.');

/* ── 6. ai.txt reaches the commercial pages ───────────────────────────────── */
const aitxt = read('apps/web/app/ai.txt/route.ts');
const notInAi = commercial.filter((c) => !aitxt.includes(c.canonical) && !aitxt.includes('getServicePages') && !aitxt.includes('CLUSTERS'));
if (notInAi.length === 0) ok('ai.txt reaches the commercial pages', 'named directly or derived from a manifest');
else bad('ai.txt reaches the commercial pages', notInAi.map((c) => c.canonical).join(', '),
  'ai.txt is the citation guide. A commercial page missing from it is a page the guide does not tell anyone how to cite.');

/* ── 7. no hard-coded price or NAP in a machine surface ───────────────────── */
const MACHINE_FILES = [
  'apps/web/app/llms.txt/route.ts',
  'apps/web/app/llms-full.txt/route.ts',
  'apps/web/app/ai.txt/route.ts',
  'apps/web/app/api/knowledge/route.ts',
  'apps/web/app/feed.xml/route.ts',
  'apps/web/app/sitemap.ts',
  'apps/web/app/robots.ts',
];
const napPhone = (read('packages/shared/constants/index.ts').match(/phoneDisplay:\s*'([^']+)'/) || [, null])[1];
const leaks = [];
for (const f of MACHINE_FILES) {
  read(f).split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (/\$\s?\d{1,3}\.\d{2}/.test(line)) leaks.push({ f, i: i + 1, what: 'price literal', text: t.slice(0, 90) });
    if (napPhone && line.includes(napPhone)) leaks.push({ f, i: i + 1, what: 'phone literal', text: t.slice(0, 90) });
  });
}
if (leaks.length === 0) ok('machine surfaces derive prices and NAP', `${MACHINE_FILES.length} file(s) clean`);
else bad('machine surfaces derive prices and NAP', `${leaks.length} literal(s)`,
  'These are the files quoted back verbatim by answer engines. A stale figure here is repeated as fact for as long as the answer is cached.');

/* ── report ───────────────────────────────────────────────────────────────── */
console.log('');
console.log('AI DISCOVERABILITY');
console.log('');
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}`);
  console.log(`      ${r.detail}`);
  if (!r.pass) console.log(`      → ${r.why}`);
}
if (leaks.length) {
  console.log('');
  for (const l of leaks.slice(0, 10)) console.log(`      ${l.f}:${l.i}  ${l.what}  ${l.text}`);
}
console.log('');

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`✗ ${failed.length} of ${results.length} check(s) failed\n`);
  process.exit(1);
}
console.log(`✓ ${results.length} check(s) passed — commercial material leads every machine surface\n`);
process.exit(0);
