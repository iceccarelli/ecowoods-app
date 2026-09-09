import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CORRIDORS, corridorById, marketBySlug, assess, marketPath, type Market,
} from '@/lib/geo';
import { SITE_URL, cityContent, BUSINESS } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const dynamicParams = false;
export const generateStaticParams = () => CORRIDORS.map((c) => ({ id: c.id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = corridorById(id);
  if (!c) return {};
  return {
    title: `${c.name} — hardwood flooring coverage along ${c.route}`,
    description: `${c.members.length} municipalities on the ${c.name} route, what coverage means in each, and where Ecowoods actually works. No claim of coverage that has not been confirmed.`,
    alternates: { canonical: `/corridors/${c.id}` },
  };
}

const STATUS_LABEL: Record<string, string> = {
  'core-active': 'Routine',
  'active-expansion': 'Active',
  'corridor-target': 'In the corridor',
  'travel-by-confirmation': 'By confirmation',
  'us-proxy': 'Advertising reach only',
};

/**
 * /corridors/[id] — one route.
 *
 * The page says three things about every municipality on it and refuses to say
 * a fourth. It says where the place sits on the drive, what its status is, and
 * whether there is a page with local detail. It does not say that work has been
 * done there, because for most of these nobody has confirmed that it has.
 *
 * The distinction is the entire value of the page. A visitor in Welland can see
 * that Welland is on the Niagara route, that its position is unconfirmed, and
 * that the confirmed markets are up the QEW — and decide to call. That is worth
 * more than a page telling them Ecowoods serves Welland, which is the version
 * every competitor's template already gives them.
 */
export default async function CorridorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corridor = corridorById(id);
  if (!corridor) notFound();

  const hub = marketBySlug(corridor.hub);
  const members = corridor.members
    .map((s) => marketBySlug(s))
    .filter((x): x is Market => Boolean(x));

  const withPages = members.filter((x) => assess(x).indexable);
  const confirmed = members.filter((x) => x.operationalTruth.verifiedAt && x.status !== 'us-proxy');
  const crossBorder = members.some((x) => x.country === 'US');

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Corridors', url: `${SITE_URL}/corridors` },
          { name: corridor.name, url: `${SITE_URL}/corridors/${corridor.id}` },
        ])}
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
            Out from {hub?.name ?? corridor.hub}. {members.length} markets on the route,{' '}
            {confirmed.length} with a confirmed operational position, {withPages.length} with a page of local
            detail.
          </p>
        </div>
      </header>

      <section className="tlx-section">
        <div className="shell">
          <h2 className="tlx-h2">Along the route</h2>
          <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label={`Markets on the ${corridor.name} route`}>
            <table className="wm-table">
              <thead>
                <tr>
                  <th scope="col">Market</th>
                  <th scope="col">Status</th>
                  <th scope="col">What that means here</th>
                </tr>
              </thead>
              <tbody>
                {members.map((x) => {
                  const worthy = assess(x).indexable;
                  const cc = cityContent(x.slug);
                  return (
                    <tr key={x.slug}>
                      <th scope="row">
                        {worthy && cc ? <Link href={marketPath(x.slug)}>{x.name}</Link> : x.name}
                        {x.kind === 'district' && x.partOf && (
                          <> <span className="tlx-kicker">part of {marketBySlug(x.partOf)?.name ?? x.partOf}</span></>
                        )}
                        {x.country === 'US' && <> <span className="tlx-kicker">NY</span></>}
                      </th>
                      <td>{STATUS_LABEL[x.status] ?? x.status}</td>
                      <td>
                        {x.operationalTruth.statement ||
                          'No confirmed operational position. On the route and in the plan; call and ask before assuming a date.'}
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
            <h2 className="tlx-h2">About the New York municipalities on this list</h2>
            <div className="tlx-body">
              <p>
                Ecowoods is an Ontario company operating from {BUSINESS.address.streetAddress} in{' '}
                {BUSINESS.address.addressLocality}. There is no United States office, no United States crew
                and no United States phone number, and this page is not an offer to work in New York State.
              </p>
              <p>
                They appear here for one reason: a great many people who own property in Niagara and along the
                lake live on the other side of the river, and somebody searching from Buffalo for work on an
                Ontario house should be able to find an Ontario company. That is the whole of it. Those
                municipalities are never published as service area, in this page or in the structured data
                behind it, and a guard fails the build if one ever is.
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
              statuses, is readable as data at <Link href="/api/v1/markets">/api/v1/markets</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
