'use client';

import { useWorkspaceState } from './WorkspaceStateProvider';
import { computedNeedsMeasure, describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { SERVICES } from '@/lib/seo-data';

const COUNTRY_LABEL: Record<string, string> = { CA: 'Ontario (CAD)', US: 'New York (USD)' };
const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

/**
 * EconomicsRail — the right zone of the workspace shell.
 *
 * ASSISTANT-02: no economics engine exists yet (ASSISTANT-04, pure functions
 * over content/constants/pricing.ts). Every money field stays an explicit
 * placeholder here — that is a law, not a gap this phase quietly works
 * around. What CAN be shown honestly is read straight from Project Decision
 * State: the objective, the region, the floor picked so far, the services
 * named, and the square footage typed in. None of it is a dollar figure.
 */
export function EconomicsRail() {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);
  const needsMeasure = computedNeedsMeasure(state);

  const rows: { label: string; value: string }[] = [
    { label: 'Objective', value: state.objective ? (OBJECTIVE_LABEL[state.objective] ?? '—') : 'Not set' },
    { label: 'Region', value: COUNTRY_LABEL[state.country] ?? state.country },
    { label: 'Selected floor', value: describeFloorPreference(state.targetFloor) },
    { label: 'Services', value: services.length ? services.join(', ') : 'None yet' },
    { label: 'Square footage', value: sqft !== undefined ? `${sqft.toLocaleString()} sq ft` : 'Not set' },
    { label: 'Cost range', value: 'Needs project state' },
    { label: 'Savings', value: 'Needs project state' },
    { label: 'Value scenario', value: 'Needs project state' },
    { label: 'Confidence', value: '—' },
  ];

  return (
    <aside className="aha-econ" aria-label="Live project economics">
      <p className="aha-econ-heading">Live project economics</p>

      <dl className="aha-econ-rows">
        {rows.map((row) => (
          <div key={row.label} className="aha-econ-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="aha-econ-status">
        <div className="aha-econ-status-group">
          <p className="aha-econ-status-label">Known</p>
          {state.objective || sqft !== undefined || state.targetFloor.productId ? (
            <ul>
              {state.objective && <li>{OBJECTIVE_LABEL[state.objective] ?? state.objective}</li>}
              {sqft !== undefined && <li>{sqft.toLocaleString()} sq ft</li>}
              {state.targetFloor.productId && <li>{describeFloorPreference(state.targetFloor)}</li>}
            </ul>
          ) : (
            <p className="aha-econ-status-empty">Nothing yet</p>
          )}
        </div>
        <div className="aha-econ-status-group">
          <p className="aha-econ-status-label">Needs measure</p>
          {needsMeasure.length ? (
            <ul>
              {needsMeasure.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="aha-econ-status-empty">Nothing outstanding</p>
          )}
        </div>
      </div>

      <button type="button" className="aha-econ-next" disabled aria-disabled="true">
        Next step — not available yet
      </button>

      <p className="aha-econ-footnote">
        Every dollar shown here will trace to a published price band. Nothing is ever estimated by the assistant
        itself.
      </p>
    </aside>
  );
}
