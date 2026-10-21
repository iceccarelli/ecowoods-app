#!/usr/bin/env node
/**
 * scripts/verify-live-deploy.mjs — is the RUNNING PROCESS behind BASE the
 * commit this checkout thinks is current, and does it still hold the
 * production invariants that have broken silently before.
 *
 * WHY THIS IS A DIFFERENT CHECK FROM verify-live-routes.mjs
 *
 * verify-live-routes.mjs's own header documents the incident that produced
 * it: a Git integration served `main` while a feature branch's work sat
 * unpushed/unmerged, and every route still 200'd — the gap was in WHICH
 * commit was live, not in whether routes existed. That script catches a
 * missing route. It cannot catch a deploy that serves the RIGHT routes from
 * the WRONG commit — content that 200s but is stale, wrong, or reverted.
 * That failure mode has no route-count signature at all; the only way to
 * see it is to ask the live process what it was built from, via
 * /api/deploy-info (added alongside this script for exactly this purpose).
 *
 * WHAT IS CHECKED
 *
 *  1. DEPLOYED REVISION vs EXPECTED. /api/deploy-info's commitSha must equal
 *     --expect <sha> (default: `git rev-parse origin/main`, so a plain run
 *     answers "does production have what's on main" without any flag).
 *     `git rev-parse HEAD` is available via --expect HEAD for checking a
 *     branch preview instead.
 *  2. ASSISTANT IDENTITY. /assistant must say "Ask Francisco" and must NOT
 *     say "AI Home Advisor" (its retired name — lib/assistant-workspace/
 *     identity.ts's own comment: "AI Home Advisor is retired"). A stale
 *     deploy of /assistant is exactly the kind of "still 200s, wrong
 *     content" failure #1 above describes.
 *  3. SECURITY HEADER INVARIANT. Permissions-Policy must grant camera to
 *     this origin (`camera=(self)`) and must never be a bare `camera=()`
 *     (which broke Floor Studio's live camera silently) or a wildcard
 *     (`camera=*`, which would grant it to every embedding origin).
 *  4. MACHINE SURFACES PRESENT. /sitemap.xml and /robots.txt return 200 —
 *     the minimum a crawler needs to find anything else this repository
 *     already checks in more depth (verify-sitemap.mjs, verify-live.sh).
 *  5. CRON ROUTE AUTH POSTURE (informational, not pass/fail on its own).
 *     Calling a cron route with a garbage Authorization header must return
 *     401 — proving the route enforces auth at all. It CANNOT prove
 *     CRON_SECRET is actually configured (an unset secret and a wrong
 *     guess both correctly 401 the same way, by design — that is what
 *     "never leak whether a secret exists" means). Reported separately so
 *     a real CRON_SECRET gap (see docs/DEPLOY.md or ask an operator with
 *     Vercel project access) is never confused with "verified healthy".
 *
 *  6. PUBLIC CONTRACT AND INTEGRATION HEALTH (GET only, no side effects):
 *     /api/health shape + status; /api/knowledge ETag, 304 on If-None-Match and
 *     404 for an unknown collection; /api/v1/manifest (shape, ETag, 304) and two
 *     collections LISTED IN THAT MANIFEST (items, meta.count > 0, ETag), one
 *     item fetched by id, an unknown id answering 404 JSON; /llms.txt fetchable;
 *     security headers on / and on the API; and /api/internal/schema-status
 *     answering 401 to an anonymous caller (not 200, not 500, not 404). Endpoint
 *     names come from the live manifest, not from this file. No credential is
 *     ever sent to the internal route, and nothing here POSTs, creates a record
 *     or reaches Stripe/Resend.
 *
 * EXIT CODES (never conflated): 0 confirmed good, 1 confirmed failure,
 * 2 inconclusive (unreachable, blocked by a proxy/WAF, or a gateway error).
 *
 *   node scripts/verify-live-deploy.mjs
 *   node scripts/verify-live-deploy.mjs --base https://preview-url --expect HEAD
 *
 * Reaches the network — not part of `pnpm verify`, run after a deploy.
 */
