import type { Metadata } from 'next';
import Link from 'next/link';
import { CORRIDORS, MARKETS, marketBySlug, assess } from '@/lib/geo';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Where we drive — the corridors this work is routed along',
  description: `The ${CORRIDORS.length} routes Ecowoods works out from Toronto, the municipalities on each, and exactly what coverage means in every one of them.`,
  alternates: { canonical: '/corridors' },
};

/**
 * /corridors — the honest map.
 *
 * A service-area list answers "do you come here" with a yes or a silence. A
 * corridor answers it with a drive: the hub, the highway, and where the place
 * sits along it. That is also the only framing in which "we cover the Golden
 * Horseshoe" can be said without exaggeration, because the reader can see which
 * end of it they are on.
 *
 * Every status shown here comes from content/geo/markets.ts, and a market whose
 * operational position nobody has confirmed says so on this page rather than
 * borrowing the confidence of the ones beside it.
 */
export default function CorridorsPage() {
  const counts = {
    operational: MARKETS.filter((x) => x.operationalTruth.verifiedAt).length,
    withPages: MARKETS.filter((x) => assess(x).indexable).length,
    total: MARKETS.length,
    ca: MARKETS.filter((x) => x.country === 'CA').length,
    us: MARKETS.filter((x) => x.country === 'US').length,
  };

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Corridors', url: `${SITE_URL}/corridors` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Corridors</span>
          </nav>
          <p className="tlx-kicker">Coverage</p>
          <h1 className="tlx-title">The routes, not a list of place names</h1>
          <p className="tlx-lede">
            What decides whether a floor in Grimsby can be done well is the QEW, not a map colour. These are
            the {CORRIDORS.length} routes the work is organised along — the hub each one runs out from, the
            municipalities strung along it, and what coverage actually means in each.
          </p>
          <p className="tlx-note">
            {`${counts.total} municipalities and districts are in the model — ${counts.ca} in Ontario, ${counts.us} in New York State.`}{' '}
            {counts.operational} have a
            confirmed operational position. {counts.withPages} have earned a page of their own. Those three
            numbers are deliberately different, and the difference is explained below.
          </p>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          <ul className="pj-index">
            {CORRIDORS.map((c) => {
              const hub = marketBySlug(c.hub);
              return (
                <li key={c.id} className="pj-card">
                  <Link href={`/corridors/${c.id}`} className="pj-card-link">
                    <h2 className="pj-card-title">{c.name}</h2>
                  </Link>
                  <p className="tlx-kicker">{c.route}</p>
                  <p className="tlx-body">{c.summary}</p>
                  <p className="pj-note">
                    Out from {hub?.name ?? c.hub} · {c.members.length} markets
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">What the statuses mean</h2>
          <div className="tlx-body">
            <p>
              <strong>Routine.</strong> Worked from the Toronto shop as a matter of course, within the
              daily-return radius. Scheduling is normal scheduling.
            </p>
            <p>
              <strong>Active.</strong> Taking work; coverage established but not yet routine.
            </p>
            <p>
              <strong>In the corridor.</strong> On the route and in the plan, with no confirmed operational
              position yet. It appears here because the geography is real; it does not have a page, because a
              page for it would imply coverage nobody has confirmed. Call and ask — the honest answer is
              available in a phone call, and it is not available in a template.
            </p>
            <p>
              <strong>By confirmation.</strong> Outside the daily-return radius. The distance is real, the job
              is scheduled as a trip, and that sits in the written price rather than appearing later.
            </p>
            <p>
              <strong>New York State.</strong> The{' '}
              <Link href="/corridors/buffalo-niagara">Buffalo–Niagara</Link>,{' '}
              <Link href="/corridors/buffalo-metro">Buffalo metro</Link> and{' '}
              <Link href="/corridors/rochester-east">Rochester east</Link> routes. Ecowoods takes this work.
              The shop and the showroom are in Toronto and there is no second address, telephone number or
              crew: what crosses the border is the job, and the written price still follows the free in-home
              measure.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Why there are fewer pages than places</h2>
          <div className="tlx-body">
            <p>
              The quick version of this page would have been {counts.total} city pages generated from one
              template with the place name substituted in. It is the most reliably punished pattern in local
              search, for the good reason that every one of those pages is the same page.
            </p>
            <p>
              So a municipality gets a page when it has something specific to say — the housing stock, the
              substrate, the practical constraint that actually differs there — and until then it lives here,
              in the corridor it belongs to, findable and linked. The list of which markets are next is
              computed, not guessed: see <Link href="/api/v1/markets">the markets API</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
