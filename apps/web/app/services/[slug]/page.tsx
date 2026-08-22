import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL, CITIES } from '@/lib/seo-data';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { getPaper } from '@/lib/papers';
import { getGuide } from '@/lib/guides';
import {
  getServicePages,
  getServicePage,
  serviceFor,
  priceBand,
  priceLabel,
  faqsFor,
  pillarsFor,
  termsFor,
  PRICE_PROMISE,
} from '@/lib/service-pages';

export function generateStaticParams() {
  return getServicePages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) return {};
  const svc = serviceFor(page);
  const url = `${SITE_URL}/services/${page.slug}`;
  const band = priceBand(page);
  return {
    title: page.h1,
    description: `${svc?.blurb ?? page.standfirst}${band ? ` Published price band: ${band}.` : ''}`,
    alternates: { canonical: `/services/${page.slug}` },
    openGraph: {
      title: `${svc?.name ?? page.h1} — EcoWoods`,
      description: svc?.blurb ?? page.standfirst,
      type: 'website',
      url,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();

  const svc = serviceFor(page);
  const url = `${SITE_URL}/services/${page.slug}`;
  const band = priceBand(page);
  const faqs = faqsFor(page);
  const pillars = pillarsFor(page);
  const terms = termsFor(page);

  /**
   * The Service node. Its `@id` is the same one lib/schema/builders.ts has been
   * emitting inside the LocalBusiness graph since that file was written — and
   * which resolved to a 404 until this route existed. Now the identifier and
   * the page are the same URL, which is the entire job of an `@id`.
   *
   * `provider` points at the organisation node by reference rather than
   * restating it. `areaServed` is CITIES, the same list the service-area routes
   * and the sitemap are built from, so the coverage claimed here cannot exceed
   * the coverage that has a page.
   */
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: svc?.name ?? page.h1,
    description: svc?.blurb ?? page.standfirst,
    serviceType: svc?.name ?? page.h1,
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: CITIES.map((c) => ({ '@type': 'City' as const, name: c.name })),
    url,
    ...(band
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'CAD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              priceCurrency: 'CAD',
              unitText: 'square foot',
              ...(page.pricing
                ? {
                    minPrice: Number(band.match(/\$([\d.]+)/)?.[1] ?? 0),
                    maxPrice: Number(band.match(/–\$([\d.]+)/)?.[1] ?? 0),
                  }
                : {}),
            },
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/#quote`,
          },
        }
      : {}),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={serviceSchema} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Services', url: `${SITE_URL}/services` },
          { name: svc?.name ?? page.h1, url },
        ])}
      />
      {faqs.length > 0 && (
        <SchemaScript schema={buildFAQPage(faqs.map((f) => ({ question: f.q, answer: f.a })))} />
      )}

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/services">Services</Link> <span aria-hidden="true">/</span>{' '}
            <span>{svc?.name ?? page.h1}</span>
          </nav>
          <h1 className="tlx-title">{page.h1}</h1>
          <p className="tlx-lede">{page.standfirst}</p>
          <p className="tlx-note">{svc?.blurb}</p>
        </div>
      </header>

      {band && (
        <section className="tlx-section" aria-label="Price">
          <div className="shell">
            <p className="tlx-kicker">Published price</p>
            <h2 className="tlx-h2">{priceLabel(page)}</h2>
            <dl className="gd-spec">
              <div className="gd-spec-row">
                <dt>Band</dt>
                <dd>{band}</dd>
              </div>
              <div className="gd-spec-row">
                <dt>How it is set</dt>
                <dd>{PRICE_PROMISE}</dd>
              </div>
              <div className="gd-spec-row">
                <dt>What moves it</dt>
                <dd>
                  Species, width, pattern, stairs and site condition — plus the commodity inputs
                  tracked on <Link href="/market">what moves a hardwood quote</Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="How this work is judged">
        <div className="shell">
          <p className="tlx-kicker">The standard</p>
          <h2 className="tlx-h2">How this work is judged</h2>
          <p className="tlx-note">
            These are the <Link href="/framework">Well-Installed Framework</Link> pillars this
            service is scored against. The framework is published, versioned and free to cite — use
            it on our quote, and on everyone else&rsquo;s.
          </p>
          <div className="tlx-grid">
            {pillars.map((p) => (
              <Link key={p.id} className="tlx-card" href={`/framework#${p.id}`}>
                <span className="tlx-card-tag">Pillar</span>
                <h3>{p.name}</h3>
                <p>{p.intent}</p>
                <div className="tlx-card-data">
                  <span>{p.criteria.length} criteria</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="The method">
        <div className="shell">
          <p className="tlx-kicker">The method</p>
          <h2 className="tlx-h2">What the technique actually is</h2>
          <p className="tlx-note">
            Nothing on this page asserts a technique that is not set out in full in a published
            paper. These are the sections that establish it.
          </p>
          <div className="tlx-grid">
            {page.papers.map((ref) => {
              const paper = getPaper(ref.paper);
              return (
                <Link
                  key={`${ref.paper}#${ref.section}`}
                  className="tlx-card"
                  href={`/papers/${ref.paper}#${ref.section}`}
                >
                  <span className="tlx-card-tag">Paper section</span>
                  <h3>{ref.label}</h3>
                  <p>{paper?.title}</p>
                  <div className="tlx-card-data">
                    <span>v{paper?.version}</span>
                    <span>{paper?.publishedAt}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="tlx-section" aria-label="Questions">
          <div className="shell">
            <p className="tlx-kicker">Before you decide</p>
            <h2 className="tlx-h2">The questions this service turns on</h2>
            <p className="tlx-note">
              Each answer is the recommendation of a published decision guide, not a paragraph
              written for this page. Follow the link for the criteria behind it.
            </p>
            <dl className="gd-spec">
              {faqs.map((f) => (
                <div className="gd-spec-row" key={f.href}>
                  <dt>{f.q}</dt>
                  <dd>
                    {f.a} <Link href={f.href}>Read the guide</Link>.
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {terms.length > 0 && (
        <section className="tlx-section" aria-label="Terms">
          <div className="shell">
            <p className="tlx-kicker">Vocabulary</p>
            <h2 className="tlx-h2">Terms used on this page</h2>
            <dl className="gd-spec">
              {terms.map((t) => (
                <div className="gd-spec-row" key={t.slug}>
                  <dt>
                    <Link href={`/glossary/${t.slug}`}>{t.term}</Link>
                  </dt>
                  <dd>{t.short}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="Coverage">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">Where this service is delivered</h2>
          <p className="tlx-note">
            {CITIES.map((c) => c.name).join(', ')} — see{' '}
            <Link href="/service-areas">service areas</Link> for the page on each.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/#quote">
              Book a free estimate
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote first
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
