'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import { ProjectRail } from './ProjectRail';
import { ConversationPane } from './ConversationPane';
import { EconomicsRail } from './EconomicsRail';
import { MobileProjectBar } from './MobileProjectBar';

/**
 * WorkspaceShell — the three-zone layout for /assistant (project nav |
 * conversation | live economics), collapsing to a sticky mobile bar under
 * 900px. ASSISTANT-01 ships the shell only; see the child components' own
 * comments for what is deliberately not here yet.
 *
 * Independent of the corner Quick Assistant (ChatWidget.tsx) in every
 * direction: no shared component, no shared route, no shared client state.
 * Deleting either one leaves the other working.
 */
export function WorkspaceShell() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    /* `source: 'workspace'` keeps this distinguishable from the corner
       widget's assistant_open events, which never carry this value. No
       message, name, or project detail — same discipline as assistant_open. */
    track('workspace_open', { source: 'workspace' });
  }, []);

  return (
    <div className="aha-shell">
      {/* ProjectRail and EconomicsRail hide below the mobile breakpoint (CSS
          only — one ConversationPane instance, not a duplicated subtree).
          MobileProjectBar is the reverse: hidden on desktop, shown below it. */}
      <ProjectRail />
      <ConversationPane />
      <EconomicsRail />
      <MobileProjectBar />
    </div>
  );
}
