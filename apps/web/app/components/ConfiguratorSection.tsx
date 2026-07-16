'use client';

/**
 * ConfiguratorSection — "Design Your Floor".
 *
 * Desktop: the configurator inline, exactly as before. It's a three-column
 * tool with room to breathe, and it earns its place in the scroll.
 *
 * Mobile: that same tool is five screens of swatches, sliders and inputs that
 * every non-interested visitor has to thumb past. So on phones it collapses to
 * a single compact teaser card, and opens **full-screen on demand**. Nobody
 * scrolls a tool they didn't ask for; anyone who wants it gets it bigger and
 * more focused than it ever was inline — which is the pattern serious mobile
 * products use for configurators and filter panels.
 *
 * The sheet is portalled to <body> because ancestor `transform` (the .reveal
 * animation) would otherwise break `position: fixed`. It locks body scroll,
 * closes on Escape and on backdrop tap, and restores focus on close.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FloorConfigurator from './FloorConfigurator';
import { useIsMobile } from './SwipeDeck';

export default function ConfiguratorSection() {
  const { mounted, isMobile } = useIsMobile();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Lock the page behind the sheet, and restore whatever was there before.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; focus moves into the sheet, then back to the trigger.
  useEffect(() => {
    if (!open) {
      opener.current?.focus?.();
      return;
    }
    closeBtn.current?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // SSR + desktop: unchanged inline tool.
  if (!mounted || !isMobile) return <FloorConfigurator />;

  return (
    <section className="section-tight" id="configurator">
      <div className="shell">
        <div className="fc-teaser reveal">
          <span className="eyebrow">Design Your Floor</span>
          <h2 className="fc-teaser-title">
            Build it here. <span className="serif-italic">Then stand on it.</span>
          </h2>
          <p className="fc-teaser-body">
            Species, finish, pattern, size — priced live with the same numbers our estimator
            carries in the truck. A range, not a quote.
          </p>
          <button
            ref={opener}
            type="button"
            className="fc-teaser-btn"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            <span>Open the floor designer</span>
            <span aria-hidden="true">→</span>
          </button>
          <span className="fc-teaser-note">Takes about a minute · nothing to fill in</span>
        </div>
      </div>

      {open &&
        createPortal(
          <div className="fc-sheet" role="dialog" aria-modal="true" aria-label="Design your floor">
            <button className="fc-sheet-scrim" onClick={close} aria-label="Close designer" tabIndex={-1} />
            <div className="fc-sheet-panel">
              <div className="fc-sheet-bar">
                <span className="fc-sheet-title">Design your floor</span>
                <button ref={closeBtn} type="button" className="fc-sheet-close" onClick={close} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="fc-sheet-body">
                <FloorConfigurator />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
