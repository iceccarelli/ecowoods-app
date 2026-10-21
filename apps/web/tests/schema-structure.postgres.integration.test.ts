/**
 * Real PostgreSQL proof for the structural schema check (lib/schema-drift.ts).
 *
 * Builds a scratch database from the shipped migrations (`prisma migrate
 * deploy`), then shows that checkSchemaHealth():
 *   - reports `ok` on the clean database,
 *   - keeps the migration LEDGER green while detecting a dropped column, a
 *     dropped index, a dropped foreign key, a changed nullability and a dropped
 *     function (the case the ledger-only check could not see),
 *   - goes back to `ok` once each defect is repaired.
 * Runs only with RUN_POSTGRES_INTEGRATION=1 against a disposable server; the
 * scratch database is dropped afterwards. The shared database is never altered.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

// lib/schema-drift.ts reads `db` through this holder so it queries the scratch database.
const holder = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({
  db: new Proxy({}, { get: (_t, prop) => (holder.client as unknown as Record<string | symbol, unknown>)[prop] }),
}));

describe.skipIf(!enabled)('structural schema check against real PostgreSQL', () => {
  let main: PrismaClient;
  let scratch: PrismaClient;
  const scratchName = `ew_struct_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const urlFor = (dbName: string) => {
    const u = new URL(process.env.DATABASE_URL!);
    u.pathname = `/${dbName}`;
    u.searchParams.set('schema', 'ecowoods');
    return u.toString();
  };
  const sql = (s: string) => scratch.$executeRawUnsafe(s);
  const health = async () => {
    const { checkSchemaHealth } = await import('@/lib/schema-drift');
    return checkSchemaHealth();
  };

  beforeAll(async () => {
    main = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await main.$executeRawUnsafe(`CREATE DATABASE "${scratchName}"`);
    const url = urlFor(scratchName);
    const boot = new PrismaClient({ datasources: { db: { url } } });
    await boot.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS ecowoods');
    await boot.$disconnect();
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: 'pipe',
      timeout: 180_000,
    });
    scratch = new PrismaClient({ datasources: { db: { url } } });
    holder.client = scratch;
    process.env.DATABASE_URL = url; // checkSchemaHealth short-circuits without one
  }, 240_000);

  afterAll(async () => {
    await scratch?.$disconnect();
    await main?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`).catch(() => undefined);
    await main?.$disconnect();
  });

  it('reports ok on a clean database built from the migrations', async () => {
    const r = await health();
    expect(r.ledger.status).toBe('ok');
    expect(r.structure).toMatchObject({
      status: 'ok', tablesMissing: [], columnsMissing: [], columnsUnexpected: [], columnTypeMismatches: [],
      nullabilityMismatches: [], indexesMissing: [], fksMissing: [], enumValuesMissing: [], typePrecision: 'native',
    });
    expect((r.structure as { checked: string[] }).checked).toEqual(expect.arrayContaining(['columns', 'indexes', 'foreign_keys']));
    expect(r.functions).toMatchObject({ status: 'ok', missing: [] });
    expect(r.status).toBe('ok');
  });

  it('detects a dropped column while the ledger still says ok', async () => {
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" DROP COLUMN "designCode"');
    const r = await health();
    expect(r.ledger.status).toBe('ok');
    expect(r.structure).toMatchObject({ status: 'drifted', columnsMissing: ['QuoteRequest.designCode'] });
    expect(r.status).toBe('drifted');
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" ADD COLUMN "designCode" VARCHAR(400)');
    expect((await health()).status).toBe('ok');
  });

  it('detects a missing index', async () => {
    const [{ indexname }] = await scratch.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='ecowoods' AND tablename='QuoteRequest' AND indexdef LIKE '%("designId")%'`,
    );
    await sql(`DROP INDEX "ecowoods"."${indexname}"`);
    const r = await health();
    expect(r.ledger.status).toBe('ok');
    expect(r.structure).toMatchObject({ status: 'drifted', indexesMissing: ['QuoteRequest(designId)'] });
    expect(r.status).toBe('drifted');
    await sql(`CREATE INDEX "${indexname}" ON "ecowoods"."QuoteRequest"("designId")`);
    expect((await health()).status).toBe('ok');
  });

  it('detects a missing unique index', async () => {
    const [{ indexname }] = await scratch.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='ecowoods' AND tablename='QuoteRequest' AND indexdef LIKE 'CREATE UNIQUE INDEX%("projectId")%'`,
    );
    await sql(`DROP INDEX "ecowoods"."${indexname}"`);
    const r = await health();
    expect(r.structure).toMatchObject({ status: 'drifted', indexesMissing: ['QuoteRequest(projectId) unique'] });
    await sql(`CREATE UNIQUE INDEX "${indexname}" ON "ecowoods"."QuoteRequest"("projectId")`);
    expect((await health()).status).toBe('ok');
  });

  it('detects a missing foreign key', async () => {
    const [{ conname }] = await scratch.$queryRawUnsafe<Array<{ conname: string }>>(
      `SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
       WHERE c.contype='f' AND n.nspname='ecowoods' AND t.relname='QuoteRequest'
         AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=c.conkey[1]) = 'userId'`,
    );
    await sql(`ALTER TABLE "ecowoods"."QuoteRequest" DROP CONSTRAINT "${conname}"`);
    const r = await health();
    expect(r.ledger.status).toBe('ok');
    expect(r.structure).toMatchObject({ status: 'drifted', fksMissing: ['QuoteRequest(userId)->User(id)'] });
    expect(r.status).toBe('drifted');
    await sql(
      `ALTER TABLE "ecowoods"."QuoteRequest" ADD CONSTRAINT "${conname}" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    expect((await health()).status).toBe('ok');
  });

  it('detects nullability and type drift', async () => {
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" ALTER COLUMN "name" DROP NOT NULL');
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" ALTER COLUMN "designCode" TYPE VARCHAR(100)');
    const r = await health();
    expect(r.structure).toMatchObject({
      status: 'drifted',
      nullabilityMismatches: ['QuoteRequest.name: expected NOT NULL, found NULL'],
      columnTypeMismatches: ['QuoteRequest.designCode: expected varchar(400), found varchar(100)'],
    });
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" ALTER COLUMN "name" SET NOT NULL');
    await sql('ALTER TABLE "ecowoods"."QuoteRequest" ALTER COLUMN "designCode" TYPE VARCHAR(400)');
    expect((await health()).status).toBe('ok');
  });

  it('reports an extra column as "ahead", not ok and not drifted', async () => {
    await sql('ALTER TABLE "ecowoods"."User" ADD COLUMN "zz_extra" TEXT');
    const r = await health();
    expect(r.structure).toMatchObject({ status: 'ahead', columnsUnexpected: ['User.zz_extra'] });
    expect(r.status).toBe('ahead');
    await sql('ALTER TABLE "ecowoods"."User" DROP COLUMN "zz_extra"');
  });

  it('detects a missing rate_limit_consume function', async () => {
    const [{ def }] = await scratch.$queryRawUnsafe<Array<{ def: string }>>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='ecowoods' AND p.proname='rate_limit_consume'`,
    );
    await sql('DROP FUNCTION "ecowoods"."rate_limit_consume"(varchar, double precision, double precision)');
    const r = await health();
    expect(r.functions).toMatchObject({ status: 'missing', missing: ['rate_limit_consume'] });
    expect(r.status).toBe('drifted');
    await sql(def);
    expect((await health()).status).toBe('ok');
  });

  it('detects a missing table and a missing enum value', async () => {
    await sql('ALTER TYPE "ecowoods"."UserRole" RENAME VALUE \'ADMIN\' TO \'ADMIN_X\'');
    const r = await health();
    expect(r.structure).toMatchObject({ status: 'drifted', enumValuesMissing: ['UserRole: ADMIN'] });
    await sql('ALTER TYPE "ecowoods"."UserRole" RENAME VALUE \'ADMIN_X\' TO \'ADMIN\'');
    await sql('ALTER TABLE "ecowoods"."ProjectNote" RENAME TO "ProjectNote_x"');
    const r2 = await health();
    expect(r2.structure).toMatchObject({ status: 'drifted', tablesMissing: ['ProjectNote'], tablesUnexpected: ['ProjectNote_x'] });
    await sql('ALTER TABLE "ecowoods"."ProjectNote_x" RENAME TO "ProjectNote"');
    expect((await health()).status).toBe('ok');
  });
});
