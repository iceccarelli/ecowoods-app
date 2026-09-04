'use client';

import { useEffect } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/**
 * Route error boundary. Reports the failure to /api/client-error (which joins
 * it to the server-side stream in lib/error-reporting) and gives the visitor
 * a way forward: retry, or the phone number.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
      } else {
        void fetch('/api/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
      }
    } catch {
      /* Reporting is best-effort. */
    }
  }, [error]);

  return (
    <div className="tlx-page">
      <section className="tlx-section">
        <div className="shell">
          <p className="tlx-kicker">One moment</p>
          <h1 className="tlx-title">This page hit a snag</h1>
          <p className="tlx-lede">
            The details have been recorded on our side. Try again, or call{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a> and we will help directly.
          </p>
          <div className="fw-actions">
            <button type="button" className="fw-cta" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
