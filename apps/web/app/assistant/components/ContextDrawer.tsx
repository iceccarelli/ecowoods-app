'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ContextDrawer — the ONE overlay every on-demand panel in /assistant opens
 * through (Project, Economics, Sources, Recommendations, Compare, Next
 * step). Right-side slide-over at >=768px, bottom sheet under it — same
 * breakpoint the rest of the redesign uses, CSS only, one component either
 * way. Not a fork of app/components/MobileSheet.tsx: that one is a
 * full-screen phone-only sheet built for the configurator/booking calendar;
 * this one also has to be a calm desktop side panel, so it gets its own
 * `aha-drawer` chrome, but copies MobileSheet's accessibility discipline
 * exactly (role=dialog, aria-modal, Escape closes, scrim click closes, body
 * scroll lock, focus lands in the panel on open and is restored to whatever
 * triggered it on close).
 */
export function ContextDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="aha-drawer">
      <button className="aha-drawer-scrim" onClick={onClose} aria-label={`Close ${title}`} tabIndex={-1} />
      <div className="aha-drawer-panel" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        <div className="aha-drawer-bar">
          <span className="aha-drawer-title">{title}</span>
          <button ref={closeBtnRef} type="button" className="aha-drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="aha-drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
