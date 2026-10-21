/**
 * The paid analysis routes must answer a durable-limiter denial through
 * rateLimitDeniedResponse(): a genuine over-limit is 429, a fail-closed denial
 * because the limiter itself could not run is a retryable 503 (never a 429).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rl = vi.hoisted(() => ({ decision: null as null | Record<string, unknown> }));

vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: 'user-1', email: 'a@example.test', role: 'CLIENT' } }) }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/stripe', () => ({ stripe: {} }));
vi.mock('@/lib/rate-limit-durable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit-durable')>();
  return { ...actual, enforceRateLimit: async () => rl.decision };
});

const post = (url: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

describe.each([
  ['analysis/run', () => import('@/app/api/assistant/analysis/run/route'), 'http://localhost/api/assistant/analysis/run'],
  ['analysis/checkout', () => import('@/app/api/assistant/analysis/checkout/route'), 'http://localhost/api/assistant/analysis/checkout'],
])('%s limiter denial', (_name, load, url) => {
  beforeEach(() => {
    rl.decision = null;
  });

  it('maps an over-limit denial to 429 with Retry-After', async () => {
    rl.decision = { allowed: false, remaining: 0, retryAfterSeconds: 12, degraded: false, unavailable: false };
    const { POST } = await load();
    const res = await POST(post(url));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
  });

  it('maps a fail-closed limiter outage to a retryable 503, not 429', async () => {
    rl.decision = { allowed: false, remaining: 0, retryAfterSeconds: 30, degraded: true, unavailable: true, unavailableCause: 'db_error' };
    const { POST } = await load();
    const res = await POST(post(url));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect((await res.json()).code).toBe('rate_limiter_unavailable');
  });
});
