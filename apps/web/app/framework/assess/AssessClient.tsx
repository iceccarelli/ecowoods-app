'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  PILLARS,
  FRAMEWORK_VERSION,
  score,
  pillarScore,
  criterionCount,
  allCriteria,
  type Answer,
} from '@/lib/framework';
import { track } from '@/lib/analytics';
import { QuoteReviewForm } from '@/app/components/QuoteReviewForm';

/**
 * The self-assessment.
 *
 * DESIGN DECISION — THE SCORING IS NEVER SENT ANYWHERE.
 *
 * This scores a quote the visitor received, very often from a competitor. The
 * moment the ANSWERS post anywhere it becomes a lead-capture form wearing a
 * tool's clothes, and the honest reply to "should I trust this scoring?"
 * becomes no. So the scoring runs entirely in the browser: no fetch, no
 * server, no account, no email wall between a person and their result.
 *
 * TWO THINGS CHANGED IN P1, AND NEITHER WEAKENS THAT.
 *
 * 1. THE RESULT NOW HAS A URL. The answers are mirrored into the querystring
 *    as one character per criterion, so a person can reload without losing an
 *    afternoon's work, send the scored quote to a partner, or send it back to
 *    the contractor who wrote it. That last one is the point: a tool that
 *    travels between a homeowner and their contractor is worth more than a
 *    tool that converts the homeowner who found it. The string is written with
 *    history.replaceState — it never leaves the browser unless the person
 *    chooses to paste it somewhere.
 *
 * 2. THERE IS AN OFFER UNDERNEATH THE RESULT. Not a gate: the score renders in
 *    full, forever, to someone who never touches it. It is a separate,
 *    explicitly-labelled second action for the reader who has just discovered
 *    four unmet criteria and wants somebody to look at the actual document.
 *    Sending the quote is a deliberate upload, on its own form, with its own
 *    consent — not a side effect of scoring.
 *
 * The distinction that matters: the tool does not charge for its answer. It
 * makes an offer after giving it. Those are different businesses.
 */

/** One character per criterion, in PILLARS order. `-` is unanswered. */
const CODE: Record<Answer, string> = { yes: 'y', unsure: 'u', no: 'n' };
const DECODE: Record<string, Answer> = { y: 'yes', u: 'unsure', n: 'no' };

function encodeAnswers(answers: Record<string, Answer>): string {
  return allCriteria()
    .map((c) => (answers[c.id] ? CODE[answers[c.id]!] : '-'))
    .join('');
}

function decodeAnswers(code: string): Record<string, Answer> {
  const criteria = allCriteria();
  /* Length is the version check. If the framework gains or loses a criterion,
     an old link no longer describes this instrument and is ignored outright —
     a partially-applied old answer set would silently mis-score a quote, which
     is worse than starting clean. */
  if (code.length !== criteria.length) return {};
  const out: Record<string, Answer> = {};
  criteria.forEach((c, i) => {
    const a = DECODE[code[i]!];
    if (a) out[c.id] = a;
  });
  return out;
}

const VERDICT: Record<
  string,
  { label: string; tone: 'bad' | 'warn' | 'ok' | 'good' | 'neutral'; text: string }
> = {
  incomplete: {
    label: 'Not enough answered',
    tone: 'neutral',
    text: 'Answer more of the criteria to get a verdict. If you cannot answer a question from the quote in front of you, that is itself the finding — mark it Unsure and ask.',
  },
  defect: {
    label: 'Unresolved defect',
    tone: 'bad',
    text: 'At least one critical criterion is answered no. A critical failure is not offset by a high score elsewhere: it is a specific, physical, predictable way this floor fails. Resolve it before signing anything.',
  },
  weak: {
    label: 'Weak',
    tone: 'warn',
    text: 'No critical failures, but a large share of the framework is unmet or unanswered. Most of these are questions the contractor can still answer — go back and ask them in writing.',
  },
  sound: {
    label: 'Sound',
    tone: 'ok',
    text: 'No critical failures and most of the framework is met. Close the remaining gaps in writing before the deposit, not after.',
  },
  strong: {
    label: 'Strong',
    tone: 'good',
    text: 'This quote meets nearly all of the framework. Whoever wrote it has done the diligence before quoting rather than after.',
  },
};

