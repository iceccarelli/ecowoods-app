/**
 * Schema-behind-code detection, in two independent layers.
 *
 *  1. LEDGER (`checkSchemaDrift`): compares the Prisma migrations this build
 *     ships (`prisma/migrations/<name>/`) with the finished rows in the
 *     database's `_prisma_migrations` table. That proves the migration NAMES
 *     were recorded. It does NOT prove the tables, columns, indexes or foreign
 *     keys exist: a hand-dropped column, a migration marked applied with
 *     `migrate resolve`, or a partial failure all leave the ledger "equal".
 *
 *  2. STRUCTURE (`checkSchemaStructure`): introspects the live catalog
 *     (information_schema / pg_catalog — never table data) and compares tables,
 *     columns (type family or native type, nullability), indexes, unique
 *     constraints, foreign keys, enum value sets and the rate_limit_consume
 *     function's existence with what THIS build's Prisma datamodel expects.
 *
 * `checkSchemaHealth` combines both with an explicit `limits` list so a green
 * result never claims more than was compared. Only names are ever returned —
 * no connection strings, rows, checksums or values.
 *
 * Never throws: an unreachable database or an unreadable migrations directory
 * is reported as `unknown`, so a health probe cannot be taken down by it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

/** A short, value-free tag for logs: error class and code, never the message (it can carry hosts). */
function errorTag(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  const code = (err as { code?: unknown }).code;
  return `${err.name}${typeof code === 'string' ? `:${code.slice(0, 20)}` : ''}`;
}

const IDENT =/^[A-Za-z_][A-Za-z0-9_]*$/;

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
        error: errorTag(err),
      }),
    );
    return { status: 'unknown', reason: 'query_failed', missing: [] };
  }
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Structural check
 * ────────────────────────────────────────────────────────────────────────── */

/** Every model/enum in prisma/schema.prisma lives in this Postgres schema (`@@schema`). */
export const APP_SCHEMA = 'ecowoods';
/** Database functions the application calls directly (raw SQL); existence only. */
export const REQUIRED_FUNCTIONS = ['rate_limit_consume'] as const;

const LIST_CAP = 100;

export interface ExpectedColumn {
  name: string;
  /** Acceptable `udt_name` values; one entry when the native type is known, several for a type family. */
  accept: string[];
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
}
export interface ExpectedIndex {
  columns: string[];
  unique: boolean;
}
export interface ExpectedForeignKey {
  columns: string[];
  refTable: string;
  refColumns: string[];
}
export interface ExpectedTable {
  name: string;
  columns: ExpectedColumn[];
  indexes: ExpectedIndex[];
  foreignKeys: ExpectedForeignKey[];
}
export interface ExpectedStructure {
  tables: ExpectedTable[];
  enums: Array<{ name: string; values: string[] }>;
  /** 'native' when @db.* annotations and @@index were read from schema.prisma, else 'family' (dmmf only). */
  precision: 'native' | 'family';
  indexesDerivable: boolean;
}

interface DmmfField {
  name: string;
  kind: string;
  type: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  dbName?: string | null;
  relationFromFields?: readonly string[];
  relationToFields?: readonly string[];
}
interface DmmfModel {
  name: string;
  dbName?: string | null;
  fields: readonly DmmfField[];
  primaryKey?: { fields: readonly string[] } | null;
  uniqueIndexes: ReadonlyArray<{ fields: readonly string[] }>;
}
export interface DmmfDatamodel {
  models: readonly DmmfModel[];
  enums: ReadonlyArray<{ name: string; dbName?: string | null; values: ReadonlyArray<{ name: string; dbName?: string | null }> }>;
}

