import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { WorkMap } from '../components/WorkMap';
import { WORK_PLACES } from '@/content/work-map';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

const years = WORK_PLACES.map((p) => p.year);
const SPAN = `${Math.min(...years)}–${Math.max(...years)}`;

export const metadata: Metadata = {
  title: 'Where the work has been done',
  description:
    `Completed hardwood work across ${BUSINESS_NAP.region}, plotted by neighbourhood and linked to the ` +
    `measurements taken on each job. Neighbourhood precision only — no customer address is published.`,
  alternates: { canonical: '/where-we-work' },
  openGraph: {
    title: `Where ${BUSINESS_NAP.shortName} has worked`,
    description: `Published jobs across ${BUSINESS_NAP.region}, ${SPAN}, each one linked to what was measured.`,
    type: 'website',
    url: `${SITE_URL}/where-we-work`,
  },
};

/**
 * /where-we-work — proof of presence, without publishing anyone's home.
 *
 * WHAT THIS PAGE IS FOR
 *
 * "Do you work in my area?" is the second question every visitor has, and the
 * first one this site could not answer with evidence. There are 32 service-area
 * pages, and a service-area page is a CLAIM: we say we work in Leaside because
 * we wrote a page saying so. This page is the other kind of statement — here is
 * a job, here is the year, here is the square footage, here is the document
 * with the moisture readings in it.
 *
 * It is also the strongest local-search asset a trade business can build, for
 * an unglamorous reason: relevance for "hardwood flooring near me" is computed
 * over areas and entities, and a page tying named neighbourhoods to dated,
 * measured, first-party work is the densest honest signal available.
 *
 * WHY THERE ARE NO ADDRESSES ON IT
 *
 * The owner has the addresses. They belong to the people who live there. See
 * the note at the top of content/work-map.ts; scripts/verify-work-map.mjs makes
 * that structural rather than a matter of remembering.
 *
 * WHY IT IS THIN TODAY, AND WHAT MAKES IT THICK
 *
 * Five pins, because five jobs are published as case studies with their
 * measurements in them, and a pin may only exist if it points at one. That is
 * the whole design: the map cannot be padded. It gets denser the way everything
 * else here gets denser — by publishing the next job.
 */
export default function WhereWeWorkPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Where we work', url: `${SITE_URL}/where-we-work` },
        ])}
      />

      <section className="tlx-section">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Where we work</span>
          </nav>

          <p className="tlx-kicker">Evidence</p>
          <h1 className="tlx-title">Where the work has been done</h1>
          <p className="tlx-lede">
            Every dot is a job published in full — the substrate, the moisture readings, the days it
            took and what it cost to get right. Not a gallery: a set of documents you can check.{' '}
            {BUSINESS_NAP.shortName} has worked across {BUSINESS_NAP.region} since{' '}
            {BUSINESS_NAP.foundedYear}, and this is the part of it that is written down.
          </p>

          <WorkMap />

          <div className="wm-privacy">
            <h2 className="wm-privacy-h">Why there are no addresses on this map</h2>
            <p>
              These were people&rsquo;s homes. An address, next to what was installed and roughly
              what it cost, is information a burglar values more than a customer does — and the
              homeowners gave it to a contractor to do a floor, not to be published. So the map
              draws neighbourhoods, and a build guard rejects a postal code, a street number or a
              coordinate with a fourth decimal place before it can reach the site.
            </p>
            <p>
              If you want to see the work itself, the case studies carry the measurements, and we
              bring references to the estimate. Ask on the{' '}
              <Link href="/#quote">estimate form</Link>, or call{' '}
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
            </p>
          </div>

          <p className="tlx-note">
            Looking for your neighbourhood specifically? Every area we serve has its own page, with
            the housing stock and the substrates you actually meet there:{' '}
            <Link href="/service-areas">all service areas</Link>. Or start with{' '}
            <Link href="/case-studies">the case studies</Link>, or read{' '}
            <Link href="/framework">how to judge a contractor</Link> before you call anyone.
          </p>
        </div>
      </section>
    </div>
  );
}
