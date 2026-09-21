'use client';

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
 * ProjectRail — the left zone of the workspace shell.
 *
 * ASSISTANT-02: every row reads Project Decision State. Sections without
 * anything to show yet keep the empty-state hint from ASSISTANT-01 — this
 * phase does not add navigation to sub-pages that don't exist (ASSISTANT-03+).
 */
export function ProjectRail() {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const services = state.selectedServiceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);

  const sections: { label: string; value: string }[] = [
    { label: 'Overview', value: state.objective ? (OBJECTIVE_LABEL[state.objective] ?? 'Not started') : 'Not started' },
    { label: 'My floor', value: describeFloorPreference(state.targetFloor) },
    { label: 'Products', value: state.targetFloor.productId ? '1 selected' : 'None yet' },
    { label: 'Services', value: services.length ? services.join(', ') : 'None yet' },
    { label: 'Scenarios', value: 'Not yet available' },
    { label: 'Savings', value: 'Not yet available' },
    { label: 'Potential value', value: 'Not yet available' },
    { label: 'Evidence', value: 'Not yet available' },
    { label: 'Compare', value: 'Not yet available' },
    { label: 'Saved', value: 'This project' },
    { label: 'Documents', value: 'None yet' },
    { label: 'Next step', value: state.nextAction ? state.nextAction[0]!.toUpperCase() + state.nextAction.slice(1) : 'Not chosen yet' },
  ];

  return (
    <nav className="aha-rail aha-rail--project" aria-label="Project sections">
      <p className="aha-rail-heading">This project</p>
      {sqft !== undefined && (
        <p className="aha-rail-sqft">{sqft.toLocaleString()} sq ft</p>
      )}
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
    </nav>
  );
}
