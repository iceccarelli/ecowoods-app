import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { loadFunnelReport, parseWindowDays } from '@/lib/funnel-report';

/**
 * GET /api/admin/funnel?days=7|30|90 — the same JSON /admin/funnel renders.
 *
 * ADMIN ONLY, and the role check precedes any data access. Counts and rates
 * only: no customer name, email or phone is selected anywhere on this path.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseWindowDays(new URL(request.url).searchParams.get('days'));
  try {
    const body = await loadFunnelReport(days);
    return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error(JSON.stringify({ event: 'funnel.report_failed', error: err instanceof Error ? err.message : 'unknown' }));
    return NextResponse.json({ error: 'Report unavailable' }, { status: 500 });
  }
}
