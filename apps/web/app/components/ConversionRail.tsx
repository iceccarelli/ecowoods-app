'use client';

import { useEffect, useState } from 'react';
import { openRenoGuide } from '@/lib/renoguide';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/* ────────────────────────────────────────────────────────────────────────────
   CONVERSION RAIL — WhatsApp + exit intent.

   Two rules, both learned the hard way:

   1. WhatsApp renders ONLY if NEXT_PUBLIC_WHATSAPP_NUMBER is set. I will not
      hardcode a number Ecowoods may not monitor; a floating icon that opens a
      chat nobody reads is worse than no icon. Set the env var to turn it on.

   2. Exit intent fires at most once per session, desktop only, never within
      the first 20 seconds, and never while RenoGuide or a modal is open. An
      interstitial that ambushes someone reading the FAQ is not persuasion, it
      is a tax on trust — and this brand sells trust.

   The modal doesn't collect an email. It offers the two things that actually
   move a hardwood decision: a real answer, or a real appointment. Both land
   in RenoGuide, which owns the tools.
   ──────────────────────────────────────────────────────────────────────────── */

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
const SESSION_KEY = 'ecowoods:exit-intent-shown';
const ARM_DELAY_MS = 20_000;

function useExitIntent(enabled: boolean) {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    // Coarse pointer == no cursor to leave the viewport. Never on touch.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return; // storage blocked → assume shown, stay quiet
    }

    let armed = false;
    const arm = setTimeout(() => { armed = true; }, ARM_DELAY_MS);

    const onLeave = (e: MouseEvent) => {
      if (!armed) return;
      if (e.clientY > 8) return;                  // must exit through the top
      if (e.relatedTarget || (e as MouseEvent & { toElement?: unknown }).toElement) return;
      if (document.querySelector('[role="dialog"]')) return; // chat/modal already open
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* noop */ }
      setTriggered(true);
    };

    document.addEventListener('mouseout', onLeave);
    return () => { clearTimeout(arm); document.removeEventListener('mouseout', onLeave); };
  }, [enabled]);

  return [triggered, setTriggered] as const;
}

export default function ConversionRail() {
  const [exitOpen, setExitOpen] = useExitIntent(true);

  useEffect(() => {
    if (!exitOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExitOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exitOpen, setExitOpen]);

  const waHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(
        "Hi Ecowoods — I'm looking at hardwood for my home and had a question.",
      )}`
    : null;

  const handoff = (prefill: string, source: string) => {
    setExitOpen(false);
    openRenoGuide({ prefill, source });
  };

  return (
    <>
      {waHref && (
        <a
          className="wa-fab"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message Ecowoods on WhatsApp"
          title="Message us on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
          </svg>
        </a>
      )}

      {exitOpen && (
        <div className="exit-overlay" onMouseDown={(e) => e.target === e.currentTarget && setExitOpen(false)}>
          <div className="exit-card" role="dialog" aria-modal="true" aria-labelledby="exit-title">
            <button type="button" className="exit-close" aria-label="Close" onClick={() => setExitOpen(false)}>×</button>

            <span className="eyebrow">Before you go</span>
            <h3 id="exit-title">
              Most people leave because they don&rsquo;t know what it costs.
            </h3>
            <p>
              Ask, and you&rsquo;ll have a real range in about a minute — no form, no call, no
              salesperson. Or take the free in-home measure and get the number in writing.
            </p>

            <div className="exit-actions">
              <button
                type="button"
                className="btn btn-copper btn-lg"
                onClick={() => handoff('What would hardwood cost for my home? I can tell you the species and rough square footage.', 'exit-intent:estimate')}
              >
                Get a range in 60 seconds
              </button>
              <button
                type="button"
                className="fc-secondary"
                onClick={() => handoff('I would like to book a free in-home measure. What times are open?', 'exit-intent:book')}
              >
                Book the free measure instead
              </button>
            </div>

            <p className="exit-foot">
              Or call <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a> · Mon–Sat, 8 AM – 7 PM
            </p>
          </div>
        </div>
      )}
    </>
  );
}
