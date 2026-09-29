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

async function getText(path) {
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}cb=${CB}`, { redirect: 'follow' });
  return { status: res.status, headers: res.headers, body: await res.text().catch(() => '') };
}

const fail = [];
const info = [];

console.log(`\nLIVE DEPLOY CHECK  ${BASE}\n`);

/* ── 1. deployed revision ─────────────────────────────────────────────── */
try {
  const res = await fetch(`${BASE}/api/deploy-info?cb=${CB}`);
  if (!res.ok) {
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
  fail.push(`could not reach /api/deploy-info: ${err instanceof Error ? err.message : String(err)}`);
}

/* ── 2. assistant identity ────────────────────────────────────────────── */
try {
  const { status, body } = await getText('/assistant');
  if (status !== 200) {
    fail.push(`/assistant returned ${status}, not 200.`);
  } else if (!body.includes('Ask Francisco')) {
    fail.push('/assistant does not mention "Ask Francisco" — either the identity regressed or the page failed to render.');
  } else if (body.includes('AI Home Advisor')) {
    fail.push('/assistant still contains "AI Home Advisor" — the retired name is back on a live page.');
  } else {
    info.push('/assistant identity: Ask Francisco, no retired naming');
  }
} catch (err) {
  fail.push(`could not fetch /assistant: ${err instanceof Error ? err.message : String(err)}`);
}

/* ── 3. Permissions-Policy camera invariant ───────────────────────────── */
try {
  const res = await fetch(`${BASE}/?cb=${CB}`);
  const pp = res.headers.get('permissions-policy') ?? '';
  if (!pp) {
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
} catch (err) {
  fail.push(`could not fetch / for headers: ${err instanceof Error ? err.message : String(err)}`);
}

/* ── 4. machine surfaces present ──────────────────────────────────────── */
for (const path of ['/sitemap.xml', '/robots.txt']) {
  try {
    const { status } = await getText(path);
    if (status !== 200) fail.push(`${path} returned ${status}, not 200.`);
    else info.push(`${path}: 200`);
  } catch (err) {
    fail.push(`could not fetch ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* ── 5. cron auth posture (informational) ─────────────────────────────── */
try {
  const res = await fetch(`${BASE}/api/cron/rate-limit-cleanup`, {
    headers: { authorization: `Bearer not-the-real-secret-${CB}` },
  });
  if (res.status === 401) {
    info.push('cron route enforces auth (401 on a wrong credential) — cannot confirm from outside whether CRON_SECRET is actually configured in Vercel; verify that separately with project access.');
  } else if (res.status === 200) {
    fail.push('/api/cron/rate-limit-cleanup accepted a WRONG credential — cron auth is not enforcing. This is a real security defect, fix immediately.');
  } else {
    info.push(`cron route returned ${res.status} for a wrong credential (expected 401) — investigate.`);
  }
} catch (err) {
  info.push(`could not reach cron route to check auth posture: ${err instanceof Error ? err.message : String(err)}`);
}

/* ── report ────────────────────────────────────────────────────────────── */
for (const line of info) console.log(`  · ${line}`);

if (fail.length) {
  console.error(`\n✗ ${fail.length} problem(s) found live at ${BASE}:\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}

console.log(`\n✓ live deploy verified — ${BASE} matches expected revision and holds every checked invariant\n`);
