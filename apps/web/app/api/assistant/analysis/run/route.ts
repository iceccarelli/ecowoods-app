/**
 * POST /api/assistant/analysis/run — spend Renovation Credits on a
 * Renovation Decision Analysis.
 *
 * Auth required. Never trusts the client for: eligibility (re-checked here
 * via isEligibleForAnalysis), the credit cost (ANALYSIS_CREDIT_COST is a
 * server constant), or the analysis content itself (computed here, from the
 * submitted context snapshot, by the deterministic engine — never returned
 * by the client and stored verbatim).
 *
 * Idempotent: the client sends `requestIdempotencyKey` (minted once per
 * attempt, resent unchanged on a retried/duplicated fetch of the SAME
 * attempt). See lib/credit-ledger.ts's chargeForAnalysis for the guarantee —
 * a repeat under the same key returns the same saved result and does not
 * charge again.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isTrustedBrowserOrigin, checkRateLimit, getClientIp, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { workspaceSnapshotSchema } from '@/lib/assistant-workspace/chat-schema';
import { buildRenovationAnalysis, isEligibleForAnalysis } from '@/lib/assistant-workspace/renovation-analysis';
import { ANALYSIS_CREDIT_COST } from '@/lib/assistant-workspace/credits-config';
import { chargeForAnalysis } from '@/lib/credit-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  workspace: workspaceSnapshotSchema,
  requestIdempotencyKey: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to run this analysis.' }, { status: 401 });
  }

  const rl = checkRateLimit(getClientIp(req), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { workspace, requestIdempotencyKey } = parsed.data;

  const eligibility = isEligibleForAnalysis(workspace);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? 'Not enough context for an analysis yet.' }, { status: 422 });
  }

  const outcome = await chargeForAnalysis({
    userId,
    credits: ANALYSIS_CREDIT_COST,
    requestIdempotencyKey,
    contextSnapshot: workspace,
    compute: () => buildRenovationAnalysis(workspace),
  });

  if (!outcome.ok) {
    if (outcome.error === 'insufficient_credits') {
      return NextResponse.json(
        { error: 'insufficient_credits', balance: outcome.balance, required: outcome.required },
        { status: 402 },
      );
    }
    console.error(
      JSON.stringify({ event: 'renovation_analysis.failed', userId, error: outcome.message }),
    );
    return NextResponse.json(
      { error: "I couldn't complete that analysis. Nothing was charged." },
      { status: 502 },
    );
  }

  console.log(
    JSON.stringify({
      event: 'renovation_analysis.completed',
      userId,
      analysisId: outcome.analysisId,
      creditsCharged: ANALYSIS_CREDIT_COST,
      replay: outcome.replay,
    }),
  );

  return NextResponse.json({
    analysisId: outcome.analysisId,
    result: outcome.result,
    balance: outcome.balance,
    replay: outcome.replay,
  });
}
