'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * TelClickTracker — one delegated listener instead of an onClick on every
 * tel: link. The phone number appears in the header, the utility bar, the
 * quote section, the 404, the footer and a dozen inline mentions; wiring each
 * one individually is the kind of chore that gets skipped exactly where the
 * click actually happens. Mounted once from the layout; renders nothing.
 */
export default function TelClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const link = target?.closest?.('a[href^="tel:"]');
      if (link) {
        track('tel_click', { page: window.location.pathname });
      }
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
