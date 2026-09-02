import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_AREAS, SERVICES, FAQ_ITEMS, SITE_URL, BUSINESS, cityBySlug, cityContent } from '@/lib/seo-data';
import { SERVICE_PAGES, priceBand } from '@/lib/service-pages';
import { serviceAreaBusinessSchema, breadcrumbSchema, faqPageSchema } from '@/lib/structured-data';
import { CommercialHeadTermRail } from '../../components/CommercialHeadTermRail';
import { JobCardRail } from '../../components/JobCard';
import { jobCardsForArea } from '@/content/job-cards';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';

export function generateStaticParams() {
  return SERVICE_AREAS.map((c) => ({ city: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params;
  const city = cityBySlug(slug);
  if (!city) return {};
  const title = `Hardwood floor refinishing & installation in ${city.name}`;
  /* The description leads with what is TRUE OF THIS AREA rather than what is
     true of all 32. `cityContent` is the only per-area copy on the page, so the
     first clause of the snippet is the first thing that differs between them. */
  const cc = cityContent(city.slug);
  const localClause = cc ? cc.intro.split(/(?<=\.)\s/)[0] : '';
  const description = (
    `${localClause} Dust-free refinishing and hardwood installation in ${city.name}. ` +
    `Fixed written estimates. Call ${BUSINESS.phoneDisplay}.`
  ).slice(0, 158);
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
    /* An area-scoped Service node. It carries its OWN @id — the page's URL, not
       the global /services/<slug>#service id — because those global nodes are
       emitted site-wide with `areaServed` covering the whole GTA. Re-emitting
       one of them here with a narrower areaServed would publish two different
       descriptions of the same entity and let a consumer pick either. This is a
       different node: the delivery of these services in this one place. */
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${url}#service`,
      name: `Hardwood floor refinishing & installation in ${city.name}`,
      serviceType: 'Hardwood flooring',
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: { '@type': 'City', name: city.name },
      url,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `Services delivered in ${city.name}`,
        itemListElement: SERVICES.map((svc) => ({
          '@type': 'Offer',
          itemOffered: { '@id': `${SITE_URL}/services/${svc.slug}#service` },
          areaServed: { '@type': 'City', name: city.name },
        })),
      },
    },
  ];
  const nearby = SERVICE_AREAS.filter((c) => c.slug !== city.slug).slice(0, 10);

  /* The per-area copy, read once. `intro` and `housingNote` are promoted into
     the hero (see the note there); the block further down renders what is left
     so nothing is published twice on one page. */
  const cc = cityContent(city.slug);
  const localIntro = cc?.intro;
  const localHousing = cc?.housingNote;

  /* Published jobs done in THIS area. Four of the thirty-two areas have one
     today; the rest render nothing rather than a card invented to fill a grid. */
  const localJobs = jobCardsForArea(city.name);

  return (
    <div>
      <ProofSliderForRoute route={`/service-areas/${slug}`} />
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
            Hardwood floor refinishing &amp; installation in{' '}
            <span className="serif-italic">{city.name}.</span>
          </h1>

          {/* THE FIRST 200 WORDS ARE THIS AREA'S, NOT THE TEMPLATE'S.
              This paragraph used to be one shared sentence pair with the city
              name substituted — the same 48 words on 32 URLs, sitting above the
              only genuinely local block on the page. Thirty-two pages whose
              opening is identical are thirty-two pages a crawler deduplicates
              before it ranks any of them, and an answer engine collapses to one
              weak citation target. The local content already existed in
              CITY_CONTENT; nothing here is newly written and nothing is
              invented. It has simply been promoted above the boilerplate,
              which is where a reader deciding whether we know their street
              needs it. `scripts/verify-cities.mjs` already guarantees every
              area has this content. */}
          {localIntro && (
            <p className="area-lede" style={{ maxWidth: '48rem', marginTop: '1rem', lineHeight: 1.7 }}>
              {localIntro}
            </p>
          )}
          {localHousing && (
            <p style={{ maxWidth: '48rem', marginTop: '1rem', lineHeight: 1.7 }}>{localHousing}</p>
          )}

          {/* The shared promise still belongs on the page — it is what the
              business guarantees everywhere — but it is now the SECOND thing
              read, after the reason to believe we work here. */}
          <p style={{ maxWidth: '48rem', marginTop: '1rem' }}>
            Dust-free sanding that keeps you living at home, fixed written estimates with no
            &ldquo;unforeseen conditions,&rdquo; and manufacturer warranties passed through to you in writing.
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <a href="/#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
          </p>
        </div>
      </section>

      {(() => {
        if (!cc) return null;
        return (
          <section className="section">
            <div className="shell">
              <span className="eyebrow">Hardwood flooring in {city.name}</span>
              <h2>What we see in {city.name} homes.</h2>
              {/* `intro` and `housingNote` are rendered in the hero now. Publishing
                  them twice on one page would be the duplication this change exists
                  to remove, so this block carries only what the hero did not. */}
              {cc.neighbourhoods.length > 0 && (
                <p style={{ marginTop: '1rem' }}><strong>Areas we work:</strong> {cc.neighbourhoods.join(' · ')}</p>
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

      {/* A job actually done in THIS area, with its readings. Four areas have
          one; the component renders nothing for the rest. A proof rail that is
          empty is honest; a proof rail filled with a job from another
          neighbourhood is not. */}
      <JobCardRail
        kicker={`Finished in ${city.name}`}
        heading={`Work we have published in ${city.name}`}
        intro="A real job, its substrate, its species and the measurement it turned on."
        jobs={localJobs}
        from={`service-area-${city.slug}`}
      />

      <section className="section">
        <div className="shell">
          <span className="eyebrow">What we do in {city.name}</span>
          <h2>Every service, one crew.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            {/* Links, not divs.

                These six cards rendered as unlinked <div>s on all sixteen city
                pages. Ninety-six of the most natural internal links on the site
                — local intent meeting a specific service — existed as text and
                went nowhere. Meanwhile the service pages listed the sixteen
                areas as plain prose, so the other ninety-six were missing too.
                A crawler cannot infer a relationship it is not given an edge
                for, and a reader who wants the price for refinishing in
                Etobicoke had no way through. See F-154. */}
            {SERVICE_PAGES.map((sp) => {
              const s = SERVICES.find((x) => x.slug === sp.slug);
              const band = priceBand(sp);
              return (
                <Link
                  key={sp.slug}
                  href={`/services/${sp.slug}`}
                  style={{ padding: '1.25rem', border: '1px solid rgba(128,128,128,0.18)', borderRadius: '14px', display: 'block' }}
                >
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>{s?.name ?? sp.h1}</h3>
                  <p style={{ fontSize: '0.92rem', opacity: 0.82, marginTop: '0.5rem' }}>{s?.blurb}</p>
                  {band && (
                    <p style={{ fontSize: '0.86rem', opacity: 0.7, marginTop: '0.5rem' }}>{band}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* The only in-content path from a local query to the two commercial
          head terms. Thirty-two pages x two links, with the city in the
          anchor text. See the note on the component. */}
      <CommercialHeadTermRail city={city.name} />

      <section className="section">
        <div className="shell">
          <span className="eyebrow">Why {city.name} homeowners choose Ecowoods</span>
          <h2>Fixed price. Dust-free. In writing.</h2>
          <ul style={{ maxWidth: '52rem', marginTop: '1rem', lineHeight: 1.7 }}>
            <li><strong>Fixed written estimates.</strong> Moisture-tested and inspected up front — the number on paper is the number on your invoice.</li>
            <li><strong>Dust-free sanding.</strong> HEPA-sealed extraction at the machine and containment at the room, so most clients stay home during the work.</li>
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

      {/* The NAP block, byte-identical to every other surface because every
          field is interpolated from BUSINESS_NAP. A local landing page that
          states the address differently from the homepage, the footer and the
          Google Business Profile is the single most common reason a local
          entity fails to resolve. */}
      <section className="section-tight" aria-label="Contact">
        <div className="shell">
          <div className="area-nap">
            <p className="area-nap-name">{BUSINESS_NAP.legalName}</p>
            <p>{BUSINESS_ADDRESS_LINE}</p>
            <p>
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>
              {' · '}
              <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
            </p>
            <p className="area-nap-hours">{HOURS_LINE}</p>
            <p className="area-nap-note">
              Serving {city.name} from the Etobicoke shop — we come to you.
            </p>
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
