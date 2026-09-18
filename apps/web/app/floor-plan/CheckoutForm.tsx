'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { FLOOR_PLAN_PRODUCT } from '@/content/constants/floor-plan-product';

/*
 * No analytics event is fired here, for the same reason the other paid
 * checkout forms on this branch omit one: lib/analytics.ts declares a closed
 * AnalyticsEvent union and extending it is an edit to an existing file, out
 * of scope for a NEW-FILES-ONLY build. Filed as an integration request in
 * docs/floor-plan.md.
 */
export function CheckoutForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const code = String(form.get('code') ?? '');
    const company = String(form.get('company') ?? '');

    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/floor-plan/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, code, company }),
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
    <form className="ef-form fp-form" onSubmit={onSubmit} noValidate>
      <label className="ef-field">
        <span>Your Floor Studio share code or link</span>
        <textarea
          name="code"
          rows={2}
          required
          placeholder="c=white-oak.satin.herringbone.5&a=900 — or paste the whole share link"
        />
      </label>

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

      <div className="ef-hp" aria-hidden="true">
        <label htmlFor="fp-company">Company</label>
        <input id="fp-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="ef-actions">
        <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
          {state === 'sending' ? 'Redirecting to payment…' : `Pay $${FLOOR_PLAN_PRODUCT.priceCad} CAD`}
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
        Paste the code from a Floor Studio share link (the part after the last <code>?</code> or{' '}
        <code>#</code>) or the whole link — either works.
      </p>
    </form>
  );
}
