import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_AREAS, SERVICES, SITE_URL, BUSINESS, cityBySlug, cityContent, areaDisplayName, faqItemsForArea, US_AREA_SLUGS, type City } from '@/lib/seo-data';
import { SERVICE_PAGES, priceBandIn } from '@/lib/service-pages';
import { breadcrumbSchema, faqPageSchema } from '@/lib/structured-data';
import { placeForArea } from '@/lib/schema/root-schema';
import { CommercialHeadTermRail } from '../../components/CommercialHeadTermRail';
import { JobCardRail } from '../../components/JobCard';
import { jobCardsForArea } from '@/content/job-cards';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';
import { MARKETS, marketBySlug, corridorsFor } from '@/lib/geo';
import { EstimateForm } from '@/app/components/EstimateForm';

export function generateStaticParams() {
  return SERVICE_AREAS.map((c) => ({ city: c.slug }));
}
export const dynamicParams = false;

/**
 * The <title>, the WebPage name and the Service name — one string, three uses.
 *
 * New York areas carry ", NY" so a result for Niagara Falls or Brighton names
 * which one it is. There is a Niagara Falls on each side of the river and a
 * Brighton in both Monroe County and Ontario; a bare place name in a title is
 * resolved by the reader against whichever they already had in mind.
 */
const pageTitle = (city: City) => `Hardwood floor refinishing & installation in ${areaDisplayName(city)}`;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params;
  const city = cityBySlug(slug);
  if (!city) return {};
  const title = pageTitle(city);
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
    alternates: {
      canonical: `/service-areas/${city.slug}`,
      /* The machine edition. next.config.js rewrites /service-areas/:slug.md to
         the route under app/md/service-areas; declaring it here is what lets
         an agent discover it from the HTML rather than guess the convention. */
      types: { 'text/markdown': `/service-areas/${city.slug}.md` },
    },
    openGraph: { title: `${title} · Ecowoods`, description, url: `${SITE_URL}/service-areas/${city.slug}`, type: 'website' },
  };
}

