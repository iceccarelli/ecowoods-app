import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BUSINESS_NAP,
  LIVE_REVIEW_DESTINATIONS,
  PENDING_REVIEW_DESTINATIONS,
  PRIMARY_REVIEW_EVIDENCE,
} from '@ecowoods/shared/constants';

export const metadata: Metadata = {
  title: 'Leave a review',
  description: `Where to leave a review for ${BUSINESS_NAP.legalName}.`,
  /*
   * Not a search surface. This is a tool a finished customer is handed, reached
   * from a printed card, and it should never compete with /reviews — the page
   * that is written to be found and quoted. `alternates` still points at
   * /reviews so anything that does crawl this lands on the real one.
   */
  robots: { index: false, follow: true },
  alternates: { canonical: '/reviews' },
};

/**
 * /r — the short URL on the card that goes out with every finished job.
 *
 * WHAT THIS PAGE IS NOT
 *
 * There is no "how did we do?" step. No star picker that sends four-and-five to
 * Google and one-through-three to a private complaints form. Every visitor sees
 * every destination, in the same order, with the same words.
 *
 * That is a policy requirement — Google's Maps user-contributed-content rules
 * prohibit discouraging negative reviews or selectively soliciting positive ones
 * — but it is also the only version that is worth anything. This company's
 * entire position is that its claims can be checked. A funnel that quietly
 * filters the unhappy ones is the same defect as a fabricated rating, arriving
 * by a politer route. scripts/verify-outreach.mjs fails the build if this file
 * ever grows a branch that shows different people different destinations.
 *
 * WHY IT IS SHORT
 *
 * It is printed on a card and read off it by someone standing in their hallway.
 * `ecowoods.ca/r` survives being retyped. `/leave-us-a-review` does not.
 */
export default function ReviewRoutingPage() {
  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <h1 className="tlx-title">Tell people what actually happened</h1>
          <p className="tlx-lede">
            Good or bad. We would rather have it written somewhere we cannot edit it than hear it
            once and lose it. Pick wherever you already have an account — it takes about a minute.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Where to leave a review">
        <div className="shell">
          {LIVE_REVIEW_DESTINATIONS.length > 0 && (
            <ul className="fw-criteria">
              {LIVE_REVIEW_DESTINATIONS.map((d) => (
                <li key={d.platform} className="fw-criterion">
                  <p className="fw-question">
                    <a className="fw-cta" href={d.href} target="_blank" rel="noopener nofollow">
                      Write a review on {d.platform} <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                  <p className="fw-risk">{d.note}</p>
                </li>
              ))}
            </ul>
          )}

          {PENDING_REVIEW_DESTINATIONS.length > 0 && (
            <p className="tlx-note">
              {PENDING_REVIEW_DESTINATIONS.map((d) => d.platform).join(' and ')} will be listed here
              once the profile link has been opened and confirmed. We do not print a link we have
              not checked.
            </p>
          )}

          <div className="gl-body">
            <p>
              <strong>No incentive, no discount, no filtering.</strong> Every completed job gets the
              same card with the same links, whether the job went smoothly or not. We do not ask
              first how it went and then decide who gets asked — that is against{' '}
              {LIVE_REVIEW_DESTINATIONS.some((d) => d.platform === 'Google')
                ? 'Google’s review policy'
                : 'the review platforms’ policies'}
              , and it is also how a perfect rating stops meaning anything.
            </p>
            <p>
              If something went wrong, write that. We would rather answer it in public than have it
              go unsaid. And if you would rather tell us directly first, call{' '}
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>{' '}
              — but please leave the review either way.
            </p>
            <p>
              Reviews already published:{' '}
              <Link href="/reviews">
                {PRIMARY_REVIEW_EVIDENCE.count} on {PRIMARY_REVIEW_EVIDENCE.platform}
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