const DEFAULT_UDT: Record<string, string> = {
  String: 'text', Int: 'int4', BigInt: 'int8', Float: 'float8', Decimal: 'numeric',
  Boolean: 'bool', DateTime: 'timestamp', Json: 'jsonb', Bytes: 'bytea',
};
const FAMILY_UDT: Record<string, string[]> = {
  String: ['text', 'varchar', 'bpchar', 'uuid', 'citext'],
  Int: ['int2', 'int4'],
  Float: ['float4', 'float8'],
  DateTime: ['timestamp', 'timestamptz', 'date', 'time', 'timetz'],
  Json: ['json', 'jsonb'],
};
const NATIVE_UDT: Record<string, string> = {
  Uuid: 'uuid', Text: 'text', VarChar: 'varchar', Char: 'bpchar', Timestamptz: 'timestamptz', Timestamp: 'timestamp',
  Date: 'date', Time: 'time', Timetz: 'timetz', JsonB: 'jsonb', Json: 'json', Decimal: 'numeric', SmallInt: 'int2',
  Integer: 'int4', BigInt: 'int8', Real: 'float4', DoublePrecision: 'float8', Boolean: 'bool', ByteA: 'bytea', Citext: 'citext',
};

interface SchemaTextModel {
  natives: Map<string, { type: string; args: number[] }>;
  indexes: string[][];
}

/** Reads `@db.*` annotations and `@@index` column lists per model from schema.prisma text. */
export function parseSchemaText(text: string): Map<string, SchemaTextModel> {
  const out = new Map<string, SchemaTextModel>();
  let current: SchemaTextModel | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!current) {
      const m = /^model\s+(\w+)\s*\{/.exec(line);
      if (m) {
        current = { natives: new Map(), indexes: [] };
        out.set(m[1], current);
      }
      continue;
    }
    if (line === '}') {
      current = null;
      continue;
    }
    if (line.startsWith('@@index')) {
      const m = /@@index\(\s*\[([^\]]*)\]/.exec(line);
      if (m) {
        current.indexes.push(
          m[1].replace(/\([^)]*\)/g, '').split(',').map((c) => c.trim()).filter(Boolean),
        );
      }
      continue;
    }
    if (line.startsWith('@@') || !line) continue;
    const f = /^(\w+)\s+\w+/.exec(line);
    const n = /@db\.(\w+)(?:\(([^)]*)\))?/.exec(line);
    if (f && n) {
      const args = (n[2] ?? '')
        .split(',')
        .map((a) => a.trim())
        .filter((a) => /^\d+$/.test(a))
        .map(Number);
      current.natives.set(f[1], { type: n[1], args });
    }
  }
  return out;
}

