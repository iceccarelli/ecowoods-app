/**
 * GET /api/assistant/conversation?designId=... — Ask Francisco's reload-safe
 * transcript (Gate 2, P0). Returns the stored turns for a design so the
 * client can hydrate ConversationPane on mount instead of starting blank
 * every time the visitor reopens the tab.
 *
 * Anonymous-first: no account is REQUIRED, but a design id alone is NOT
 * enough — it is shareable (Floor Studio links carry it). The transcript is
 * returned only to the signed-in owner of an account-linked conversation, or
 * to the browser holding the private httpOnly access cookie minted when the
 * conversation was created (conversation-access.ts). Anyone else gets the
 * same empty result as "no conversation".
 * Rate-limited (reusing the existing durable limiter, not a new one) to
 * blunt a script that walks many design ids looking for a hit — the 60-bit
 * id space already makes that infeasible by brute force, but a cheap read
 * loop costs nothing to also throttle.
 */
import { NextResponse } from 'next/server';
import { getClientIp, isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit-durable';
import { auth } from '@/lib/auth';
import { isDesignId } from '@/lib/floor-studio/design-id';
import { loadTranscript } from '@/lib/assistant-workspace/conversation-store';
import { readAccessToken } from '@/lib/assistant-workspace/conversation-access';

export const dynamic = 'force-dynamic';

/** Generous — this is a read a visitor's own client fires once per page load, not a chat turn. Fail-open: a transient limiter outage must not block a homeowner reopening their own project. */
const CONVERSATION_READ_RATE_LIMIT = { windowMs: 60_000, maxRequests: 60 };

export async function GET(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const ip = getClientIp(req);
  const rateLimit = await enforceRateLimit({
    routeKey: 'assistant-conversation-read',
    identity: ip,
    config: CONVERSATION_READ_RATE_LIMIT,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests, give it a moment.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const url = new URL(req.url);
  const designId = url.searchParams.get('designId') ?? '';
  if (!isDesignId(designId)) {
    return NextResponse.json({ turns: [] });
  }
  const session = await auth().catch(() => null);
  const turns = await loadTranscript(designId, session?.user?.id ?? null, readAccessToken(req, designId));
  return NextResponse.json({ turns });
}
