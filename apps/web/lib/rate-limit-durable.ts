/**
 * Durable (cross-instance) token-bucket rate limiter, backed by Postgres via
 * the existing Prisma client (`db`) — not a new infrastructure dependency.
 *
 * `lib/rate-limit.ts`'s in-memory bucket is correct for what it protects
 * today (lead-capture POSTs, where a false negative just means one more
 * throttled instance in a distributed flood — documented there). It is NOT
 * sufficient for POST /api/assistant/chat: each turn can run up to 8 tool
 * steps against a paid model, so a flood spread across serverless instances
 * — each with its own empty in-memory Map — was effectively unthrottled.
 *
 * The refill (continuous, `maxRequests` per `windowMs`) and the conditional
 * consume (spend one token only if >=1 is available) happen inside a single
 * Postgres function, `rate_limit_consume` (see the migration that created
 * it for why this is a plpgsql function and not a chain of data-modifying
 * CTEs — the CTE version silently returned zero rows every time). The
 * function's own `SELECT ... FOR UPDATE` holds the row lock for the rest of
 * the call, so two instances hitting the same key at the same moment
 * serialize instead of both reading the same pre-refill count and both
 * being allowed through.
 */
import { db } from './db';
import { Prisma } from '@prisma/client';

export interface DurableRateLimitConfig {
  windowMs: number; // refill period: maxRequests tokens per windowMs
  maxRequests: number; // bucket capacity
}

interface BucketRow {
  tokens: number;
  allowed: boolean;
}

/**
 * Check (and, if allowed, consume) one token for `key` under `config`.
 *
 * Fails OPEN on a database error: a rate limiter that is briefly unreachable
 * must never turn into an outage of the thing it is protecting. The route
 * calling this already has its own hard ceilings (body size, step count,
 * timeout) — this is abuse mitigation on top of those, not the only guard.
 */
export async function checkDurableRateLimit(
  key: string,
  config: DurableRateLimitConfig,
): Promise<{ allowed: boolean; remaining: number }> {
  const refillPerMs = config.maxRequests / config.windowMs;

  try {
    const rows = await db.$queryRaw<BucketRow[]>(
      Prisma.sql`SELECT * FROM "ecowoods"."rate_limit_consume"(${key}, ${config.maxRequests}::float8, ${refillPerMs}::float8)`,
    );

    const row = rows[0];
    if (!row) return { allowed: true, remaining: config.maxRequests };
    return { allowed: row.allowed, remaining: Math.max(0, Math.floor(row.tokens)) };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'rate_limit.durable_unavailable',
        error: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return { allowed: true, remaining: config.maxRequests };
  }
}