/** Expected live structure for this build, from the Prisma datamodel (+ schema.prisma text when available). */
export function buildExpectedStructure(datamodel: DmmfDatamodel, schemaText: string | null): ExpectedStructure {
  const text = schemaText ? parseSchemaText(schemaText) : null;
  const modelByName = new Map(datamodel.models.map((m) => [m.name, m]));
  const tableOf = (m: DmmfModel) => m.dbName ?? m.name;
  const colOf = (m: DmmfModel, field: string) => m.fields.find((f) => f.name === field)?.dbName ?? field;
  const enumByName = new Map(datamodel.enums.map((e) => [e.name, e]));

  const tables: ExpectedTable[] = datamodel.models.map((m) => {
    const t = text?.get(m.name);
    const columns: ExpectedColumn[] = [];
    for (const f of m.fields) {
      if (f.kind !== 'scalar' && f.kind !== 'enum') continue;
      const col: ExpectedColumn = { name: f.dbName ?? f.name, accept: [], nullable: !f.isRequired };
      let base: string[];
      if (f.kind === 'enum') {
        const e = enumByName.get(f.type);
        base = [e?.dbName ?? f.type];
      } else {
        const native = t?.natives.get(f.name);
        const nativeUdt = native ? NATIVE_UDT[native.type] : undefined;
        if (native && nativeUdt) {
          base = [nativeUdt];
          if ((nativeUdt === 'varchar' || nativeUdt === 'bpchar') && native.args.length) col.maxLength = native.args[0];
          if (nativeUdt === 'numeric' && native.args.length === 2) [col.precision, col.scale] = native.args;
        } else if (text) {
          base = [DEFAULT_UDT[f.type] ?? f.type.toLowerCase()];
        } else {
          base = FAMILY_UDT[f.type] ?? [DEFAULT_UDT[f.type] ?? f.type.toLowerCase()];
        }
      }
      col.accept = f.isList ? base.map((b) => `_${b}`) : base;
      if (f.isList) {
        delete col.maxLength;
        delete col.precision;
        delete col.scale;
      }
      columns.push(col);
    }

    const indexes: ExpectedIndex[] = [];
    const addIndex = (cols: string[], unique: boolean) => {
      const mapped = cols.map((c) => colOf(m, c));
      if (!indexes.some((i) => i.unique === unique && i.columns.join() === mapped.join())) indexes.push({ columns: mapped, unique });
    };
    for (const f of m.fields) if (f.isId || f.isUnique) addIndex([f.name], true);
    if (m.primaryKey?.fields.length) addIndex([...m.primaryKey.fields], true);
    for (const u of m.uniqueIndexes) addIndex([...u.fields], true);
    for (const cols of t?.indexes ?? []) addIndex(cols, false);

    const foreignKeys: ExpectedForeignKey[] = [];
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.relationFromFields?.length) continue;
      const target = modelByName.get(f.type);
      if (!target) continue;
      foreignKeys.push({
        columns: f.relationFromFields.map((c) => colOf(m, c)),
        refTable: tableOf(target),
        refColumns: (f.relationToFields ?? []).map((c) => colOf(target, c)),
      });
    }
    return { name: tableOf(m), columns, indexes, foreignKeys };
  });

  return {
    tables,
    enums: datamodel.enums.map((e) => ({ name: e.dbName ?? e.name, values: e.values.map((v) => v.dbName ?? v.name) })),
    precision: text ? 'native' : 'family',
    indexesDerivable: Boolean(text),
  };
}

export interface ActualStructure {
  tables: string[];
  columns: Array<{
    table: string; column: string; udt: string; nullable: boolean;
    maxLength: number | null; precision: number | null; scale: number | null;
  }>;
  indexes: Array<{ table: string; columns: string[]; unique: boolean }>;
  foreignKeys: Array<{ table: string; columns: string[]; refTable: string; refColumns: string[] }>;
  enums: Array<{ name: string; value: string }>;
  functions: string[];
}

export type StructureChecked = 'tables' | 'columns' | 'column_types' | 'nullability' | 'indexes' | 'unique_constraints' | 'foreign_keys' | 'enum_values';

export interface StructureFindings {
  status: 'ok' | 'drifted' | 'ahead';
  checked: StructureChecked[];
  typePrecision: 'native' | 'family';
  tablesMissing: string[];
  tablesUnexpected: string[];
  columnsMissing: string[];
  columnsUnexpected: string[];
  columnTypeMismatches: string[];
  nullabilityMismatches: string[];
  indexesMissing: string[];
  fksMissing: string[];
  enumValuesMissing: string[];
  truncated: boolean;
}
export type StructureReport = StructureFindings | { status: 'unknown'; reason: 'no_database_url' | 'query_failed' };

export type FunctionsReport =
  | { status: 'ok' | 'missing'; checked: string[]; missing: string[] }
  | { status: 'unknown'; reason: 'no_database_url' | 'query_failed' };

const idx = (t: string, cols: string[], unique: boolean) => `${t}(${cols.join(',')})${unique ? ' unique' : ''}`;

