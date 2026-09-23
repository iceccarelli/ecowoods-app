'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState } from '@/lib/assistant-workspace/economics';
import type { CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { WorkspaceStateProvider, useWorkspaceState } from './WorkspaceStateProvider';
import { AssistantHeader } from './AssistantHeader';
import { ConversationPane } from './ConversationPane';
import { ContextDrawer } from './ContextDrawer';
import { ProjectDrawer } from './ProjectDrawer';
import { EconomicsDrawer } from './EconomicsDrawer';
import { SourcesPanel } from './SourcesPanel';
import { RecommendationsPanel } from './RecommendationsPanel';
import { ScenarioCompare } from './ScenarioCompare';
import { ConversionPanel } from './ConversionPanel';

/**
 * A single active on-demand panel at a time — never two drawers stacked.
 * 'project' / 'economics' / 'sources' open from AssistantHeader's pills;
 * 'recommendations' / 'compare' / 'conversion' open from ConversationPane's
 * compact contextual card under the assistant's reply.
 */
export type PanelKind = 'project' | 'economics' | 'sources' | 'recommendations' | 'compare' | 'conversion' | null;

const PANEL_TITLE: Record<Exclude<PanelKind, null>, string> = {
  project: 'This project',
  economics: 'Live project economics',
  sources: 'Evidence & sources',
  recommendations: 'Recommended for your project',
  compare: 'Compare scenarios',
  conversion: 'Next step',
};

/**
 * WorkspaceShell — conversation-first layout for /assistant.
 *
 * Was a permanent three-column grid (project rail | conversation | economics
 * rail) plus a sticky mobile bar, all four always mounted. Now the
 * conversation is the whole surface between `AssistantHeader` and the
 * composer; project/economics/evidence/recommendation detail lives in ONE
 * shared `ContextDrawer` — a right-side slide-over at >=768px, a bottom
 * sheet under it — opened on demand from the header's pills or from a
 * compact card ConversationPane renders under the assistant's reply. Never
 * more than one drawer open, so `activePanel` is a single value here, not a
 * flag per rail.
 *
 * Independent of the corner Quick Assistant (ChatWidget.tsx) in every
 * direction: no shared component, no shared route, no shared client state.
 * Deleting either one leaves the other working.
 *
 * `evidencePool` (ASSISTANT-05) is server-loaded once in `page.tsx` and
 * threaded down as a plain prop — read-only reference data, not part of
 * Project Decision State.
 */
export function WorkspaceShell({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  return (
    <WorkspaceStateProvider>
      <WorkspaceShellBody evidencePool={evidencePool} />
    </WorkspaceStateProvider>
  );
}

function WorkspaceShellBody({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  const { state, ready } = useWorkspaceState();
  const [activePanel, setActivePanel] = useState<PanelKind>(null);
  const openFired = useRef(false);
  const previousObjective = useRef<typeof state.objective | undefined>(undefined);

  const sqft = totalSquareFeet(state);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);

  useEffect(() => {
    if (openFired.current) return;
    openFired.current = true;
    /* `source: 'workspace'` keeps this distinguishable from the corner
       widget's assistant_open events, which never carry this value. No
       message, name, or project detail — same discipline as assistant_open. */
    track('workspace_open', { source: 'workspace' });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const prev = previousObjective.current;
    if (prev === undefined) {
      /* First observation after hydration — a reload of an existing project
         is not a new one, so this establishes the baseline without firing. */
      previousObjective.current = state.objective;
      return;
    }
    if (prev === state.objective) return;
    if (prev === null && state.objective) {
      track('workspace_project_created', { objective: state.objective, country: state.country });
    } else if (state.objective) {
      track('workspace_objective_selected', { objective: state.objective, country: state.country });
    }
    previousObjective.current = state.objective;
  }, [ready, state.objective, state.country]);

  const openPanel = (panel: Exclude<PanelKind, null>) => {
    setActivePanel(panel);
    if (panel === 'project') track('workspace_project_opened', {});
    else if (panel === 'economics') track('workspace_economics_opened', {});
    else if (panel === 'sources') track('workspace_source_opened', {});
  };

  const closePanel = () => setActivePanel(null);

  return (
    <div className="aha-shell">
      <AssistantHeader evidencePool={evidencePool} onOpenPanel={openPanel} />

      <ConversationPane onOpenPanel={openPanel} />

      <ContextDrawer open={activePanel !== null} onClose={closePanel} title={activePanel ? PANEL_TITLE[activePanel] : ''}>
        {activePanel === 'project' && <ProjectDrawer evidencePool={evidencePool} />}
        {activePanel === 'economics' && (
          <EconomicsDrawer evidencePool={evidencePool} onOpenConversion={() => setActivePanel('conversion')} />
        )}
        {activePanel === 'sources' && <SourcesPanel evidencePool={evidencePool} />}
        {activePanel === 'recommendations' && <RecommendationsPanel />}
        {activePanel === 'compare' && sqft !== undefined && (
          <ScenarioCompare squareFeet={sqft} country={state.country} />
        )}
        {activePanel === 'conversion' && <ConversionPanel projectRange={projectRange} />}
      </ContextDrawer>
    </div>
  );
}
