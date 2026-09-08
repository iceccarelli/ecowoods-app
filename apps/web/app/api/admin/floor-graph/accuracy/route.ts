import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { accuracySummary } from '@/lib/floor-graph/prediction';

/**
 * GET /api/admin/floor-graph/accuracy — prediction versus actual, by kind and model.
 *
 * The one number the business should look at every month, and the reason the
 * ledger exists. `?days=90` narrows the window; the default is everything.
 *
 * `openCount` is returned next to the figures on purpose. A ledger with four
 * hundred open rows and twelve closed ones does not have a 12-row accuracy
 * figure — it has a broken closing process, and reporting the MAPE without
 * that context would be the most misleading thing this endpoint could do.
 *
 * ADMIN ONLY, AND NOT BECAUSE THE NUMBERS ARE EMBARRASSING. This is internal
 * operating data. The public surface for anything derived from it is a written
 * finding on the site with its method stated — not a JSON endpoint that a
 * competitor can poll to watch our margins move.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = Number(new URL(request.url).searchParams.get('days'));
  const since =
    Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

  const summary = await accuracySummary(since);

  return NextResponse.json({
    windowDays: since ? days : null,
    ...summary,
    note:
      summary.closedCount === 0
        ? 'No closed predictions yet. Every figure here stays null until jobs are closed through /api/admin/floor-graph/outcome.'
        : undefined,
  });
}
