/**
 * GET /api/assistant/conversation?designId=... — Ask Francisco's reload-safe
 * transcript (Gate 2, P0). Returns the stored turns for a design so the
 * client can hydrate ConversationPane on mount instead of starting blank
 * every time the visitor reopens the tab.
 *
 * Read-only, anonymous-first: no auth required, since a design id alone
 * never identifies a person (see design-id.ts) and this route returns only
 * what that same browser already has the id for. Trusted-origin check
 * mirrors the chat route — this is a private conversation, not a public
 * lookup.
 */
import { NextResponse } from 'next/server';
import { isTrustedBrowserOrigin } from '@/lib/rate-limit';
import { isDesignId } from '@/lib/floor-studio/design-id';
import { loadTranscript } from '@/lib/assistant-workspace/conversation-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isTrustedBrowserOrigin(req)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const designId = url.searchParams.get('designId') ?? '';
  if (!isDesignId(designId)) {
    return NextResponse.json({ turns: [] });
  }
  const turns = await loadTranscript(designId);
  return NextResponse.json({ turns });
}
