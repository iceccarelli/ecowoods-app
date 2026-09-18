'use client';

/**
 * The estimator's workbench: one to three quotes, every scope item and
 * framework criterion recorded as one of five statuses, with the page and
 * wording for anything marked "stated" or "unclear".
 *
 * All decisions about what a finding means live in lib/quote-intelligence —
 * this component only collects them. Pure state transitions are in
 * workbench-state.ts (unit-tested); validation, scoring, flags and the
 * comparison are compose(), which the Preview button runs server-side.
 *
 * The form autosaves to localStorage per order. A read of three quotes is
 * ~150 findings, and losing it to a refreshed tab is the most likely way this
 * product misses its turnaround.
 */

import { useEffect, useState } from 'react';
import { PILLARS } from '@/lib/framework';
import { SCOPE_GROUPS, SCOPE_ITEMS } from '@/lib/quote-check';
import { FINDING_STATUSES, type Finding, type FindingStatus, type QuoteEntry, type QuoteIntelligenceReport } from '@/lib/quote-intelligence/types';
import { STATUS_LABEL } from '@/lib/quote-intelligence/wording';
import {
  QUOTE_LABELS,
  draftKey,
  emptyForm,
  emptyQuote,
  fillBlanks,
  needsEvidence,
  progress,
  restoreDraft,
  withEvidence,
  withStatus,
  type WorkbenchForm,
} from '@/lib/quote-intelligence/workbench-state';

type Kind = 'criteria' | 'scope';

