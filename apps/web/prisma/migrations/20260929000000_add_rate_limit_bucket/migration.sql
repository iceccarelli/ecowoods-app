-- Durable token bucket for POST /api/assistant/chat, replacing the
-- in-memory `Map` that reset per cold start and was never shared across
-- concurrent serverless instances (a distributed flood was effectively
-- unlimited). One row per limiter key (the client IP today).
--
-- No foreign keys, no cascade — this table is disposable bookkeeping, not a
-- business record. Safe to `migrate deploy` against a live database: it is
-- a brand-new table, nothing existing changes shape.

-- CreateTable
CREATE TABLE "ecowoods"."RateLimitBucket" (
    "key" VARCHAR(200) NOT NULL,
    "tokens" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- A plpgsql function, not a chain of data-modifying CTEs: Postgres gives every
-- CTE in one WITH clause the SAME statement-start snapshot, so a later CTE
-- that re-scans the base table (`UPDATE ... FROM earlier_cte WHERE
-- base.key = earlier_cte.key`) does NOT see a row an earlier CTE in that same
-- statement just INSERTed — it sees the base table as it stood BEFORE the
-- statement ran, which for a first-ever key is empty, so the join matches
-- zero rows. (Verified against a real Postgres 16 while building this: the
-- two-CTE version returned zero rows for every call.) A function's
-- statements execute sequentially and see each other's writes, which is
-- exactly what refill-then-consume needs.
--
-- SELECT ... FOR UPDATE holds the row lock for the rest of this function
-- call, which — called as a single statement with no surrounding explicit
-- transaction — is the whole implicit transaction. Two instances racing on
-- the same key serialize on that lock instead of both reading the same
-- pre-refill token count and both being allowed through.
CREATE FUNCTION "ecowoods"."rate_limit_consume"(
  p_key VARCHAR(200),
  p_capacity DOUBLE PRECISION,
  p_rate_per_ms DOUBLE PRECISION
) RETURNS TABLE(tokens DOUBLE PRECISION, allowed BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tokens DOUBLE PRECISION;
  v_updated_at TIMESTAMPTZ;
  v_refilled DOUBLE PRECISION;
  v_allowed BOOLEAN;
BEGIN
  INSERT INTO "ecowoods"."RateLimitBucket" AS b ("key", "tokens", "updatedAt")
  VALUES (p_key, p_capacity, now())
  ON CONFLICT ("key") DO NOTHING;

  SELECT b."tokens", b."updatedAt" INTO v_tokens, v_updated_at
  FROM "ecowoods"."RateLimitBucket" b
  WHERE b."key" = p_key
  FOR UPDATE;

  v_refilled := LEAST(p_capacity, v_tokens + (EXTRACT(EPOCH FROM (now() - v_updated_at)) * 1000 * p_rate_per_ms));
  v_allowed := v_refilled >= 1;

  UPDATE "ecowoods"."RateLimitBucket" b
  SET "tokens" = v_refilled - CASE WHEN v_allowed THEN 1 ELSE 0 END,
      "updatedAt" = now()
  WHERE b."key" = p_key;

  RETURN QUERY SELECT (v_refilled - CASE WHEN v_allowed THEN 1 ELSE 0 END), v_allowed;
END;
$$;
