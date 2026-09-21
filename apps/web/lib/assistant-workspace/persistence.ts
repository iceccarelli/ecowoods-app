/**
 * lib/assistant-workspace/persistence.ts — the I/O shell around state.ts.
 *
 * Same shape of contract as lib/floor-studio/studio-config.ts's
 * save/readStudioDesign: try/catch around every localStorage call (private
 * mode, storage full, a disabled API all fail silently rather than crash the
 * workspace), and the raw JSON is revalidated on the way back in rather than
 * trusted — a value written by an older version of this file, or edited by
 * hand in devtools, must not become a stored designId or catalog id that
 * skipped sanitizeFloorPreference et al.
 *
 * A SEPARATE localStorage key from Floor Studio's `ew-studio-v1`/
 * `ew-design-v1` — this is project decision state, not a studio
 * configuration, and the two are bridged deliberately in ASSISTANT-06, not
 * merged into one key now. See docs/assistant-workspace/NO_DUPLICATION_GUARANTEE.md.
 */
import { isDesignId } from '@/lib/floor-studio/design-id';
import { hydrateWorkspaceState } from './state';
import type { WorkspaceState } from './types';

export const WORKSPACE_STORAGE_KEY = 'ew-assistant-workspace-v1';

/** Longer than Floor Studio's design TTL — a project plan is meant to survive more than one session. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export function serializeWorkspaceState(state: WorkspaceState): string {
  return JSON.stringify(state);
}

/**
 * Parse and revalidate. Returns null for anything that isn't a workspace
 * state this version recognizes — never a partially-trusted object.
 */
export function parseWorkspaceState(raw: string, now = Date.now()): WorkspaceState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Partial<WorkspaceState>;
  if (typeof p.updatedAt !== 'string' || Number.isNaN(Date.parse(p.updatedAt))) return null;
  if (now - Date.parse(p.updatedAt) > MAX_AGE_MS) return null;
  /* An invalid designId fails the whole load rather than silently minting a
     replacement here — minting belongs to the caller (an effect/handler),
     never to a parse function, per design-id.ts's hydration-mismatch warning. */
  if (!isDesignId(p.designId)) return null;

  return hydrateWorkspaceState(p, p.designId, p.updatedAt);
}

export function loadWorkspaceState(now = Date.now()): WorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    return parseWorkspaceState(raw, now);
  } catch {
    return null;
  }
}

export function saveWorkspaceState(state: WorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspaceState(state));
  } catch {
    /* private mode, storage full — the workspace still works for this tab */
  }
}

export function clearWorkspaceState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
