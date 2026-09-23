/**
 * GET /api/assistant/analysis/[id] — read back a previously-run Renovation
 * Decision Analysis (directive rule 23/26 — a paid result must not
 * disappear into chat history). Ownership-checked: a signed-in visitor can
 * only read their OWN analyses (directive rule 40 — validate project
 * ownership server-side).
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRenovationAnalysis } from '@/lib/assistant-workspace/analysis-execution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to view this analysis.', code: 'auth_required' }, { status: 401 });
  }
  const { id } = await params;
  const analysis = await getRenovationAnalysis(id);
  if (!analysis || analysis.userId !== session.user.id) {
    // Same 404 whether it doesn't exist or belongs to someone else — never
    // confirm another user's analysis id exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    id: analysis.id,
    designId: analysis.designId,
    status: analysis.status,
    creditCost: analysis.creditCost,
    engineVersion: analysis.engineVersion,
    result: analysis.resultJson,
    generatedAt: analysis.generatedAt,
  });
}
