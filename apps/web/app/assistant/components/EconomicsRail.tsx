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
 * EconomicsRail — live economics. Shown inside WorkspaceContextDrawer (v8);
 * not a permanent right rail.
 *
 * ASSISTANT-04: the cost range is real now — `projectRangeForState`
 * (lib/assistant-workspace/economics.ts) composes `calculateProjectRange`
 * over every DISTINCT published band among the services added in
 * ASSISTANT-03, at the square footage typed into state. Every dollar traces
 * to a `PriceBand`; nothing here is estimated by the assistant itself.
 *
 * Two honest empty states, not one generic placeholder: "Needs sq ft" when
 * no room has an area yet, "Needs a service" when the area is known but
 * nothing's been added to price against. "Savings" always runs through
 * `calculateExplicitSavings` — with no overlap-rule evidence published in
 * this codebase yet, that deterministically returns "Potential efficiency:
 * not quantified," never a guessed percentage.
 *
 * ASSISTANT-05: "Value scenario"/"Confidence" now read the same
 * `buildValueScenario` output ConversationPane's `ValueScenarioCard` shows in
 * full — `effect.range` is always `null` today (no evidence in this system
 * quantifies a value effect; see value-scenario.ts's module comment), so
 * this row says "Not quantified" rather than a number, same as the card.
 *
 * ASSISTANT-07: "Next step" is a real link now, not a permanently-disabled
 * button — it jumps to ConversationPane's `ConversionPanel`
 * (`#aha-next-step`), the one place that PLAN → REVIEW → CONFIRM → EXECUTE
 * flow lives. This rail never duplicates that logic; it only points at it,
 * same as "Value scenario"'s own "see conversation" text.
 */
export function EconomicsRail({ evidencePool, embedded = false }: { evidencePool: CaseStudyEvidence[]; embedded?: boolean }) {
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
        : 'Needs a service — add one from the cards above';

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
          ? 'Not quantified — see conversation'
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
    <aside className={`aha-econ${embedded ? ' aha-econ--embedded' : ''}`} aria-label="Live project economics">
      <p className="aha-econ-heading">Live project economics</p>

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
        <a href="#aha-next-step" className="aha-econ-next">
          Next step — book a measure, estimate or quote
        </a>
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
    </aside>
  );
}
