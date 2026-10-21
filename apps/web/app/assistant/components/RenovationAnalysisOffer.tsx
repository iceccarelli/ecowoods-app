'use client';

/**
 * RenovationAnalysisOffer — the one paid action in Ask Francisco.
 *
 * Rendered inline, in the same aha-inline-card family as every other card
 * type (see ConversationPane's `data-card-type`), never a separate pricing
 * page or a modal that pulls the visitor out of the conversation. Mirrors
 * directive language: names the deliverable and the exact cost up front,
 * never "Upgrade" / "Unlock" / urgency copy.
 *
 * STATE MACHINE (deliberately small):
 *   signed out -> "Sign in to run this analysis" (never a paywall lecture)
 *   signed in, balance unknown -> loading
 *   signed in, balance >= cost -> "Run the analysis" (spends credits directly, no Stripe roundtrip)
 *   signed in, balance < cost -> "Buy Renovation Credits" (Stripe Checkout)
 *   running -> disabled, honest progress copy
 *   done -> <RenovationAnalysisResultView>
 *   failed -> honest failure copy, "Nothing was charged," retry with a fresh key
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { track } from '@/lib/analytics';
import type { WorkspaceSnapshot } from '@/lib/assistant-workspace/chat-schema';
import type { RenovationAnalysisResult } from '@/lib/assistant-workspace/renovation-analysis';
import { RenovationAnalysisResultView } from './RenovationAnalysisResultView';

function mintIdempotencyKey(): string {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `analysis-${id}`;
}

type Phase = 'idle' | 'checking-wallet' | 'ready-to-buy' | 'ready-to-run' | 'buying' | 'running' | 'done' | 'failed';

export function RenovationAnalysisOffer({
  creditsCost,
  workspaceSnapshot,
}: {
  creditsCost: number;
  workspaceSnapshot: WorkspaceSnapshot;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [balance, setBalance] = useState<number | null>(null);
  const [result, setResult] = useState<RenovationAnalysisResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(mintIdempotencyKey());
  const shownOnce = useRef(false);

  useEffect(() => {
    if (!shownOnce.current) {
      shownOnce.current = true;
      track('analysis_offer_shown', { creditsCost });
    }
  }, [creditsCost]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    let cancelled = false;
    setPhase('checking-wallet');
    fetch('/api/assistant/credits/wallet')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('wallet_unavailable'))))
      .then((data: { balance: number }) => {
        if (cancelled) return;
        setBalance(data.balance);
        setPhase(data.balance >= creditsCost ? 'ready-to-run' : 'ready-to-buy');
      })
      .catch(() => {
        if (!cancelled) setPhase('ready-to-buy');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, creditsCost]);

  const buyCredits = async () => {
    track('analysis_offer_selected', { creditsCost });
    if (sessionStatus !== 'authenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent('/assistant')}`);
      return;
    }
    setPhase('buying');
    track('checkout_started', { creditsCost });
    try {
      const res = await fetch('/api/assistant/analysis/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: '/assistant' }),
      });
      if (!res.ok) throw new Error('checkout_failed');
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setPhase('ready-to-buy');
      setErrorText("Couldn't start checkout. Nothing was charged. Try again.");
    }
  };

  const runAnalysis = async () => {
    track('analysis_offer_selected', { creditsCost });
    setPhase('running');
    setErrorText(null);
    track('analysis_started', { creditsCost });
    /* Set only once the server has actually answered. A thrown fetch (dropped
       connection, lost response) leaves it unset: the charge may already have
       committed, so the SAME key must be re-sent — that is what makes the retry
       replay the saved result instead of charging twice. */
    let answered: { status: number } | null = null;
    try {
      const res = await fetch('/api/assistant/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: workspaceSnapshot, requestIdempotencyKey: idempotencyKeyRef.current }),
      });
      answered = { status: res.status };
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setBalance(data.balance ?? 0);
        setPhase('ready-to-buy');
        setErrorText('Not enough Renovation Credits for this — buy more to continue.');
        return;
      }
      if (res.status === 401) {
        setPhase('failed');
        setErrorText('Your session has ended. Sign in again to run the analysis. Nothing was charged.');
        return;
      }
      if (res.status === 422 || res.status === 429) {
        setPhase('failed');
        setErrorText(typeof data?.error === 'string' ? `${data.error} Nothing was charged.` : "I couldn't run that yet. Nothing was charged.");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? 'analysis_failed');
      setResult(data.result as RenovationAnalysisResult);
      setBalance(data.balance ?? null);
      setPhase('done');
      track('analysis_completed', { creditsCost });
      track('analysis_result_viewed', {});
    } catch {
      setPhase('failed');
      track('analysis_failed', { creditsCost });
      /* A key conflict (409) is the only answer a replay cannot fix; every other
         failure keeps the key so a retry can never double-charge. */
      if (answered?.status === 409) idempotencyKeyRef.current = mintIdempotencyKey();
      setErrorText(
        answered
          ? "I couldn't complete that analysis. Nothing was charged."
          : "I couldn't confirm that analysis finished. If credits were used, trying again shows the saved result without charging twice.",
      );
    }
  };

  if (phase === 'done' && result) {
    return <RenovationAnalysisResultView result={result} />;
  }

  return (
    <div className="aha-inline-card aha-analysis-offer" data-card-type="renovation_analysis_offer">
      <p className="aha-inline-card-title">Renovation Decision Analysis</p>
      <p className="aha-inline-card-body">
        I&apos;ll turn everything you&apos;ve told me about this project into a prioritized sequence, a cost view from
        published Ecowoods bands where they apply, what&apos;s still an assumption, and one concrete next step.
      </p>
      <p className="aha-analysis-cost">{creditsCost} Renovation Credits</p>
      {balance !== null && phase !== 'buying' && phase !== 'running' && (
        <p className="aha-analysis-balance">You have {balance} Renovation Credits.</p>
      )}
      {errorText && (
        <p className="aha-message-text" role="alert">
          {errorText}
        </p>
      )}
      {sessionStatus !== 'authenticated' ? (
        <button type="button" className="aha-analysis-cta" onClick={buyCredits}>
          Sign in to run the analysis
        </button>
      ) : phase === 'checking-wallet' ? (
        <button type="button" className="aha-analysis-cta" disabled>
          Checking your balance…
        </button>
      ) : phase === 'ready-to-run' ? (
        <button type="button" className="aha-analysis-cta" onClick={runAnalysis}>
          Run the analysis
        </button>
      ) : phase === 'running' ? (
        <button type="button" className="aha-analysis-cta" disabled>
          Working through your project…
        </button>
      ) : phase === 'buying' ? (
        <button type="button" className="aha-analysis-cta" disabled>
          Opening secure checkout…
        </button>
      ) : phase === 'failed' ? (
        <button type="button" className="aha-analysis-cta" onClick={runAnalysis}>
          Try the analysis again
        </button>
      ) : (
        <button type="button" className="aha-analysis-cta" onClick={buyCredits}>
          Buy Renovation Credits
        </button>
      )}
    </div>
  );
}
