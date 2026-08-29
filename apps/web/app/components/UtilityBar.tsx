import Link from 'next/link';
import { BUSINESS_NAP, HOURS_LINE_SHORT } from '@ecowoods/shared/constants';

/**
 * UtilityBar — the thin strip above the masthead.
 *
 * WHY THIS PATTERN, AND WHY IT IS THE FIRST THING BORROWED FROM AWS
 *
 * aws.amazon.com runs a dark utility strip above its product nav: language,
 * Contact us, Marketplace, Support, My account. It exists because a masthead has
 * exactly one row of primary attention and everything that is NOT a product
 * belongs somewhere else — but still has to be one click away, on every page.
 *
 * That is precisely the problem this site had. The header was spending slots on
 * a login and a product name (F-163), and the phone number — the single highest
 * converting element a trade business owns — was reachable only on the homepage
 * and in the footer.
 *
 * A homeowner reading about cupping on /hardwood-floor-problems-toronto at
 * 9pm is one decision away from calling. That number is now on every page, at
 * the top, permanently, without costing the primary nav a single character.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * It is not AWS's strip. Same structural job, this company's palette and this
 * company's four facts: who we serve, when we answer, how to call, where to
 * sign in. Copying the mechanism is strategy; copying the skin would be a
 * Toronto flooring company dressed as a cloud provider.
 */
export function UtilityBar() {
  return (
    <div className="ub" role="complementary" aria-label="Contact and account">
      <div className="ub-inner">
        <span className="ub-item ub-area">Serving Toronto &amp; the GTA</span>
        <span className="ub-sep" aria-hidden="true" />
        <span className="ub-item ub-hours">{HOURS_LINE_SHORT}</span>
        <span className="ub-grow" />
        <Link className="ub-item ub-link" href="/service-areas">Service areas</Link>
        <Link className="ub-item ub-link" href="/reviews">Reviews</Link>
        <Link className="ub-item ub-link ub-hide-sm" href="/mypage">Client sign in</Link>
        <a className="ub-phone" href={BUSINESS_NAP.phoneHref}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {BUSINESS_NAP.phoneDisplay}
        </a>
      </div>
    </div>
  );
}
