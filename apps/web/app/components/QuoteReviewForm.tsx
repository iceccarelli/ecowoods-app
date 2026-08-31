'use client';

import { useState, type FormEvent } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { track } from '@/lib/analytics';
import { compressPhoto } from '@/lib/image-compress';

/**
 * QuoteReviewForm — "send us the quote you already have".
 *
 * THE STRATEGIC POINT
 *
 * Competitors in this market win on Google review volume. This does not fight
 * that; it goes around it. A homeowner holding three quotes has a problem no
 * review count solves — they cannot tell which one is right — and the business
 * that reads the document for them is the one in the room when they decide.
 *
 * It only works if the answer is honest, including when the honest answer is
 * "that quote is good, take it". Saying so costs one job and earns the referral
 * from someone who will tell the story for years. The copy on the page commits
 * to that out loud, which is the only way it means anything.
 *
 * MECHANICS
 *
 * Accepts a PDF (what a quote usually is) or up to three images (what a quote
 * usually is when photographed on a phone). Images are compressed client-side
 * by the same path the photo-triage track uses; PDFs are passed through with a
 * size cap because re-encoding somebody's contract is not our business.
 *
 * `context` is the assess result, if it came from there — a text summary only.
 * The criterion-by-criterion answers are NOT sent: see AssessClient's header.
 */

const MAX_FILES = 3;

export function QuoteReviewForm({
  source,
  /** One-line summary of where this came from, e.g. an assess verdict. */
  context,
}: {
  source: string;
  context?: string;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function onPick(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, MAX_FILES);
    const out: File[] = [];
    const problems: string[] = [];
    for (const f of picked) {
      if (f.type === 'application/pdf') {
        // A contract is not ours to re-encode. Pass it through, cap the size.
        if (f.size > 8 * 1024 * 1024) problems.push(`${f.name} is over 8 MB — send the pages that carry the scope and the price.`);
        else out.push(f);
        continue;
      }
      const r = await compressPhoto(f);
      if (r.ok) out.push(r.file);
      else problems.push(r.reason);
    }
    setFiles(out);
    setNote(problems.length ? problems.join(' ') : null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.delete('documents');
    for (const f of files) fd.append('documents', f, f.name);

    setState('sending');
    setErrors({});
    try {
      const res = await fetch('/api/quote-review', {
        method: 'POST',
        headers: { 'x-requested-with': 'fetch', accept: 'application/json' },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        track('quote_review_submit', { source, documents: files.length });
        setState('sent');
        form.reset();
        setFiles([]);
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
      <div className="ef ef--done qr-done" aria-live="polite">
        <h3 className="ef-h">We have it.</h3>
        <p className="ef-intro">
          A senior estimator will read the quote and reply with what is genuinely wrong with it,
          what is only missing from it, and what is fine. If it is a good quote we will tell you
          that. Urgent? Call <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="ef-form qr-form" method="post" action="/api/quote-review" encType="multipart/form-data" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="source" value={source} />
      {context && <input type="hidden" name="context" value={context} />}

      <label className="ef-field">
        <span>The quote — a PDF, or up to 3 photos of it</span>
        <input
          name="documents"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={(e) => void onPick(e.currentTarget.files)}
        />
        {files.length > 0 && (
          <em className="ef-photo-list">
            {files.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`).join(' · ')}
          </em>
        )}
        {note && <em className="ef-err">{note}</em>}
        {errors.documents && <em className="ef-err">{errors.documents}</em>}
      </label>

      <div className="ef-row">
        <label className="ef-field">
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" required placeholder="Jane Doe" />
          {errors.name && <em className="ef-err">{errors.name}</em>}
        </label>
        <label className="ef-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required placeholder="jane@example.com" />
          {errors.email && <em className="ef-err">{errors.email}</em>}
        </label>
      </div>

      <label className="ef-field">
        <span>
          Anything you already suspect <em>optional</em>
        </span>
        <textarea name="message" rows={2} placeholder="They quoted a screen and recoat but the finish is worn through in the hallway." />
      </label>

      <div className="ef-hp" aria-hidden="true">
        <label htmlFor={`qr-company-${source}`}>Company</label>
        <input id={`qr-company-${source}`} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="ef-actions">
        <button type="submit" className="btn btn-copper" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send the quote for review'}
        </button>
        <a className="ef-call" href={BUSINESS_NAP.phoneHref}>
          or call {BUSINESS_NAP.phoneDisplay}
        </a>
      </div>

      {state === 'error' && (
        <p className="ef-err ef-err--block" role="alert">
          Something went wrong sending that. Please call {BUSINESS_NAP.phoneDisplay}.
        </p>
      )}

      <p className="ef-fine">
        We read it and reply. We do not contact the company that wrote it, and we do not publish
        anything you send. Your score above is still not transmitted — only the file you attach here.
      </p>
    </form>
  );
}
