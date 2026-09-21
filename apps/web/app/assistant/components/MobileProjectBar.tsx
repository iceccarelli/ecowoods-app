'use client';

import { useState } from 'react';

/**
 * MobileProjectBar — sticky summary bar for narrow viewports.
 *
 * Collapses the left (project nav) and right (economics) zones into one tap
 * target above the conversation, which dominates the viewport on mobile per
 * docs/assistant-workspace/NEW_ASSISTANT_ARCHITECTURE.md. Tapping it opens a
 * bottom sheet with the same "—" placeholders EconomicsRail shows on desktop
 * — ASSISTANT-01 ships no live data, only the honest empty state and the
 * interaction shell it will run in.
 */
export function MobileProjectBar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="aha-mobile-bar-wrap">
      <button
        type="button"
        className="aha-mobile-bar"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="aha-mobile-sheet"
      >
        <span className="aha-mobile-bar-label">Project</span>
        <span className="aha-mobile-bar-value">Cost range — not started</span>
        <span className="aha-mobile-bar-chevron" aria-hidden="true" data-open={open} />
      </button>

      {open && (
        <div id="aha-mobile-sheet" className="aha-mobile-sheet" role="dialog" aria-label="Project economics">
          <dl className="aha-mobile-sheet-rows">
            <div className="aha-mobile-sheet-row">
              <dt>Selected floor</dt>
              <dd>Not started</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Services</dt>
              <dd>Not started</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Cost range</dt>
              <dd>Needs project state</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Value scenario</dt>
              <dd>Needs project state</dd>
            </div>
          </dl>
          <p className="aha-mobile-sheet-footnote">
            Every dollar shown here will trace to a published price band.
          </p>
          <button type="button" className="aha-mobile-sheet-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
