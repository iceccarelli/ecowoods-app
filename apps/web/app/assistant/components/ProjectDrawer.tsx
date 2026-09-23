'use client';

import { useMemo } from 'react';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, calculateExplicitSavings } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { SERVICES } from '@/lib/seo-data';

const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

/**
 * ProjectDrawer — content for the "Project" pill's `ContextDrawer`.
 *
 * Was ProjectRail, a permanently-visible left column; same fields, same
 * `projectRangeForState`/`calculateExplicitSavings`/`buildValueScenario`
 * reads EconomicsDrawer and ConversationPane already compute — never a
 * second, independently-worded computation of the same facts — now shown
 * only while the drawer is open instead of taking up a column on every
 * screen size at all times.
 */
export function ProjectDrawer({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);

  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  const scenariosHint = sqft !== undefined ? 'Open the Compare panel from the conversation' : 'Needs sq ft';

  const savingsHint =
    projectRange.status !== 'ready'
      ? projectRange.status === 'needs-sqft'
        ? 'Needs sq ft'
        : 'Needs a service'
      : projectRange.scopes.length < 2
        ? 'One scope — nothing to bundle yet'
        : 'notQuantified' in calculateExplicitSavings({ baseline: projectRange.total, bundled: projectRange.total, overlapEvidence: [] })
          ? 'Not quantified'
          : 'See Economics';

  const potentialValueHint =
    valueScenario.status === 'needs-sqft'
      ? 'Needs sq ft'
      : valueScenario.status === 'needs-service'
        ? 'Needs a service'
        : `Not quantified — ${valueScenario.scenario.effect.confidence} confidence`;

  const evidenceCount =
    valueScenario.status === 'ready' ? valueScenario.scenario.evidence.filter((e) => e.tier !== 'E0').length : 0;
  const evidenceHint =
    valueScenario.status === 'needs-sqft'
      ? 'Needs sq ft'
      : valueScenario.status === 'needs-service'
        ? 'Needs a service'
        : evidenceCount
          ? `${evidenceCount} documented project${evidenceCount === 1 ? '' : 's'} — see Sources`
          : 'General assumptions only';

  const sections: { label: string; value: string }[] = [
    { label: 'Overview', value: state.objective ? (OBJECTIVE_LABEL[state.objective] ?? 'Not started') : 'Not started' },
    { label: 'My floor', value: describeFloorPreference(state.targetFloor) },
    { label: 'Products', value: state.targetFloor.productId ? '1 selected' : 'None yet' },
    { label: 'Services', value: services.length ? services.join(', ') : 'None yet' },
    { label: 'Scenarios', value: scenariosHint },
    { label: 'Savings', value: savingsHint },
    { label: 'Potential value', value: potentialValueHint },
    { label: 'Evidence', value: evidenceHint },
    { label: 'Compare', value: 'Open from the conversation' },
    { label: 'Saved', value: 'This project' },
    { label: 'Documents', value: 'None yet' },
    { label: 'Next step', value: state.nextAction ? state.nextAction[0]!.toUpperCase() + state.nextAction.slice(1) : 'Not chosen yet' },
  ];

  return (
    <div className="aha-drawer-project">
      {sqft !== undefined && <p className="aha-rail-sqft">{sqft.toLocaleString()} sq ft</p>}
      <ul className="aha-rail-list">
        {sections.map((section) => (
          <li key={section.label} className="aha-rail-item" aria-disabled="true">
            <span className="aha-rail-item-label">{section.label}</span>
            <span className="aha-rail-item-hint">{section.value}</span>
          </li>
        ))}
      </ul>
      <p className="aha-rail-note">
        {state.objective
          ? 'This is saved on this device — reload and it’s still here.'
          : 'Nothing is started yet — tell the assistant what you’re planning and this fills in.'}
      </p>
    </div>
  );
}
