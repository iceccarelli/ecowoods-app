'use client';

import { useMemo } from 'react';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';
import { describeFloorPreference, totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { useWorkspaceState } from './WorkspaceStateProvider';
import type { PanelKind } from './WorkspaceShell';

const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

const REGION_LABEL: Record<string, string> = { CA: 'Toronto home', US: 'New York home' };

/**
 * AssistantHeader — "Ecowoods · Ask Francisco", a project capsule pill
 * derived straight from Project Decision State, and three small pill
 * buttons (Project / Economics / Sources) that open the shared
 * `ContextDrawer` from `WorkspaceShell`. Replaces the always-visible
 * ProjectRail/EconomicsRail pair as the way a visitor reaches that detail —
 * the header only ever SUMMARIZES it, never recomputes a different number:
 * every figure here comes from the same `projectRangeForState`/
 * `buildValueScenario` pipeline the drawers and ConversationPane use.
 */
export function AssistantHeader({
  evidencePool,
  onOpenPanel,
}: {
  evidencePool: CaseStudyEvidence[];
  onOpenPanel: (panel: Exclude<PanelKind, null>) => void;
}) {
  const { state } = useWorkspaceState();
  const sqft = totalSquareFeet(state);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  const projectLabel = useMemo(() => {
    const parts: string[] = [];
    if (state.objective) {
      parts.push(REGION_LABEL[state.country] ?? state.country);
      if (sqft !== undefined) parts.push(`${sqft.toLocaleString()} sq ft`);
      parts.push(OBJECTIVE_LABEL[state.objective] ?? state.objective);
      if (state.targetFloor.productId) parts.push(describeFloorPreference(state.targetFloor));
      return parts.join(' · ');
    }
    return 'Start a project';
  }, [state.objective, state.country, state.targetFloor, sqft]);

  const economicsLabel =
    projectRange.status === 'ready' ? formatMoneyRange(projectRange.total) : 'waiting for area';

  const sourcesAvailable =
    valueScenario.status === 'ready' && valueScenario.scenario.evidence.some((e) => e.tier !== 'E0');

  return (
    <header className="aha-appbar">
      <div className="aha-appbar-top">
        <p className="aha-appbar-brand">
          Ecowoods <span aria-hidden="true">·</span> {WORKSPACE_ASSISTANT.name}
        </p>
        <p className="aha-appbar-project" title={projectLabel}>
          {projectLabel}
        </p>
      </div>
      <div className="aha-appbar-pills" role="group" aria-label="Project detail">
        <button type="button" className="aha-pill" onClick={() => onOpenPanel('project')}>
          Project
        </button>
        <button type="button" className="aha-pill" onClick={() => onOpenPanel('economics')}>
          Economics <span className="aha-pill-value">· {economicsLabel}</span>
        </button>
        {sourcesAvailable && (
          <button type="button" className="aha-pill" onClick={() => onOpenPanel('sources')}>
            Sources
          </button>
        )}
      </div>
    </header>
  );
}