function nearbyAreas(slug: string): City[] {
  const published = new Set(SERVICE_AREAS.map((a) => a.slug));
  const out: string[] = [];
  const push = (s: string | undefined) => {
    if (s && s !== slug && published.has(s) && !out.includes(s)) out.push(s);
  };
  const mk = marketBySlug(slug);
  mk?.nearest.forEach(push);
  if (mk?.partOf) {
    push(mk.partOf);
    MARKETS.filter((x) => x.partOf === mk.partOf).forEach((x) => push(x.slug));
  }
  MARKETS.filter((x) => x.partOf === slug).forEach((x) => push(x.slug));
  corridorsFor(slug).forEach((c) => c.members.forEach(push));
  return out.slice(0, 10).map((s) => cityBySlug(s)).filter((c): c is City => Boolean(c));
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = cityBySlug(slug);
  if (!city) notFound();
  const url = `${SITE_URL}/service-areas/${city.slug}`;
  /* What this page is about, typed as what it is: a City node for the sixteen
     municipalities, a Place inside Toronto for the sixteen neighbourhoods.
     Rosedale is not a city (F-157), and this page used to say it was — in the
     Service node below and in every Offer under it. */
  const place = placeForArea(city);
  const isUS = US_AREA_SLUGS.has(city.slug);
  const jsonLd = [
    /* ONE BUSINESS ENTITY.

       This slot held serviceAreaBusinessSchema(city): a second
       ['LocalBusiness', 'HomeAndConstructionBusiness'] node per page, with its
       own @id, "Ecowoods — Rosedale" as its name, and a parentOrganization
       pointing at `/#business` — an @id nothing on the site emits (the root is
       `/#organization`). Thirty-two pages, each declaring a business that does
       not exist, linked to the real one by a reference that resolved to
       nothing. The root organisation is injected on every page by the layout.
       What THIS page adds is that it is a page: about the business, part of
       the site, covering this one place. */
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: pageTitle(city),
      inLanguage: 'en-CA',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      spatialCoverage: place,
    },
    breadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: 'Service Areas', url: `${SITE_URL}/service-areas` },
      { name: city.name, url },
    ]),
    /* The FAQ a New York visitor gets answers the cost question in their own
       currency (GEO-004). Every other answer is identical on both sides of the
       river, because every other answer is about wood. */
    faqPageSchema(faqItemsForArea(city.slug)),
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
      name: pageTitle(city),
      serviceType: 'Hardwood flooring',
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: place,
      url,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `Services delivered in ${city.name}`,
        itemListElement: SERVICES.map((svc) => ({
          '@type': 'Offer',
          itemOffered: { '@id': `${SITE_URL}/services/${svc.slug}#service` },
          areaServed: place,
        })),
      },
    },
  ];
  /*
   * Nearby, from the geography — not the first ten entries of a list. This was
   * `SERVICE_AREAS.slice(0, 10)` under the heading "Across the GTA", so every
   * New York page, Port Colborne and Barrie linked to Downtown Toronto, North
   * York and Etobicoke as their neighbours, under a heading that put them in
   * the GTA (GC-004). Now: the market's own nearest list, its siblings and
   * children, then its corridor, restricted to places with a page.
   */
  const nearby = nearbyAreas(city.slug);

  /* The per-area copy, read once. `intro` and `housingNote` are promoted into
     the hero (see the note there); the block further down renders what is left
     so nothing is published twice on one page. */
  const cc = cityContent(city.slug);
  const localIntro = cc?.intro;
  const localHousing = cc?.housingNote;

  /* Published jobs done in THIS area. A handful of the published areas have one
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
            <Link href="/">Home</Link> › <Link href="/service-areas">Service Areas</Link> › <span>{areaDisplayName(city)}</span>
          </nav>
          <span className="eyebrow">Hardwood Flooring · {areaDisplayName(city)}</span>
          <h1 style={{ marginTop: '0.5rem' }}>
            Hardwood floor refinishing &amp; installation in{' '}
            <span className="serif-italic">{areaDisplayName(city)}.</span>
          </h1>

          {/* THE SENTENCE EVERY PAGE OWES THE READER, ABOVE EVERYTHING ELSE.
              A visitor arriving from "hardwood flooring {city}" has one
              question and it is not about substrate. Answering it in the first
              line — and, on a New York page, saying in the same breath where
              the shop is — is what separates a service page from a directory
              listing that leaves them guessing.

              EACH SENTENCE IS ONE TEMPLATE LITERAL, NOT MIXED JSX CHILDREN.
              Written as `Ecowoods serves {name}. Book the measure.` React
              renders it as three text nodes with separator comments between
              them:

                  Ecowoods serves <!-- -->Pittsford, NY<!-- -->. Book the measure.

              A browser and any HTML-parsing crawler read that as one sentence.
              A naive string extractor does not — and a live grep for the exact
              sentence came back empty on every New York page while finding the
              adjacent static one, which is precisely the failure mode. The
              sentence a page most needs a machine to lift verbatim is the one
              that must not be interrupted. */}
          <p style={{ maxWidth: '48rem', marginTop: '1rem', fontWeight: 600 }}>
            {`Ecowoods serves ${areaDisplayName(city)}. Book the measure.`}
            {isUS && ` The showroom is Toronto. The job is in ${city.name}. We take this work.`}
          </p>

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
          <p style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
            {/* SALE-03 — SAME PAGE. This was `/#quote`, a cross-page anchor:
                a homeowner who searched for this city, landed here, and pressed
                the primary button was sent to the homepage to scroll for a
                form. EstimateForm's own docblock records F-160 fixing exactly
                this pattern — it reached /services, /pricing, /commercial,
                /realtors and the four Toronto landing pages, and never reached
                the hundred pages that carry the entire geographic footprint. */}
            <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
            {/* THE STUDIO, IN THIS CITY'S OWN CURRENCY (GEO-006).
                Until now these pages reached Floor Studio only through the
                header and footer, which are global and were therefore Canadian
                — so a homeowner in Amherst read a United States band here and
                was quoted in Canadian dollars one tap later. That is GC-026.
                The region travels with the link, the studio says on screen
                which bands it is using, and the visitor can change it: nothing
                is inferred from an IP or a locale, because a Toronto laptop
                planning a Buffalo rental is not a Canadian job. */}
            <Link
              href={`/floor-studio?region=${isUS ? 'US' : 'CA'}#live`}
              className="btn btn-ghost btn-lg"
              prefetch={false}
            >
              See it in your room, priced in {isUS ? 'US dollars' : 'Canadian dollars'}
            </Link>
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
              /* The band in the currency of the country this page is about
                 (GEO-004). These cards read the Ontario set on every page,
                 including the twenty-six in New York State. */
              const band = priceBandIn(sp, isUS ? 'US' : 'CA');
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
      <CommercialHeadTermRail city={city.name} country={isUS ? 'US' : 'CA'} />

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
            {faqItemsForArea(city.slug).map((f) => (
              <details key={f.q} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(128,128,128,0.18)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.q}</summary>
                <p style={{ marginTop: '0.6rem', opacity: 0.85 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* SALE-03 — THE FORM, ON THE PAGE.
          
          This page type had none. Its primary button, twice, pointed at
          `/#quote` on the homepage, and the only contact mechanism here was a
          `tel:` link in the sixth section. One hundred URLs, every one of them
          a local commercial-intent search result, every one of them asking a
          homeowner to load a second page before typing anything.

          `source` carries the city. That is the whole point of MEAS-01 and
          MEAS-02 arriving first: a lead from Etobicoke is now distinguishable
          from a lead from Oakville in the funnel ledger, so the question "which
          cities actually produce deposits" becomes answerable instead of
          assumed — and the answer is what decides where the next real job
          photograph and the next piece of local proof should come from.

          It sits before the NAP block and after the local content, so a visitor
          reads the reason to believe we work here first and is then asked. */}
      <section className="tlx-section" id="quote" aria-label={`Request an estimate in ${city.name}`}>
        <div className="shell">
          <EstimateForm
            source={`service-area-${city.slug}`}
            heading={`Get a fixed written price in ${city.name}`}
            intro="A senior estimator measures, then writes one price. It does not move afterwards."
          />
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
          <h2>Nearby.</h2>
          <p style={{ marginTop: '1rem', lineHeight: 2 }}>
            {nearby.map((c, i) => (
              <span key={c.slug}>
                <Link href={`/service-areas/${c.slug}`}>{areaDisplayName(c)}</Link>{i < nearby.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <a href="#quote" className="btn btn-copper btn-lg">Get your fixed-price estimate in {city.name}</a>
          </p>
        </div>
      </section>
    </div>
  );
}
