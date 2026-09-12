import type { Metadata } from 'next';
import Link from 'next/link';
import QuoteCompare from './QuoteCompare';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { NextStep } from '@/app/components/NextStep';
import { Illustration } from '@/app/components/Illustration';
import { illustrationImage } from '@/app/data/illustration-images';

export const metadata: Metadata = {
  title: 'Compare hardwood flooring quotes — are they even for the same job?',
  description: `Put two or three hardwood quotes side by side against ${SCOPE_ITEMS.length} line items and find out whether their totals are comparable at all. Nothing is uploaded, nothing is stored, and no quote is ranked.`,
  alternates: { canonical: '/quote-check' },
  openGraph: {
    images: [{ url: illustrationImage('og-quote-check')?.src ?? '/illustrations/og-quote-check.webp', width: 1200, height: 630 }],
    title: 'Three quotes, three different jobs',
    description:
      'The reason hardwood quotes disagree is usually that they are not pricing the same work. This puts them side by side, line by line.',
    type: 'website',
    url: `${SITE_URL}/quote-check`,
  },
};

/**
 * /quote-check — the highest-intent moment in the whole business.
 *
 * A homeowner holding three quotes has already decided to do the work, already
 * chosen a rough budget, and is minutes from picking someone. Every flooring
 * company in this city competes for that moment with review counts. Review
 * counts do not tell anybody which of three numbers is correct.
 *
 * WHAT IT DOES, AND THE LINE IT WILL NOT CROSS
 *
 * It takes the visitor's own numbers about documents we never see and reports
 * where the scopes differ. It does not rank the quotes, does not price the
 * gaps, does not characterise anyone's document, and does not ask for an email
 * before showing the answer.
 *
 * The temptation is to price the gaps — "Quote B omits subfloor preparation,
 * typically $1.80/sq ft" — and it is exactly the thing we must not do.
 * Competition Act s.74.01(1)(b) requires adequate and proper testing to exist
 * BEFORE a performance claim is made, and we have no such test for a typical
 * GTA line-item price. Since Bill C-59 the exposure is the greater of CAD 10M
 * and 3% of worldwide gross revenue, and since 20 June 2025 a private party can
 * take it to the Tribunal directly. Naming or characterising a competitor's
 * document additionally invites the analysis in Energizer Brands v Gillette
 * 2023 FC 804.
 *
 * So the output is a question, not a verdict. That is also the more useful
 * output: a homeowner who goes back to three companies asking "what would
 * subfloor preparation cost, and why isn't it here?" learns more about all
 * three than any score we could compute.
 *
 * WHY IT IS WORTH BUILDING ANYWAY
 *
 * Every session teaches us, anonymously and only with consent, which line items
 * GTA quotes leave out. That is a fact about this market that no competitor can
 * assemble, because no competitor sees other companies' quotes at volume. It is
 * the same asset as the Floor Graph, gathered at the other end of the funnel.
 */
export default function QuoteCheckPage() {
  const published = SCOPE_ITEMS.filter((i) => i.basis === 'published').length;

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Compare quotes', url: `${SITE_URL}/quote-check` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Compare quotes</span>
          </nav>
          <p className="tlx-kicker">Quote comparison</p>
          <h1 className="tlx-title">Three quotes, and probably three different jobs</h1>
          <p className="tlx-lede">
            When two hardwood quotes are thousands of dollars apart, the usual reason is not that one company
            is expensive. It is that one of them is pricing subfloor preparation, disposal of the old floor
            and four coats, and the other is not — and nothing on either page says so. Tick what each document
            actually contains and find out whether the totals can be compared at all.
          </p>
          <p className="tlx-note">
            Nothing is uploaded and nothing is stored. This runs entirely in your browser; the quotes never
            leave this page.
          </p>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          <QuoteCompare />
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <Illustration id="quote-same-job-checklist" />
          <h2 className="tlx-h2">What this will not do</h2>
          <div className="tlx-body">
            <p>
              It will not tell you which quote to accept, and it will not put a dollar figure on anything a
              quote leaves out. Both are things we would have to invent. Nobody — us included — can publish
              what subfloor preparation costs in your house without seeing it, and a number we made up is the
              one number here you would actually act on.
            </p>
            <p>
              It also names nobody. We never see the documents, and this page contains no judgement about any
              company, including the ones you are comparing us against.
            </p>
            <p>
              {published} of the {SCOPE_ITEMS.length} line items are the ones we already publish as belonging
              in a hardwood quote, in{' '}
              <Link href="/guides/how-to-evaluate-a-hardwood-quote">how to evaluate a hardwood quote</Link>.
              The rest are plain scope questions — who moves the furniture, who takes the old floor away —
              where including the item is not better, it is simply a different job.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">If you would rather someone read them</h2>
          <div className="tlx-body">
            <p>
              A senior estimator will read the actual documents and tell you what is missing, what is unusual
              and what is fine — including where our own quote is the weaker one.{' '}
              <Link href="/framework/assess">Send the quotes you are holding</Link>. They are attached to one
              internal email and never stored.
            </p>
            <p>
              If you want to test the companies rather than the paperwork, the{' '}
              <Link href="/framework">twenty-four-criterion framework</Link> scores the process behind a quote,
              and the <Link href="/tools/floor-movement">movement calculator</Link> and{' '}
              <Link href="/equipment">equipment reference</Link> cover the two things quotes most often get
              silently wrong.
            </p>
          </div>
        </div>
      </section>
      <NextStep route="/quote-check" />
    </div>
  );
}
