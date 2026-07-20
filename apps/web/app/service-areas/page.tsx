import type { Metadata } from 'next';
import Link from 'next/link';
import { CITIES, SERVICES, SITE_URL, BUSINESS } from '@/lib/seo-data';
import { breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Service Areas — Hardwood Flooring Across the GTA',
  description: `Ecowoods installs and refinishes hardwood floors across Toronto and the GTA — from Downtown to Vaughan, Mississauga, Markham and beyond. Find your city. Call ${BUSINESS.phoneDisplay}.`,
  alternates: { canonical: '/service-areas' },
};

export default function ServiceAreasIndex() {
  const ld = breadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Service Areas', url: `${SITE_URL}/service-areas` },
  ]);
  return (
    <main>
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
            {CITIES.map((c) => (
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
    </main>
  );
}
