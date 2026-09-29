import { describe, expect, it, vi } from 'vitest';

const queryRawMock = vi.fn();
vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...args: unknown[]) => queryRawMock(...args) } }));

import { checkDurableRateLimit } from './rate-limit-durable';

/**
 * The atomic refill+consume math itself is verified against a real
 * Postgres 16 (see the migration's comment for why a chain of
 * data-modifying CTEs silently returned zero rows, and why this is a
 * plpgsql function instead) — that isn't something a mocked `$queryRaw`
 * can meaningfully re-prove. These tests cover the one thing that IS this
 * module's own responsibility: passing the right key/capacity/rate, and
 * never letting a database problem become an outage of the route calling it.
 */
describe('checkDurableRateLimit', () => {
  it('passes the key, capacity and per-ms refill rate to rate_limit_consume', async () => {
    queryRawMock.mockResolvedValueOnce([{ tokens: 4, allowed: true }]);

    const result = await checkDurableRateLimit('assistant-chat:203.0.113.9', {
      windowMs: 60_000,
      maxRequests: 20,
    });

    expect(result).toEqual({ allowed: true, remaining: 4 });
    const sql = queryRawMock.mock.calls[0]![0] as { values: unknown[] };
    expect(sql.values).toEqual(['assistant-chat:203.0.113.9', 20, 20 / 60_000]);
  });

  it('reports denied when the function returns allowed: false', async () => {
    queryRawMock.mockResolvedValueOnce([{ tokens: 0.2, allowed: false }]);
    const result = await checkDurableRateLimit('k', { windowMs: 1000, maxRequests: 1 });
    expect(result).toEqual({ allowed: false, remaining: 0 });
  });

  it('fails open — never blocks chat because the limiter table is unreachable', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection terminated'));
    const result = await checkDurableRateLimit('k', { windowMs: 1000, maxRequests: 5 });
    expect(result).toEqual({ allowed: true, remaining: 5 });
  });

  it('fails open on an unexpectedly empty result set', async () => {
    queryRawMock.mockResolvedValueOnce([]);
    const result = await checkDurableRateLimit('k', { windowMs: 1000, maxRequests: 3 });
    expect(result).toEqual({ allowed: true, remaining: 3 });
  });
});