export default function AssessClient() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => score(answers), [answers]);
  const answered = Object.keys(answers).length;
  const verdict = VERDICT[result.verdict];
  const completeFired = useRef(false);

  /* Restore from the URL on mount only — never during render, so the server
     and the first client pass agree and hydration stays silent. */
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('a');
    if (code) setAnswers(decodeAnswers(code));
  }, []);

  /* Mirror into the URL. replaceState, so the back button still means "the
     page before this one" rather than "one criterion ago". */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = encodeAnswers(answers);
    const url = new URL(window.location.href);
    if (answered === 0) url.searchParams.delete('a');
    else url.searchParams.set('a', code);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    setCopied(false);
  }, [answers, answered]);

  /* One event, once, when the instrument has actually been completed. The
     ANSWERS are never sent — this records that a scoring finished and what the
     verdict was, which is what tells us whether the tool is doing its job. */
  useEffect(() => {
    if (completeFired.current) return;
    if (answered < criterionCount()) return;
    completeFired.current = true;
    track('framework_assess_complete', { verdict: result.verdict, pct: result.pct });
  }, [answered, result.verdict, result.pct]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* Clipboard blocked (permissions, insecure context). The URL is in the
         address bar either way — say nothing rather than claim a copy that
         did not happen. */
      setCopied(false);
    }
  }, []);

  const set = (id: string, a: Answer) =>
    setAnswers((prev) => (prev[id] === a ? (({ [id]: _drop, ...rest }) => rest)(prev) : { ...prev, [id]: a }));

  const unmet = PILLARS.flatMap((p) => p.criteria).filter((c) => answers[c.id] === 'no');
  const unsure = PILLARS.flatMap((p) => p.criteria).filter((c) => answers[c.id] === 'unsure');

  return (
    <>
      <div className="fw-scorebar" role="status" aria-live="polite">
        <div className="shell fw-scorebar-inner">
          <div className="fw-score-figure">
            <span className="fw-score-pct">{result.pct}%</span>
            <span className="fw-score-of">
              {answered} of {criterionCount()} answered
            </span>
          </div>
          <div className={`fw-verdict fw-verdict--${verdict.tone}`}>
            <strong>{verdict.label}</strong>
            <span>{verdict.text}</span>
          </div>
          <div className="fw-scorebar-actions">
            <button type="button" className="fw-btn" onClick={() => window.print()}>
              Print / save as PDF
            </button>
            <button type="button" className="fw-btn fw-btn--ghost" onClick={copyLink} disabled={answered === 0}>
              {copied ? 'Link copied' : 'Copy link to this score'}
            </button>
            <button type="button" className="fw-btn fw-btn--ghost" onClick={() => setAnswers({})}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {PILLARS.map((pillar) => {
        const ps = pillarScore(pillar, answers);
        return (
          <section key={pillar.id} className="tlx-section" aria-label={pillar.name}>
            <div className="shell">
              <p className="tlx-kicker">Pillar {pillar.number}</p>
              <div className="fw-pillar-head">
                <h2 className="tlx-h2">{pillar.name}</h2>
                <span className="fw-pillar-score">{ps.pct}%</span>
              </div>
              <p className="tlx-note">{pillar.intent}</p>

              <ul className="fw-q-list">
                {pillar.criteria.map((c) => {
                  const a = answers[c.id];
                  return (
                    <li key={c.id} className={`fw-q${a === 'no' ? ' fw-q--no' : ''}`}>
                      <div className="fw-q-text">
                        <span className="fw-id">{c.id}</span>
                        <p>{c.question}</p>
                        {a === 'no' && <p className="fw-risk">{c.risk}</p>}
                      </div>
                      <div
                        className="fw-choice"
                        role="group"
                        aria-label={`Criterion ${c.id}: ${c.question}`}
                      >
                        {(['yes', 'unsure', 'no'] as Answer[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={`fw-choice-btn fw-choice-btn--${v}${a === v ? ' is-on' : ''}`}
                            aria-pressed={a === v}
                            onClick={() => set(c.id, v)}
                          >
                            {v === 'yes' ? 'Yes' : v === 'unsure' ? 'Unsure' : 'No'}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}

      {(unmet.length > 0 || unsure.length > 0) && (
        <section className="tlx-section" aria-label="What to ask next">
          <div className="shell">
            <p className="tlx-kicker">Result</p>
            <h2 className="tlx-h2">What to take back to them, in writing</h2>
            {unmet.length > 0 && (
              <>
                <h3 className="fw-sub">Unmet — {unmet.length}</h3>
                <ul className="fw-followup">
                  {unmet.map((c) => (
                    <li key={c.id}>
                      <span className={`fw-sev fw-sev--${c.severity}`}>{c.severity}</span>
                      <div>
                        <p>{c.question}</p>
                        <p className="fw-risk">{c.risk}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {unsure.length > 0 && (
              <>
                <h3 className="fw-sub">Unanswered by the quote — {unsure.length}</h3>
                <p className="tlx-note">
                  A quote that does not answer these is not necessarily wrong. It is incomplete, and
                  the answers should arrive before a deposit rather than after.
                </p>
                <ul className="fw-followup">
                  {unsure.map((c) => (
                    <li key={c.id}>
                      <span className="fw-sev fw-sev--advisory">ask</span>
                      <div>
                        <p>{c.question}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="tlx-note">
              Scored against{' '}
              <Link href="/framework">Well-Installed Framework v{FRAMEWORK_VERSION}</Link>. Every
              criterion above is sourced to a paper published on this site. The link in your address
              bar carries this score — send it to whoever wrote the quote.
            </p>
          </div>
        </section>
      )}

      {/* The offer, AFTER the answer. It renders only once there is a result to
          react to, it is a separate deliberate upload, and nothing above it is
          withheld from anyone who ignores it. */}
      {answered >= 5 && (
        <section className="tlx-section" id="second-opinion" aria-label="Send us the quote">
          <div className="shell">
            <p className="tlx-kicker">Optional</p>
            <h2 className="tlx-h2">Want us to read the actual quote?</h2>
            <p className="tlx-note" style={{ maxWidth: '46rem' }}>
              The scoring above never leaves your browser. This is a different thing, and it is
              your choice: send us the document and a senior estimator will tell you which of the
              unmet criteria are real problems and which are just missing paperwork. We will say so
              when a competitor&rsquo;s quote is good — that answer is worth more to you than a
              sales pitch, and it is the only reason you would ask us.
            </p>
            <QuoteReviewForm
              source="framework-assess"
              context={`Framework v${FRAMEWORK_VERSION} · ${result.pct}% · ${verdict.label} · ${unmet.length} unmet, ${unsure.length} unanswered`}
            />
          </div>
        </section>
      )}
    </>
  );
}
