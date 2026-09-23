'use client';

import { useEffect, useId, useRef } from 'react';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';
import type { CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { ProjectRail } from './ProjectRail';
import { EconomicsRail } from './EconomicsRail';

export type WorkspaceDrawerTab = 'project' | 'economics' | 'sources' | 'documents';

const TABS: { id: WorkspaceDrawerTab; label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'economics', label: 'Economics' },
  { id: 'sources', label: 'Sources' },
  { id: 'documents', label: 'Documents' },
];

/**
 * One contextual slide-over for Project / Economics / Sources / Documents.
 * AGENT_DIRECTIVE v8: no permanent side rails — conversation owns the canvas;
 * details open here on demand. Reuses ProjectRail + EconomicsRail (same
 * economics.ts / value-scenario backends), never a second pricing engine.
 */
export function WorkspaceContextDrawer({
  open,
  tab,
  onTabChange,
  onClose,
  evidencePool,
}: {
  open: boolean;
  tab: WorkspaceDrawerTab;
  onTabChange: (tab: WorkspaceDrawerTab) => void;
  onClose: () => void;
  evidencePool: CaseStudyEvidence[];
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="aha-drawer-root" role="presentation">
      <button type="button" className="aha-drawer-backdrop" aria-label="Close project panel" onClick={onClose} />
      <aside
        className="aha-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="aha-drawer-header">
          <div>
            <p className="aha-drawer-kicker">{WORKSPACE_ASSISTANT.name}</p>
            <h2 id={titleId} className="aha-drawer-title">
              Project context
            </h2>
          </div>
          <button ref={closeRef} type="button" className="aha-drawer-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="aha-drawer-tabs" role="tablist" aria-label="Project context sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="aha-drawer-tab"
              data-active={tab === t.id}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="aha-drawer-body" role="tabpanel">
          {tab === 'project' && <ProjectRail evidencePool={evidencePool} embedded />}
          {tab === 'economics' && <EconomicsRail evidencePool={evidencePool} embedded />}
          {tab === 'sources' && (
            <div className="aha-drawer-panel">
              <p className="aha-drawer-panel-title">Sources</p>
              <p className="aha-drawer-panel-text">
                Floor value scenarios cite published case-study evidence when this project has sq ft and a
                service. Licensed house-profile and market-cost adapters are pending_key — we will not invent
                AVMs, MLS comps, or unsourced renovation dollars.
              </p>
            </div>
          )}
          {tab === 'documents' && (
            <div className="aha-drawer-panel">
              <p className="aha-drawer-panel-title">Documents</p>
              <p className="aha-drawer-panel-text">
                Save and share land with ASSISTANT-08. Until then this project stays on this device only —
                nothing is uploaded as a document from this panel.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
