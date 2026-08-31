'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { PHOTO_TRIAGE_INTENTS } from '@ecowoods/shared/schemas';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { track } from '@/lib/analytics';
import { compressPhoto, MAX_PHOTO_BYTES } from '@/lib/image-compress';
import {
  readDesignConfig,
  clearDesignConfig,
  describeDesignConfig,
  type DesignConfig,
} from '@/lib/design-config';

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
 * HTML of every page on this site. A trade business publishing 286 pages of
 * sourced authority was collecting jobs through a phone number.
 *
 * NOW TWO TRACKS (P0.5). Track A books the in-home measure (the original form,
 * plus an area <select> over the 32 published service areas — no geolocation).
 * Track B is photo triage: three photos, a rough size, an intent, and a call
 * back — for the person on a couch with a phone who will not type a paragraph.
 * The toggle is client-side; with JavaScript off, track A renders and posts
 * natively, exactly as before.
 *
 * THREE RULES THIS COMPONENT KEEPS
 *
 * 1. TRACK A EXISTS WITHOUT JAVASCRIPT. Real `<form method="post"
 *    action="/api/leads">`; the route answers a native post with a redirect.
 *
 * 2. IT STAYS ON THE PAGE. No navigation to `/#quote`.
 *
 * 3. IT ASKS FOR THE MINIMUM. Every extra required field is a percentage of
 *    the people who came here to give us money and left instead.
 *
 * DESIGN HANDOFF: /design persists `ew-design-v1` (species, finish, pattern,
 * sq ft). When present and fresh, this form prefills the square footage,
 * shows a dismissible summary chip, and forwards the one-line summary with
 * the lead — the visitor never retypes what they already told us.
 *
 * The honeypot is `company`, matching what the APIs check. Visually hidden
 * rather than `display:none`, because some autofill agents skip
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

const INTENT_LABELS: Record<(typeof PHOTO_TRIAGE_INTENTS)[number], string> = {
  refinish: 'Refinish what is there',
  install: 'New floor',
  stairs: 'Stairs',
  'not-sure': 'Not sure — you tell me',
};

