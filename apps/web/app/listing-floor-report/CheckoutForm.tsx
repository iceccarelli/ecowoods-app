'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { LISTING_REPORT_SKUS, type ListingReportSku } from '@/content/constants/listing-floor-report-product';

/*
 * No analytics event is fired here, for the same reason CheckoutForm.tsx
 * under /well-installed-review omits one: lib/analytics.ts declares a closed
 * AnalyticsEvent union and extending it is an edit to an existing file, out
 * of scope for a NEW-FILES-ONLY build. Filed as an integration request in
 * docs/listing-floor-report.md.
 */
export function CheckoutForm() {
  const [sku, setSku] = useState<ListingReportSku>('photo');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    const company = String(form.get('company') ?? '');

    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/listing-floor-report/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, sku, company }),
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
    <form className="ef-form lfr-form" onSubmit={onSubmit} noValidate>
      <div className="lfr-skus" role="radiogroup" aria-label="Report type">
        {LISTING_REPORT_SKUS.map((s) => (
          <label key={s.id} className={`lfr-sku${sku === s.id ? ' lfr-sku--selected' : ''}`}>
            <input type="radio" name="sku" value={s.id} checked={sku === s.id} onChange={() => setSku(s.id)} />
            <span className="lfr-sku-name">{s.name}</span>
            <span className="lfr-sku-price">${s.priceCad} CAD</span>
            <span className="lfr-sku-sla">{s.sla}</span>
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

      <div className="ef-hp" aria-hidden="true">
        <label htmlFor="lfr-company">Company</label>
        <input id="lfr-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="ef-actions">
        <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
          {state === 'sending' ? 'Redirecting to payment…' : `Pay $${LISTING_REPORT_SKUS.find((s) => s.id === sku)?.priceCad} CAD`}
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
        Payment first, details after — you&rsquo;ll enter the listing address, photography date and
        photos on the confirmation page once payment completes.
      </p>
    </form>
  );
}
