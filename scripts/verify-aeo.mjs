#!/usr/bin/env node
/**
 * scripts/verify-aeo.mjs — the tools this site can run must be discoverable as
 * things that can be run.
 *
 * THE GAP THIS EXISTS TO CLOSE
 *
 * Before this guard, /api/v1/actions listed four actions and every one of them
 * ended in a human: a form, a phone number, an inbox. That is precisely what an
 * assistant learns from every other flooring company's site, which is why it has
 * no reason to name one over another.
 *
 * Meanwhile this site carries four things an assistant can actually execute —
 * a wood-movement calculation from the published shrinkage coefficients, a
 * circuit assessment against manufacturer-published amperage, a quote-scope
 * checklist, and an honest coverage lookup — and not one of them was
 * discoverable as executable. Asked how far a 7-inch white oak floor moves
 * between a Toronto summer and a Toronto winter, an assistant had no way to
 * know that a documented endpoint on this domain computes it. So it guessed.
 *
 * An assistant that has answered a real question from a real source has a
 * reason to cite the source. That is the entire mechanism of AI discoverability
 * for a business this size, and it is worth more than any amount of prose.
 *
 * WHAT IS CHECKED
 *
 *  1. Every computational action (AssessAction, SearchAction) targets an
 *     endpoint that exists in the ENDPOINTS manifest.
 *  2. Every computational action publishes an example that resolves to one of
 *     those endpoints, a human_page that is a real route, and a `refuses` list.
 *     A tool with no stated boundary invites a consumer to assume there isn't
 *     one.
 *  3. Every public tool page has an action pointing at it. A tool nobody can
 *     discover as executable is a tool that will be described rather than used.
 *  4. /ai.txt names every computational endpoint. It is the file written for
 *     exactly this audience; an endpoint absent from it is absent.
 *  5. robots.txt still allows the named AI crawlers and still allows /api/v1
 *     under BOTH spellings — prefix matching means `/api/v1/` does not match
 *     `/api/v1`, and that bare base URL is the first thing any agent requests.
 *
 *   node scripts/verify-aeo.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');

const fail = [];
const read = (rel, label) => {
  const p = join(WEB, rel);
  if (!existsSync(p)) { fail.push(`missing ${label}: apps/web/${rel}`); return ''; }
  return readFileSync(p, 'utf8');
};

const registry = read('lib/registry/registry.ts', 'registry');
const manifest = read('lib/registry/manifest.ts', 'endpoint manifest');
const aiTxt = read('app/ai.txt/route.ts', 'ai.txt');
const robots = read('app/robots.ts', 'robots');

/* ── the endpoints that exist ────────────────────────────────────────────── */
const endpoints = new Set(
  [...manifest.matchAll(/\{\s*path:\s*'([^']+)'/g)].map((m) => m[1]),
);
if (endpoints.size < 20) {
  fail.push(`read only ${endpoints.size} endpoint(s) from the manifest — the reader is blind`);
}

/* ── the actions ─────────────────────────────────────────────────────────── */
const actionsBlock = registry.slice(registry.indexOf('export function buildActions'));
const actions = [];
for (const m of actionsBlock.matchAll(/id:\s*'(action:[a-z_]+)',[\s\S]*?status:\s*'[a-z]+',/g)) {
  const body = m[0];
  actions.push({
    id: m[1],
    schemaType: /schema_type:\s*'([A-Za-z]+)'/.exec(body)?.[1] ?? null,
    target: /target:\s*(?:abs\('([^']+)'\)|`([^`]*)`|BUSINESS_NAP\.[a-zA-Z]+|`mailto[^`]*`)/.exec(body)?.[1] ?? null,
    example: /example:\s*`([^`]+)`/.exec(body)?.[1] ?? null,
    humanPage: /human_page:\s*abs\('([^']+)'\)/.exec(body)?.[1] ?? null,
    refuses: /refuses:\s*\[/.test(body),
    body,
  });
}
if (actions.length < 4) {
  fail.push(`read only ${actions.length} action(s) from buildActions() — the reader is blind, fix it`);
}

const COMPUTATIONAL = new Set(['AssessAction', 'SearchAction']);
const computational = actions.filter((a) => COMPUTATIONAL.has(a.schemaType ?? ''));

if (!computational.length) {
  fail.push(
    'no computational action is registered. Every action on this site ends in a human — a form, a phone, an ' +
      'inbox — which is what an assistant learns from every competitor. The endpoints that compute an answer ' +
      'must be registered as actions, or they will be described rather than used.',
  );
}

const apiPath = (url) => {
  const m = /\/api\/v1(\/[^?\s]*)?/.exec(url ?? '');
  if (!m) return null;
  return m[1] ? m[1].replace(/\/$/, '') : '/';
};

for (const a of computational) {
  const t = apiPath(a.target);
  if (!t) {
    fail.push(`${a.id} is computational but its target "${a.target}" is not an /api/v1 endpoint — an assistant cannot execute a page`);
  } else if (!endpoints.has(t) && t !== '/') {
    fail.push(`${a.id} targets /api/v1${t}, which is not in the ENDPOINTS manifest`);
  }
  if (!a.example) {
    fail.push(`${a.id} publishes no example. A call that works verbatim is the one thing a consumer can copy.`);
  } else {
    const e = apiPath(a.example);
    if (e && !endpoints.has(e) && e !== '/') {
      fail.push(`${a.id} example calls /api/v1${e}, which is not in the ENDPOINTS manifest`);
    }
  }
  if (!a.refuses) {
    fail.push(
      `${a.id} publishes no \`refuses\`. A tool that does not state its boundary invites a consumer to assume ` +
        'there is not one, and to use a number it was never willing to give.',
    );
  }
  if (!a.humanPage) {
    fail.push(`${a.id} has no human_page. Every endpoint here has a page a person would use instead; say which.`);
  } else if (!existsSync(join(WEB, 'app', a.humanPage.replace(/^\//, ''), 'page.tsx'))) {
    fail.push(`${a.id} human_page ${a.humanPage} has no page.tsx`);
  }
}

/* ── 3. every tool page is reachable as an action ────────────────────────── */
const TOOL_PAGES = ['/tools/floor-movement', '/equipment', '/quote-check', '/corridors'];
for (const page of TOOL_PAGES) {
  if (!existsSync(join(WEB, 'app', page.replace(/^\//, ''), 'page.tsx'))) {
    fail.push(`${page} is listed as a tool page but has no page.tsx`);
    continue;
  }
  if (!actions.some((a) => a.humanPage === page)) {
    fail.push(
      `${page} is a tool a machine could use and no action points at it. It will be read about and not run.`,
    );
  }
}

/* ── 4. ai.txt names every computational endpoint ────────────────────────── */
for (const a of computational) {
  const t = apiPath(a.target);
  if (!t) continue;
  const needle = t === '/' ? '/api/v1' : `/api/v1${t}`;
  if (!aiTxt.includes(needle)) {
    fail.push(
      `ai.txt does not name ${needle}. That file is written for exactly this audience; an endpoint absent ` +
        'from it is absent.',
    );
  }
}

/* ── 5. the crawler policy has not quietly narrowed ──────────────────────── */
/*
 * Strip the commentary first. robots.ts explains the two-spelling rule in prose
 * that quotes both spellings, so a naive substring check passed on a file where
 * the rule had been deleted from the code and survived only in the comment
 * describing it. The first regression test caught exactly that.
 */
const robotsCode = robots.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const REQUIRED_AGENTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot',
  'Google-Extended', 'Applebot-Extended', 'PerplexityBot', 'CCBot',
];
for (const agent of REQUIRED_AGENTS) {
  if (!robotsCode.includes(`'${agent}'`)) {
    fail.push(`robots.ts no longer names ${agent}. Some agents ignore '*', which is why each is named.`);
  }
}
for (const spelling of ["'/api/v1'", "'/api/v1/'"]) {
  if (!robotsCode.includes(spelling)) {
    fail.push(
      `robots.ts no longer allows ${spelling}. Both spellings are required: robots.txt matching is plain ` +
        'prefix matching, so /api/v1/ does not match the path /api/v1 — and that bare base URL is the one ' +
        'advertised in the OpenAPI servers field, so it is the first thing any agent requests. F-89.',
    );
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`\n✗ aeo: ${fail.length} problem(s)\n`);
  for (const f of fail) console.error(`  · ${f}\n`);
  process.exit(1);
}

console.log(
  `✓ aeo verified — ${computational.length} computational action(s), each targeting a manifested endpoint with a ` +
    `working example, a human page and a stated refusal; ${REQUIRED_AGENTS.length} AI crawlers named in robots.txt`,
);
