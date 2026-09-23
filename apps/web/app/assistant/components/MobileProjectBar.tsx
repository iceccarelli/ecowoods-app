'use client';

import { useMemo, useState } from 'react';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
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
 * Reads the same Project Decision State (and the same
 * `projectRangeForState` economics, ASSISTANT-04) as EconomicsRail, in a
 * bottom sheet instead of a fixed rail. The collapsed bar itself shows the
 * cost range once one exists — that is the number a visitor on a phone
 * came here for.
 *
 * ASSISTANT-05: the "Value scenario" row reads the same `buildValueScenario`
 * output EconomicsRail's does — never a fabricated "Not available yet" once
 * the feature exists on the same state.
 */
export function MobileProjectBar({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  const { state } = useWorkspaceState();
  const [open, setOpen] = useState(false);
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  const costRangeText =
    projectRange.status === 'ready'
      ? formatMoneyRange(projectRange.total)
      : projectRange.status === 'needs-sqft'
        ? 'Needs sq ft'
        : 'Needs a service';

  const summary =
    projectRange.status === 'ready'
      ? costRangeText
      : state.objective
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
              <dd>{costRangeText}</dd>
            </div>
            <div className="aha-mobile-sheet-row">
              <dt>Value scenario</dt>
              <dd>
                {valueScenario.status === 'ready'
                  ? `Not quantified — ${valueScenario.scenario.effect.confidence} confidence`
                  : valueScenario.status === 'needs-sqft'
                    ? 'Needs sq ft'
                    : 'Needs a service'}
              </dd>
            </div>
          </dl>
          <p className="aha-mobile-sheet-footnote">
            {projectRange.status === 'ready'
              ? 'The published band applied to your square footage — not a quote. Fixed in writing after a free in-home measure.'
              : 'Every dollar shown here will trace to a published price band.'}
          </p>
          <button type="button" className="aha-mobile-sheet-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
