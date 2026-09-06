import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
import Link from 'next/link';
import { SERVICE_AREAS, SERVICES, SITE_URL, BUSINESS } from '@/lib/seo-data';
import { breadcrumbSchema } from '@/lib/structured-data';
import { EvidenceRail, CASES } from '@/app/components/EvidenceRail';
import { IllustrationPair } from '../components/Illustration';

export const metadata: Metadata = {
  title: 'Service Areas — Hardwood Flooring Across the GTA',
  description: `Ecowoods installs and refinishes hardwood floors across Toronto and the GTA — from Downtown to Vaughan, Mississauga, Markham and beyond. Find your city. Call ${BUSINESS.phoneDisplay}.`,
  alternates: { canonical: '/service-areas', types: { 'text/markdown': '/service-areas.md' } },
};

export default function ServiceAreasIndex() {
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
          <h1>Hardwood flooring <span className="serif-italic">across the GTA.</span></h1>
          <p style={{ maxWidth: '48rem', marginTop: '1rem' }}>
            Installation, refinishing and dust-free sanding — from Downtown Toronto to Vaughan, Mississauga,
            Markham and beyond. Find your city for local details, or book a free in-home estimate anywhere in
            the Greater Toronto Area.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1.75rem' }}>
            {SERVICE_AREAS.map((c) => (
              <Link key={c.slug} href={`/service-areas/${c.slug}`}
                style={{ padding: '0.9rem 1.1rem', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '12px', textDecoration: 'none' }}>
                Hardwood Flooring in {c.name} →
              </Link>
            ))}
          </div>
          <p style={{ marginTop: '2rem' }}>
            <a href="/#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
          </p>
        </div>
      </section>

      {/* The area index listed thirty-two places and nothing else — no service,
          no evidence, no price. It is the page a "near me" query lands on, and
          it answered "where" while saying nothing about "what" or "how much". */}
      <section className="tlx-section" aria-label="What we do in all of them">
        <div className="shell">
          <p className="tlx-kicker">The same work everywhere</p>
          <h2 className="tlx-h2">What the crews do, wherever the job is</h2>
          <IllustrationPair a="map-service-areas-gta" b="map-service-areas-gta-b" />
          <p className="tlx-note">
            {SERVICES.map((sv, i) => (
              <span key={sv.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${sv.slug}`}>{sv.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            Price bands are published before you call and do not change by postal code:{' '}
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
