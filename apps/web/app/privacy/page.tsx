import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import {
  PROCESSORS,
  LEAD_FIELDS,
  OWN_STORAGE,
  LEGAL_LAST_REVIEWED,
  REVIEW,
  consentGated,
} from '@/lib/legal';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

const URL = `${SITE_URL}/privacy`;

export const metadata: Metadata = {
  title: 'Privacy — what we collect, who processes it, and how to get it deleted',
  description:
    'Exactly what this site collects, every third party it reaches, which ones only run after ' +
    'you opt in, and how to ask for your data back or deleted. Written from the application ' +
    `code and last checked against it on ${LEGAL_LAST_REVIEWED}.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

/**
 * /privacy — the page four things linked to and nothing served.
 *
 * The footer of every page on this site, the cookie consent banner's "learn
 * more", and the registration form's "I agree to the Privacy Policy" all
 * pointed here. It was a 404. The consent banner's own header comment cites
 * PIPEDA as the reason it exists, and the document that consent was supposed to
 * be informed by did not exist.
 *
 * WHAT THIS PAGE IS
 *
 * A description of what the application does, generated from `lib/legal.ts`,
 * which names the file and the import for every processor. Not borrowed
 * boilerplate. PIPEDA's openness principle asks for information about actual
 * policies and practices made readily available, and a true description of a
 * small business's actual data flow is worth more than a template describing
 * someone else's.
 *
 * `REVIEW.approved` is false and the page says so, in the body, above the fold.
 * That is uncomfortable and it is correct: a policy that implies legal review
 * it has not had is a worse document than one that states its own provenance.
 * Flip it in lib/legal.ts when a person with the standing to bind the business
 * has read it.
 */
export default function PrivacyPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Privacy', url: URL },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${URL}#webpage`,
          url: URL,
          name: 'Privacy',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          dateModified: LEGAL_LAST_REVIEWED,
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Privacy</span>
          </nav>
          <h1 className="tlx-title">What we collect, and what happens to it</h1>
          <p className="tlx-lede">
            Written from the code that runs this site rather than from a template, so every
            statement below can be checked against the thing it describes. Last checked on{' '}
            {LEGAL_LAST_REVIEWED}.
          </p>
          {!REVIEW.approved && <p className="tlx-note">{REVIEW.note}</p>}
        </div>
      </header>

      <section className="tlx-section" aria-label="The short version">
        <div className="shell">
          <p className="tlx-kicker">If you read one section</p>
          <h2 className="tlx-h2">The short version</h2>
          <ul className="fw-criteria">
            <li className="fw-criterion">
              <p className="fw-question">
                We collect what you type into a form, and nothing you did not type.
              </p>
              <p className="fw-risk">
                No purchased lists, no data brokers, no enrichment of your details from anywhere
                else.
              </p>
            </li>
            <li className="fw-criterion">
              <p className="fw-question">
                Analytics and advertising trackers do not run until you say yes.
              </p>
              <p className="fw-risk">
                {consentGated().map((p) => p.name).join(' and ')} load only after you accept them
                in the banner. Decline and they are never fetched — not loaded-and-ignored,
                never requested.
              </p>
            </li>
            <li className="fw-criterion">
              <p className="fw-question">We do not sell anything about you, to anyone.</p>
              <p className="fw-risk">
                The processors listed below are suppliers doing a job we asked them to do. There
                is no other route out.
              </p>
            </li>
            <li className="fw-criterion">
              <p className="fw-question">
                Ask and you get a copy, or a deletion. Email{' '}
                <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>.
              </p>
              <p className="fw-risk">
                No form to fill in, no account required. Say which address you used and we will
                find it.
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section className="tlx-section" aria-label="What the forms collect">
        <div className="shell">
          <p className="tlx-kicker">Every field</p>
          <h2 className="tlx-h2">What the enquiry form sends</h2>
          <p className="tlx-note">
            {LEAD_FIELDS.join(' · ')}. That is the whole list — it is the same schema the form
            validates against, so this cannot quietly grow a field.
          </p>
          <p className="tlx-note">
            Booking an in-home estimate adds the time you chose. Creating an account adds a
            password, which is stored hashed and cannot be read back by us or by anyone with
            access to the database.
          </p>
          <p className="tlx-note">
            <strong>Why we keep it.</strong> To answer you, to prepare and honour a written
            quote, and to keep the record of a job we did — a warranty claim years later needs the
            file. We do not have a fixed deletion schedule; ask and it goes.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Third parties">
        <div className="shell">
          <p className="tlx-kicker">Everyone who sees any of it</p>
          <h2 className="tlx-h2">The complete list</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Processors">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">Who</th>
                  <th scope="col">What they do</th>
                  <th scope="col">What reaches them</th>
                  <th scope="col">Runs</th>
                </tr>
              </thead>
              <tbody>
                {PROCESSORS.map((p) => (
                  <tr key={p.name}>
                    <th scope="row">{p.name}</th>
                    <td>{p.purpose}</td>
                    <td>{p.data}</td>
                    <td>{p.consentGated ? 'Only if you opt in' : 'Always'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            Some of these are outside Canada, which means your information can be processed in
            another country and is subject to the laws there. That is a consequence of using any
            mainstream email, payment or hosting supplier, and saying so is the honest version.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Cookies">
        <div className="shell">
          <p className="tlx-kicker">In your browser</p>
          <h2 className="tlx-h2">What this site stores on your device</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Storage">
            <table className="wp-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Kind</th>
                  <th scope="col">What it is for</th>
                </tr>
              </thead>
              <tbody>
                {OWN_STORAGE.map((s) => (
                  <tr key={s.key}>
                    <th scope="row">
                      <code>{s.key}</code>
                    </th>
                    <td>{s.kind}</td>
                    <td>{s.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            To change your mind about analytics or advertising, clear your site data for this
            domain and the banner will ask again.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Your rights">
        <div className="shell">
          <p className="tlx-kicker">What you can ask for</p>
          <h2 className="tlx-h2">Access, correction, deletion, complaint</h2>
          <p className="tlx-note">
            Under Canada&rsquo;s Personal Information Protection and Electronic Documents Act you
            can ask what we hold about you, ask us to correct it, ask us to delete it, and withdraw
            consent for anything that is not needed to finish work you have asked for. All four go
            to the same place:{' '}
            <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>, or{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
          </p>
          <p className="tlx-note">
            If we get it wrong, the Office of the Privacy Commissioner of Canada takes complaints
            about businesses, and you do not need our permission to make one.
          </p>
          <p className="tlx-note">
            {BUSINESS_NAP.legalName} · {BUSINESS_ADDRESS_LINE}
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Changes">
        <div className="shell">
          <p className="tlx-kicker">When this changes</p>
          <h2 className="tlx-h2">How you will know</h2>
          <p className="tlx-note">
            The date at the top is the last time this page was checked against the application.
            Every change to it is a commit in a public repository, so the history is inspectable
            rather than announced. See also{' '}
            <Link href="/terms">terms of use</Link> and{' '}
            <Link href="/authority">how this site expects to be cited</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
