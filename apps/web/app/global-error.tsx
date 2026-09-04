'use client';

import { useEffect } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/**
 * Root error boundary — replaces the root layout when it fails to render, so
 * it must return its own <html> and <body>. Reports like app/error.tsx.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      void fetch('/api/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    } catch {
      /* Reporting is best-effort. */
    }
  }, [error]);

  return (
    <html lang="en-CA">
      <body style={{ fontFamily: 'sans-serif', margin: 0, padding: '48px 24px', color: '#1a0f08', background: '#fdfbf6' }}>
        <main style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ letterSpacing: 2, fontSize: 12, color: '#c87e4f' }}>ECOWOODS</p>
          <h1 style={{ fontWeight: 300, fontSize: 28 }}>This page hit a snag</h1>
          <p>
            The details have been recorded on our side. Try again, or call{' '}
            <a href={BUSINESS_NAP.phoneHref} style={{ color: '#c87e4f' }}>
              {BUSINESS_NAP.phoneDisplay}
            </a>{' '}
            and we will help directly.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ background: '#c87e4f', color: '#fdfbf6', border: 0, borderRadius: 6, padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
