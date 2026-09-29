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
import { isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { designIdOf } from '@/lib/floor-studio/design-id';
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

/**
 * 5 runs/minute/user — keyed by userId, not IP: this route requires auth
 * (right below), so the authenticated identity is both more precise than an
 * IP (no false sharing behind NAT/CGNAT) and the right unit to protect,
 * since what it spends is that user's Renovation Credits.
 *
 * `failClosed: true` — this is a paid, credit-charging route. A Postgres
 * outage DENIES the request rather than falling back to an in-memory
 * bucket: `chargeForAnalysis` itself touches this same database for the
 * credit charge, so an outage fails the request either way, and failing
 * closed here means that failure happens before any compute is spent, not
 * after.
 */
const ANALYSIS_RUN_RATE_LIMIT = { windowMs: 60_000, maxRequests: 5 };

export async function POST(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to run this analysis.' }, { status: 401 });
  }

  const rl = await enforceRateLimit({
    routeKey: 'assistant-analysis-run',
    identity: userId,
    config: ANALYSIS_RUN_RATE_LIMIT,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
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
    designId: designIdOf(workspace.designId),
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
