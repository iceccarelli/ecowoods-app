import fs from 'node:fs';
import path from 'node:path';
import { submitToIndexNow, filterIndexNowUrls } from '../../../lib/indexnow';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/indexnow — submit URLs to Bing, Yandex, Seznam and Naver on demand.
 *
 * WHY IT NEEDS A KEY
 *
 * F-158. This endpoint was open. Anyone could POST a list of URLs and this
 * server would submit them to IndexNow **signed with our ownership key**. The
 * damage is bounded — the protocol only accepts URLs on our own host — but it
 * is not nothing: an attacker could spend our submission quota, repeatedly
 * submit URLs we do not want prioritised, and give the receiving engines a
 * pattern of behaviour attributable to us that we did not choose.
 *
 * WHY THE KEY IS NOT AN ENV VAR
 *
 * A first fix compared the caller's key against `process.env.INDEXNOW_KEY`.
 * That variable is not set in this deployment and deliberately so: F-144
 * removed the submitter's dependency on it, because the key is public by
 * construction — the whole ownership check is that anyone can fetch it at
 * /<key>.txt — and hiding a public value in an unvalidated env var only creates
 * a way for the path to be broken and look fine.
 *
 * With it unset, that comparison rejects every caller including us. Safe, but
 * only by accident, and it would have looked like a working endpoint.
 *
 * So the key is read from the route directory that serves it, exactly as
 * apps/web/scripts/notify-indexnow.mjs does. One fact, one place.
 *
 * A public key is not a secret and is not authentication in any real sense. It
 * is a shared value that raises the cost of casual abuse from zero to
 * "read the docs first", on an endpoint whose worst case is a wasted quota.
 * Anything that genuinely needs protecting does not live behind it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function repoKey(): string | null {
  try {
    const appDir = path.join(process.cwd(), 'app');
    const hit = fs
      .readdirSync(appDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^[0-9a-f]{8,64}\.txt$/i.test(e.name))
      .map((e) => e.name.replace(/\.txt$/i, ''));
    return hit.length === 1 ? hit[0]! : null;
  } catch {
    return null;
  }
}

/**
 * THE KEY IS PUBLIC BY DESIGN, SO THE URL LIST IS THE CONTROL.
 *
 * IndexNow verifies ownership by serving the key at /<key>.txt, which means
 * anyone can read it. Requiring it here stops nothing on its own. What limits
 * abuse is that this route will only ever submit URLs on the canonical host
 * (filterIndexNowUrls), at most a thousand per call, at most ten calls a
 * minute per client — so the worst a stranger can do is ask Bing to recrawl
 * pages of this site that already exist. CRON_SECRET, when set, is accepted as
 * a second credential so the deploy workflow does not need the public key.
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`indexnow:${getClientIp(req)}`, { windowMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) {
    return Response.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'retry-after': String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } });
  }

  const expected = process.env.INDEXNOW_KEY || repoKey();
  const provided =
    req.headers.get('x-indexnow-key') ?? new URL(req.url).searchParams.get('key');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const cronSecret = process.env.CRON_SECRET;
  const bearerOk = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!expected && !bearerOk) {
    return Response.json(
      { ok: false, error: 'key_unavailable' },
      { status: 503 },
    );
  }
  if (!bearerOk && provided !== expected) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { urls?: unknown };
  const filtered = filterIndexNowUrls(body?.urls);
  if (!filtered.ok) {
    return Response.json({ ok: false, error: filtered.error, ...(filtered.offending ? { offending: filtered.offending } : {}) }, { status: 400 });
  }

  const ok = await submitToIndexNow(filtered.urls);
  return Response.json({ ok, count: filtered.urls.length });
}