/** Pure comparison of expected vs actual structure. */
export function diffStructure(expected: ExpectedStructure, actual: ActualStructure): StructureFindings {
  const tablesMissing: string[] = [];
  const columnsMissing: string[] = [];
  const columnsUnexpected: string[] = [];
  const columnTypeMismatches: string[] = [];
  const nullabilityMismatches: string[] = [];
  const indexesMissing: string[] = [];
  const fksMissing: string[] = [];
  const enumValuesMissing: string[] = [];

  const actualTables = new Set(actual.tables);
  const colsByTable = new Map<string, Map<string, ActualStructure['columns'][number]>>();
  for (const c of actual.columns) {
    if (!colsByTable.has(c.table)) colsByTable.set(c.table, new Map());
    colsByTable.get(c.table)!.set(c.column, c);
  }
  const expectedNames = new Set(expected.tables.map((t) => t.name));

  for (const t of expected.tables) {
    if (!actualTables.has(t.name)) {
      tablesMissing.push(t.name);
      continue;
    }
    const have = colsByTable.get(t.name) ?? new Map<string, ActualStructure['columns'][number]>();
    const wanted = new Set(t.columns.map((c) => c.name));
    for (const c of t.columns) {
      const a = have.get(c.name);
      const label = `${t.name}.${c.name}`;
      if (!a) {
        columnsMissing.push(label);
        continue;
      }
      if (!c.accept.includes(a.udt)) {
        columnTypeMismatches.push(`${label}: expected ${c.accept.join('|')}, found ${a.udt}`);
      } else if (c.maxLength !== undefined && a.maxLength !== c.maxLength) {
        columnTypeMismatches.push(`${label}: expected ${a.udt}(${c.maxLength}), found ${a.udt}(${a.maxLength ?? 'unbounded'})`);
      } else if (c.precision !== undefined && (a.precision !== c.precision || a.scale !== c.scale)) {
        columnTypeMismatches.push(`${label}: expected numeric(${c.precision},${c.scale}), found numeric(${a.precision ?? '-'},${a.scale ?? '-'})`);
      }
      if (c.nullable !== a.nullable) {
        nullabilityMismatches.push(`${label}: expected ${c.nullable ? 'NULL' : 'NOT NULL'}, found ${a.nullable ? 'NULL' : 'NOT NULL'}`);
      }
    }
    for (const name of have.keys()) if (!wanted.has(name)) columnsUnexpected.push(`${t.name}.${name}`);

    for (const ix of t.indexes) {
      const ok = actual.indexes.some(
        (a) => a.table === t.name && a.columns.join() === ix.columns.join() && (!ix.unique || a.unique),
      );
      if (!ok) indexesMissing.push(idx(t.name, ix.columns, ix.unique));
    }
    for (const fk of t.foreignKeys) {
      const ok = actual.foreignKeys.some(
        (a) =>
          a.table === t.name && a.columns.join() === fk.columns.join() &&
          a.refTable === fk.refTable && a.refColumns.join() === fk.refColumns.join(),
      );
      if (!ok) fksMissing.push(`${t.name}(${fk.columns.join(',')})->${fk.refTable}(${fk.refColumns.join(',')})`);
    }
  }
  const tablesUnexpected = actual.tables.filter((t) => !expectedNames.has(t) && t !== '_prisma_migrations');

  const actualEnums = new Map<string, Set<string>>();
  for (const e of actual.enums) {
    if (!actualEnums.has(e.name)) actualEnums.set(e.name, new Set());
    actualEnums.get(e.name)!.add(e.value);
  }
  for (const e of expected.enums) {
    const have = actualEnums.get(e.name);
    if (!have) enumValuesMissing.push(`${e.name}: type missing`);
    else {
      const gone = e.values.filter((v) => !have.has(v));
      if (gone.length) enumValuesMissing.push(`${e.name}: ${gone.join(',')}`);
    }
  }

  const all = [
    tablesMissing, tablesUnexpected, columnsMissing, columnsUnexpected, columnTypeMismatches,
    nullabilityMismatches, indexesMissing, fksMissing, enumValuesMissing,
  ];
  const cap = (l: string[]) => l.slice(0, LIST_CAP);
  const breaking = [tablesMissing, columnsMissing, columnTypeMismatches, nullabilityMismatches, indexesMissing, fksMissing, enumValuesMissing].some(
    (l) => l.length > 0,
  );
  const extra = tablesUnexpected.length > 0 || columnsUnexpected.length > 0;

  const checked: StructureChecked[] = ['tables', 'columns', 'column_types', 'nullability', 'unique_constraints', 'foreign_keys', 'enum_values'];
  if (expected.indexesDerivable) checked.push('indexes');
  return {
    status: breaking ? 'drifted' : extra ? 'ahead' : 'ok',
    checked,
    typePrecision: expected.precision,
    tablesMissing: cap(tablesMissing),
    tablesUnexpected: cap(tablesUnexpected),
    columnsMissing: cap(columnsMissing),
    columnsUnexpected: cap(columnsUnexpected),
    columnTypeMismatches: cap(columnTypeMismatches),
    nullabilityMismatches: cap(nullabilityMismatches),
    indexesMissing: cap(indexesMissing),
    fksMissing: cap(fksMissing),
    enumValuesMissing: cap(enumValuesMissing),
    truncated: all.some((l) => l.length > LIST_CAP),
  };
}

