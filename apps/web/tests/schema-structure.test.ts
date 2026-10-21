/**
 * Structural schema check (lib/schema-drift.ts): the live catalog compared with
 * what this build's Prisma datamodel expects. The database is mocked here (a SQL
 * router over the catalog queries); tests/schema-structure.postgres.integration
 * .test.ts proves the same checks against a real PostgreSQL.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const q = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => q.fn(...a) } }));

import {
  buildExpectedStructure,
  checkSchemaHealth,
  checkSchemaStructure,
  diffStructure,
  parseSchemaText,
  type ActualStructure,
  type DmmfDatamodel,
  type ExpectedStructure,
} from '@/lib/schema-drift';
import { GET } from '@/app/api/internal/schema-status/route';

const datamodel = Prisma.dmmf.datamodel as unknown as DmmfDatamodel;
const schemaText = readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
const MIGRATIONS = ['20260620000002_init', '20260929000000_add_rate_limit_bucket'];

/** The catalog a perfectly migrated database would return for `exp`. */
function perfectActual(exp: ExpectedStructure): ActualStructure {
  return {
    tables: exp.tables.map((t) => t.name),
    columns: exp.tables.flatMap((t) =>
      t.columns.map((c) => ({
        table: t.name, column: c.name, udt: c.accept[0], nullable: c.nullable,
        maxLength: c.maxLength ?? null, precision: c.precision ?? null, scale: c.scale ?? null,
      })),
    ),
    indexes: exp.tables.flatMap((t) => t.indexes.map((i) => ({ table: t.name, columns: i.columns, unique: i.unique }))),
    foreignKeys: exp.tables.flatMap((t) => t.foreignKeys.map((f) => ({ table: t.name, ...f }))),
    enums: exp.enums.flatMap((e) => e.values.map((value) => ({ name: e.name, value }))),
    functions: ['rate_limit_consume'],
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('expected structure from the real Prisma datamodel', () => {
  const exp = buildExpectedStructure(datamodel, schemaText);

  it('covers every model, the native column types and the @@index lists', () => {
    expect(exp.tables.length).toBe(datamodel.models.length);
    expect(exp.precision).toBe('native');
    expect(exp.indexesDerivable).toBe(true);
    const qr = exp.tables.find((t) => t.name === 'QuoteRequest')!;
    expect(qr.columns.find((c) => c.name === 'designCode')).toMatchObject({ accept: ['varchar'], maxLength: 400, nullable: true });
    expect(qr.columns.find((c) => c.name === 'id')).toMatchObject({ accept: ['uuid'], nullable: false });
    expect(qr.columns.find((c) => c.name === 'quotedAmount')).toMatchObject({ accept: ['numeric'], precision: 12, scale: 2 });
    expect(qr.columns.find((c) => c.name === 'createdAt')).toMatchObject({ accept: ['timestamptz'] });
    expect(qr.indexes).toContainEqual({ columns: ['designId'], unique: false });
    expect(qr.indexes).toContainEqual({ columns: ['projectId'], unique: true });
    expect(qr.foreignKeys).toContainEqual({ columns: ['userId'], refTable: 'User', refColumns: ['id'] });
  });

  it('expects composite unique constraints and enum value sets', () => {
    const acct = exp.tables.find((t) => t.name === 'Account')!;
    expect(acct.indexes).toContainEqual({ columns: ['provider', 'providerAccountId'], unique: true });
    expect(exp.enums.find((e) => e.name === 'UserRole')?.values).toEqual(['USER', 'ADMIN']);
  });

  it('falls back to type families, and says so, when schema.prisma is unavailable', () => {
    const fam = buildExpectedStructure(datamodel, null);
    expect(fam.precision).toBe('family');
    expect(fam.indexesDerivable).toBe(false);
    const col = fam.tables.find((t) => t.name === 'QuoteRequest')!.columns.find((c) => c.name === 'createdAt')!;
    expect(col.accept).toContain('timestamptz');
    expect(fam.tables.flatMap((t) => t.indexes).some((i) => !i.unique)).toBe(false);
  });

  it('parses @db types and @@index lists, ignoring sort/length arguments and comments', () => {
    const m = parseSchemaText(`model A {\n  id String @id @db.Uuid // c\n  n Decimal @db.Decimal(12, 2)\n  @@index([a, b(sort: Desc)], map: "x")\n}\nmodel B {\n  x Int\n}`);
    expect(m.get('A')!.natives.get('id')).toEqual({ type: 'Uuid', args: [] });
    expect(m.get('A')!.natives.get('n')).toEqual({ type: 'Decimal', args: [12, 2] });
    expect(m.get('A')!.indexes).toEqual([['a', 'b']]);
    expect(m.get('B')!.natives.size).toBe(0);
  });
});

describe('diffStructure', () => {
  const exp = buildExpectedStructure(datamodel, schemaText);

  it('is ok for a perfectly matching catalog', () => {
    const r = diffStructure(exp, perfectActual(exp));
    expect(r.status).toBe('ok');
    expect(r.checked).toEqual(expect.arrayContaining(['tables', 'columns', 'column_types', 'nullability', 'indexes', 'unique_constraints', 'foreign_keys', 'enum_values']));
    for (const k of ['tablesMissing', 'columnsMissing', 'columnsUnexpected', 'indexesMissing', 'fksMissing', 'columnTypeMismatches', 'nullabilityMismatches', 'enumValuesMissing'] as const) {
      expect(r[k]).toEqual([]);
    }
  });

  it('detects a dropped column', () => {
    const a = perfectActual(exp);
    a.columns = a.columns.filter((c) => !(c.table === 'QuoteRequest' && c.column === 'designCode'));
    const r = diffStructure(exp, a);
    expect(r.status).toBe('drifted');
    expect(r.columnsMissing).toEqual(['QuoteRequest.designCode']);
  });

  it('detects a missing table, index, unique index and foreign key', () => {
    const a = perfectActual(exp);
    a.tables = a.tables.filter((t) => t !== 'RateLimitBucket');
    a.indexes = a.indexes.filter((i) => !(i.table === 'QuoteRequest' && i.columns.join() === 'designId'));
    a.indexes = a.indexes.filter((i) => !(i.table === 'QuoteRequest' && i.columns.join() === 'projectId'));
    a.foreignKeys = a.foreignKeys.filter((f) => !(f.table === 'QuoteRequest' && f.columns.join() === 'userId'));
    const r = diffStructure(exp, a);
    expect(r.status).toBe('drifted');
    expect(r.tablesMissing).toEqual(['RateLimitBucket']);
    expect(r.indexesMissing).toContain('QuoteRequest(designId)');
    expect(r.indexesMissing).toContain('QuoteRequest(projectId) unique');
    expect(r.fksMissing).toEqual(['QuoteRequest(userId)->User(id)']);
  });

  it('a non-unique index does not satisfy a unique expectation', () => {
    const a = perfectActual(exp);
    a.indexes = a.indexes.map((i) => (i.table === 'QuoteRequest' && i.columns.join() === 'projectId' ? { ...i, unique: false } : i));
    expect(diffStructure(exp, a).indexesMissing).toEqual(['QuoteRequest(projectId) unique']);
  });

  it('detects type and nullability drift', () => {
    const a = perfectActual(exp);
    const col = (t: string, c: string) => a.columns.find((x) => x.table === t && x.column === c)!;
    col('QuoteRequest', 'id').udt = 'text';
    col('QuoteRequest', 'designCode').maxLength = 100;
    col('QuoteRequest', 'name').nullable = true;
    const r = diffStructure(exp, a);
    expect(r.status).toBe('drifted');
    expect(r.columnTypeMismatches).toEqual([
      'QuoteRequest.id: expected uuid, found text',
      'QuoteRequest.designCode: expected varchar(400), found varchar(100)',
    ]);
    expect(r.nullabilityMismatches).toEqual(['QuoteRequest.name: expected NOT NULL, found NULL']);
  });

  it('detects a missing enum value and type', () => {
    const a = perfectActual(exp);
    a.enums = a.enums.filter((e) => !(e.name === 'UserRole' && e.value === 'ADMIN') && e.name !== 'QuoteStatus');
    const r = diffStructure(exp, a);
    expect(r.status).toBe('drifted');
    expect(r.enumValuesMissing).toEqual(expect.arrayContaining(['UserRole: ADMIN', 'QuoteStatus: type missing']));
  });

  it('extra columns/tables mean "ahead" (e.g. a code rollback), never "ok" and never "drifted"', () => {
    const a = clone(perfectActual(exp));
    a.columns.push({ table: 'User', column: 'newer', udt: 'text', nullable: true, maxLength: null, precision: null, scale: null });
    a.tables.push('NewerTable', '_prisma_migrations');
    const r = diffStructure(exp, a);
    expect(r.status).toBe('ahead');
    expect(r.columnsUnexpected).toEqual(['User.newer']);
    expect(r.tablesUnexpected).toEqual(['NewerTable']);
  });

  it('breaking drift outranks "ahead"', () => {
    const a = perfectActual(exp);
    a.tables.push('NewerTable');
    a.columns = a.columns.slice(1);
    expect(diffStructure(exp, a).status).toBe('drifted');
  });

  it('skips non-unique index checks (and does not claim them) without schema.prisma', () => {
    const fam = buildExpectedStructure(datamodel, null);
    const r = diffStructure(fam, perfectActual(fam));
    expect(r.status).toBe('ok');
    expect(r.checked).not.toContain('indexes');
    expect(r.typePrecision).toBe('family');
  });

  it('caps long lists and flags truncation', () => {
    const r = diffStructure(exp, { tables: [], columns: [], indexes: [], foreignKeys: [], enums: [], functions: [] });
    expect(r.tablesMissing.length).toBe(exp.tables.length);
    const big: ExpectedStructure = {
      ...exp,
      tables: Array.from({ length: 150 }, (_, i) => ({ name: `T${i}`, columns: [], indexes: [], foreignKeys: [] })),
    };
    const rb = diffStructure(big, { tables: [], columns: [], indexes: [], foreignKeys: [], enums: [], functions: [] });
    expect(rb.tablesMissing.length).toBe(100);
    expect(rb.truncated).toBe(true);
  });
});

/** Answers the catalog queries from a fixed `ActualStructure`; routes by SQL text. */
function mockCatalog(actual: ActualStructure, ledgerNames: string[] | 'no_table' = MIGRATIONS) {
  q.fn.mockImplementation(async (...args: unknown[]) => {
    const first = args[0] as { strings?: string[]; sql?: string } | string[];
    const sql = (Array.isArray(first) ? first.join('?') : (first.sql ?? first.strings?.join('?') ?? '')).replace(/\s+/g, ' ');
    if (sql.includes("table_name = '_prisma_migrations'")) return ledgerNames === 'no_table' ? [] : [{ table_schema: 'public' }];
    if (sql.includes('_prisma_migrations')) return (ledgerNames as string[]).map((migration_name) => ({ migration_name }));
    if (sql.includes('information_schema.tables')) return actual.tables.map((table_name) => ({ table_name }));
    if (sql.includes('information_schema.columns')) {
      return actual.columns.map((c) => ({
        table_name: c.table, column_name: c.column, udt_name: c.udt, is_nullable: c.nullable ? 'YES' : 'NO',
        character_maximum_length: c.maxLength, numeric_precision: c.precision, numeric_scale: c.scale,
      }));
    }
    if (sql.includes('FROM pg_index')) return actual.indexes.map((i) => ({ table_name: i.table, is_unique: i.unique, columns: i.columns }));
    if (sql.includes('FROM pg_constraint')) {
      return actual.foreignKeys.map((f) => ({ table_name: f.table, columns: f.columns, ref_table: f.refTable, ref_columns: f.refColumns }));
    }
    if (sql.includes('pg_enum')) return actual.enums.map((e) => ({ type_name: e.name, label: e.value }));
    if (sql.includes('pg_proc')) return actual.functions.map((proname) => ({ proname }));
    throw new Error(`unrouted query: ${sql.slice(0, 80)}`);
  });
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://u:p@h/db';
  q.fn.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('checkSchemaStructure / checkSchemaHealth (mocked catalog)', () => {
  const exp = buildExpectedStructure(datamodel, schemaText);

  it('reports overall ok only when ledger, structure and function all pass', async () => {
    mockCatalog(perfectActual(exp));
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.status).toBe('ok');
    expect(r.ledger).toMatchObject({ status: 'ok', expected: 2, applied: 2, missing: [] });
    expect(r.structure.status).toBe('ok');
    expect(r.functions).toMatchObject({ status: 'ok', checked: ['rate_limit_consume'], missing: [] });
  });

  it('ledger equal does NOT make a drifted structure ok', async () => {
    const a = perfectActual(exp);
    a.columns = a.columns.filter((c) => !(c.table === 'User' && c.column === 'email'));
    mockCatalog(a);
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.ledger.status).toBe('ok');
    expect(r.structure).toMatchObject({ status: 'drifted', columnsMissing: ['User.email'] });
    expect(r.status).toBe('drifted');
  });

  it('a missing rate_limit_consume is drift', async () => {
    mockCatalog({ ...perfectActual(exp), functions: [] });
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.functions).toMatchObject({ status: 'missing', missing: ['rate_limit_consume'] });
    expect(r.status).toBe('drifted');
  });

  it('a behind ledger is reported as behind even when the structure is fine', async () => {
    mockCatalog(perfectActual(exp), [MIGRATIONS[0]]);
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.status).toBe('behind');
    expect(r.ledger).toMatchObject({ status: 'behind', missing: [MIGRATIONS[1]] });
  });

  it('states what it does not check, never "ok" for things it cannot see', async () => {
    mockCatalog(perfectActual(exp));
    const r = await checkSchemaHealth(MIGRATIONS);
    const limits = r.limits.join(' ');
    expect(limits).toMatch(/Function bodies/);
    expect(limits).toMatch(/defaults/);
    expect(limits).toMatch(/Row data/);
    expect(r.ledger.verifies).toMatch(/Says nothing about whether the tables/);
  });

  it('never throws: a catalog query error is unknown, and the log carries no message text', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    q.fn.mockRejectedValue(new Error('password authentication failed for user "secretuser" at db.internal.example'));
    const { structure, functions } = await checkSchemaStructure();
    expect(structure).toEqual({ status: 'unknown', reason: 'query_failed' });
    expect(functions).toEqual({ status: 'unknown', reason: 'query_failed' });
    const logged = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('health.schema_structure_query_failed');
    expect(logged).not.toMatch(/secretuser|db\.internal/);
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.status).toBe('unknown');
  });

  it('is unknown without DATABASE_URL and runs no query', async () => {
    delete process.env.DATABASE_URL;
    const r = await checkSchemaHealth(MIGRATIONS);
    expect(r.status).toBe('unknown');
    expect(q.fn).not.toHaveBeenCalled();
  });

  it('only ever issues catalog queries: no table data is read', async () => {
    mockCatalog(perfectActual(exp));
    await checkSchemaHealth(MIGRATIONS);
    for (const call of q.fn.mock.calls) {
      const first = call[0] as { strings?: string[]; sql?: string } | string[];
      const sql = Array.isArray(first) ? first.join('?') : (first.sql ?? first.strings?.join('?') ?? '');
      expect(sql).toMatch(/information_schema|pg_catalog|pg_index|pg_constraint|pg_enum|pg_proc|_prisma_migrations/);
      expect(sql).not.toMatch(/FROM\s+"?ecowoods"?\."/i);
    }
  });
});

describe('GET /api/internal/schema-status (structure sections)', () => {
  const exp = buildExpectedStructure(datamodel, schemaText);
  const call = (auth?: string) =>
    GET(new Request('https://ecowoods.ca/api/internal/schema-status', auth ? { headers: { authorization: auth } } : undefined));

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('anonymous callers get 401 and trigger no query', async () => {
    expect((await call()).status).toBe(401);
    expect((await call('Bearer nope')).status).toBe(401);
    expect(q.fn).not.toHaveBeenCalled();
  });

  it('returns separate named sections, uncached and noindex, with no connection detail', async () => {
    const a = perfectActual(exp);
    a.columns = a.columns.filter((c) => !(c.table === 'User' && c.column === 'email'));
    mockCatalog(a, [MIGRATIONS[0]]);
    // the route reads the real migrations dir, so the ledger is "behind" here; structure is drifted
    const res = await call('Bearer test-secret');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(body.ok).toBe(false);
    expect(Object.keys(body)).toEqual(expect.arrayContaining(['status', 'ledger', 'structure', 'functions', 'limits']));
    expect(body.structure.columnsMissing).toEqual(['User.email']);
    expect(Array.isArray(body.limits)).toBe(true);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/postgresql:|test-secret|u:p@/);
  });
});
