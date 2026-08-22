import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CITIES, SERVICES, FAQ_ITEMS, SITE_URL, BUSINESS, cityBySlug, cityContent } from '@/lib/seo-data';
import { serviceAreaBusinessSchema, breadcrumbSchema, faqPageSchema } from '@/lib/structured-data';

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params;
  const city = cityBySlug(slug);
  if (!city) return {};
  const title = `Hardwood floor installation & refinishing in ${city.name}`;
  const description = `Custom hardwood floor installation, dust-free refinishing and restoration in ${city.name} and the GTA. Fixed written estimates, manufacturer warranties in writing. Call ${BUSINESS.phoneDisplay}.`;
  return {
    title,
    description,
    alternates: { canonical: `/service-areas/${city.slug}` },
    openGraph: { title: `${title} · Ecowoods`, description, url: `${SITE_URL}/service-areas/${city.slug}`, type: 'website' },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = cityBySlug(slug);
  if (!city) notFound();
  const url = `${SITE_URL}/service-areas/${city.slug}`;
  const jsonLd = [
    serviceAreaBusinessSchema(city),
    breadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: 'Service Areas', url: `${SITE_URL}/service-areas` },
      { name: city.name, url },
    ]),
    faqPageSchema(),
  ];
  const nearby = CITIES.filter((c) => c.slug !== city.slug).slice(0, 10);

  return (
    <div>
      {jsonLd.map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(o) }} />
      ))}

      <section className="section">
        <div className="shell">
          <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>
            <Link href="/">Home</Link> › <Link href="/service-areas">Service Areas</Link> › <span>{city.name}</span>
          </nav>
          <span className="eyebrow">Hardwood Flooring · {city.name}</span>
          <h1 style={{ marginTop: '0.5rem' }}>
            Hardwood floor installation &amp; refinishing in{' '}
            <span className="serif-italic">{city.name}.</span>
          </h1>
          <p style={{ maxWidth: '48rem', marginTop: '1rem' }}>
            Ecowoods installs, sands and refinishes solid and engineered hardwood across {city.name} and the
            wider GTA. Dust-free sanding that keeps you living at home, fixed written estimates with no
            &ldquo;unforeseen conditions,&rdquo; and manufacturer warranties passed through to you in writing.
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <a href="/#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
          </p>
        </div>
      </section>

      {(() => {
        const cc = cityContent(city.slug);
        if (!cc) return null;
        return (
          <section className="section">
            <div className="shell">
              <span className="eyebrow">Hardwood flooring in {city.name}</span>
              <h2>What we see in {city.name} homes.</h2>
              <p style={{ maxWidth: '52rem', marginTop: '1rem', lineHeight: 1.7 }}>{cc.intro}</p>
              {cc.neighbourhoods.length > 0 && (
                <p style={{ marginTop: '1rem' }}><strong>Areas we work:</strong> {cc.neighbourhoods.join(' · ')}</p>
              )}
              {cc.housingNote && (
                <p style={{ maxWidth: '52rem', marginTop: '1rem', lineHeight: 1.7 }}>{cc.housingNote}</p>
              )}
              {cc.signatureProject && (
                <blockquote style={{ margin: '1.5rem 0', padding: '1rem 1.25rem', borderLeft: '3px solid var(--copper-bright, #b87333)', opacity: 0.9 }}>{cc.signatureProject}</blockquote>
              )}
              {cc.localConsideration && (
                <p style={{ maxWidth: '52rem', marginTop: '1rem', lineHeight: 1.7 }}>{cc.localConsideration}</p>
              )}
            </div>
          </section>
        );
      })()}

      <section className="section">
        <div className="shell">
          <span className="eyebrow">What we do in {city.name}</span>
          <h2>Every service, one crew.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            {SERVICES.map((s) => (
              <div key={s.slug} style={{ padding: '1.25rem', border: '1px solid rgba(128,128,128,0.18)', borderRadius: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{s.name}</h3>
                <p style={{ fontSize: '0.92rem', opacity: 0.82, marginTop: '0.5rem' }}>{s.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <span className="eyebrow">Why {city.name} homeowners choose Ecowoods</span>
          <h2>Fixed price. Dust-free. In writing.</h2>
          <ul style={{ maxWidth: '52rem', marginTop: '1rem', lineHeight: 1.7 }}>
            <li><strong>Fixed written estimates.</strong> Moisture-tested and inspected up front — the number on paper is the number on your invoice.</li>
            <li><strong>Dust-free sanding.</strong> HEPA-sealed containment captures ~99.7% of airborne dust, so most clients stay home during the work.</li>
            <li><strong>Warranties in writing.</strong> Manufacturer finish and material warranties passed through, itemized in your contract.</li>
            <li><strong>Salaried craftsmen.</strong> No day-labour subcontractors — the same crew from first board to final coat.</li>
          </ul>
          <p style={{ marginTop: '1.25rem' }}>
            See <Link href="/#gallery">the floors we install</Link> and <Link href="/#craft">the machines behind the finish</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <span className="eyebrow">Common questions</span>
          <h2>Straight answers.</h2>
          <div style={{ maxWidth: '52rem', marginTop: '1rem' }}>
            {FAQ_ITEMS.map((f) => (
              <details key={f.q} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(128,128,128,0.18)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.q}</summary>
                <p style={{ marginTop: '0.6rem', opacity: 0.85 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <span className="eyebrow">Also serving</span>
          <h2>Across the GTA.</h2>
          <p style={{ marginTop: '1rem', lineHeight: 2 }}>
            {nearby.map((c, i) => (
              <span key={c.slug}>
                <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>{i < nearby.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <a href="/#quote" className="btn btn-copper btn-lg">Get your fixed-price estimate in {city.name}</a>
          </p>
        </div>
      </section>
    </div>
  );
}
