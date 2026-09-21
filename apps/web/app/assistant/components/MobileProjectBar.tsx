'use client';

import { useState } from 'react';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { SERVICES } from '@/lib/seo-data';

const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

/**
 * MobileProjectBar — sticky summary bar for narrow viewports.
 *
 * Reads the same Project Decision State as EconomicsRail and shows the same
 * non-money facts, in a bottom sheet instead of a fixed rail. Still no money
 * field — that stays "Needs pricing engine" until ASSISTANT-04.
 */
export function MobileProjectBar() {
  const { state } = useWorkspaceState();
  const [open, setOpen] = useState(false);
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);

  const summary = state.objective
    ? `${OBJECTIVE_LABEL[state.objective] ?? state.objective}${sqft !== undefined ? ` · ${sqft.toLocaleString()} sq ft` : ''}`
    : 'Not started';

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
        <span className="aha-mobile-bar-value">{summary}</span>
        <span className="aha-mobile-bar-chevron" aria-hidden="true" data-open={open} />
      </button>

      {open && (
        <div id="aha-mobile-sheet" className="aha-mobile-sheet" role="dialog" aria-label="Project economics">
          <dl className="aha-mobile-sheet-rows">
            <div className="aha-mobile-sheet-row">
              <dt>Objective</dt>
              <dd>{state.objective ? (OBJECTIVE_LABEL[state.objective] ?? state.objective) : 'Not set'}</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Selected floor</dt>
              <dd>{describeFloorPreference(state.targetFloor)}</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Services</dt>
              <dd>{services.length ? services.join(', ') : 'None yet'}</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Square footage</dt>
              <dd>{sqft !== undefined ? `${sqft.toLocaleString()} sq ft` : 'Not set'}</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Cost range</dt>
              <dd>Needs pricing engine</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Value scenario</dt>
              <dd>Needs pricing engine</dd>
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
