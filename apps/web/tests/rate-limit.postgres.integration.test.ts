/**
 * Real PostgreSQL checks for the durable limiter (lib/rate-limit-durable.ts):
 * the real `rate_limit_consume()` function from the migration, fail-closed vs
 * fail-open, and the `schema_missing` classification against a scratch
 * database that lacks the function/table. Runs only with
 * RUN_POSTGRES_INTEGRATION=1 against a disposable database.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

// lib/rate-limit-durable.ts reads `db` through this holder so one test can
// point it at a scratch database that has no limiter schema.
const holder = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, { get: (_t, prop) => (holder.client as unknown as Record<string | symbol, unknown>)[prop] }),
}));

const MIGRATION = readFileSync(
  path.join(__dirname, '../prisma/migrations/20260929000000_add_rate_limit_bucket/migration.sql'),
  'utf8',
);
const CREATE_TABLE = MIGRATION.slice(MIGRATION.indexOf('CREATE TABLE'), MIGRATION.indexOf(');', MIGRATION.indexOf('CREATE TABLE')) + 2);
const CREATE_FUNCTION = MIGRATION.slice(MIGRATION.indexOf('CREATE FUNCTION')).trim();

const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

describe.skipIf(!enabled)('durable rate limiter against real PostgreSQL', () => {
  let main: PrismaClient;
  const scratchName = `ew_scratch_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const urlFor = (dbName: string) => {
    const u = new URL(process.env.DATABASE_URL!);
    u.pathname = `/${dbName}`;
    return u.toString();
  };

  beforeAll(() => {
    main = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    holder.client = main;
  });

  afterAll(async () => {
    holder.client = main;
    await main.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`).catch(() => undefined);
    await main.$disconnect();
  });

  it('allows exactly maxRequests then denies, via the real consume function', async () => {
    const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
    const identity = `ip-${randomUUID()}`;
    const config = { windowMs: 60_000, maxRequests: 3 };
    const decisions = [];
    for (let i = 0; i < 5; i++) decisions.push(await enforceRateLimit({ routeKey: 'it-seq', identity, config }));
    expect(decisions.map((d) => d.allowed)).toEqual([true, true, true, false, false]);
    expect(decisions.every((d) => !d.degraded && !d.unavailable)).toBe(true);
    expect(decisions[3]!.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(decisions[0]!.remaining).toBe(2);
  });

  it('serializes true concurrency: N parallel callers get exactly capacity tokens', async () => {
    const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
    const identity = `ip-${randomUUID()}`;
    const config = { windowMs: 3_600_000, maxRequests: 4 };
    const results = await Promise.all(
      Array.from({ length: 16 }, () => enforceRateLimit({ routeKey: 'it-par', identity, config })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
  });

  it('never shares a bucket across routeKeys, and stores only an HMAC of the identity', async () => {
    const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
    const identity = `203.0.113.${Math.floor(Math.random() * 200)}-${randomUUID()}`;
    const config = { windowMs: 3_600_000, maxRequests: 1 };
    expect((await enforceRateLimit({ routeKey: 'it-a', identity, config })).allowed).toBe(true);
    expect((await enforceRateLimit({ routeKey: 'it-a', identity, config })).allowed).toBe(false);
    expect((await enforceRateLimit({ routeKey: 'it-b', identity, config })).allowed).toBe(true);
    const rows = await main.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "ecowoods"."RateLimitBucket" WHERE "key" = ${identity}`;
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('cleanupIdleRateLimitBuckets deletes only idle buckets', async () => {
    const { cleanupIdleRateLimitBuckets } = await import('@/lib/rate-limit-durable');
    const stale = `stale-${randomUUID()}`;
    const fresh = `fresh-${randomUUID()}`;
    await main.$executeRaw`INSERT INTO "ecowoods"."RateLimitBucket" ("key","tokens","updatedAt") VALUES (${stale}, 1, now() - interval '2 days'), (${fresh}, 1, now())`;
    expect(await cleanupIdleRateLimitBuckets(24 * 3_600_000)).toBeGreaterThanOrEqual(1);
    const left = await main.$queryRaw<{ key: string }[]>`SELECT "key" FROM "ecowoods"."RateLimitBucket" WHERE "key" IN (${stale}, ${fresh})`;
    expect(left.map((r) => r.key)).toEqual([fresh]);
  });

  describe('when the limiter schema is missing', () => {
    let scratch: PrismaClient;

    beforeAll(async () => {
      await main.$executeRawUnsafe(`CREATE DATABASE "${scratchName}"`);
      scratch = new PrismaClient({ datasources: { db: { url: urlFor(scratchName) } } });
      await scratch.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS ecowoods');
    });

    afterAll(async () => {
      await scratch.$disconnect();
    });

    const config = { windowMs: 60_000, maxRequests: 2 };

    it('classifies a dropped function as schema_missing and fails closed with unavailable', async () => {
      holder.client = scratch; // schema exists, neither table nor function does
      const spy = quiet();
      const { enforceRateLimit, rateLimitDeniedResponse } = await import('@/lib/rate-limit-durable');
      const rl = await enforceRateLimit({ routeKey: 'it-missing', identity: 'x', config, failClosed: true });
      spy.mockRestore();
      expect(rl).toMatchObject({ allowed: false, unavailable: true, degraded: true, unavailableCause: 'schema_missing' });
      const res = rateLimitDeniedResponse(rl);
      expect(res.status).toBe(503);
      expect((await res.json()).code).toBe('rate_limiter_unavailable');
    });

    it('fails open (in-memory fallback, still counted) for non-failClosed callers', async () => {
      holder.client = scratch;
      const spy = quiet();
      const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
      const identity = `mem-${randomUUID()}`;
      const a = await enforceRateLimit({ routeKey: 'it-open', identity, config });
      const b = await enforceRateLimit({ routeKey: 'it-open', identity, config });
      const c = await enforceRateLimit({ routeKey: 'it-open', identity, config });
      spy.mockRestore();
      expect([a.allowed, b.allowed, c.allowed]).toEqual([true, true, false]);
      expect(a).toMatchObject({ degraded: true, unavailable: false });
    });

    it('classifies a function whose table was dropped as schema_missing', async () => {
      holder.client = scratch;
      await scratch.$executeRawUnsafe(CREATE_TABLE);
      await scratch.$executeRawUnsafe(CREATE_FUNCTION);
      const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
      const ok = await enforceRateLimit({ routeKey: 'it-present', identity: 'y', config, failClosed: true });
      expect(ok).toMatchObject({ allowed: true, degraded: false });

      await scratch.$executeRawUnsafe('DROP TABLE "ecowoods"."RateLimitBucket"');
      const spy = quiet();
      const rl = await enforceRateLimit({ routeKey: 'it-present', identity: 'y', config, failClosed: true });
      spy.mockRestore();
      expect(rl).toMatchObject({ allowed: false, unavailable: true, unavailableCause: 'schema_missing' });
    });

    it('classifies an unreachable database as db_error, not schema_missing', async () => {
      const dead = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres@127.0.0.1:1/nope?schema=ecowoods&connect_timeout=2' } } });
      holder.client = dead;
      const spy = quiet();
      const { enforceRateLimit } = await import('@/lib/rate-limit-durable');
      const rl = await enforceRateLimit({ routeKey: 'it-dead', identity: 'z', config, failClosed: true });
      spy.mockRestore();
      await dead.$disconnect();
      expect(rl).toMatchObject({ allowed: false, unavailable: true, unavailableCause: 'db_error' });
    });
  });
});
