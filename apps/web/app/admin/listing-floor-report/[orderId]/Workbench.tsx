'use client';

import { useState } from 'react';
import type { ListingMeta } from '@/lib/listing-floor-report/notes';
import type { Certainty, ListingFloorReport, Recommendation } from '@/lib/listing-floor-report/types';

type FormState = {
  recommendation: Recommendation;
  findings: { finishWear: Certainty; woodDamage: Certainty; moisture: Certainty };
  present: string;
  missing: string;
  askInWriting: string;
};

const CERTAINTY_OPTIONS: Certainty[] = ['verified', 'not_specified', 'unclear', 'cannot_determine', 'inspection_needed'];
const RECOMMENDATION_OPTIONS: Recommendation[] = ['recoat_ok', 'sand_required', 'leave_it', 'cannot_determine_from_photos'];

const EMPTY_FORM: FormState = {
  recommendation: 'cannot_determine_from_photos',
  findings: { finishWear: 'not_specified', woodDamage: 'not_specified', moisture: 'inspection_needed' },
  present: '',
  missing: '',
  askInWriting: '',
};

export function Workbench({
  orderId,
  sku,
  meta,
  alreadyPublished,
  existingReportUrl,
}: {
  orderId: string;
  sku: 'photo' | 'onsite';
  meta: ListingMeta;
  alreadyPublished: boolean;
  existingReportUrl: string | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [preview, setPreview] = useState<ListingFloorReport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [published, setPublished] = useState(alreadyPublished);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(existingReportUrl);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'publishing'>('idle');

  async function callApi(path: 'compose' | 'publish') {
    const res = await fetch(`/api/listing-floor-report/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, ...form }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  async function onPreview() {
    setBusy('previewing');
    setErrors([]);
    const { ok, json } = await callApi('compose');
    if (ok) setPreview(json.report);
    else {
      setPreview(null);
      setErrors(json.errors ?? [json.error ?? 'Something went wrong.']);
    }
    setBusy('idle');
  }

  async function onPublish() {
    setBusy('publishing');
    setErrors([]);
    const { ok, json } = await callApi('publish');
    if (ok) {
      setPublished(true);
      setPublishedUrl(json.url);
    } else {
      setErrors(json.errors ?? [json.error ?? 'Something went wrong.']);
    }
    setBusy('idle');
  }

  if (published) {
    return (
      <div className="portal-card">
        <h2>Published</h2>
        {publishedUrl && (
          <p>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
              View the PDF
            </a>
          </p>
        )}
      </div>
    );
  }

  const moistureEditable = sku === 'onsite';

  return (
    <div className="portal-card lfr-workbench">
      <div className="portal-card">
        <h2>Listing details (from intake)</h2>
        <p>Role: {meta.role}{meta.brokerage ? ` · ${meta.brokerage}` : ''}</p>
        <p>{meta.address}, {meta.city}</p>
        <p>Photography date: {meta.photographyDate}</p>
        {meta.listingGoLiveDate && <p>Listing go-live: {meta.listingGoLiveDate}</p>}
        {meta.message && <p>Note: {meta.message}</p>}
      </div>

      <fieldset className="wir-pillar">
        <legend>Recommendation</legend>
        <select
          value={form.recommendation}
          onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value as Recommendation }))}
        >
          {RECOMMENDATION_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="wir-pillar">
        <legend>Findings</legend>
        <label className="ef-field">
          <span>Finish wear</span>
          <select
            value={form.findings.finishWear}
            onChange={(e) => setForm((f) => ({ ...f, findings: { ...f.findings, finishWear: e.target.value as Certainty } }))}
          >
            {CERTAINTY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="ef-field">
          <span>Wood damage</span>
          <select
            value={form.findings.woodDamage}
            onChange={(e) => setForm((f) => ({ ...f, findings: { ...f.findings, woodDamage: e.target.value as Certainty } }))}
          >
            {CERTAINTY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="ef-field">
          <span>Moisture {!moistureEditable && '(photo SKU — always inspection_needed)'}</span>
          <select
            value={moistureEditable ? form.findings.moisture : 'inspection_needed'}
            disabled={!moistureEditable}
            onChange={(e) => setForm((f) => ({ ...f, findings: { ...f.findings, moisture: e.target.value as Certainty } }))}
          >
            {CERTAINTY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <label className="ef-field">
        <span>What&rsquo;s present</span>
        <textarea rows={3} value={form.present} onChange={(e) => setForm((f) => ({ ...f, present: e.target.value }))} />
      </label>

      <label className="ef-field">
        <span>What couldn&rsquo;t be determined</span>
        <textarea rows={3} value={form.missing} onChange={(e) => setForm((f) => ({ ...f, missing: e.target.value }))} />
      </label>

      <label className="ef-field">
        <span>Questions for the contractor, one per line</span>
        <textarea rows={3} value={form.askInWriting} onChange={(e) => setForm((f) => ({ ...f, askInWriting: e.target.value }))} />
      </label>

      {errors.length > 0 && (
        <div className="ef-err ef-err--block" role="alert">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ef-actions">
        <button type="button" className="btn" disabled={busy !== 'idle'} onClick={onPreview}>
          {busy === 'previewing' ? 'Previewing…' : 'Preview'}
        </button>
        <button type="button" className="btn btn-copper" disabled={busy !== 'idle'} onClick={onPublish}>
          {busy === 'publishing' ? 'Publishing…' : 'Publish and email customer'}
        </button>
      </div>

      {preview && (
        <div className="wir-preview">
          <h3>Preview — {preview.recommendation}</h3>
          {preview.band && <p>{preview.band} — {preview.bandCaption}</p>}
          {preview.schedule.feasible && (
            <p>
              Day 1 {preview.schedule.day1} · Day 2 {preview.schedule.day2} · Day 3 {preview.schedule.day3}
            </p>
          )}
          {!preview.schedule.feasible && preview.schedule.reason === 'window_closed' && (
            <p>Window closed — next window could start {preview.schedule.nextWindowStart}.</p>
          )}
        </div>
      )}
    </div>
  );
}
