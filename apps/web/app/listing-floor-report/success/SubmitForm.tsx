'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { CONSENT_WORDING } from '@/lib/floor-graph/wording';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;

export function SubmitForm({ orderId, sku, maskedEmail }: { orderId: string; sku: 'photo' | 'onsite'; maskedEmail: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);

  function onPick(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list).slice(0, MAX_PHOTOS));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('orderId', orderId);
    fd.delete('photos');
    for (const f of files) fd.append('photos', f, f.name);

    setState('sending');
    setErrors({});
    try {
      const res = await fetch('/api/listing-floor-report/submit', {
        method: 'POST',
        headers: { 'x-requested-with': 'fetch', accept: 'application/json' },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setState('sent');
        form.reset();
        setFiles([]);
        return;
      }
      if (json.fieldErrors) {
        setErrors(json.fieldErrors);
        setState('idle');
        return;
      }
      setErrors({ form: json.message ?? 'Something went wrong.' });
      setState('error');
    } catch {
      setErrors({ form: 'Something went wrong.' });
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="ef ef--done lfr-done" aria-live="polite">
        <h3 className="ef-h">Received.</h3>
        <p className="ef-intro">
          Your estimator will read this and reply per your report&rsquo;s turnaround. Urgent? Call{' '}
          <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="ef-form lfr-submit-form" onSubmit={onSubmit} noValidate>
      <p className="tlx-note">Paid by {maskedEmail}. Confirm the same email below.</p>

      <label className="ef-field">
        <span>Confirm your email</span>
        <input name="email" type="email" autoComplete="email" required placeholder="jane@example.com" />
        {errors.email && <em className="ef-err">{errors.email}</em>}
      </label>

      <div className="ef-row">
        <label className="ef-field">
          <span>I am the</span>
          <select name="role" required defaultValue="agent">
            <option value="agent">Listing agent</option>
            <option value="seller">Seller</option>
          </select>
        </label>
        <label className="ef-field">
          <span>
            Brokerage <em>optional</em>
          </span>
          <input name="brokerage" type="text" />
        </label>
      </div>

      <div className="ef-row">
        <label className="ef-field">
          <span>
            Phone <em>optional</em>
          </span>
          <input name="phone" type="tel" />
        </label>
        <label className="ef-field">
          <span>City</span>
          <input name="city" type="text" required placeholder="Toronto" />
          {errors.city && <em className="ef-err">{errors.city}</em>}
        </label>
      </div>

      <label className="ef-field">
        <span>Listing address</span>
        <input name="address" type="text" required placeholder="123 Main St" />
        {errors.address && <em className="ef-err">{errors.address}</em>}
      </label>

      <div className="ef-row">
        <label className="ef-field">
          <span>Photography date</span>
          <input name="photographyDate" type="date" required />
          {errors.photographyDate && <em className="ef-err">{errors.photographyDate}</em>}
        </label>
        <label className="ef-field">
          <span>
            Listing go-live date <em>optional</em>
          </span>
          <input name="listingGoLiveDate" type="date" />
        </label>
      </div>

      {sku === 'photo' ? (
        <label className="ef-field">
          <span>
            {MIN_PHOTOS}–{MAX_PHOTOS} photos: traffic lanes, the overall field, one transition, one
            close-up of any wear or damage
          </span>
          <input
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={(e) => onPick(e.currentTarget.files)}
          />
          {files.length > 0 && (
            <em className="ef-photo-list">
              {files.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`).join(' · ')}
            </em>
          )}
          {errors.photos && <em className="ef-err">{errors.photos}</em>}
        </label>
      ) : (
        <label className="ef-field">
          <span>
            Photos <em>optional for the onsite letter</em>
          </span>
          <input
            name="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={(e) => onPick(e.currentTarget.files)}
          />
          {errors.photos && <em className="ef-err">{errors.photos}</em>}
        </label>
      )}

      {sku === 'photo' && (
        <label className="ef-field ef-checkbox">
          <input type="checkbox" name="photoConsent" value="true" />
          <span>{CONSENT_WORDING.ASSESSMENT_PHOTOS.text}</span>
        </label>
      )}

      <label className="ef-field">
        <span>
          Anything else worth knowing <em>optional</em>
        </span>
        <textarea name="message" rows={2} placeholder="Access notes, preferred visit window, etc." />
      </label>

      <div className="ef-actions">
        <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Submit'}
        </button>
      </div>

      {(state === 'error' || errors.form) && (
        <p className="ef-err ef-err--block" role="alert">
          {errors.form ?? 'Something went wrong.'} Please call {BUSINESS_NAP.phoneDisplay} if it happens again.
        </p>
      )}
    </form>
  );
}