function FindingRow({
  id,
  label,
  hint,
  finding,
  onStatus,
  onEvidence,
}: {
  id: string;
  label: string;
  hint?: string;
  finding: Finding | undefined;
  onStatus: (s: FindingStatus) => void;
  onEvidence: (patch: { page?: number; excerpt?: string }) => void;
}) {
  const status = finding?.status;
  const missingExcerpt = needsEvidence(status) && !finding?.evidence?.excerpt?.trim();
  return (
    <div className="wir-criterion" data-unassessed={status ? undefined : 'true'}>
      <label className="ef-field">
        <span>
          {label}
          {hint && <em> — {hint}</em>}
        </span>
        <select value={status ?? ''} onChange={(e) => onStatus(e.target.value as FindingStatus)} aria-label={`Status: ${label}`}>
          <option value="" disabled>
            — not yet assessed —
          </option>
          {FINDING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {needsEvidence(status) && (
        <div className="wir-evidence">
          <label className="ef-field">
            <span>Page</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={finding?.evidence?.page ?? ''}
              onChange={(e) => onEvidence({ page: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </label>
          <label className="ef-field">
            <span>Wording, as written {missingExcerpt && <em>(required)</em>}</span>
            <input
              type="text"
              id={`excerpt-${id}`}
              maxLength={300}
              value={finding?.evidence?.excerpt ?? ''}
              aria-invalid={missingExcerpt}
              onChange={(e) => onEvidence({ excerpt: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function Workbench({
  orderId,
  alreadyPublished,
  existingReportUrl,
}: {
  orderId: string;
  alreadyPublished: boolean;
  existingReportUrl: string | null;
}) {
  const [form, setForm] = useState<WorkbenchForm>(emptyForm);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<QuoteIntelligenceReport | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [published, setPublished] = useState(alreadyPublished);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(existingReportUrl);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'publishing'>('idle');

  useEffect(() => {
    try {
      const draft = restoreDraft(window.localStorage.getItem(draftKey(orderId)));
      if (draft) setForm(draft);
    } catch {
      /* storage unavailable — work without a draft */
    }
    setLoaded(true);
  }, [orderId]);

  useEffect(() => {
    if (!loaded || published) return;
    try {
      window.localStorage.setItem(draftKey(orderId), JSON.stringify(form));
    } catch {
      /* quota or privacy mode — the form still works */
    }
  }, [form, loaded, orderId, published]);

  // Publish is only enabled against a preview of exactly what will be sent.
  useEffect(() => setPreview(null), [form]);

  const quote = form.quotes[Math.min(active, form.quotes.length - 1)];
  const quoteIndex = form.quotes.indexOf(quote);

  function updateQuote(fn: (q: QuoteEntry) => QuoteEntry) {
    setForm((f) => ({ ...f, quotes: f.quotes.map((q, i) => (i === quoteIndex ? fn(q) : q)) }));
  }

  function setFinding(kind: Kind, id: string, fn: (existing: Finding | undefined) => Finding) {
    updateQuote((q) => ({ ...q, [kind]: { ...q[kind], [id]: fn(q[kind][id]) } }));
  }

  function addQuote() {
    setForm((f) => (f.quotes.length >= QUOTE_LABELS.length ? f : { ...f, quotes: [...f.quotes, emptyQuote(f.quotes.length)] }));
    setActive(form.quotes.length);
  }

  function removeQuote() {
    if (form.quotes.length <= 1) return;
    if (!window.confirm(`Remove ${quote.label} and every finding recorded on it?`)) return;
    setForm((f) => ({ ...f, quotes: f.quotes.filter((_, i) => i !== quoteIndex) }));
    setActive(0);
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
    if (!window.confirm('Publish the PDF and email the customer? A published report cannot be re-published.')) return;
    setBusy('publishing');
    setErrors([]);
    const { ok, json } = await callApi('publish');
    if (ok) {
      setPublished(true);
      setPublishedUrl(json.url);
      try {
        window.localStorage.removeItem(draftKey(orderId));
      } catch {
        /* nothing to clean */
      }
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

  const p = progress(quote);

  return (
    <div className="portal-card wir-workbench">
      <div className="ef-actions" role="tablist" aria-label="Quotes">
        {form.quotes.map((q, i) => {
          const qp = progress(q);
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === quoteIndex}
              className={i === quoteIndex ? 'btn btn-copper' : 'btn'}
              onClick={() => setActive(i)}
            >
              {q.label || `Quote ${i + 1}`} ({qp.assessed}/{qp.total})
            </button>
          );
        })}
        {form.quotes.length < QUOTE_LABELS.length && (
          <button type="button" className="btn" onClick={addQuote}>
            + Add a quote
          </button>
        )}
      </div>

      <fieldset className="wir-pillar">
        <legend>About {quote.label || 'this quote'}</legend>
        <label className="ef-field">
          <span>
            Label <em>— neutral only, never a company name</em>
          </span>
          <input type="text" maxLength={40} value={quote.label} onChange={(e) => updateQuote((q) => ({ ...q, label: e.target.value }))} />
        </label>
        <label className="ef-field">
          <span>
            Total as written <em>— optional, CAD</em>
          </span>
          <input
            type="number"
            min={0}
            value={quote.statedTotal ?? ''}
            onChange={(e) => updateQuote((q) => ({ ...q, statedTotal: e.target.value === '' ? undefined : Number(e.target.value) }))}
          />
        </label>
        <label className="ef-field">
          <span>
            Area as written <em>— optional, sq ft</em>
          </span>
          <input
            type="number"
            min={0}
            value={quote.statedAreaSqFt ?? ''}
            onChange={(e) => updateQuote((q) => ({ ...q, statedAreaSqFt: e.target.value === '' ? undefined : Number(e.target.value) }))}
          />
        </label>
        <p>
          {p.assessed} of {p.total} assessed
          {p.missingEvidence > 0 && ` · ${p.missingEvidence} still need the wording quoted`}
        </p>
        <div className="ef-actions">
          <button type="button" className="btn" onClick={() => updateQuote((q) => fillBlanks(q, 'not_specified'))}>
            Mark every blank item “{STATUS_LABEL.not_specified}”
          </button>
          <button type="button" className="btn" onClick={() => updateQuote((q) => fillBlanks(q, 'cannot_determine'))}>
            Mark every blank item “{STATUS_LABEL.cannot_determine}”
          </button>
          {form.quotes.length > 1 && (
            <button type="button" className="btn" onClick={removeQuote}>
              Remove this quote
            </button>
          )}
        </div>
      </fieldset>

      {SCOPE_GROUPS.map((group) => (
        <fieldset key={group} className="wir-pillar">
          <legend>Scope — {group}</legend>
          {SCOPE_ITEMS.filter((s) => s.group === group).map((s) => (
            <FindingRow
              key={`${quoteIndex}-${s.id}`}
              id={`${quoteIndex}-${s.id}`}
              label={s.label}
              hint={s.changesScope ? 'changes scope' : undefined}
              finding={quote.scope[s.id]}
              onStatus={(st) => setFinding('scope', s.id, (f) => withStatus(f, st))}
              onEvidence={(patch) => setFinding('scope', s.id, (f) => withEvidence(f, patch))}
            />
          ))}
        </fieldset>
      ))}

      {PILLARS.map((pillar) => (
        <fieldset key={pillar.id} className="wir-pillar">
          <legend>
            {pillar.number}. {pillar.name}
          </legend>
          {pillar.criteria.map((c) => (
            <FindingRow
              key={`${quoteIndex}-${c.id}`}
              id={`${quoteIndex}-${c.id}`}
              label={`${c.id} ${c.question}`}
              hint={c.severity === 'advisory' ? undefined : c.severity}
              finding={quote.criteria[c.id]}
              onStatus={(st) => setFinding('criteria', c.id, (f) => withStatus(f, st))}
              onEvidence={(patch) => setFinding('criteria', c.id, (f) => withEvidence(f, patch))}
            />
          ))}
        </fieldset>
      ))}

      <fieldset className="wir-pillar">
        <legend>Across the quote(s)</legend>
        {(
          [
            ['present', 'What’s right (present)', 3],
            ['missing', 'What’s missing', 3],
            ['askInWriting', 'Additional questions to ask in writing, one per line', 3],
            ['riskNotes', 'Additional risk notes, one per line', 2],
            ['ifSoundSaySo', 'Only if every quote holds up: say so here', 2],
          ] as const
        ).map(([key, label, rows]) => (
          <label key={key} className="ef-field">
            <span>{label}</span>
            <textarea rows={rows} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
          </label>
        ))}
        <p>No dollar figures, percentages, comparisons or company names in free text — the preview will reject them.</p>
      </fieldset>

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
        <button type="button" className="btn btn-copper" disabled={busy !== 'idle' || !preview} onClick={onPublish}>
          {busy === 'publishing' ? 'Publishing…' : 'Publish and email customer'}
        </button>
      </div>

      {preview && (
        <div className="wir-preview" aria-live="polite">
          <h3>Preview</h3>
          <p>{preview.statement}</p>
          <ul>
            {preview.quotes.map((q) => (
              <li key={q.label}>
                <strong>{q.label}</strong>: {q.verdict} ({q.pct}) · {q.riskFlags.filter((f) => f.level === 'high').length} high /{' '}
                {q.riskFlags.filter((f) => f.level === 'medium').length} medium flags · {q.questionsToAsk.length} questions
              </li>
            ))}
          </ul>
          {preview.comparison && (
            <p>
              Comparison ({preview.comparison.verdict}): {preview.comparison.statement}
            </p>
          )}
          {preview.generalRiskFlags.length > 0 && (
            <ul>
              {preview.generalRiskFlags.map((f, i) => (
                <li key={i}>
                  {f.level.toUpperCase()} · {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
