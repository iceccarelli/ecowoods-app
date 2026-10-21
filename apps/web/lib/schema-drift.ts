/**
 * Schema-behind-code detection.
 *
 * Compares the Prisma migrations this build ships (`prisma/migrations/<name>/`)
 * with the finished rows in the database's `_prisma_migrations` table, and
 * reports which expected migrations are not applied. Only migration NAMES are
 * ever read or returned — no checksums, logs, hosts or customer data.
 *
 * Never throws: an unreachable database or an unreadable migrations directory
 * is reported as `unknown`, so a health probe cannot be taken down by it.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { db } from './db';

export type SchemaDriftReport =
  | { status: 'ok'; expected: number; applied: number; missing: string[] }
  | { status: 'behind'; expected: number; applied: number; missing: string[] }
  | { status: 'unknown'; reason: 'no_database_url' | 'migrations_not_bundled' | 'query_failed'; missing: string[] };

export function listExpectedMigrations(dir = path.join(process.cwd(), 'prisma', 'migrations')): string[] | null {
  try {
    if (!existsSync(dir)) return null;
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return null;
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export async function checkSchemaDrift(expected: string[] | null = listExpectedMigrations()): Promise<SchemaDriftReport> {
  if (!process.env.DATABASE_URL) return { status: 'unknown', reason: 'no_database_url', missing: [] };
  if (!expected || expected.length === 0) return { status: 'unknown', reason: 'migrations_not_bundled', missing: [] };
  try {
    // Prisma keeps `_prisma_migrations` in the connection's default schema,
    // which is deployment-specific; locate it rather than assume.
    const where = await db.$queryRaw<Array<{ table_schema: string }>>`
      SELECT table_schema FROM information_schema.tables
      WHERE table_name = '_prisma_migrations'
      ORDER BY (table_schema = current_schema()) DESC
      LIMIT 1
    `;
    const schema = where[0]?.table_schema;
    if (!schema || !IDENT.test(schema)) {
      // No migrations table at all: nothing has been applied by Prisma.
      return { status: 'behind', expected: expected.length, applied: 0, missing: expected };
    }
    const rows = await db.$queryRaw<Array<{ migration_name: string }>>(
      Prisma.sql`SELECT migration_name FROM ${Prisma.raw(`"${schema}"`)}."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const applied = new Set(rows.map((r) => r.migration_name));
    const missing = expected.filter((n) => !applied.has(n));
    return {
      status: missing.length === 0 ? 'ok' : 'behind',
      expected: expected.length,
      applied: expected.length - missing.length,
      missing,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'health.schema_drift_query_failed',
        error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      }),
    );
    return { status: 'unknown', reason: 'query_failed', missing: [] };
  }
}
