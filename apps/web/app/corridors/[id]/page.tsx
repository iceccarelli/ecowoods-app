import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CORRIDORS, corridorById, corridorStops, corridorMarkets, marketBySlug, assess, marketPath,
} from '@/lib/geo';
import { SITE_URL, cityContent, BUSINESS } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { buildCorridorSchema } from '@/lib/schema/corridor-schema';
import { SchemaScripts } from '@/lib/schema/components';

export const dynamicParams = false;
export const generateStaticParams = () => CORRIDORS.map((c) => ({ id: c.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = corridorById(id);
  if (!c) return {};
  return {
    title: `${c.name} — hardwood flooring coverage along ${c.route}`,
    description: `${c.members.length} municipalities on the ${c.name} route, what coverage means in each, and where Ecowoods actually works. No claim of coverage that has not been confirmed.`,
    alternates: {
      canonical: `/corridors/${c.id}`,
      /* The machine edition (GEO-002). next.config.js rewrites
         /corridors/:id.md onto app/md/corridors/[id]; declaring it here is
         what lets an agent discover it instead of guessing the convention. */
      types: { 'text/markdown': `/corridors/${c.id}.md` },
    },
  };
}

const STATUS_LABEL: Record<string, string> = {
  'core-active': 'Routine',
  'active-expansion': 'Active',
  'corridor-target': 'In the corridor',
  'travel-by-confirmation': 'By confirmation',
  'us-active': 'Active · New York',
  'us-by-confirmation': 'By confirmation · New York',
};

/**
 * /corridors/[id] — one route.
 *
 * The page says three things about every municipality on it and refuses to say
 * a fourth. It says where the place sits on the drive, what its status is, and
 * whether there is a page with local detail. It does not say that work has been
 * documented there — coverage confirmed by the owner and a photographed job in
 * that municipality are two different facts, and this page keeps them apart.
 *
 * On 2026-09-10 the owner confirmed coverage of all forty-three Ontario
 * markets, so the honest content of this table changed: no municipality on any
 * route now reads "nobody has confirmed this". What did NOT change is the
 * second column. Eleven of the newly confirmed markets are inside the daily
 * return; fourteen are a real drive and say so in their own sentence, because a
 * visitor in Port Colborne is better served by "scheduled as a trip, confirmed
 * in advance, and priced with that in the written quote" than by the word
 * "routine", which every competitor's template already gives them and which
 * stops being true on the morning nobody arrives.
 *
 * Nor did the page gate move. A market links to a municipal page only when it
 * has real local content; twenty-five of these are confirmed and still have
 * none, and confirming coverage was never going to conjure a page worth
 * reading.
 */
export default async function CorridorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corridor = corridorById(id);
  if (!corridor) notFound();

  const hub = marketBySlug(corridor.hub);
  /* The stops are municipalities, in travel order, each carrying the districts
     inside it. Until GEO-002 five districts were typed into the corridor's own
     member list and rendered as peers of the cities that contain them
     (GC-016); they are still every one of them on this page, under the
     municipality they belong to, which is where they were always true. */
  const stops = corridorStops(corridor.id);
  const municipalities = stops.map((s) => s.municipality);
  const members = corridorMarkets(corridor.id);
  const districts = members.filter((x) => x.kind === 'district');

  const withPages = members.filter((x) => assess(x).indexable);
  const confirmed = members.filter((x) => x.operationalTruth.verifiedAt);
  const crossBorder = members.some((x) => x.country === 'US');

  return (
    <div className="tlx-page">
      <SchemaScripts
        schemas={[
          buildBreadcrumbList([
            { name: 'Home', url: SITE_URL },
            { name: 'Corridors', url: `${SITE_URL}/corridors` },
            { name: corridor.name, url: `${SITE_URL}/corridors/${corridor.id}` },
          ]),
          buildCorridorSchema(corridor),
        ]}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/corridors">Corridors</Link> <span aria-hidden="true">/</span>{' '}
            <span>{corridor.name}</span>
          </nav>
          <p className="tlx-kicker">{corridor.route}</p>
          <h1 className="tlx-title">{corridor.name}</h1>
          <p className="tlx-lede">{corridor.summary}</p>
          <p className="tlx-note">
            Out from {hub?.name ?? corridor.hub}. {municipalities.length} municipalities on the route
            {districts.length > 0 && <>, {districts.length} districts and communities inside them</>}.{' '}
            {confirmed.length} of the {members.length} have a confirmed operational position,{' '}
            {withPages.length} have a page of local detail.
          </p>
          <p className="tlx-note">
            A confirmed position means the owner of this business stated, on a date, what coverage of that
            municipality means — not that a job there has been photographed and published. Both are on the
            record and they are not the same thing. The dates are in{' '}
            <Link href="/api/v1/markets">/api/v1/markets</Link>.
          </p>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Along the route</h2>
          <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label={`Markets on the ${corridor.name} route`}>
            <table className="wm-table cr-table">
              <thead>
                <tr>
                  <th scope="col">Market</th>
                  <th scope="col">Status</th>
                  <th scope="col">What that means here</th>
                </tr>
              </thead>
              <tbody>
                {stops.map(({ municipality: x, districts: inside }) => {
                  const worthy = assess(x).indexable;
                  const cc = cityContent(x.slug);
                  return (
                    <tr key={x.slug}>
                      <th scope="row">
                        {worthy && cc ? <Link href={marketPath(x.slug)}>{x.name}</Link> : x.name}
                        {x.country === 'US' && <> <span className="tlx-kicker">NY</span></>}
                        {/* The districts inside this municipality — named as what they
                            are, under it, never as another stop on the drive. */}
                        {inside.length > 0 && (
                          <span className="tlx-kicker cr-within">
                            <span className="cr-within-label">within it</span>{' '}
                            {inside.map((d, i) => {
                              const linked = assess(d).indexable && cityContent(d.slug);
                              return (
                                <span key={d.slug}>
                                  {i > 0 && ', '}
                                  {linked ? <Link href={marketPath(d.slug)}>{d.name}</Link> : d.name}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </th>
                      <td data-label="Status">{STATUS_LABEL[x.status] ?? x.status}</td>
                      <td data-label="What that means here">
                        {x.operationalTruth.statement ||
                          'No confirmed operational position. On the route and in the plan; call and ask before assuming a date.'}
                        {x.operationalTruth.verifiedAt && (
                          <> <span className="tlx-kicker">confirmed {x.operationalTruth.verifiedAt}</span></>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {crossBorder && (
        <section className="tlx-section">
          <div className="shell">
            <h2 className="tlx-h2">Working in New York State</h2>
            <div className="tlx-body">
              <p>
                Ecowoods serves these municipalities. The shop and showroom are at{' '}
                {BUSINESS.address.streetAddress} in {BUSINESS.address.addressLocality}, and that is the only
                address this company has: there is no second office, no local telephone number and no separate
                crew in New York State. The crews are the same salaried employees who work in Toronto.
              </p>
              <p>
                What travels is the work, not a storefront. The published price is fixed after a free in-home
                measure, exactly as it is in Ontario, and jobs on this side of the river are scheduled with the
                crossing accounted for. A guard fails the build if a second address or telephone number ever
                appears anywhere in this geography.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Before you call about a market on this route</h2>
          <div className="tlx-body">
            <p>
              The published <Link href="/pricing">price bands</Link> are the same everywhere; distance shows up
              in the written price after the measure, not as a different rate card. If you are holding quotes
              already, <Link href="/quote-check">put them side by side</Link> before comparing the totals — the
              usual reason two quotes disagree is that they are pricing different work.
            </p>
            <p>
              Everything on <Link href="/corridors">the other routes</Link>, and the full model behind these
              statuses, is readable as data at <Link href="/api/v1/markets">/api/v1/markets</Link> and{' '}
              <Link href="/api/v1/corridors">/api/v1/corridors</Link>. This page is served as clean Markdown
              at <Link href={`/corridors/${corridor.id}.md`}>{`/corridors/${corridor.id}.md`}</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
