'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { REVIEW_TIERS, type ReviewTier } from '@/content/constants/paid-review-product';

/*
 * No analytics event is fired here. lib/analytics.ts declares a closed
 * AnalyticsEvent union deliberately (see its own comments) so no untyped
 * event name reaches GA4, and extending that union is an edit to an existing
 * file — out of scope for a NEW-FILES-ONLY build. Wiring a
 * well_installed_review_checkout_start event into that union is filed as an
 * integration request rather than done here.
 */

export function CheckoutForm() {
  const [tier, setTier] = useState<ReviewTier>('standard');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');

    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/well-installed-review/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, tier }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setError(json.error ?? 'Something went wrong. Please try again.');
      setState('error');
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  return (
    <form className="ef-form wir-form" onSubmit={onSubmit} noValidate>
      <div className="wir-tiers" role="radiogroup" aria-label="Turnaround">
        {REVIEW_TIERS.map((t) => (
          <label key={t.id} className={`wir-tier${tier === t.id ? ' wir-tier--selected' : ''}`}>
            <input
              type="radio"
              name="tier"
              value={t.id}
              checked={tier === t.id}
              onChange={() => setTier(t.id)}
            />
            <span className="wir-tier-name">{t.name}</span>
            <span className="wir-tier-price">${t.priceCad} CAD</span>
            <span className="wir-tier-turnaround">{t.turnaround}</span>
          </label>
        ))}
      </div>

      <div className="ef-row">
        <label className="ef-field">
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" required placeholder="Jane Doe" />
        </label>
        <label className="ef-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required placeholder="jane@example.com" />
        </label>
      </div>

      <div className="ef-actions">
        <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
          {state === 'sending' ? 'Redirecting to payment…' : `Pay $${REVIEW_TIERS.find((t) => t.id === tier)?.priceCad} CAD and send my quote`}
        </button>
        <a className="ef-call" href={BUSINESS_NAP.phoneHref}>
          or call {BUSINESS_NAP.phoneDisplay}
        </a>
      </div>

      {state === 'error' && (
        <p className="ef-err ef-err--block" role="alert">
          {error} Please call {BUSINESS_NAP.phoneDisplay} if it happens again.
        </p>
      )}

      <p className="ef-fine">
        Payment first, document after — you attach the quote on the confirmation page once payment
        completes, so nothing you send is stored before it is paid for.
      </p>
    </form>
  );
}
