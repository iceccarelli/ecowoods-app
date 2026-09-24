/**
 * GET /api/assistant/analysis/[id] — reopen a saved Renovation Decision
 * Analysis.
 *
 * Owner-only: a request for someone else's analysis (or a well-formed but
 * nonexistent id) gets the SAME 404 — never a 403 that would confirm the id
 * exists but belongs to another homeowner. This is what makes the analysis
 * un-enumerable, per the directive's "saved results cannot be enumerated."
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NOT_FOUND = NextResponse.json({ error: 'Not found.' }, { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NOT_FOUND;

  const { id } = await params;
  // Reject anything that isn't a UUID before it reaches the database —
  // a malformed id is a 404 too, not a 400 that would distinguish
  // "badly formed" from "doesn't exist."
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NOT_FOUND;

  const analysis = await db.renovationAnalysis.findUnique({ where: { id } });
  if (!analysis || analysis.userId !== userId) return NOT_FOUND;

  return NextResponse.json({
    id: analysis.id,
    status: analysis.status,
    creditsCharged: analysis.creditsCharged,
    contextSnapshot: analysis.contextSnapshot,
    result: analysis.result,
    failureReason: analysis.failureReason,
    createdAt: analysis.createdAt,
    completedAt: analysis.completedAt,
  });
}
