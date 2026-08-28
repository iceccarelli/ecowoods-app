'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/**
 * EstimateForm — the ask, rendered in HTML, on the page that earned it.
 *
 * WHY THIS EXISTS — F-160, the finding two independent audits opened with
 *
 * Every commercial page's primary button pointed at `/#quote`. That anchor is on
 * a DIFFERENT url, and the thing it scrolls to is a heading, a `tel:` link and a
 * `<button type="button">` that sets React state to open a modal. The modal is
 * behind `{estimateModalOpen && …}`, so it renders nothing on the server.
 *
 * The measurable consequence: `<form>` count 0, `<input>` count 0, in the served
 * HTML of every page on this site. A buyer who has read the price band, accepted
 * it, and wants to send us a job had to (1) leave the page that convinced them,
 * (2) land on the homepage, (3) wait for hydration, (4) click a button, (5) wait
 * for a modal. Every step is a place to lose them, and step 3 is a place the
 * page itself cannot control.
 *
 * A trade business publishing 286 pages of sourced authority was collecting jobs
 * through a phone number.
 *
 * THREE RULES THIS COMPONENT KEEPS
 *
 * 1. IT EXISTS WITHOUT JAVASCRIPT. This is a real `<form method="post"
 *    action="/api/leads">`. With scripting off, a broken bundle, or a hydration
 *    error, the browser posts it and the route answers with a redirect. The
 *    lead-capture invariant in app/api/leads/route.ts — durable log FIRST, then
 *    best-effort everything — is what makes that safe.
 *
 * 2. IT STAYS ON THE PAGE. No navigation to `/#quote`. The buyer converts from
 *    the url that answered their query, which is also the url whose analytics
 *    tell us which page earns money.
 *
 * 3. IT ASKS FOR THE MINIMUM. Name, phone, email, postcode, service. Square
 *    footage and a note are optional. Every extra required field is a percentage
 *    of the people who came here to give us money and left instead.
 *
 * The honeypot is `company`, matching what the API already checks. It is
 * visually hidden rather than `display:none`, because some autofill agents skip
 * `display:none` fields and a bot that fills nothing looks like a human.
 */

const SERVICES = [
  { value: 'refinishing', label: 'Refinishing an existing floor' },
  { value: 'installation', label: 'New hardwood install' },
  { value: 'sanding', label: 'Dust-free sanding' },
  { value: 'stairs', label: 'Stairs' },
  { value: 'inlays', label: 'Custom inlays' },
  { value: 'commercial', label: 'Commercial' },
] as const;

export function EstimateForm({
  source,
  service,
  heading = 'Get a fixed written price',
  intro = 'A senior estimator replies within one business day. The price we write after measuring is the price you pay.',
  className = '',
}: {
  /** Which page this lead came from. Recorded on the lead. */
  source: string;
  /** Preselect the service this page is about. */
  service?: (typeof SERVICES)[number]['value'];
  heading?: string;
  intro?: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    /* Progressive enhancement ONLY. If this handler never runs — no JS, a
       bundle that failed, an error boundary — the browser performs the native
       POST and the route redirects. The page works either way, which is the
       entire point of the component. */
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => { if (typeof v === 'string' && v !== '') body[k] = v; });
    if (typeof body.sqft === 'string') body.sqft = Number(body.sqft);

    setState('sending');
    setErrors({});
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { setState('sent'); form.reset(); return; }
      if (res.status === 400 && json.fieldErrors) { setErrors(json.fieldErrors); setState('idle'); return; }
      setState('error');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <section className={`ef ef--done ${className}`.trim()} aria-live="polite">
        <h2 className="ef-h">Request received.</h2>
        <p className="ef-intro">
          A senior estimator will call you within one business day to book the free in-home
          measurement. If it is urgent, call{' '}
          <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
        </p>
      </section>
    );
  }

  return (
    <section className={`ef ${className}`.trim()} id="estimate">
      <h2 className="ef-h">{heading}</h2>
      <p className="ef-intro">{intro}</p>

      <form className="ef-form" method="post" action="/api/leads" onSubmit={onSubmit} noValidate>
        <input type="hidden" name="source" value={source} />

        <div className="ef-row">
          <label className="ef-field">
            <span>Name</span>
            <input name="name" type="text" autoComplete="name" required placeholder="Jane Doe" />
            {errors.name && <em className="ef-err">{errors.name}</em>}
          </label>
          <label className="ef-field">
            <span>Phone</span>
            <input name="phone" type="tel" autoComplete="tel" required placeholder="(416) 555-0142" />
            {errors.phone && <em className="ef-err">{errors.phone}</em>}
          </label>
        </div>

        <div className="ef-row">
          <label className="ef-field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required placeholder="jane@example.com" />
            {errors.email && <em className="ef-err">{errors.email}</em>}
          </label>
          <label className="ef-field">
            <span>Postal code</span>
            <input name="postal" type="text" autoComplete="postal-code" required placeholder="M5V 3A8" />
            {errors.postal && <em className="ef-err">{errors.postal}</em>}
          </label>
        </div>

        <div className="ef-row">
          <label className="ef-field">
            <span>What do you need</span>
            <select name="service" defaultValue={service ?? 'refinishing'}>
              {SERVICES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="ef-field">
            <span>Approximate square feet <em>optional</em></span>
            <input name="sqft" type="number" min="1" inputMode="numeric" placeholder="900" />
          </label>
        </div>

        <label className="ef-field">
          <span>Anything we should know <em>optional</em></span>
          <textarea name="message" rows={3} placeholder="Two bedrooms and a hallway, red oak, last refinished around 2005." />
        </label>

        {/* Honeypot. The API accepts and silently discards anything that fills it. */}
        <div className="ef-hp" aria-hidden="true">
          <label htmlFor={`ef-company-${source}`}>Company</label>
          <input id={`ef-company-${source}`} name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="ef-actions">
          <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Request a free estimate'}
          </button>
          <a className="ef-call" href={BUSINESS_NAP.phoneHref}>
            or call {BUSINESS_NAP.phoneDisplay}
          </a>
        </div>

        {state === 'error' && (
          <p className="ef-err ef-err--block" role="alert">
            Something went wrong sending that. Please call {BUSINESS_NAP.phoneDisplay} — we do not
            want you to have to try twice.
          </p>
        )}

        <p className="ef-fine">
          No obligation, no pressure, and we do not sell your details. The in-home measurement is
          free and the written price does not move afterwards.
        </p>
      </form>
    </section>
  );
}
