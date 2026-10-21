import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { buildMarketIntelligence } from '@/lib/registry/market-intelligence';

/**
 * /api/internal/market-intelligence — the opportunity model, expansion order,
 * content queue and unsourced inputs. Internal working material: bearer
 * CRON_SECRET only, never cached or indexed, and listed in no public contract.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://ecowoods.ca/api/internal/market-intelligence?country=CA"
 *
 * The repository is public: this route keeps the deployed site from
 * publishing the report, not the source from being readable.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || !auth) return false;
  const a = Buffer.from(auth);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
  }
  const country = new URL(request.url).searchParams.get('country');
  return NextResponse.json({ ok: true, ...buildMarketIntelligence(country) }, { status: 200, headers });
}
