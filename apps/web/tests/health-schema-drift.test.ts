/**
 * /api/internal/schema-status (bearer-protected) reports "schema behind code": migration NAMES the build expects
 * that `_prisma_migrations` has no finished row for. DB and upstream mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const q = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => q.fn(...a) } }));
vi.mock('@/lib/market', () => ({
  VALET_BASE: 'https://valet.test',
  getSeries: () => [{ id: 'FX', name: 'FX', frequency: 'daily' }],
  fetchSeries: async () => [{ id: 'FX', latest: { date: new Date().toISOString().slice(0, 10), value: 1 } }],
}));

import { checkSchemaDrift, listExpectedMigrations } from '@/lib/schema-drift';
import { GET } from '@/app/api/internal/schema-status/route';

const EXPECTED = ['20260620000002_init', '20260929000000_add_rate_limit_bucket', '20261021000000_x'];

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://u:p@h/db';
  q.fn.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('checkSchemaDrift', () => {
  it('lists the real migrations directory, sorted, names only', () => {
    const names = listExpectedMigrations()!;
    expect(names.length).toBeGreaterThan(5);
    expect(names).toEqual([...names].sort());
    expect(names).toContain('20260929000000_add_rate_limit_bucket');
  });

  it('reports ok when every expected migration is finished', async () => {
    q.fn.mockResolvedValueOnce([{ table_schema: 'public' }]).mockResolvedValueOnce(EXPECTED.map((migration_name) => ({ migration_name })));
    expect(await checkSchemaDrift(EXPECTED)).toEqual({ status: 'ok', expected: 3, applied: 3, missing: [] });
  });

  it('reports behind with the missing names', async () => {
    q.fn.mockResolvedValueOnce([{ table_schema: 'public' }]).mockResolvedValueOnce([{ migration_name: EXPECTED[0] }]);
    expect(await checkSchemaDrift(EXPECTED)).toEqual({ status: 'behind', expected: 3, applied: 1, missing: [EXPECTED[1], EXPECTED[2]] });
  });

  it('reports behind (everything missing) when there is no _prisma_migrations table', async () => {
    q.fn.mockResolvedValueOnce([]);
    const r = await checkSchemaDrift(EXPECTED);
    expect(r.status).toBe('behind');
    expect(r.missing).toEqual(EXPECTED);
  });

  it('never throws: a query error is unknown/query_failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    q.fn.mockRejectedValueOnce(new Error('connection terminated'));
    expect(await checkSchemaDrift(EXPECTED)).toEqual({ status: 'unknown', reason: 'query_failed', missing: [] });
  });

  it('is unknown without DATABASE_URL and does not query', async () => {
    delete process.env.DATABASE_URL;
    expect((await checkSchemaDrift(EXPECTED)).status).toBe('unknown');
    expect(q.fn).not.toHaveBeenCalled();
  });
});

describe('GET /api/internal/schema-status', () => {
  const call = (auth?: string) =>
    GET(new Request('https://ecowoods.ca/api/internal/schema-status', auth ? { headers: { authorization: auth } } : undefined));

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('refuses callers without the bearer secret and never queries', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(q.fn).not.toHaveBeenCalled();
  });

  it('names the missing migrations for an authorised caller, uncached and noindex', async () => {
    // Ledger queries answered; the structural catalog queries fail, which must read as unknown (not ok).
    vi.spyOn(console, 'error').mockImplementation(() => {});
    q.fn.mockImplementation(async (...a: unknown[]) => {
      const first = a[0] as { strings?: string[]; sql?: string } | string[];
      const sql = Array.isArray(first) ? first.join('?') : (first.sql ?? first.strings?.join('?') ?? '');
      if (sql.includes("table_name = '_prisma_migrations'")) return [{ table_schema: 'public' }];
      if (sql.includes('"_prisma_migrations"')) return [{ migration_name: '20260620000002_init' }];
      throw new Error('catalog unavailable');
    });
    const res = await call('Bearer test-secret');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(body.ok).toBe(false);
    expect(body.status).toBe('behind');
    expect(body.ledger.status).toBe('behind');
    expect(body.ledger.missing).toContain('20260929000000_add_rate_limit_bucket');
    expect(body.structure.status).toBe('unknown');
    expect(JSON.stringify(body)).not.toContain('postgresql://');
  });
});

describe('GET /api/health stays free of schema detail', () => {
  it('does not mention migrations or schema state', async () => {
    const { GET: health } = await import('@/app/api/health/route');
    const text = JSON.stringify(await (await health()).json());
    expect(text).not.toMatch(/migration|schemaStatus|"schema"/i);
  });
});
