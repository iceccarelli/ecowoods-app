'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { track } from '@/lib/analytics';
import { RENOVATION_DECISION_ANALYSIS } from '@/content/constants/renovation-analysis-product';
import type { DetailedRenovationAnalysis } from '@/lib/assistant-workspace/renovation-analysis';
import type { WorkspaceState } from '@/lib/assistant-workspace/types';

interface WalletState {
  signedIn: boolean;
  balance: number;
  reserved: number;
}

/**
 * The real paywall + checkout + execution for the Renovation Decision
 * Analysis — not a "coming soon" card. Mounted by ConversationPane when a
 * `paid_analysis_proposed` card renders. Owns its own balance/checkout/run
 * state because none of it belongs on WorkspaceState (it's account/ledger
 * state, server-authoritative, never persisted to the anonymous
 * localStorage snapshot).
 *
 * States, in order (directive rule 17-20):
 *   loading balance -> not signed in (sign-in CTA) ->
 *   signed in, insufficient credits (buy credits CTA) ->
 *   signed in, enough credits (run CTA) -> running -> result | error
 */
export function PaidAnalysisAction({
  designId,
  workspaceState,
  onResult,
}: {
  designId: string;
  workspaceState: WorkspaceState;
  onResult: (result: DetailedRenovationAnalysis) => void;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'run' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = sessionStatus === 'authenticated' && Boolean(session?.user);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/assistant/credits')
      .then((r) => r.json())
      .then((data: WalletState) => {
        if (!cancelled) setWallet(data);
      })
      .catch(() => {
        if (!cancelled) setWallet({ signedIn: false, balance: 0, reserved: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  useEffect(() => {
    track('workspace_paid_action_shown', { creditCost: RENOVATION_DECISION_ANALYSIS.creditCost });
  }, []);

  const startCheckout = async () => {
    track('workspace_checkout_started', {});
    setBusy('checkout');
    setError(null);
    try {
      const res = await fetch('/api/assistant/credits/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start checkout.');
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Could not start checkout. Try again.');
      setBusy(null);
    }
  };

  const runAnalysis = async () => {
    track('workspace_analysis_started', {});
    setBusy('run');
    setError(null);
    try {
      const requestId = crypto.randomUUID();
      const res = await fetch('/api/assistant/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId,
          requestId,
          workspace: {
            country: workspaceState.country,
            objective: workspaceState.objective,
            sellHorizon: workspaceState.sellHorizon,
            stairs: workspaceState.stairs,
            rooms: workspaceState.rooms,
            targetFloor: workspaceState.targetFloor,
            selectedServiceSlugs: workspaceState.selectedServiceSlugs,
            nextAction: workspaceState.nextAction,
            personalization: workspaceState.personalization,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        track('workspace_analysis_failed', { code: typeof data.code === 'string' ? data.code : 'unknown' });
        setError(data.error ?? "I couldn't complete that analysis. Nothing was charged.");
        setBusy(null);
        return;
      }
      track('workspace_analysis_completed', {});
      const refreshed = await fetch('/api/assistant/credits').then((r) => r.json());
      setWallet(refreshed);
      onResult(data.result as DetailedRenovationAnalysis);
    } catch {
      track('workspace_analysis_failed', { code: 'network' });
      setError("I couldn't complete that analysis. Nothing was charged.");
    } finally {
      setBusy(null);
    }
  };

  if (!wallet) {
    return <p className="aha-paid-action-status">Checking your Renovation Credits{'…'}</p>;
  }

  if (!signedIn) {
    return (
      <div className="aha-paid-action">
        <p className="aha-paid-action-status">Sign in to run this — it saves against your house, not this browser tab.</p>
        <a
          className="aha-inline-card-link"
          href={`/login?callbackUrl=${encodeURIComponent('/assistant')}`}
          onClick={() => track('workspace_account_prompt_shown', {})}
        >
          Sign in to continue
        </a>
      </div>
    );
  }

  const enough = wallet.balance >= RENOVATION_DECISION_ANALYSIS.creditCost;

  return (
    <div className="aha-paid-action">
      {error && <p className="aha-paid-action-error">{error}</p>}
      {enough ? (
        <button type="button" className="aha-paid-action-run" onClick={() => void runAnalysis()} disabled={busy !== null}>
          {busy === 'run' ? 'Analyzing…' : 'Analyze my house'}
        </button>
      ) : (
        <>
          <p className="aha-paid-action-status">
            You have {wallet.balance} credit{wallet.balance === 1 ? '' : 's'} {'—'} {RENOVATION_DECISION_ANALYSIS.creditCost} required.
          </p>
          <button type="button" className="aha-paid-action-run" onClick={() => void startCheckout()} disabled={busy !== null}>
            {busy === 'checkout' ? 'Opening checkout…' : 'Buy credits'}
          </button>
        </>
      )}
    </div>
  );
}
