/**
 * Durable (cross-instance) token-bucket rate limiter, backed by Postgres via
 * the existing Prisma client (`db`) — not a new infrastructure dependency.
 *
 * `lib/rate-limit.ts`'s in-memory bucket is correct for what it protects
 * today (lead-capture POSTs, where a false negative just means one more
 * throttled instance in a distributed flood — documented there). It is NOT
 * sufficient on its own for the assistant's model-backed routes: each chat
 * turn can run up to 8 tool steps against a paid model, and the analysis
 * route spends real Renovation Credits, so a flood spread across serverless
 * instances — each with its own empty in-memory Map — was effectively
 * unthrottled before this file existed.
 *
 * The refill (continuous, `maxRequests` per `windowMs`) and the conditional
 * consume (spend one token only if >=1 is available) happen inside a single
 * Postgres function, `rate_limit_consume` (see the migration that created
 * it for why this is a plpgsql function and not a chain of data-modifying
 * CTEs — the CTE version silently returned zero rows every time, verified
 * against a real Postgres 16). The function's own `SELECT ... FOR UPDATE`
 * holds the row lock for the rest of the call, so two instances hitting the
 * same key at the same moment serialize instead of both reading the same
 * pre-refill count and both being allowed through.
 */
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from './db';
import { Prisma } from '@prisma/client';
import { checkRateLimit as inMemoryCheckRateLimit } from './rate-limit';

export interface DurableRateLimitConfig {
  windowMs: number; // refill period: maxRequests tokens per windowMs
  maxRequests: number; // bucket capacity
}

interface BucketRow {
  tokens: number;
  allowed: boolean;
}

/**
 * Postgres-reachable outcome, or the caller-facing signal that it wasn't.
 * Deliberately does NOT decide allow/deny on its own when the database is
 * unreachable — see `enforceRateLimit`, which is where that production
 * decision belongs, because the right answer depends on what the caller is
 * protecting (a free chat turn vs. a paid, credit-charging analysis).
 */
type DurableCheckResult =
  | { dbReachable: true; allowed: boolean; remaining: number; retryAfterSeconds: number }
  | { dbReachable: false; cause: UnavailableCause };

/**
 * Why the durable limiter could not answer. `schema_missing` means Postgres
 * answered but the limiter's table/function does not exist (migrations behind
 * the code) — an operator problem, not an outage — and is logged distinctly so
 * it is not mistaken for a database outage.
 */
export type UnavailableCause = 'schema_missing' | 'db_error';

/** Postgres undefined_table / undefined_function, surfaced by Prisma raw queries. */
export function classifyLimiterError(err: unknown): UnavailableCause {
  const e = err as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown } | null;
  const pg = typeof e?.meta?.code === 'string' ? e.meta.code : undefined;
  if (pg === '42P01' || pg === '42883' || pg === '3F000') return 'schema_missing';
  if (e?.code === 'P2021') return 'schema_missing'; // table does not exist
  const msg = `${typeof e?.message === 'string' ? e.message : ''} ${typeof e?.meta?.message === 'string' ? e.meta.message : ''}`;
  if (/rate_limit_consume|RateLimitBucket/.test(msg) && /does not exist/i.test(msg)) return 'schema_missing';
  return 'db_error';
}

/**
 * Every raw identity (an IP address today) that reaches Postgres is HMAC'd
 * first — never stored or transmitted as plaintext. A bare SHA-256 of an
 * IPv4 address is not real pseudonymity: the whole /32 space is brute-forced
 * in well under a second, so anyone with read access to this table could
 * reverse every row back to a real IP. Keying the hash with `NEXTAUTH_SECRET`
 * (already the one app-wide secret this deployment cannot run without —
 * Auth.js session signing depends on it) makes that brute force require the
 * secret too, while staying fully deterministic: the same IP hitting the
 * same route within the same window still collides onto the same bucket,
 * which is the only property rate limiting actually needs from the key.
 *
 * `routeKey` is mixed into the hash input (not appended to the output) so
 * two routes never share a bucket even if Postgres or a future secret
 * rotation ever produced the same raw identity twice.
 */
function hashLimiterKey(routeKey: string, identity: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'ecowoods-rate-limit-dev-only';
  return createHmac('sha256', secret).update(`${routeKey}:${identity}`).digest('hex');
}

/**
 * Check (and, if allowed, consume) one token for `hashedKey` under `config`.
 * Returns `{ dbReachable: false }` on any database error — never throws.
 */
