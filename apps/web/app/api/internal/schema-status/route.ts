import { NextResponse } from 'next/server';
import { checkSchemaHealth } from '@/lib/schema-drift';
import { isAuthorizedBearer } from '@/lib/cron-auth';

/**
 * /api/internal/schema-status — does the database match the code?
 *
 * Independent checks, reported as separate sections so none is read as more
 * than it is:
 *   ledger    migration NAMES this build ships vs finished `_prisma_migrations` rows
 *   structure tables, columns (type, nullability), unique constraints, indexes,
 *             foreign keys and enum values in the live catalog vs this build's
 *             Prisma datamodel
 *   functions existence of the raw-SQL functions the app calls
 * `limits` lists what is NOT compared. Top-level `status` is `ok` only when
 * everything checked passed. This is operational detail, not public
 * information, so unlike /api/health it needs the same bearer secret as the
 * cron routes (CRON_SECRET) and is never cached or indexed. Names only: no
 * rows, values, checksums, hosts or connection strings.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://ecowoods.ca/api/internal/schema-status
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  if (!isAuthorizedBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
  }
  const report = await checkSchemaHealth();
  return NextResponse.json({ ok: report.status === 'ok', ...report }, { status: 200, headers });
}
