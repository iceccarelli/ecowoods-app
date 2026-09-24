/**
 * GET /api/assistant/credits/wallet — the homeowner's current Renovation
 * Credits balance.
 *
 * Read-only, own-wallet-only. The webhook (not this route, not the browser
 * returning from Checkout) is the authority on whether a purchase granted
 * credits — this just reports whatever the ledger currently says, so the UI
 * can poll it after a Checkout redirect instead of trusting the redirect
 * itself as proof of payment.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWalletBalance } from '@/lib/credit-ledger';
import { ANALYSIS_CREDIT_COST } from '@/lib/assistant-workspace/credits-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const balance = await getWalletBalance(userId);
  return NextResponse.json({ balance, analysisCreditCost: ANALYSIS_CREDIT_COST });
}