async function checkDurableRateLimit(hashedKey: string, config: DurableRateLimitConfig): Promise<DurableCheckResult> {
  const refillPerMs = config.maxRequests / config.windowMs;

  try {
    const rows = await db.$queryRaw<BucketRow[]>(
      Prisma.sql`SELECT * FROM "ecowoods"."rate_limit_consume"(${hashedKey}, ${config.maxRequests}::float8, ${refillPerMs}::float8)`,
    );

    const row = rows[0];
    if (!row) return { dbReachable: true, allowed: true, remaining: config.maxRequests, retryAfterSeconds: 0 };
    const retryAfterSeconds = row.allowed ? 0 : Math.max(1, Math.ceil((1 - row.tokens) / refillPerMs / 1000));
    return {
      dbReachable: true,
      allowed: row.allowed,
      remaining: Math.max(0, Math.floor(row.tokens)),
      retryAfterSeconds,
    };
  } catch (err) {
    const cause = classifyLimiterError(err);
    console.error(
      JSON.stringify({
        event: 'rate_limit.durable_unavailable',
        cause,
        error: err instanceof Error ? err.message.slice(0, 300) : 'unknown',
      }),
    );
    return { dbReachable: false, cause };
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** True when Postgres was unreachable and this decision came from the degraded fallback tier (or a fail-closed default) instead. */
  degraded: boolean;
  /**
   * True only when a `failClosed` caller was denied because the limiter could
   * not run (not because the caller is over its limit). Callers must answer
   * this with a retryable 503 — see `rateLimitDeniedResponse` — never a 429.
   */
  unavailable: boolean;
  /** Set with `unavailable`; names why the limiter could not run. */
  unavailableCause?: UnavailableCause;
}

/**
 * The one response a denied `RateLimitDecision` should become. A genuine
 * over-limit decision is a 429; a fail-closed denial caused by the limiter
 * being unavailable is an explicit, retryable 503 (still a denial — abuse
 * paths do not become fail-open).
 */
export function rateLimitDeniedResponse(rl: RateLimitDecision): NextResponse {
  if (rl.unavailable) {
    return NextResponse.json(
      { error: 'This service is temporarily unavailable. Please try again shortly.', code: 'rate_limiter_unavailable' },
      { status: 503, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }
  return NextResponse.json(
    { error: 'Please wait a moment before trying again.' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
  );
}

/**
 * The one call every assistant route should make. `routeKey` namespaces the
 * bucket (so /api/assistant/chat and /api/assistant/analysis/run never share
 * one), `identity` is the raw, not-yet-hashed value to key on (an IP, or a
 * userId for an authenticated route — see the two call sites for why they
 * differ).
 *
 * PRODUCTION FAILURE POSTURE — this is the actual decision the directive
 * asked for, not just a fallback in name:
 *
 *   `failClosed: true` (paid / credit-charging routes) — a database outage
 *   DENIES the request. An analysis run already touches this same Postgres
 *   for the credit charge itself, so a real outage fails it either way; the
 *   only thing failing closed HERE changes is that the failure happens
 *   before any Anthropic/compute cost is spent, not after.
 *
 *   `failClosed: false` (default; free routes like chat) — falls back to
 *   `lib/rate-limit.ts`'s existing in-memory bucket rather than allowing the
 *   request through uncounted. This is "bounded degradation": per-instance,
 *   not cross-instance, so a distributed flood during a genuine Postgres
 *   outage is throttled less precisely than normal — but it is still
 *   throttled, on the same existing infrastructure this repo already ships,
 *   not a silent open door to a paid LLM call.
 */
export async function enforceRateLimit(input: {
  routeKey: string;
  identity: string;
  config: DurableRateLimitConfig;
  failClosed?: boolean;
}): Promise<RateLimitDecision> {
  const hashedKey = hashLimiterKey(input.routeKey, input.identity);
  const result = await checkDurableRateLimit(hashedKey, input.config);

  if (result.dbReachable) {
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterSeconds: result.retryAfterSeconds,
      degraded: false,
      unavailable: false,
    };
  }

  if (input.failClosed) {
    console.error(
      JSON.stringify({
        event: 'rate_limit.fail_closed_denied',
        routeKey: input.routeKey,
        cause: result.cause,
      }),
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      degraded: true,
      unavailable: true,
      unavailableCause: result.cause,
    };
  }

  const fallback = inMemoryCheckRateLimit(`${input.routeKey}:${input.identity}`, input.config);
  return {
    allowed: fallback.allowed,
    remaining: fallback.remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((fallback.resetAt - Date.now()) / 1000)),
    degraded: true,
    unavailable: false,
  };
}

/**
 * Deletes buckets idle longer than `maxAgeMs` — without this, one row per
 * distinct hashed key accumulates forever. Called from the hourly
 * /api/cron/rate-limit-cleanup sweep (see vercel.json's `crons`), the same
 * pattern this repo already uses for review-requests/quote-recovery. Safe to
 * run at any time: a bucket this old has long since refilled to full, so
 * deleting it just means the next request re-creates it at full capacity —
 * identical behavior to a bucket that was never created.
 */
export async function cleanupIdleRateLimitBuckets(maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const deleted = await db.$executeRaw`
    DELETE FROM "ecowoods"."RateLimitBucket" WHERE "updatedAt" < ${cutoff}
  `;
  return deleted;
}