type Track = 'measure' | 'photos';

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
  const [trackTab, setTrackTab] = useState<Track>('measure');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sentTrack, setSentTrack] = useState<Track>('measure');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [design, setDesign] = useState<DesignConfig | null>(null);
  const [recoverConsent, setRecoverConsent] = useState(false);
  const recoverySent = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);
  const viewedRef = useRef(false);

  /* Design handoff — read once on mount, never during render (SSR match). */
  useEffect(() => {
    setDesign(readDesignConfig());
  }, []);

  /* #photo-triage in the URL (header “Send photos” CTA) opens track B. */
  useEffect(() => {
    const applyHash = () => {
      if (window.location.hash === '#photo-triage') setTrackTab('photos');
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  /* quote_view — the section entered the viewport, once. */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || viewedRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !viewedRef.current) {
          viewedRef.current = true;
          track('quote_view', { source });
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [source]);

  /* P1.8 — THE UNFINISHED FORM, RECOVERED ONLY IF ASKED FOR.
     Someone types an email, is interrupted, and never submits: today they are
     simply gone, because nothing is written until the whole form validates.
     This records the address ONLY when the reminder box is ticked, so the
     later email is a thing the visitor asked for rather than a thing we
     decided they would not mind. Under CASL that distinction is the whole
     legal difference between a recovery programme and a fine.

     Fires on unload and on tab-hide, once per mount. `keepalive` because a
     normal fetch is cancelled when the document goes away — which is exactly
     the moment this needs to survive. */
  useEffect(() => {
    if (!recoverConsent) return;
    const flush = () => {
      if (recoverySent.current || state === 'sent') return;
      const form = sectionRef.current?.querySelector('form');
      const email = (form?.querySelector('input[name="email"]') as HTMLInputElement | null)?.value?.trim();
      if (!email || !email.includes('@')) return;
      recoverySent.current = true;
      const name = (form?.querySelector('input[name="name"]') as HTMLInputElement | null)?.value?.trim();
      const phone = (form?.querySelector('input[name="phone"]') as HTMLInputElement | null)?.value?.trim();
      const city = (form?.querySelector('select[name="city"], select[name="area"]') as HTMLSelectElement | null)?.value;
      // Named `pickedService` so it cannot be confused with the `service` prop,
      // which is the page's preselection rather than what the visitor chose.
      const pickedService = (form?.querySelector('select[name="service"]') as HTMLSelectElement | null)?.value;
      void fetch('/api/quote-recovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ email, name, phone, city, service: pickedService, source, consent: true }),
      }).catch(() => {});
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [recoverConsent, source, state]);

  const consentRow = (
    <label className="ef-consent">
      <input
        type="checkbox"
        name="recoverConsent"
        checked={recoverConsent}
        onChange={(e) => {
          setRecoverConsent(e.currentTarget.checked);
          if (e.currentTarget.checked) track('recovery_opt_in', { source });
        }}
      />
      <span>
        Email me if I leave this unfinished. One reminder, two hours later, and never again.
      </span>
    </label>
  );

  const onFirstInteraction = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('quote_start', { source, form_track: trackTab });
  };

  async function onPickPhotos(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, 3);
    setPhotoNote(picked.length < list.length ? 'First three photos kept — three is all the triage needs.' : null);
    const out: File[] = [];
    const problems: string[] = [];
    for (const f of picked) {
      const result = await compressPhoto(f);
      if (result.ok) out.push(result.file);
      else problems.push(result.reason);
    }
    setPhotos(out);
    if (problems.length) setPhotoNote(problems.join(' '));
  }

  async function submitMeasure(e: FormEvent<HTMLFormElement>) {
    /* Progressive enhancement ONLY. If this handler never runs — no JS, a
       bundle that failed, an error boundary — the browser performs the native
       POST and the route redirects. The page works either way. */
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v !== '') body[k] = v;
    });
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
      if (res.ok) {
        track('quote_submit', { source, form_track: 'measure' });
        setSentTrack('measure');
        setState('sent');
        form.reset();
        return;
      }
      if (res.status === 400 && json.fieldErrors) {
        setErrors(json.fieldErrors);
        setState('idle');
        return;
      }
      setState('error');
    } catch {
      setState('error');
    }
  }

  async function submitPhotos(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Replace the raw file input's contents with the compressed set.
    fd.delete('photos');
    for (const f of photos) fd.append('photos', f, f.name);

    setState('sending');
    setErrors({});
    try {
      const res = await fetch('/api/photo-triage', {
        method: 'POST',
        headers: { 'x-requested-with': 'fetch', accept: 'application/json' },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        track('photo_triage_submit', { source, photos: photos.length });
        setSentTrack('photos');
        setState('sent');
        form.reset();
        setPhotos([]);
        return;
      }
      if (res.status === 400 && json.fieldErrors) {
        setErrors(json.fieldErrors);
        setState('idle');
        return;
      }
      setState('error');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <section className={`ef ef--done ${className}`.trim()} aria-live="polite">
        <h2 className="ef-h">{sentTrack === 'photos' ? 'Photos received.' : 'Request received.'}</h2>
        <p className="ef-intro">
          {sentTrack === 'photos'
            ? 'A senior estimator will look at the photos and call you back. Remember: this is a triage, not a quote — the fixed price is written after we measure the subfloor.'
            : 'A senior estimator will call you within one business day to book the free in-home measurement.'}{' '}
          If it is urgent, call <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
        </p>
      </section>
    );
  }

  const areaSelect = (fieldName: string) => (
    <label className="ef-field">
      <span>Your area</span>
      <select name={fieldName} defaultValue="" onFocus={onFirstInteraction}>
        <option value="" disabled>
          Choose your area
        </option>
        {SERVICE_AREAS.map((a) => (
          <option key={a.slug} value={a.name}>
            {a.name}
          </option>
        ))}
      </select>
      {errors[fieldName] && <em className="ef-err">{errors[fieldName]}</em>}
    </label>
  );

  const designChip = design && (
    <p className="ef-design-chip" data-testid="design-chip">
      <span aria-hidden="true">🧭</span> From your floor design: <strong>{describeDesignConfig(design)}</strong>
      <button
        type="button"
        className="ef-design-chip-x"
        aria-label="Remove the floor-designer configuration from this request"
        onClick={() => {
          clearDesignConfig();
          setDesign(null);
        }}
      >
        ×
      </button>
    </p>
  );

  return (
    <section className={`ef ${className}`.trim()} id="estimate" ref={sectionRef}>
      <h2 className="ef-h">{heading}</h2>
      <p className="ef-intro">{intro}</p>

      {/* Track toggle. Client-side; without JS, track A renders and posts natively. */}
      <div className="ef-tracks" role="group" aria-label="How would you like to start">
        <button
          type="button"
          className={`ef-track-btn ${trackTab === 'measure' ? 'is-active' : ''}`}
          aria-pressed={trackTab === 'measure'}
          onClick={() => setTrackTab('measure')}
        >
          Book the in-home measure
        </button>
        <button
          type="button"
          className={`ef-track-btn ${trackTab === 'photos' ? 'is-active' : ''}`}
          aria-pressed={trackTab === 'photos'}
          onClick={() => setTrackTab('photos')}
        >
          Send 3 photos today
        </button>
      </div>

      {designChip}

      {trackTab === 'measure' && (
        <form className="ef-form" method="post" action="/api/leads" onSubmit={submitMeasure} noValidate onFocusCapture={onFirstInteraction}>
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
            {areaSelect('city')}
            <label className="ef-field">
              <span>What do you need</span>
              <select name="service" defaultValue={service ?? 'refinishing'}>
                {SERVICES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ef-row">
            <label className="ef-field">
              <span>
                Approximate square feet <em>optional</em>
              </span>
              <input
                name="sqft"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="900"
                defaultValue={design ? design.sqft : undefined}
                key={design ? `sqft-${design.sqft}` : 'sqft'}
              />
            </label>
            <label className="ef-field">
              <span>
                Anything we should know <em>optional</em>
              </span>
              <textarea
                name="message"
                rows={3}
                placeholder="Two bedrooms and a hallway, red oak, last refinished around 2005."
                defaultValue={design ? `From the floor designer: ${describeDesignConfig(design)}.` : undefined}
                key={design ? `msg-${design.savedAt}` : 'msg'}
              />
            </label>
          </div>

          {/* Honeypot. The API accepts and silently discards anything that fills it. */}
          <div className="ef-hp" aria-hidden="true">
            <label htmlFor={`ef-company-${source}`}>Company</label>
            <input id={`ef-company-${source}`} name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {consentRow}

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
              Something went wrong sending that. Please call {BUSINESS_NAP.phoneDisplay} — we do not want you to have to
              try twice.
            </p>
          )}

          <p className="ef-fine">
            No obligation, no pressure, and we do not sell your details. The in-home measurement is free and the written
            price does not move afterwards.
          </p>
        </form>
      )}

      {trackTab === 'photos' && (
        <form
          className="ef-form"
          method="post"
          action="/api/photo-triage"
          encType="multipart/form-data"
          onSubmit={submitPhotos}
          noValidate
          onFocusCapture={onFirstInteraction}
        >
          <input type="hidden" name="source" value={source} />
          {design && <input type="hidden" name="designSummary" value={describeDesignConfig(design)} />}

          <label className="ef-field">
            <span>Up to 3 photos of the floor</span>
            <input
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(e) => void onPickPhotos(e.currentTarget.files)}
            />
            {photos.length > 0 && (
              <em className="ef-photo-list">
                {photos.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`).join(' · ')}
              </em>
            )}
            {photoNote && <em className="ef-err">{photoNote}</em>}
            {errors.photos && <em className="ef-err">{errors.photos}</em>}
          </label>

          <div className="ef-row">
            <label className="ef-field">
              <span>
                Approximate square feet <em>optional</em>
              </span>
              <input
                name="sqft"
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="900"
                defaultValue={design ? design.sqft : undefined}
                key={design ? `psqft-${design.sqft}` : 'psqft'}
              />
            </label>
            <label className="ef-field">
              <span>What do you think it needs</span>
              <select name="intent" defaultValue="not-sure">
                {PHOTO_TRIAGE_INTENTS.map((v) => (
                  <option key={v} value={v}>
                    {INTENT_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
            {areaSelect('area')}
          </div>

          {/* Honeypot. */}
          <div className="ef-hp" aria-hidden="true">
            <label htmlFor={`ef-pt-company-${source}`}>Company</label>
            <input id={`ef-pt-company-${source}`} name="company" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {consentRow}

          <div className="ef-actions">
            <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send the photos'}
            </button>
            <a className="ef-call" href={BUSINESS_NAP.phoneHref}>
              or call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>

          {state === 'error' && (
            <p className="ef-err ef-err--block" role="alert">
              Something went wrong sending that. Please call {BUSINESS_NAP.phoneDisplay} — we do not want you to have to
              try twice.
            </p>
          )}

          <p className="ef-fine">
            This is a triage, not a quote. Fixed price is written after we measure the subfloor. We do not sell your
            details.
          </p>
        </form>
      )}
    </section>
  );
}
