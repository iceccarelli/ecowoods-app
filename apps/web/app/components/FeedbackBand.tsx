'use client';

import { useState } from 'react';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/**
 * FeedbackBand — "Did you find what you were looking for today?"
 *
 * WHY COPY THIS ONE
 *
 * It is the last thing above the AWS footer on every page, and it is the
 * cheapest instrument in web publishing: two buttons that turn a silent bounce
 * into a signal. A site with 286 pages and no analytics narrative has no way to
 * know which of them fails a reader — and the honest answer is that some of
 * them do.
 *
 * WHAT IT DOES HERE THAT IT DOES NOT DO AT AWS
 *
 * A "No" on a flooring site is not a documentation gap. It is very often a
 * person who wanted a price for something the page did not cover. So "No" opens
 * the one thing that helps them: the phone number and the estimate form,
 * immediately, without a survey. The signal is a by-product; the visitor is
 * the point.
 *
 * NO TRACKING BEYOND THE PAGE. The answer is held in component state and used
 * to decide what to render next. It sets no cookie, calls no endpoint and names
 * no third party — which is why it needs no entry in the processor register
 * that seo:legal enforces.
 */
export function FeedbackBand({ topic = 'this page' }: { topic?: string }) {
  const [answer, setAnswer] = useState<null | 'yes' | 'no'>(null);

  return (
    <aside className="fb" aria-label="Page feedback">
      <div className="shell fb-inner">
        {answer === null && (
          <>
            <div className="fb-copy">
              <h2 className="fb-h">Did you find what you were looking for?</h2>
              <p className="fb-sub">
                Tell us, and we will fix {topic}. We publish what we learn either way.
              </p>
            </div>
            <div className="fb-actions">
              <button type="button" className="fb-btn" onClick={() => setAnswer('yes')}>
                Yes <span aria-hidden="true">👍</span>
              </button>
              <button type="button" className="fb-btn" onClick={() => setAnswer('no')}>
                No <span aria-hidden="true">👎</span>
              </button>
            </div>
          </>
        )}

        {answer === 'yes' && (
          <div className="fb-copy" aria-live="polite">
            <h2 className="fb-h">Good.</h2>
            <p className="fb-sub">
              When you want the number in writing, the estimate is free and the price does not move
              after we measure. <a href="#estimate">Request one</a>, or call{' '}
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
            </p>
          </div>
        )}

        {answer === 'no' && (
          <div className="fb-copy" aria-live="polite">
            <h2 className="fb-h">Then ask us directly.</h2>
            <p className="fb-sub">
              A senior estimator answers the phone during working hours, and there is no script.
              Call <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>, or{' '}
              <a href="#estimate">send the question with your postcode</a> and we will answer in
              writing within one business day.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
