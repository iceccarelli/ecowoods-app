'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import type { CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { WorkspaceStateProvider, useWorkspaceState } from './WorkspaceStateProvider';
import { ConversationPane } from './ConversationPane';
import {
  WorkspaceContextDrawer,
  type WorkspaceDrawerTab,
} from './WorkspaceContextDrawer';

const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

/**
 * WorkspaceShell — AGENT_DIRECTIVE v8 conversation-first layout.
 *
 * Desktop default: NO permanent ProjectRail / EconomicsRail. Header with
 * Ask Francisco + compact Project capsule → conversation canvas → premium
 * composer. Project / Economics / Sources / Documents open as ONE contextual
 * slide-over (WorkspaceContextDrawer). Backend engines unchanged.
 *
 * Independent of the corner Quick Assistant (ChatWidget.tsx).
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
  const openFired = useRef(false);
  const previousObjective = useRef<typeof state.objective | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<WorkspaceDrawerTab>('project');

  useEffect(() => {
    if (openFired.current) return;
    openFired.current = true;
    track('workspace_open', { source: 'workspace' });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const prev = previousObjective.current;
    if (prev === undefined) {
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

  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const sqft = totalSquareFeet(state);

  const capsuleSummary = useMemo(() => {
    if (projectRange.status === 'ready') return formatMoneyRange(projectRange.total);
    if (state.objective) {
      const label = OBJECTIVE_LABEL[state.objective] ?? state.objective;
      return sqft !== undefined ? `${label} · ${sqft.toLocaleString()} sq ft` : label;
    }
    return 'Not started';
  }, [projectRange, state.objective, sqft]);

  const openDrawer = (tab: WorkspaceDrawerTab = 'project') => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  };

  return (
    <div className="aha-shell aha-shell--conversation-first">
      <header className="aha-workspace-bar">
        <div className="aha-workspace-bar-identity">
          <p className="aha-workspace-bar-kicker">Ecowoods Inc.</p>
          <h2 className="aha-workspace-bar-title">{WORKSPACE_ASSISTANT.name}</h2>
        </div>
        <button
          type="button"
          className="aha-project-capsule"
          onClick={() => openDrawer(projectRange.status === 'ready' ? 'economics' : 'project')}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
        >
          <span className="aha-project-capsule-label">Project</span>
          <span className="aha-project-capsule-value">{capsuleSummary}</span>
        </button>
      </header>

      <ConversationPane
        evidencePool={evidencePool}
        onOpenProject={() => openDrawer('project')}
        onOpenEconomics={() => openDrawer('economics')}
      />

      <WorkspaceContextDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        evidencePool={evidencePool}
      />
    </div>
  );
}