function readSchemaText(file = path.join(process.cwd(), 'prisma', 'schema.prisma')): string | null {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  } catch {
    return null;
  }
}

/** Catalog-only introspection of APP_SCHEMA. Reads names and types, never rows. */
export async function introspectStructure(schema = APP_SCHEMA): Promise<ActualStructure> {
  const [tables, columns, indexes, fks, enums, fns] = await Promise.all([
    db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'`,
    db.$queryRaw<
      Array<{
        table_name: string; column_name: string; udt_name: string; is_nullable: string;
        character_maximum_length: number | null; numeric_precision: number | null; numeric_scale: number | null;
      }>
    >`
      SELECT table_name, column_name, udt_name, is_nullable, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns WHERE table_schema = ${schema}`,
    db.$queryRaw<Array<{ table_name: string; is_unique: boolean; columns: string[] }>>`
      SELECT t.relname::text AS table_name, i.indisunique AS is_unique,
        ARRAY(
          SELECT COALESCE(a.attname::text, '<expr>')
          FROM unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
          LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
          WHERE k.ord <= i.indnkeyatts ORDER BY k.ord
        ) AS columns
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = ${schema} AND i.indisvalid AND i.indisready AND i.indpred IS NULL`,
    db.$queryRaw<Array<{ table_name: string; columns: string[]; ref_table: string; ref_columns: string[] }>>`
      SELECT t.relname::text AS table_name, rt.relname::text AS ref_table,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum ORDER BY k.ord) AS columns,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum ORDER BY k.ord) AS ref_columns
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class rt ON rt.oid = c.confrelid
      WHERE c.contype = 'f' AND n.nspname = ${schema}`,
    db.$queryRaw<Array<{ type_name: string; label: string }>>`
      SELECT t.typname::text AS type_name, e.enumlabel::text AS label
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema}`,
    db.$queryRaw<Array<{ proname: string }>>`
      SELECT p.proname::text AS proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = ${schema}`,
  ]);
  return {
    tables: tables.map((r) => r.table_name),
    columns: columns.map((r) => ({
      table: r.table_name, column: r.column_name, udt: r.udt_name, nullable: r.is_nullable === 'YES',
      maxLength: r.character_maximum_length ?? null, precision: r.numeric_precision ?? null, scale: r.numeric_scale ?? null,
    })),
    indexes: indexes.map((r) => ({ table: r.table_name, columns: r.columns, unique: r.is_unique })),
    foreignKeys: fks.map((r) => ({ table: r.table_name, columns: r.columns, refTable: r.ref_table, refColumns: r.ref_columns })),
    enums: enums.map((r) => ({ name: r.type_name, value: r.label })),
    functions: fns.map((r) => r.proname),
  };
}

