import type { Metadata } from 'next';
import Link from 'next/link';
import { FeedbackBand } from '../components/FeedbackBand';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { REFERRAL, referralRewardLine, referralOfferLine } from '@/content/referral';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: `Refer someone — ${referralRewardLine()}`,
  description: `Send us someone with a floor and receive ${referralOfferLine()}. One contact, we say who sent us, and we never add anyone to a list.`,
  alternates: { canonical: '/refer' },
  openGraph: {
    title: 'Refer someone to Ecowoods',
    description: `${referralRewardLine()} ${REFERRAL.condition}.`,
    type: 'website',
    url: `${SITE_URL}/refer`,
  },
};

/**
 * /refer — the cheapest customer this business will ever acquire.
 *
 * A referred buyer arrives with the hard part already done: somebody they
 * believe has told them we are worth calling. No advertising channel available
 * to a trade contractor competes with that on cost or on close rate, and the
 * only reason most contractors do not run a referral programme is that nobody
 * ever built them a page for it.
 *
 * THE THING THAT MAKES OR BREAKS IT IS RESTRAINT. A referral programme that
 * feels like a pyramid scheme costs you the referrer, who is your best
 * customer. So the promises on this page are narrow and all of them are kept
 * by the code behind it:
 *
 *   · ONE contact with the person referred. /api/referrals emails the
 *     estimating desk, not the friend — a human makes the call.
 *   · We say who sent us. That is what makes the call welcome rather than cold.
 *   · Nobody is added to a list, because there is no list.
 *   · The reward and its condition are stated in the same sentence, every time,
 *     from content/referral.ts. Never the reward alone.
 *
 * The form posts natively without JavaScript, like every other lead surface on
 * this site.
 */
export default function ReferPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Refer someone', url: `${SITE_URL}/refer` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Refer someone</span>
          </nav>
          <h1 className="tlx-title">Know someone with a floor?</h1>
          <p className="tlx-lede">
            Send them our way and you get {referralOfferLine()}. Most of our work has always come
            from someone telling someone else; this is us saying thank you for it properly instead
            of assuming it will keep happening.
          </p>
          <p className="fw-meta">
            One contact · We say you sent us · Nobody goes on a list
          </p>
          <div className="fw-actions">
            <a className="fw-cta" href="#refer-form">
              Refer someone now
            </a>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Or just tell us — {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="How it works">
        <div className="shell">
          <p className="tlx-kicker">How it works</p>
          <h2 className="tlx-h2">Three steps, and two of them are ours</h2>
          <ol className="fw-criteria">
            <li>
              <strong>You tell us who they are.</strong> A name and a way to reach them. Only fill
              this in for someone you actually know and who would not mind hearing from us — that is
              the whole basis on which we are allowed to call them.
            </li>
            <li>
              <strong>We contact them once, and we say you sent us.</strong> One call or one email
              from a senior estimator. If they are not interested, that is the end of it — there is
              no follow-up sequence and no list.
            </li>
            <li>
              <strong>You get {referralRewardLine()} when their job completes.</strong> Applied as
              credit against your own next job, or paid as an amenity if you have not got one
              planned. {REFERRAL.condition[0].toUpperCase() + REFERRAL.condition.slice(1)}.
            </li>
          </ol>
          <p className="tlx-note ref-legal">{REFERRAL.legalLine}</p>
        </div>
      </section>

      <section className="tlx-section" id="refer-form" aria-label="Refer someone">
        <div className="shell">
          <p className="tlx-kicker">The form</p>
          <h2 className="tlx-h2">Who should we talk to?</h2>

          <form className="ef-form ref-form" method="post" action="/api/referrals">
            <fieldset className="ref-fieldset">
              <legend>You</legend>
              <div className="ef-row">
                <label className="ef-field">
                  <span>Your name</span>
                  <input name="referrerName" type="text" autoComplete="name" required placeholder="Jane Doe" />
                </label>
                <label className="ef-field">
                  <span>Your email</span>
                  <input name="referrerEmail" type="email" autoComplete="email" required placeholder="jane@example.com" />
                </label>
              </div>
              <label className="ef-field">
                <span>Your phone</span>
                <input name="referrerPhone" type="tel" autoComplete="tel" required placeholder="(416) 555-0142" />
              </label>
            </fieldset>

            <fieldset className="ref-fieldset">
              <legend>Them</legend>
              <div className="ef-row">
                <label className="ef-field">
                  <span>Their name</span>
                  <input name="friendName" type="text" required placeholder="Alex" />
                </label>
                <label className="ef-field">
                  <span>Their email or phone</span>
                  <input name="friendContact" type="text" required placeholder="alex@example.com" />
                </label>
              </div>
              <div className="ef-row">
                <label className="ef-field">
                  <span>
                    Their area <em>optional</em>
                  </span>
                  <select name="friendArea" defaultValue="">
                    <option value="">Not sure</option>
                    {SERVICE_AREAS.map((a) => (
                      <option key={a.slug} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ef-field">
                  <span>
                    Anything we should know <em>optional</em>
                  </span>
                  <input name="note" type="text" placeholder="They mentioned the hallway is worn through." />
                </label>
              </div>
            </fieldset>

            <label className="ef-consent">
              <input type="checkbox" name="referrerConsent" required />
              <span>
                I know this person, and I am happy for Ecowoods to contact them once and mention that
                I referred them.
              </span>
            </label>

            <div className="ef-hp" aria-hidden="true">
              <label htmlFor="ref-company">Company</label>
              <input id="ref-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="ef-actions">
              <button type="submit" className="btn btn-copper">
                Send the referral
              </button>
              <a className="ef-call" href={BUSINESS_NAP.phoneHref}>
                or call {BUSINESS_NAP.phoneDisplay}
              </a>
            </div>

            <p className="ef-fine">
              We contact them once. We do not add them — or you — to any mailing list, and we do not
              share either of your details with anyone. {REFERRAL.legalLine}
            </p>
          </form>
        </div>
      </section>

      <section className="tlx-section" aria-label="Why people refer us">
        <div className="shell">
          <p className="tlx-kicker">Before you do</p>
          <h2 className="tlx-h2">Make sure we deserve it</h2>
          <p className="tlx-note" style={{ maxWidth: '46rem' }}>
            Your name is attached to this, which is a real thing to spend. Everything we claim is
            published and checkable: the{' '}
            <Link href="/framework">twenty-seven criteria</Link> we hold our own work to, the{' '}
            <Link href="/case-studies">jobs with their measurements</Link>, and the{' '}
            <Link href="/reviews">reviews on a platform we cannot edit</Link>. If any of it does not
            hold up, do not refer us — tell us instead.
          </p>
        </div>
      </section>

      <FeedbackBand topic="referrals" estimateHref="/#quote" />
    </div>
  );
}
