#!/usr/bin/env node
/**
 * verify-migrations.mjs — build-time guard on Prisma schema/migration drift.
 *
 * The bug this exists to prevent, in full:
 *
 *   The P0 pilot-lead work added `model PilotLead` to schema.prisma and never
 *   generated a migration. `apps/web` builds with `prisma generate && next
 *   build`, and `generate` only regenerates the client — it never touches the
 *   database. So the generated client knew about PilotLead, TypeScript was
 *   happy, the build was green, the route returned 201, and the table did not
 *   exist in production. Every submission fell through to the durable-log
 *   fallback. Nothing anywhere reported an error.
 *
 * That is the dangerous shape: a schema change with no migration is invisible
 * to every check in the pipeline. This closes it.
 *
 * What it checks
 *   1. Every `model` in schema.prisma has a CREATE TABLE somewhere in
 *      prisma/migrations (respecting @@map and @@schema).
 *   2. Every `enum` in schema.prisma has a CREATE TYPE.
 *   3. migration_lock.toml exists (catches a migrations dir that was never
 *      initialised).
 *
 * What it deliberately does NOT check
 *   Column-level drift. That needs a live database connection, which does not
 *   belong in CI on every push. For that, run against the real datasource:
 *
 *     pnpm --filter @ecowoods/web exec prisma migrate diff \
 *       --from-schema-datasource prisma/schema.prisma \
 *       --to-schema-datamodel   prisma/schema.prisma \
 *       --script
 *
 *   Empty output means no drift. That is also how the PilotLead migration was
 *   generated non-destructively.
 *
 * Run:  pnpm verify:migrations
 * CI:   .github/workflows/verify-migrations.yml
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA = 'apps/web/prisma/schema.prisma';
const MIGRATIONS = 'apps/web/prisma/migrations';

if (!existsSync(SCHEMA)) {
  console.error(`✗ schema not found at ${SCHEMA} — run from the repo root`);
  process.exit(1);
}
if (!existsSync(MIGRATIONS)) {
  console.error(`✗ no migrations directory at ${MIGRATIONS}`);
  process.exit(1);
}
if (!existsSync(join(MIGRATIONS, 'migration_lock.toml'))) {
  console.error('✗ migrations/migration_lock.toml missing — migrations were never initialised');
  process.exit(1);
}

const schema = readFileSync(SCHEMA, 'utf8');

/** Pull every `model X { ... }` / `enum X { ... }` block out of the schema. */
function blocks(kind) {
  const out = [];
  const re = new RegExp(`^${kind}\\s+(\\w+)\\s*\\{`, 'gm');
  let m;
  while ((m = re.exec(schema)) !== null) {
    const start = schema.indexOf('{', m.index);
    let depth = 0, end = start;
    for (let i = start; i < schema.length; i++) {
      if (schema[i] === '{') depth++;
      else if (schema[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    out.push({ name: m[1], body: schema.slice(start, end) });
  }
  return out;
}

/** Prisma names the table after the model unless @@map overrides it. */
const tableName = (b) => (b.body.match(/@@map\(\s*"([^"]+)"\s*\)/) || [, b.name])[1];
const dbSchema = (b) => (b.body.match(/@@schema\(\s*"([^"]+)"\s*\)/) || [, null])[1];

// Concatenate every migration's SQL — order does not matter, only presence.
const dirs = readdirSync(MIGRATIONS).filter((d) => statSync(join(MIGRATIONS, d)).isDirectory());
if (dirs.length === 0) {
  console.error('✗ migrations directory contains no migrations');
  process.exit(1);
}
const sql = dirs
  .map((d) => {
    const f = join(MIGRATIONS, d, 'migration.sql');
    return existsSync(f) ? readFileSync(f, 'utf8') : '';
  })
  .join('\n');

const missing = [];

for (const b of blocks('model')) {
  const table = tableName(b);
  const s = dbSchema(b);
  // Match CREATE TABLE with or without a schema prefix, quoted or bare.
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?("?${s ? `${s}"?\\."?` : ''}${table}"?)\\s*\\(`,
    'i'
  );
  if (!re.test(sql)) {
    missing.push({
      kind: 'model',
      name: b.name,
      table: s ? `${s}.${table}` : table,
    });
  }
}

for (const b of blocks('enum')) {
  const s = dbSchema(b);
  const re = new RegExp(`CREATE\\s+TYPE\\s+("?${s ? `${s}"?\\."?` : ''}${b.name}"?)\\s+AS\\s+ENUM`, 'i');
  if (!re.test(sql)) {
    missing.push({ kind: 'enum', name: b.name, table: s ? `${s}.${b.name}` : b.name });
  }
}

const modelCount = blocks('model').length;
const enumCount = blocks('enum').length;

if (missing.length === 0) {
  console.log(
    `✓ migrations verified — ${modelCount} model(s), ${enumCount} enum(s), ` +
      `${dirs.length} migration(s), no drift`
  );
  process.exit(0);
}

console.error(`\n✗ ${missing.length} schema object(s) have no migration:\n`);
for (const m of missing) {
  console.error(`  ${m.kind} ${m.name}  →  no CREATE for "${m.table}" in prisma/migrations`);
}
console.error(`
This builds green and fails silently in production: the generated client knows
the model, the database does not have the table.

Generate the missing migration without touching data:

  cd apps/web
  STAMP=$(date -u +%Y%m%d%H%M%S)_<describe_change>
  mkdir -p prisma/migrations/$STAMP
  pnpm exec prisma migrate diff \\
    --from-schema-datasource prisma/schema.prisma \\
    --to-schema-datamodel   prisma/schema.prisma \\
    --script > prisma/migrations/$STAMP/migration.sql

Read the SQL. If it contains DROP, stop and investigate. Then:

  pnpm exec prisma migrate deploy

And commit the migration directory — an applied migration missing from the repo
breaks every future 'migrate deploy'.
`);
process.exit(1);
