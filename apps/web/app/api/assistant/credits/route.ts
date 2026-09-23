/**
 * GET /api/assistant/credits — the signed-in visitor's current Renovation
 * Credits balance. Server-authoritative (directive rule 40): the client
 * never computes or caches a balance across a paid action, it re-reads this
 * every time the paywall card or the checkout-return flow needs to know
 * "does this person have enough."
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletSummary } from '@/lib/assistant-workspace/credit-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false, balance: 0, reserved: 0 });
  }
  const summary = await getWalletSummary(session.user.id);
  return NextResponse.json({ signedIn: true, balance: summary?.balance ?? 0, reserved: summary?.reserved ?? 0 });
}
