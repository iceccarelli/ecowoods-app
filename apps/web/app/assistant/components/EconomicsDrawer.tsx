'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { computedNeedsMeasure, describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, calculateExplicitSavings, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { SERVICES } from '@/lib/seo-data';
import { track } from '@/lib/analytics';

const COUNTRY_LABEL: Record<string, string> = { CA: 'Ontario (CAD)', US: 'New York (USD)' };
const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

/**
 * EconomicsDrawer — content for the "Economics" pill's `ContextDrawer`.
 *
 * Was EconomicsRail (a permanently-visible right column on desktop) and
 * MobileProjectBar (a sticky bottom bar below ~900px) — the same rows, the
 * same `projectRangeForState`/`calculateExplicitSavings`/`buildValueScenario`
 * reads, now ONE component behind ONE drawer at every breakpoint rather than
 * two components each hard-coding a different width. "Next step" opens the
 * conversion drawer via `onOpenConversion` instead of anchor-scrolling to a
 * ConversionPanel that no longer sits permanently inline.
 */
export function EconomicsDrawer({
  evidencePool,
  onOpenConversion,
}: {
  evidencePool: CaseStudyEvidence[];
  onOpenConversion: () => void;
}) {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);
  const needsMeasure = computedNeedsMeasure(state);
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
        : 'Needs a service — add one from the conversation';

  const savingsText = useMemo(() => {
    if (projectRange.status !== 'ready') return 'Needs pricing engine';
    if (projectRange.scopes.length < 2) return 'One scope — nothing to bundle yet';
    /* Two-or-more distinct scopes at one square footage IS the situation a bundle-overlap
       rule would apply to. `total` already sums them without double-counting (see
       projectRangeForState); this call asks whether Ecowoods has a PUBLISHED rule that
       would discount that sum further. Baseline and bundled are the same total because no
       such rule exists in content/constants/pricing.ts today — the function correctly
       reports notQuantified rather than inventing a discount. */
    const result = calculateExplicitSavings({ baseline: projectRange.total, bundled: projectRange.total, overlapEvidence: [] });
    return 'notQuantified' in result ? 'Potential efficiency: not quantified' : formatMoneyRange(result);
  }, [projectRange]);

  const savingsViewedFired = useRef(false);
  useEffect(() => {
    if (savingsViewedFired.current) return;
    if (projectRange.status !== 'ready' || projectRange.scopes.length < 2) return;
    savingsViewedFired.current = true;
    track('workspace_savings_viewed', { scopeCount: projectRange.scopes.length });
  }, [projectRange]);

  const rows: { label: string; value: string }[] = [
    { label: 'Objective', value: state.objective ? (OBJECTIVE_LABEL[state.objective] ?? '—') : 'Not set' },
    { label: 'Region', value: COUNTRY_LABEL[state.country] ?? state.country },
    { label: 'Selected floor', value: describeFloorPreference(state.targetFloor) },
    { label: 'Services', value: services.length ? services.join(', ') : 'None yet' },
    { label: 'Square footage', value: sqft !== undefined ? `${sqft.toLocaleString()} sq ft` : 'Not set' },
    { label: 'Cost range', value: costRangeText },
    { label: 'Savings', value: savingsText },
    {
      label: 'Value scenario',
      value:
        valueScenario.status === 'ready'
          ? 'Not quantified — see Sources'
          : valueScenario.status === 'needs-sqft'
            ? 'Needs sq ft'
            : 'Needs a service',
    },
    {
      label: 'Confidence',
      value: valueScenario.status === 'ready' ? valueScenario.scenario.effect.confidence : '—',
    },
  ];

  return (
    <div className="aha-drawer-econ">
      <dl className="aha-econ-rows">
        {rows.map((row) => (
          <div key={row.label} className="aha-econ-row" data-highlight={row.label === 'Cost range' && projectRange.status === 'ready'}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      {projectRange.status === 'ready' && projectRange.scopes.length > 1 && (
        <div className="aha-econ-scopes">
          <p className="aha-econ-status-label">By scope</p>
          <ul>
            {projectRange.scopes.map((scope) => (
              <li key={scope.pricingKey}>
                {scope.label}: {formatMoneyRange(scope.range)}
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {projectRange.status === 'ready' ? (
        <button type="button" className="aha-econ-next" onClick={onOpenConversion}>
          Next step — book a measure, estimate or quote
        </button>
      ) : (
        <button type="button" className="aha-econ-next" disabled aria-disabled="true">
          Next step — needs sq ft and a service first
        </button>
      )}

      <p className="aha-econ-footnote">
        {projectRange.status === 'ready'
          ? 'This is the published band applied to your square footage — not a quote. Species, finish, pattern, substrate, stairs and transitions move the number inside the range. The fixed price is written after a free in-home measure.'
          : 'Every dollar shown here will trace to a published price band. Nothing is ever estimated by the assistant itself.'}
      </p>
    </div>
  );
}
