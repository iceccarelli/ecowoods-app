'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ensureDesignId } from '@/lib/floor-studio/design-id';
import { applyPatch, defaultWorkspaceState } from '@/lib/assistant-workspace/state';
import { loadWorkspaceState, saveWorkspaceState } from '@/lib/assistant-workspace/persistence';
import type { WorkspacePatch, WorkspaceState } from '@/lib/assistant-workspace/types';

interface WorkspaceContextValue {
  state: WorkspaceState;
  patch: (p: WorkspacePatch) => void;
  /** True once the client has hydrated from localStorage or minted a fresh id. */
  ready: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * WorkspaceStateProvider — the ONE store the shell reads from.
 *
 * Server-rendered state is the default, unminted one (`designId: ''`) so
 * there is nothing for hydration to disagree about; the real designId is
 * loaded from localStorage — or minted, if none exists — inside an effect,
 * which per lib/floor-studio/design-id.ts's own warning is the only safe
 * place to call ensureDesignId(). That effect runs once, after mount, so it
 * never races React's hydration pass.
 */
export function WorkspaceStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => defaultWorkspaceState());
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const existing = loadWorkspaceState();
    if (existing) {
      setState(existing);
    } else {
      setState((prev) => ({ ...prev, designId: ensureDesignId(prev.designId || undefined) }));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !state.designId) return;
    saveWorkspaceState(state);
  }, [ready, state]);

  const patch = useCallback((p: WorkspacePatch) => {
    setState((prev) => applyPatch(prev, p));
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({ state, patch, ready }), [state, patch, ready]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceState(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspaceState must be used within WorkspaceStateProvider');
  return ctx;
}
