import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
import Link from 'next/link';
import { SERVICE_AREAS, SERVICES, SITE_URL, BUSINESS, areaDisplayName } from '@/lib/seo-data';
import { TERRITORY, TERRITORY_SHORT } from '@/lib/geo/territory';
import { breadcrumbSchema } from '@/lib/structured-data';
import { EvidenceRail, CASES } from '@/app/components/EvidenceRail';
import TerritoryMap from '../components/TerritoryMap';
import { illustrationImage } from '@/app/data/illustration-images';
import { areaGroups } from '@/lib/area-groups';

export const metadata: Metadata = {
  /* The title said "Across the GTA" over an index that runs to Port Colborne
     and Rochester (GC-004). Named from the published places, like the H1. */
  title: `Service Areas — Hardwood Flooring Across ${TERRITORY_SHORT}`,
  description: `Ecowoods installs and refinishes hardwood floors in ${SERVICE_AREAS.length} published areas across ${TERRITORY_SHORT}, from Downtown Toronto outward. Find your city. Call ${BUSINESS.phoneDisplay}.`,
  alternates: { canonical: '/service-areas', types: { 'text/markdown': '/service-areas.md' } },
  openGraph: {
    images: [{ url: illustrationImage('og-service-areas')?.src ?? '/illustrations/og-service-areas.webp', width: 1200, height: 630 }],
  },
};

export default function ServiceAreasIndex() {
  /* GROUP-01 — computed once, from lib/area-groups.ts, so the shape is
     testable rather than assembled inline in JSX. */
  const groups = areaGroups();

  const ld = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Service Areas', url: `${SITE_URL}/service-areas` },
  ]);
  return (
    <div>
      <ProofSliderForRoute route="/service-areas" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="section">
        <div className="shell">
          <span className="eyebrow">Service Areas</span>
          {/* The headline said "across the GTA" while the list below it ran to
              eighty-nine places, twenty-six of them in New York State. The most
              important geography page on the site was contradicting its own
              contents in its H1 — which is the version a search engine quotes.
              Counts are derived, so this cannot go stale again. */}
          <h1>
            Hardwood flooring <span className="serif-italic">across the corridor.</span>
          </h1>
          <p style={{ maxWidth: '48rem', marginTop: '1rem' }}>
            {`Installation, refinishing, dust-free sanding, restoration, stairs and custom inlays in ${SERVICE_AREAS.length} published areas across ${TERRITORY}. Find your city for the housing stock and the substrate under it, or book a free in-home measure anywhere on the map.`}
          </p>
          {/* GROUP-01 — ONE HUNDRED TILES IN ONE FLAT GRID WAS THE MARATHON.
              
              On a phone that is a hundred cards in a single column before the
              page says anything else. Grouped by CORRIDOR — the routes this
              business already publishes, already drives, and already models in
              content/geo/corridors.ts. Measured: all 100 published areas map to
              a corridor and none falls outside one, so this is the data's own
              shape rather than a taxonomy invented to tidy a list.

              Native <details>, no JavaScript, the same mechanism the footer
              already uses on mobile. Every link stays in the DOM whether the
              group is open or shut, so a crawler and an assistant see all one
              hundred either way — the collapsing costs discoverability nothing
              and costs a human ninety scroll-lengths.

              A city on more than one corridor is listed under the first, once.
              Listing it twice would double a hundred links into two hundred and
              make the counts in the summaries wrong. */}
          <nav className="gl-jump" aria-label="Jump to a corridor" style={{ marginTop: '1.5rem' }}>
            {groups.map((g) => (
              <a key={g.id} href={`#corridor-${g.id}`}>
                {g.name} <span aria-hidden="true">({g.cities.length})</span>
              </a>
            ))}
          </nav>

          {groups.map((g, gi) => (
            <details
              key={g.id}
              id={`corridor-${g.id}`}
              /* The largest group is open, so the page never looks empty and a
                 visitor sees the shape immediately. The rest are one tap. */
              open={gi === 0}
              style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: '1rem' }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, listStyle: 'revert' }}>
                {g.name}{' '}
                <span style={{ fontWeight: 400, opacity: 0.7 }}>
                  — {g.cities.length} {g.cities.length === 1 ? 'area' : 'areas'}
                </span>
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                {g.cities.map((c) => (
                  <Link key={c.slug} href={`/service-areas/${c.slug}`}
                    style={{ padding: '0.9rem 1.1rem', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '12px', textDecoration: 'none' }}>
                    Hardwood Flooring in {areaDisplayName(c)} →
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <p style={{ marginTop: '2rem' }}>
            <a href="/#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
          </p>
        </div>
      </section>

      {/* The area index listed the places and nothing else — no service,
          no evidence, no price. It is the page a "near me" query lands on, and
          it answered "where" while saying nothing about "what" or "how much". */}
      <section className="tlx-section" aria-label="What we do in all of them">
        <div className="shell">
          <p className="tlx-kicker">The same work everywhere</p>
          <h2 className="tlx-h2">What the crews do, wherever the job is</h2>
          {/* Was a static drawing of the GTA. It was accurate the month it was
              drawn and a factual error the day the territory reached Hamilton —
              a page headed "the same work everywhere" showing one sixth of
              everywhere. This reads the registry, so it cannot go stale, and it
              cycles one corridor at a time because a hundred and one markets
              shown at once show nothing. */}
          <TerritoryMap />
          <p className="tlx-note">
            {SERVICES.map((sv, i) => (
              <span key={sv.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${sv.slug}`}>{sv.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            Price bands are published before you call and do not change by postal code within a country:{' '}
            <Link href="/hardwood-flooring-toronto">hardwood flooring in Toronto</Link>,{' '}
            <Link href="/hardwood-floor-refinishing-toronto">refinishing</Link>,{' '}
            <Link href="/hardwood-stairs-toronto">stairs</Link>. What does change by address is the
            housing stock and the substrate under it, which is what each area page above is for.
          </p>
        </div>
      </section>

      <EvidenceRail
        heading="Four of them, by neighbourhood"
        intro={
          'Each publishes the substrate it was built on and the readings taken before the work — ' +
          'which is the part of a local job that actually varies.'
        }
        items={[
          { ...CASES.distillery, why: 'Distillery District: a Victorian loft over concrete, tested before the assembly was specified.' },
          { ...CASES.yorkville, why: 'Yorkville: below grade at a critical moisture reading, mitigated and re-measured.' },
          { ...CASES.forestHill, why: 'Forest Hill: wide-plank walnut over plywood, with the colour held uniform.' },
          { ...CASES.rosedale, why: 'Rosedale: a grand staircase and a radiant-heat main floor.' },
        ]}
      />
    </div>
  );
}
