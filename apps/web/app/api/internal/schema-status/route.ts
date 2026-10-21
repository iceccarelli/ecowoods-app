import { NextResponse } from 'next/server';
import { checkSchemaDrift } from '@/lib/schema-drift';

/**
 * /api/internal/schema-status — is the database behind the code?
 *
 * Compares the Prisma migrations this build ships with the finished rows in
 * `_prisma_migrations` and lists the NAMES of any not applied. That is an
 * operational detail, not public information, so unlike /api/health it needs
 * the same bearer secret as the cron routes (CRON_SECRET) and is never cached
 * or indexed. Names only: no rows, checksums, hosts or customer data.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://ecowoods.ca/api/internal/schema-status
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
  }
  const schema = await checkSchemaDrift();
  return NextResponse.json({ ok: schema.status === 'ok', schema }, { status: 200, headers });
}
