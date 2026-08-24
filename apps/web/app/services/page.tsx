import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { illustrationImage } from '../data/illustration-images';
import { getServicePages, serviceFor, priceBand, PRICE_PROMISE } from '@/lib/service-pages';
import { CommercialHeadTermRail } from '../components/CommercialHeadTermRail';

export const metadata: Metadata = {
  title: 'Custom hardwood installation, refinishing & dust-free sanding',
  description:
    'Custom hardwood floor installation, dust-free refinishing, restoration, stairs and inlays in Toronto and the GTA — each with a published price band and the paper behind the method.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Hardwood flooring services — EcoWoods',
    description:
      'Six services, each with a published price band and the technical paper behind it.',
    type: 'website',
    url: `${SITE_URL}/services`,
    images: [
      {
        url: illustrationImage('og-services')?.src ?? '/illustrations/og-services.webp',
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function ServicesPage() {
  const pages = getServicePages();

  return (
    <div className="tlx-page">
      {/*
        Written here rather than through buildWebPageSchema, whose item type is
        TechArticle | CaseStudy. Widening that union so a Service fits would let
        anything through a builder that four other pages depend on; a
        CollectionPage of six known nodes is three lines.

        hasPart references each service by @id instead of restating it. That is
        the whole point of the identifier: the detail page defines the Service
        once, and every other mention — here, and inside the LocalBusiness graph
        — points at that definition rather than making a second one.
      */}
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/services#collection`,
          name: 'Hardwood flooring services — EcoWoods',
          description:
            'Hardwood flooring services in Toronto and the GTA, each with its published price band and the technical paper behind it.',
          url: `${SITE_URL}/services`,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          hasPart: pages.map((p) => ({ '@id': `${SITE_URL}/services/${p.slug}#service` })),
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Services', url: `${SITE_URL}/services` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Services</span>
          </nav>
          <h1 className="tlx-title">Services</h1>
          <p className="tlx-lede">
            Six services. Each one has its own page because each one is a different decision, with a
            different price band and a different way of going wrong. Where a price is published it
            is the whole band, not a starting-from number.
          </p>
          <p className="tlx-note">
            {PRICE_PROMISE} Every figure on these pages is already published elsewhere on this
            site — in the <Link href="/papers">technical papers</Link> or the{' '}
            <Link href="/framework">framework</Link> — and a build guard enforces it.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Services">
        <div className="shell">
          <div className="tlx-grid">
            {pages.map((p) => {
              const svc = serviceFor(p);
              const band = priceBand(p);
              return (
                <Link key={p.slug} className="tlx-card" href={`/services/${p.slug}`}>
                  <span className="tlx-card-tag">Service</span>
                  <h3>{svc?.name ?? p.h1}</h3>
                  <p>{svc?.blurb ?? p.standfirst}</p>
                  <div className="tlx-card-data">
                    <span>{band ?? 'Quoted per project'}</span>
                    <span>{p.guides.length + p.papers.length} linked document(s)</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CommercialHeadTermRail />

      <section className="tlx-section" aria-label="Where we work">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">Where these services are delivered</h2>
          <p className="tlx-note">
            Every service on this page is delivered across{' '}
            <Link href="/service-areas">Toronto and the GTA</Link>. Judge any of them against the{' '}
            <Link href="/framework">Well-Installed Framework</Link>, or{' '}
            <Link href="/framework/assess">score a quote you have already been given</Link> —
            including one that is not ours.
          </p>
        </div>
      </section>
    </div>
  );
}
