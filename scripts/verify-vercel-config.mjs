#!/usr/bin/env node
/**
 * scripts/verify-vercel-config.mjs — the twenty-seventh guard.
 *
 * THE ACCIDENT THIS PREVENTS
 *
 * Two vercel.json files are in circulation for this business: the real one for
 * the ecowoods.ca project, and a standalone one written for a separate project
 * that would host only the old domain. The second contains:
 *
 *     { "source": "/:path*", "destination": "https://ecowoods.ca/:path*" }
 *
 * Correct in a project that serves ONLY ecowoodshardwood.com. Catastrophic here.
 * Pasted into this file it matches every request on ecowoods.ca and redirects
 * the site to itself — a permanent loop, 301-cached in every visitor's browser
 * and every CDN that saw it. That is not a bad deploy you roll back cleanly; a
 * cached 301 outlives the fix.
 *
 * So: every redirect here MUST carry a host condition, and no host condition may
 * name the canonical host. A rule without `has` IS the loop.
 *
 * It also holds two things that are easy to lose in a merge:
 *   · the machine surfaces stay CORS-open, because an agent fetching /llms.txt
 *     or /api/knowledge from a browser context needs the header;
 *   · X-XSS-Protection stays off. "1; mode=block" is deprecated and its filter
 *     has itself been an XSS vector; modern guidance is 0, and the real
 *     protection is the CSP in next.config.js.
 *
 *   node scripts/verify-vercel-config.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = 'vercel.json';
const CANONICAL = 'ecowoods.ca';
const problems = [];

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(path.join(ROOT, FILE), 'utf8'));
} catch (e) {
  console.error(`✗ ${FILE} is not valid JSON: ${e.message}`);
  process.exit(1);
}

/* ── the loop guard ──────────────────────────────────────────────────────── */
for (const [i, r] of (cfg.redirects ?? []).entries()) {
  const where = `${FILE} redirects[${i}] (${r.source} → ${r.destination})`;
  if (!Array.isArray(r.has) || r.has.length === 0) {
    problems.push(
      `${where}\n      has NO host condition. On this project that matches every request to\n` +
        `      ${CANONICAL} and redirects the site to itself. A 301 loop is cached by browsers\n` +
        `      and CDNs, so it outlives the rollback that fixes it.`,
    );
    continue;
  }
  const hosts = r.has.filter((h) => h.type === 'host').map((h) => h.value);
  if (!hosts.length) {
    problems.push(`${where}\n      has conditions but none of type "host". Add one.`);
    continue;
  }
  for (const h of hosts) {
    if (h === CANONICAL) {
      problems.push(
        `${where}\n      redirects the canonical host ${CANONICAL} — the loop, written explicitly.`,
      );
    }
  }
  if (!r.permanent && r.statusCode !== 301) {
    problems.push(
      `${where}\n      is not permanent. A 302 tells crawlers to keep the OLD url indexed,\n` +
        `      which is the opposite of consolidating a domain.`,
    );
  }
  if (/:path\*/.test(r.source) && !/:path\*/.test(r.destination)) {
    problems.push(
      `${where}\n      drops the path. A link earned by /services/floor-refinishing must land on\n` +
        `      that page, not on the homepage.`,
    );
  }
}

/* ── the machine surfaces stay open ──────────────────────────────────────── */
const groups = cfg.headers ?? [];
const corsFor = (src) =>
  groups
    .find((h) => h.source === src)
    ?.headers?.some((x) => x.key.toLowerCase() === 'access-control-allow-origin');
for (const s of ['/llms.txt', '/llms-full.txt', '/ai.txt', '/api/knowledge']) {
  if (!groups.some((h) => h.source === s)) {
    problems.push(
      `${FILE} has no header block for ${s}.\n` +
        `      The machine editions exist to be fetched by agents; without\n` +
        `      Access-Control-Allow-Origin a browser-context fetch is blocked.`,
    );
  } else if (!corsFor(s)) {
    problems.push(`${FILE}: ${s} has a header block but no Access-Control-Allow-Origin.`);
  }
}

/* ── the deprecated header stays off ─────────────────────────────────────── */
for (const g of groups) {
  for (const h of g.headers ?? []) {
    if (h.key.toLowerCase() === 'x-xss-protection' && String(h.value).trim() !== '0') {
      problems.push(
        `${FILE}: X-XSS-Protection is "${h.value}".\n` +
          `      "1; mode=block" is deprecated and its filter has itself been an XSS vector.\n` +
          `      Modern guidance is 0; the real protection is the CSP in next.config.js.`,
      );
    }
  }
}

/* ── build wiring must not drift ─────────────────────────────────────────── */
if (cfg.outputDirectory !== 'apps/web/.next') {
  problems.push(`${FILE}: outputDirectory is "${cfg.outputDirectory}", expected apps/web/.next.`);
}
if (cfg.framework !== 'nextjs') {
  problems.push(`${FILE}: framework is "${cfg.framework}", expected nextjs.`);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in ${FILE}:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('');
  process.exit(1);
}
console.log(
  `✓ vercel config verified — ${(cfg.redirects ?? []).length} host-scoped redirect(s), none can loop; ` +
    `machine surfaces CORS-open; build wiring intact`,
);
