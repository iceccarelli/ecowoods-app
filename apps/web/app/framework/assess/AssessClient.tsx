'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PILLARS,
  FRAMEWORK_VERSION,
  score,
  pillarScore,
  criterionCount,
  type Answer,
} from '@/lib/framework';

/**
 * The self-assessment.
 *
 * DESIGN DECISION — NOTHING IS SENT ANYWHERE.
 *
 * This scores a quote the visitor received, very often from a competitor. The
 * moment it posts anywhere it becomes a lead-capture form wearing a tool's
 * clothes, and the honest answer to "should I trust this scoring?" becomes no.
 * So the whole thing runs in component state: no fetch, no analytics event, no
 * localStorage, no hidden field. The result is printed by the browser.
 *
 * That constraint is also what makes it credible enough to be linked to by
 * someone who is not a customer, which is the entire distribution strategy.
 */

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
  const result = useMemo(() => score(answers), [answers]);
  const answered = Object.keys(answers).length;
  const verdict = VERDICT[result.verdict];

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
              criterion above is sourced to a paper published on this site.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
