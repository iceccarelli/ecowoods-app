/**
 * POST /api/assistant/analysis/run — execute the paid Renovation Decision
 * Analysis: reserve credits, compute (free, deterministic), settle on
 * success or release on failure. See lib/assistant-workspace/
 * analysis-execution.ts for the actual orchestration — this route is auth +
 * body validation + a thin call into it, kept thin on purpose so the
 * reserve/execute/settle logic is testable without Next's request handling
 * (see analysis-execution.integration.test.ts, run against a real Postgres).
 *
 * Requires a signed-in session (directive rule 11) — running a paid action
 * without an account to hold the credit ledger against isn't meaningful.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { workspaceSnapshotSchema } from '@/lib/assistant-workspace/chat-schema';
import { runRenovationAnalysis } from '@/lib/assistant-workspace/analysis-execution';
import { applyPatch, defaultWorkspaceState } from '@/lib/assistant-workspace/state';
import { RENOVATION_DECISION_ANALYSIS } from '@/content/constants/renovation-analysis-product';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HITS = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const w = 60_000;
  const max = 10;
  const e = HITS.get(ip);
  if (!e || now - e.t > w) {
    HITS.set(ip, { n: 1, t: now });
    return false;
  }
  e.n += 1;
  return e.n > max;
}

const requestSchema = z.object({
  designId: z.string().min(1).max(16),
  workspace: workspaceSnapshotSchema,
  /**
   * Client-generated, stable across a retry of the SAME user click (not
   * regenerated on every network retry) — the actual idempotency guarantee
   * comes from credit-ledger.ts's DB-level unique constraint either way,
   * this just lets a genuine retry resolve to the same reservation instead
   * of always failing "already running."
   */
  requestId: z.string().uuid(),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  if (limited(getClientIp(req))) {
    return NextResponse.json({ error: 'Too many requests, give it a moment.' }, { status: 429 });
  }

  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to run the analysis.', code: 'auth_required' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const workspaceState = applyPatch(defaultWorkspaceState(), {
    country: parsed.data.workspace.country,
    objective: parsed.data.workspace.objective,
    sellHorizon: parsed.data.workspace.sellHorizon,
    stairs: parsed.data.workspace.stairs,
    rooms: parsed.data.workspace.rooms,
    targetFloor: parsed.data.workspace.targetFloor,
    selectedServiceSlugs: parsed.data.workspace.selectedServiceSlugs,
    nextAction: parsed.data.workspace.nextAction,
    personalization: parsed.data.workspace.personalization,
  });

  const out = await runRenovationAnalysis({
    userId: session.user.id,
    designId: parsed.data.designId,
    workspaceState,
    idempotencyKey: `${session.user.id}:${parsed.data.requestId}`,
  });

  if (!out.ok) {
    const status = out.error === 'insufficient_credits' ? 402 : out.error === 'not_enough_context' ? 409 : 500;
    return NextResponse.json(
      {
        error:
          out.error === 'insufficient_credits'
            ? `You need ${RENOVATION_DECISION_ANALYSIS.creditCost} Renovation Credits to run this.`
            : out.error === 'not_enough_context'
              ? 'I need at least two projects on this house before I can sequence them.'
              : "I couldn't complete that analysis. Nothing was charged.",
        code: out.error,
      },
      { status },
    );
  }

  return NextResponse.json({ analysisId: out.analysisId, result: out.result });
}