export async function checkSchemaStructure(
  opts: { datamodel?: DmmfDatamodel; schemaText?: string | null } = {},
): Promise<{ structure: StructureReport; functions: FunctionsReport }> {
  if (!process.env.DATABASE_URL) {
    return {
      structure: { status: 'unknown', reason: 'no_database_url' },
      functions: { status: 'unknown', reason: 'no_database_url' },
    };
  }
  try {
    const datamodel = opts.datamodel ?? (Prisma.dmmf.datamodel as unknown as DmmfDatamodel);
    const schemaText = opts.schemaText !== undefined ? opts.schemaText : readSchemaText();
    const actual = await introspectStructure();
    const missing = REQUIRED_FUNCTIONS.filter((f) => !actual.functions.includes(f));
    return {
      structure: diffStructure(buildExpectedStructure(datamodel, schemaText), actual),
      functions: { status: missing.length ? 'missing' : 'ok', checked: [...REQUIRED_FUNCTIONS], missing },
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'health.schema_structure_query_failed', error: errorTag(err) }));
    return {
      structure: { status: 'unknown', reason: 'query_failed' },
      functions: { status: 'unknown', reason: 'query_failed' },
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Combined report
 * ────────────────────────────────────────────────────────────────────────── */

export type SchemaHealthStatus = 'ok' | 'behind' | 'drifted' | 'ahead' | 'unknown';

export interface SchemaHealthReport {
  /** `ok` only when the ledger, the structure and the required functions all passed. */
  status: SchemaHealthStatus;
  ledger: SchemaDriftReport & { verifies: string };
  structure: StructureReport & { verifies: string };
  functions: FunctionsReport & { verifies: string };
  /** What a green result does NOT prove. */
  limits: string[];
}

const LIMITS = [
  'Row data, row counts and data correctness are never read.',
  'Column defaults, CHECK constraints and generated/identity settings are not compared.',
  'Foreign-key ON DELETE/ON UPDATE rules and constraint/index names are not compared (indexes match by column list).',
  'Partial and expression indexes are not matched; index method and sort order are not compared.',
  'Extra indexes and extra foreign keys in the database are not reported; extra enum values are not reported.',
  'Function bodies and signatures are not compared; only that rate_limit_consume exists.',
  'Migration names applied in the database but not shipped in this build are not reported.',
  'Permissions, row-level security, extensions, sequences and triggers are not checked.',
];

export async function checkSchemaHealth(expectedMigrations: string[] | null = listExpectedMigrations()): Promise<SchemaHealthReport> {
  const [ledger, { structure, functions }] = await Promise.all([checkSchemaDrift(expectedMigrations), checkSchemaStructure()]);
  let status: SchemaHealthStatus;
  if (ledger.status === 'behind') status = 'behind';
  else if (structure.status === 'drifted' || functions.status === 'missing') status = 'drifted';
  else if (ledger.status === 'unknown' || structure.status === 'unknown' || functions.status === 'unknown') status = 'unknown';
  else if (structure.status === 'ahead') status = 'ahead';
  else status = 'ok';

  const limits = [...LIMITS];
  if (structure.status !== 'unknown') {
    if (!structure.checked.includes('indexes')) limits.unshift('Non-unique indexes (@@index) were NOT checked: schema.prisma was not available in this build.');
    if (structure.typePrecision === 'family') {
      limits.unshift('Column types were compared by type family only (schema.prisma not available for native types such as uuid, timestamptz, varchar length, numeric precision).');
    }
  }
  return {
    status,
    ledger: {
      ...ledger,
      verifies:
        'Every migration folder shipped in this build has a finished, not-rolled-back row in _prisma_migrations. Says nothing about whether the tables actually match.',
    },
    structure: {
      ...structure,
      verifies:
        "Live tables, columns (type, nullability), unique constraints, indexes, foreign keys and enum values compared with this build's Prisma datamodel via the catalog.",
    },
    functions: { ...functions, verifies: 'The listed database functions exist in the application schema (existence only).' },
    limits,
  };
}
