'use client';

/**
 * MobileSheet — the one full-screen sheet the site uses on phones.
 *
 * Extracted from ConfiguratorSection so the configurator and the booking
 * calendar open the *same* way: identical rise animation, grab handle, scrim,
 * scroll lock, Escape/backdrop close and focus handling. Same reasoning as the
 * SwipeDeck engine — a second hand-rolled modal is how a site starts feeling
 * assembled instead of designed.
 *
 * Portalled to <body> because an ancestor `transform` (the .reveal animation)
 * silently breaks `position: fixed`.
 */

import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function MobileSheet({
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
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

  // Lock the page behind the sheet; restore exactly what was there before.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; focus lands on the close button when it opens.
  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-scrim" onClick={close} aria-label={`Close ${title}`} tabIndex={-1} />
      <div className="sheet-panel">
        <div className="sheet-bar">
          <span className="sheet-title">{title}</span>
          <button ref={closeBtn} type="button" className="sheet-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