import { execFileSync } from 'node:child_process';

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = argOf('--base', process.env.SITE_URL ?? 'https://ecowoods.ca').replace(/\/$/, '');
const CB = Date.now();

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const expectArg = argOf('--expect', null);
const EXPECTED_SHA = expectArg === 'HEAD' ? git(['rev-parse', 'HEAD']) : (expectArg ?? git(['rev-parse', 'origin/main']));

/** fetch with a hard timeout: a hanging origin is "unreachable" (inconclusive), never a hung job. */
const timedFetch = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

async function getText(path) {
  const res = await timedFetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}cb=${CB}`, { redirect: 'follow' });
  return { status: res.status, headers: res.headers, body: await res.text().catch(() => '') };
}

const fail = [];
const info = [];
/* Inconclusive results. A network error, a proxy/WAF refusal or a gateway error
   says nothing about the site, so it is never green and never counted as a
   confirmed defect:
     unreachable — no HTTP response at all (DNS, TLS, refused, timeout)
     blocked     — 401/403/407/429: something between us and the origin refused
     unknown     — 5xx gateway statuses, or anything else we cannot interpret */
const inconclusive = [];
const unreachable = (what, err) =>
  inconclusive.push(['unreachable', `${what}: ${err instanceof Error ? err.message : String(err)}`]);
/** true when the status is one we can assert on; otherwise records why not. */
function conclusive(what, status) {
  if ([401, 403, 407, 429].includes(status)) {
    inconclusive.push(['blocked', `${what} returned ${status} — refused before the page could be judged`]);
    return false;
  }
  if ([502, 503, 504].includes(status)) {
    inconclusive.push(['unknown', `${what} returned ${status} — gateway/upstream error, site state unknown`]);
    return false;
  }
  return true;
}

/** Baseline response headers vercel.json promises on every page (HSTS only over https). */
function securityHeaderProblems(h) {
  const problems = [];
  if ((h.get('x-content-type-options') ?? '').toLowerCase() !== 'nosniff') problems.push('X-Content-Type-Options is not nosniff');
  if (!/^(sameorigin|deny)$/i.test((h.get('x-frame-options') ?? '').trim())) problems.push('X-Frame-Options is not SAMEORIGIN/DENY');
  if (!h.get('referrer-policy')) problems.push('Referrer-Policy is missing');
  if (!h.get('cross-origin-opener-policy')) problems.push('Cross-Origin-Opener-Policy is missing');
  if (BASE.startsWith('https://')) {
    const m = /max-age=(\d+)/i.exec(h.get('strict-transport-security') ?? '');
    if (!m || Number(m[1]) < 31536000) problems.push('Strict-Transport-Security is missing or shorter than one year');
  }
  return problems;
}

console.log(`\nLIVE DEPLOY CHECK  ${BASE}\n`);

/* ── 1. deployed revision ─────────────────────────────────────────────── */
try {
  const res = await timedFetch(`${BASE}/api/deploy-info?cb=${CB}`);
  if (!conclusive('/api/deploy-info', res.status)) {
    /* recorded */
  } else if (!res.ok) {
    fail.push(`/api/deploy-info returned ${res.status} — cannot verify which commit is live.`);
  } else {
    const data = await res.json();
    const deployedSha = data.commitSha;
    if (!deployedSha) {
      fail.push('/api/deploy-info returned no commitSha (VERCEL_GIT_COMMIT_SHA unset) — cannot verify revision.');
    } else if (!EXPECTED_SHA) {
      info.push(`deployed commit: ${deployedSha.slice(0, 12)} (no local git ref to compare against — pass --expect)`);
    } else if (deployedSha !== EXPECTED_SHA) {
      fail.push(
        `production is serving ${deployedSha.slice(0, 12)} (ref ${data.commitRef ?? 'unknown'}), ` +
          `expected ${EXPECTED_SHA.slice(0, 12)}. A deploy has not landed, or the wrong branch is aliased.`,
      );
    } else {
      info.push(`deployed commit matches expected: ${deployedSha.slice(0, 12)}`);
    }
  }
} catch (err) {
  unreachable('/api/deploy-info', err);
}

/* ── 2. assistant identity ────────────────────────────────────────────── */
try {
  const { status, body } = await getText('/assistant');
  if (!conclusive('/assistant', status)) {
    /* recorded */
  } else if (status !== 200) {
    fail.push(`/assistant returned ${status}, not 200.`);
  } else if (!body.includes('Ask Francisco')) {
    fail.push('/assistant does not mention "Ask Francisco" — either the identity regressed or the page failed to render.');
  } else if (body.includes('AI Home Advisor')) {
    fail.push('/assistant still contains "AI Home Advisor" — the retired name is back on a live page.');
  } else {
    info.push('/assistant identity: Ask Francisco, no retired naming');
  }
} catch (err) {
  unreachable('/assistant', err);
}

/* ── 3. Permissions-Policy camera invariant ───────────────────────────── */
try {
  const res = await timedFetch(`${BASE}/?cb=${CB}`);
  const pp = res.headers.get('permissions-policy') ?? '';
  if (!conclusive('/ (headers)', res.status)) {
    /* recorded */
  } else if (!pp) {
    fail.push('no Permissions-Policy header on / at all.');
  } else if (/camera=\(\)/.test(pp)) {
    fail.push(`Permissions-Policy denies camera to everyone including this origin: "${pp}". Floor Studio's live camera will not work.`);
  } else if (/camera=\*/.test(pp) || /camera=\(self \*\)/.test(pp)) {
    fail.push(`Permissions-Policy grants camera to a wildcard origin: "${pp}". Should be camera=(self) only.`);
  } else if (!/camera=\(self\)/.test(pp)) {
    fail.push(`Permissions-Policy camera directive is unrecognized: "${pp}". Expected camera=(self).`);
  } else {
    info.push(`Permissions-Policy: ${pp}`);
  }
  if (res.status === 200) {
    const missing = securityHeaderProblems(res.headers);
    if (missing.length) fail.push(`security headers on /: ${missing.join('; ')}.`);
    else info.push('security headers on /: present');
  }
} catch (err) {
  unreachable('/ (headers)', err);
}

