'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import type { CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { WorkspaceStateProvider, useWorkspaceState } from './WorkspaceStateProvider';
import { ProjectRail } from './ProjectRail';
import { ConversationPane } from './ConversationPane';
import { EconomicsRail } from './EconomicsRail';
import { MobileProjectBar } from './MobileProjectBar';

/**
 * WorkspaceShell — the three-zone layout for /assistant (project nav |
 * conversation | live economics), collapsing to a sticky mobile bar under
 * 900px. All four zones read Project Decision State from the one provider
 * below — see docs/assistant-workspace/NEW_ASSISTANT_ARCHITECTURE.md.
 *
 * Independent of the corner Quick Assistant (ChatWidget.tsx) in every
 * direction: no shared component, no shared route, no shared client state.
 * Deleting either one leaves the other working.
 *
 * `evidencePool` (ASSISTANT-05) is server-loaded once in `page.tsx` — the
 * one place in this client-component tree that touches the filesystem-backed
 * case-study loader — and threaded down as a plain prop, not folded into
 * `WorkspaceStateProvider`'s context: it is read-only reference data, not
 * part of Project Decision State, and NO_DUPLICATION_GUARANTEE.md's "one
 * canonical shape" is about that state, not about every prop this tree
 * passes around.
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

  return (
    <div className="aha-shell">
      {/* ProjectRail and EconomicsRail hide below the mobile breakpoint (CSS
          only — one ConversationPane instance, not a duplicated subtree).
          MobileProjectBar is the reverse: hidden on desktop, shown below it. */}
      <ProjectRail evidencePool={evidencePool} />
      <ConversationPane evidencePool={evidencePool} />
      <EconomicsRail evidencePool={evidencePool} />
      <MobileProjectBar evidencePool={evidencePool} />
    </div>
  );
}
