import { afterEach, describe, expect, it, vi } from 'vitest';

const queryRawMock = vi.fn();
const executeRawMock = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
  },
}));

import { enforceRateLimit, cleanupIdleRateLimitBuckets } from './rate-limit-durable';

/**
 * The atomic refill+consume math itself is verified against a real
 * Postgres 16 (see the migration's comment for why a chain of
 * data-modifying CTEs silently returned zero rows, and why
 * `rate_limit_consume` is a plpgsql function instead) — that isn't
 * something a mocked `$queryRaw` can meaningfully re-prove. These tests
 * cover this module's own responsibilities: routing to the right SQL
 * inputs, the fail-open/fail-closed production decision, and never letting
 * a database problem crash the caller.
 */
describe('enforceRateLimit', () => {
  afterEach(() => {
    queryRawMock.mockReset();
  });

  it('passes the hashed key, capacity and per-ms refill rate to rate_limit_consume', async () => {
    queryRawMock.mockResolvedValueOnce([{ tokens: 4, allowed: true }]);

    const result = await enforceRateLimit({
      routeKey: 'assistant-chat',
      identity: '203.0.113.9',
      config: { windowMs: 60_000, maxRequests: 20 },
    });

    expect(result).toEqual({ allowed: true, remaining: 4, retryAfterSeconds: 0, degraded: false });
    const sql = queryRawMock.mock.calls[0]![0] as { values: unknown[] };
    // The raw IP never reaches the query — only its HMAC does.
    expect(sql.values[0]).not.toContain('203.0.113.9');
    expect(typeof sql.values[0]).toBe('string');
    expect((sql.values[0] as string)).toMatch(/^[0-9a-f]{64}$/);
    expect(sql.values[1]).toBe(20);
    expect(sql.values[2]).toBeCloseTo(20 / 60_000);
  });

  it('hashes the same routeKey+identity to the same key every time (deterministic)', async () => {
    queryRawMock.mockResolvedValue([{ tokens: 1, allowed: true }]);
    await enforceRateLimit({ routeKey: 'assistant-chat', identity: '203.0.113.9', config: { windowMs: 1000, maxRequests: 1 } });
    await enforceRateLimit({ routeKey: 'assistant-chat', identity: '203.0.113.9', config: { windowMs: 1000, maxRequests: 1 } });
    const [firstCallSql] = queryRawMock.mock.calls[0]! as [{ values: unknown[] }];
    const [secondCallSql] = queryRawMock.mock.calls[1]! as [{ values: unknown[] }];
    expect(firstCallSql.values[0]).toBe(secondCallSql.values[0]);
  });

  it('never collides two routes hitting the same identity onto the same bucket', async () => {
    queryRawMock.mockResolvedValue([{ tokens: 1, allowed: true }]);
    await enforceRateLimit({ routeKey: 'assistant-chat', identity: 'user-1', config: { windowMs: 1000, maxRequests: 1 } });
    await enforceRateLimit({ routeKey: 'assistant-analysis-run', identity: 'user-1', config: { windowMs: 1000, maxRequests: 1 } });
    const [chatSql] = queryRawMock.mock.calls[0]! as [{ values: unknown[] }];
    const [analysisSql] = queryRawMock.mock.calls[1]! as [{ values: unknown[] }];
    expect(chatSql.values[0]).not.toBe(analysisSql.values[0]);
  });

  it('reports denied with a computed Retry-After when the function returns allowed: false', async () => {
    // tokens: 0.5, capacity 2 over 1000ms => refillPerMs = 0.002/ms. Needs
    // 0.5 more tokens => 250ms => ceil(0.25s) => 1s.
    queryRawMock.mockResolvedValueOnce([{ tokens: 0.5, allowed: false }]);
    const result = await enforceRateLimit({ routeKey: 'r', identity: 'k', config: { windowMs: 1000, maxRequests: 2 } });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(result.degraded).toBe(false);
  });

  it('fails OPEN (bounded degradation via the in-memory bucket) on a free route when Postgres is unreachable', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection terminated'));
    const result = await enforceRateLimit({
      routeKey: `free-route-${Math.random()}`,
      identity: 'k',
      config: { windowMs: 60_000, maxRequests: 5 },
    });
    expect(result.allowed).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('fails CLOSED on a paid route (failClosed: true) when Postgres is unreachable', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection terminated'));
    const result = await enforceRateLimit({
      routeKey: 'assistant-analysis-run',
      identity: 'user-1',
      config: { windowMs: 60_000, maxRequests: 5 },
      failClosed: true,
    });
    expect(result).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 60, degraded: true });
  });

  it('the in-memory fallback tier itself still enforces a real limit, not unlimited access', async () => {
    queryRawMock.mockRejectedValue(new Error('connection terminated'));
    const routeKey = `free-route-${Math.random()}`;
    const config = { windowMs: 60_000, maxRequests: 2 };
    const first = await enforceRateLimit({ routeKey, identity: 'same-ip', config });
    const second = await enforceRateLimit({ routeKey, identity: 'same-ip', config });
    const third = await enforceRateLimit({ routeKey, identity: 'same-ip', config });
    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
  });

  it('fails open on an unexpectedly empty result set (treated as dbReachable with full bucket)', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const result = await enforceRateLimit({ routeKey: 'r', identity: 'k', config: { windowMs: 1000, maxRequests: 3 } });
    expect(result).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0, degraded: false });
  });
});

describe('cleanupIdleRateLimitBuckets', () => {
  it('deletes rows idle past the given age and returns the count', async () => {
    executeRawMock.mockResolvedValueOnce(7);
    const deleted = await cleanupIdleRateLimitBuckets(24 * 60 * 60 * 1000);
    expect(deleted).toBe(7);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });
});
