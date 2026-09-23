'use client';

import { useMemo } from 'react';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { ValueScenarioCard } from './ValueScenarioCard';

/**
 * SourcesPanel — content for the "Sources" pill's `ContextDrawer`.
 *
 * Only reachable once `buildValueScenario` is ready and has evidence beyond
 * a bare E0 assumption (AssistantHeader hides the pill otherwise). Renders
 * `ValueScenarioCard` exactly as the old always-inline version did — same
 * component, same "why this number?" evidence list — just reached from a
 * deliberate click instead of sitting permanently under every recommended
 * card.
 */
export function SourcesPanel({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  if (valueScenario.status !== 'ready') {
    return (
      <p className="aha-card-why-empty">
        {sqft === undefined
          ? 'Add a square footage to see the evidence behind a value scenario for this project.'
          : 'Add a service to see the evidence behind a value scenario for this project.'}
      </p>
    );
  }

  return <ValueScenarioCard scenario={valueScenario.scenario} />;
}
