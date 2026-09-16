'use client';

import { useState } from 'react';
import { PILLARS, type Answer } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import type { QuoteIntelligenceReport } from '@/lib/quote-intelligence/types';

type FormState = {
  answers: Record<string, Answer>;
  presentScopeIds: string[];
  present: string;
  missing: string;
  askInWriting: string;
  ifSoundSaySo: string;
};

const EMPTY_FORM: FormState = {
  answers: {},
  presentScopeIds: [],
  present: '',
  missing: '',
  askInWriting: '',
  ifSoundSaySo: '',
};

export function Workbench({
  orderId,
  alreadyPublished,
  existingReportUrl,
}: {
  orderId: string;
  alreadyPublished: boolean;
  existingReportUrl: string | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [preview, setPreview] = useState<QuoteIntelligenceReport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [published, setPublished] = useState(alreadyPublished);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(existingReportUrl);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'publishing'>('idle');

  function setAnswer(id: string, answer: Answer) {
    setForm((f) => ({ ...f, answers: { ...f.answers, [id]: answer } }));
  }

  function toggleScope(id: string) {
    setForm((f) => ({
      ...f,
      presentScopeIds: f.presentScopeIds.includes(id)
        ? f.presentScopeIds.filter((s) => s !== id)
        : [...f.presentScopeIds, id],
    }));
  }

  async function callApi(path: 'compose' | 'publish') {
    const res = await fetch(`/api/quote-intelligence/${path}`, {
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

  return (
    <div className="portal-card wir-workbench">
      {PILLARS.map((pillar) => (
        <fieldset key={pillar.id} className="wir-pillar">
          <legend>
            {pillar.number}. {pillar.name}
          </legend>
          {pillar.criteria.map((c) => (
            <div key={c.id} className="wir-criterion">
              <span>
                {c.id} {c.question}
              </span>
              <span className="wir-criterion-answers" role="radiogroup" aria-label={c.question}>
                {(['yes', 'no', 'unsure'] as Answer[]).map((a) => (
                  <label key={a}>
                    <input
                      type="radio"
                      name={`criterion-${c.id}`}
                      checked={form.answers[c.id] === a}
                      onChange={() => setAnswer(c.id, a)}
                    />
                    {a}
                  </label>
                ))}
              </span>
            </div>
          ))}
        </fieldset>
      ))}

      <fieldset className="wir-pillar">
        <legend>Scope items present in the document</legend>
        {SCOPE_ITEMS.map((s) => (
          <label key={s.id} className="wir-scope-item">
            <input
              type="checkbox"
              checked={form.presentScopeIds.includes(s.id)}
              onChange={() => toggleScope(s.id)}
            />
            {s.label}
          </label>
        ))}
      </fieldset>

      <label className="ef-field">
        <span>What&rsquo;s right (present)</span>
        <textarea
          rows={3}
          value={form.present}
          onChange={(e) => setForm((f) => ({ ...f, present: e.target.value }))}
        />
      </label>

      <label className="ef-field">
        <span>What&rsquo;s missing</span>
        <textarea
          rows={3}
          value={form.missing}
          onChange={(e) => setForm((f) => ({ ...f, missing: e.target.value }))}
        />
      </label>

      <label className="ef-field">
        <span>Additional questions to ask in writing, one per line</span>
        <textarea
          rows={3}
          value={form.askInWriting}
          onChange={(e) => setForm((f) => ({ ...f, askInWriting: e.target.value }))}
        />
      </label>

      <label className="ef-field">
        <span>If the quote is sound, say so here</span>
        <textarea
          rows={2}
          value={form.ifSoundSaySo}
          onChange={(e) => setForm((f) => ({ ...f, ifSoundSaySo: e.target.value }))}
        />
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
          <h3>Preview — verdict: {preview.verdict} ({preview.pct}%)</h3>
          <p>{preview.statement}</p>
          {preview.questionsToAsk.length > 0 && (
            <ul>
              {preview.questionsToAsk.map((q, i) => (
                <li key={i}>{q.text}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