/* ── 4. machine surfaces present ──────────────────────────────────────── */
for (const path of ['/sitemap.xml', '/robots.txt']) {
  try {
    const { status } = await getText(path);
    if (!conclusive(path, status)) { /* recorded */ }
    else if (status !== 200) fail.push(`${path} returned ${status}, not 200.`);
    else info.push(`${path}: 200`);
  } catch (err) {
    unreachable(path, err);
  }
}

/* ── 5. cron auth posture (informational) ─────────────────────────────── */
try {
  const res = await timedFetch(`${BASE}/api/cron/rate-limit-cleanup`, {
    headers: { authorization: `Bearer not-the-real-secret-${CB}` },
  });
  if (res.status === 401 || res.status === 403) {
    info.push('cron route enforces auth (401 on a wrong credential) — cannot confirm from outside whether CRON_SECRET is actually configured in Vercel; verify that separately with project access.');
  } else if (res.status === 200) {
    fail.push('/api/cron/rate-limit-cleanup accepted a WRONG credential — cron auth is not enforcing. This is a real security defect, fix immediately.');
  } else {
    info.push(`cron route returned ${res.status} for a wrong credential (expected 401) — investigate.`);
  }
} catch (err) {
  unreachable('cron auth posture', err);
}

/* ── 6. public contract + integration health (GET only) ───────────────── */

/** GET `path` (cache-busted, same URL every time so ETags are comparable). null = unreachable, already recorded. */
async function probe(what, path, headers = {}) {
  try {
    const res = await timedFetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}cb=${CB}`, {
      headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.5', ...headers },
      redirect: 'follow',
    });
    return { status: res.status, headers: res.headers, text: await res.text().catch(() => '') };
  } catch (err) {
    unreachable(what, err);
    return null;
  }
}
const parseJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
};
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The response must carry an ETag, and a conditional GET with it must be a bodiless 304. */
async function checkEtag304(what, path, first) {
  const etag = first.headers.get('etag');
  if (!etag) {
    fail.push(`${what} has no ETag header.`);
    return;
  }
  // A CDN may weaken a strong ETag in transit (W/"…"); the origin matches the opaque tag.
  const second = await probe(`${what} (conditional)`, path, { 'if-none-match': etag.replace(/^W\//, '') });
  if (!second || !conclusive(`${what} (conditional)`, second.status)) return;
  if (second.status !== 304) fail.push(`${what}: If-None-Match with its own ETag returned ${second.status}, expected 304.`);
  else if (second.text) fail.push(`${what}: the 304 response carried a body.`);
  else info.push(`${what}: ETag + 304 ok`);
}

/* 6a. /api/health — the public contract: shape and a coherent status/HTTP pairing. */
try {
  const r = await probe('/api/health', '/api/health');
  if (r) {
    const body = parseJson(r.text);
    const looksHealth = isObj(body) && ['ok', 'degraded', 'down'].includes(body.status);
    if (!(r.status === 503 && looksHealth) && !conclusive('/api/health', r.status)) {
      /* recorded */
    } else if (r.status !== 200 && r.status !== 503) {
      fail.push(`/api/health returned ${r.status}, expected 200 (ok/degraded) or 503 (down).`);
    } else if (!looksHealth) {
      fail.push('/api/health is not JSON with status ok|degraded|down.');
    } else if (
      !Number.isFinite(Date.parse(body.checkedAt)) ||
      !Array.isArray(body.series) ||
      !Array.isArray(body.standards) ||
      !isObj(body.summary) ||
      !isObj(body.endpoints)
    ) {
      fail.push('/api/health shape changed: expected checkedAt, series[], standards[], summary{}, endpoints{}.');
    } else if (/migration|schema[-_ ]?status|prisma|database_url|cron_secret/i.test(r.text)) {
      fail.push('/api/health mentions internal state (migrations/schema/database/secret) — it must stay a public, internals-free probe.');
    } else if ((body.status === 'down') !== (r.status === 503)) {
      fail.push(`/api/health status "${body.status}" does not match HTTP ${r.status}.`);
    } else if (body.status === 'down') {
      fail.push('/api/health reports "down" (503): every upstream series failed. The cause may be the upstream data source rather than this deploy — investigate.');
    } else {
      info.push(
        body.status === 'ok'
          ? '/api/health: ok'
          : `/api/health: ${body.status} (upstream data freshness — informational, not a deploy defect)`,
      );
    }
  }
} catch (err) {
  unreachable('/api/health', err);
}

/* 6b. /api/knowledge — collection filter, ETag/304, unknown collection 404. */
try {
  const path = '/api/knowledge?collection=services';
  const r = await probe('/api/knowledge', path);
  if (r && conclusive('/api/knowledge', r.status)) {
    const body = parseJson(r.text);
    if (r.status !== 200) fail.push(`/api/knowledge?collection=services returned ${r.status}, not 200.`);
    else if (!isObj(body) || !Array.isArray(body.meta?.collections) || !body.meta.collections.includes('services')) {
      fail.push('/api/knowledge payload lost meta.collections (or "services" is no longer a collection).');
    } else if (!Array.isArray(body.services) || body.services.length === 0) {
      fail.push('/api/knowledge?collection=services returned no services.');
    } else if (Object.keys(body).filter((k) => k !== 'meta').length !== 1) {
      fail.push('/api/knowledge?collection=services did not filter to that one collection.');
    } else {
      info.push(`/api/knowledge: ${body.services.length} services, ${body.meta.collections.length} collections listed`);
      await checkEtag304('/api/knowledge', path, r);
    }
  }
  const unk = await probe('/api/knowledge (unknown collection)', '/api/knowledge?collection=zz-no-such-collection');
  if (unk && conclusive('/api/knowledge (unknown collection)', unk.status)) {
    const body = parseJson(unk.text);
    if (unk.status !== 404 || body?.error !== 'unknown_collection') {
      fail.push(`/api/knowledge with an unknown collection returned ${unk.status}, expected 404 {error:"unknown_collection"}.`);
    } else {
      info.push('/api/knowledge: unknown collection -> 404 JSON');
    }
  }
} catch (err) {
  unreachable('/api/knowledge', err);
}

/* 6c. /api/v1 — the manifest, then collections the manifest itself lists. */
try {
  const m = await probe('/api/v1/manifest', '/api/v1/manifest');
  if (m && conclusive('/api/v1/manifest', m.status)) {
    const manifest = parseJson(m.text);
    const endpoints = Array.isArray(manifest?.api?.endpoints) ? manifest.api.endpoints : null;
    if (m.status !== 200) {
      fail.push(`/api/v1/manifest returned ${m.status}, not 200.`);
    } else if (!isObj(manifest) || !endpoints || endpoints.length === 0) {
      fail.push('/api/v1/manifest is not JSON with a non-empty api.endpoints[].');
    } else {
      const apiProblems = [];
      if (!/^application\/json/i.test(m.headers.get('content-type') ?? '')) apiProblems.push('content-type is not application/json');
      if (m.headers.get('access-control-allow-origin') !== '*') apiProblems.push('CORS is not open (access-control-allow-origin: *)');
      apiProblems.push(...securityHeaderProblems(m.headers));
      if (apiProblems.length) fail.push(`/api/v1/manifest headers: ${apiProblems.join('; ')}.`);
      else info.push(`/api/v1/manifest: ${endpoints.length} endpoints listed, headers ok`);
      await checkEtag304('/api/v1/manifest', '/api/v1/manifest', m);

      // Only GET endpoints under /api/v1 that the live manifest lists. Relative path, no origin (a preview host
      // may differ from the canonical origin written into the manifest).
      const rel = endpoints
        .filter((e) => isObj(e) && e.method === 'GET' && typeof e.url === 'string')
        .map((e) => e.url.replace(/^https?:\/\/[^/]+/, ''))
        .filter((p) => p.startsWith('/api/v1/'))
        .map((p) => p.slice('/api/v1'.length));
      const SKIP = new Set(['/manifest', '/openapi.json']);
      const PREFER = ['/services', '/pricing', '/locations', '/faq', '/sources'];
      const flat = rel.filter((p) => /^\/[a-z0-9-]+$/.test(p) && !SKIP.has(p));
      const ordered = [...PREFER.filter((p) => flat.includes(p)), ...flat.filter((p) => !PREFER.includes(p))].slice(0, 8);

      let found = 0;
      let answered = 0;
      const inconclusiveBefore = inconclusive.length;
      for (const p of ordered) {
        if (found >= 2) break;
        const r = await probe(`/api/v1${p}`, `/api/v1${p}`);
        if (!r || !conclusive(`/api/v1${p}`, r.status)) continue;
        answered += 1;
        if (r.status !== 200) {
          fail.push(`/api/v1${p} is listed in the manifest but returned ${r.status}.`);
          continue;
        }
        const body = parseJson(r.text);
        if (!isObj(body) || !Array.isArray(body.items)) continue; // not a list-shaped endpoint (usage/doc); not judged here
        found += 1;
        const count = body.meta?.count;
        if (!(typeof count === 'number' && count > 0) || body.items.length === 0) {
          fail.push(`/api/v1${p}: expected meta.count > 0 and a non-empty items[] (count=${String(count)}, items=${body.items.length}).`);
          continue;
        }
        if (typeof body.meta?.registry_version !== 'string' || !body.meta.registry_version) {
          fail.push(`/api/v1${p}: meta.registry_version missing.`);
          continue;
        }
        if (body.items.some((it) => !isObj(it) || typeof it.id !== 'string')) {
          fail.push(`/api/v1${p}: an item has no string id.`);
          continue;
        }
        info.push(`/api/v1${p}: ${count} items`);
        if (found === 1) await checkEtag304(`/api/v1${p}`, `/api/v1${p}`, r);
        else if (!r.headers.get('etag')) fail.push(`/api/v1${p} has no ETag header.`);

        // One real id from the list must resolve, and a made-up id must be a JSON 404 — via the manifest's own {id} route.
        if (rel.includes(`${p}/{id}`)) {
          const id = body.items[0].id;
          const one = await probe(`/api/v1${p}/{id}`, `/api/v1${p}/${encodeURIComponent(id)}`);
          if (one && conclusive(`/api/v1${p}/{id}`, one.status)) {
            const ob = parseJson(one.text);
            if (one.status !== 200 || !isObj(ob) || ob.id !== id) fail.push(`/api/v1${p}/{id}: an id taken from the list did not resolve (HTTP ${one.status}).`);
            else info.push(`/api/v1${p}/{id}: listed id resolves`);
          }
          const none = await probe(`/api/v1${p}/{unknown}`, `/api/v1${p}/ecowoods-no-such-id-${CB}`);
          if (none && conclusive(`/api/v1${p}/{unknown}`, none.status)) {
            const nb = parseJson(none.text);
            if (none.status !== 404 || nb?.error?.code !== 'not_found') {
              fail.push(`/api/v1${p}/<unknown id> returned ${none.status}, expected 404 with {error:{code:"not_found"}}.`);
            } else if (!/^application\/json/i.test(none.headers.get('content-type') ?? '')) {
              fail.push(`/api/v1${p}/<unknown id> 404 is not application/json.`);
            } else {
              info.push(`/api/v1${p}/<unknown id>: 404 JSON`);
            }
          }
        }
      }
      if (found === 0 && answered > 0 && inconclusive.length === inconclusiveBefore) {
        fail.push('no collection endpoint listed in the /api/v1 manifest answered with items[] — the registry may be empty or the contract changed.');
      }
    }
  }
} catch (err) {
  unreachable('/api/v1', err);
}

/* 6d. /llms.txt */
try {
  const r = await probe('/llms.txt', '/llms.txt');
  if (r && conclusive('/llms.txt', r.status)) {
    if (r.status !== 200) fail.push(`/llms.txt returned ${r.status}, not 200.`);
    else if (!/^text\//i.test(r.headers.get('content-type') ?? '')) fail.push(`/llms.txt content-type is "${r.headers.get('content-type')}", expected text/*.`);
    else if (!r.text.startsWith('#') || r.text.length < 200) fail.push('/llms.txt is not a non-trivial markdown document starting with a heading.');
    else info.push(`/llms.txt: ${r.text.length} bytes`);
  }
} catch (err) {
  unreachable('/llms.txt', err);
}

/* 6e. /api/internal/schema-status must refuse an anonymous caller — and we send NO credential. */
try {
  const r = await probe('/api/internal/schema-status', '/api/internal/schema-status');
  if (r) {
    const body = parseJson(r.text);
    if (r.status === 401) {
      if (isObj(body) && body.error === 'unauthorized' && /no-store/i.test(r.headers.get('cache-control') ?? '')) {
        if (/ledger|structure|migration|columns|tables/i.test(r.text)) {
          fail.push('/api/internal/schema-status 401 body mentions schema detail.');
        } else {
          info.push('/api/internal/schema-status: anonymous -> 401 (route answers, not cached)');
        }
      } else {
        // A 401 that is not this route's own refusal came from something in front of it.
        inconclusive.push(['blocked', '/api/internal/schema-status returned 401 that is not the route\'s own refusal — cannot tell whether the route is deployed']);
      }
    } else if (!conclusive('/api/internal/schema-status', r.status)) {
      /* recorded */
    } else if (r.status === 200) {
      fail.push('/api/internal/schema-status answered 200 to an ANONYMOUS caller — internal schema state is publicly readable. Fix immediately.');
    } else {
      fail.push(`/api/internal/schema-status returned ${r.status} to an anonymous caller, expected 401 (404 = route not deployed, 5xx = route broken).`);
    }
  }
} catch (err) {
  unreachable('/api/internal/schema-status', err);
}

/* ── report ────────────────────────────────────────────────────────────── */
for (const line of info) console.log(`  · ${line}`);

if (fail.length) {
  console.error(`\n✗ ${fail.length} CONFIRMED problem(s) found live at ${BASE}:\n`);
  for (const f of fail) console.error(`  · ${f}`);
  for (const [kind, msg] of inconclusive) console.error(`  ? [${kind}] ${msg}`);
  console.error('');
  process.exit(1);
}

/* Exit 2, not 0 and not 1: nothing was confirmed good and nothing was
   confirmed broken. A pipeline must not read this as green. */
if (inconclusive.length) {
  console.error(`\n? INCONCLUSIVE — ${inconclusive.length} check(s) could not be judged at ${BASE}. This is NOT a pass.\n`);
  for (const [kind, msg] of inconclusive) console.error(`  ? [${kind}] ${msg}`);
  console.error('');
  process.exit(2);
}

console.log(`\n✓ live deploy verified — ${BASE} matches expected revision and holds every checked invariant\n`);
