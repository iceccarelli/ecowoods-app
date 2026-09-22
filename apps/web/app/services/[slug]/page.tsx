import type { Metadata } from 'next';
import { ProofSliderForRoute } from '@/app/components/ProofSliderForRoute';
import { EstimateForm } from '../../components/EstimateForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL, CITIES, SERVICE_AREAS, SERVICES } from '@/lib/seo-data';
import { placeForArea } from '@/lib/schema/root-schema';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { Illustration, IllustrationPair } from '../../components/Illustration';
import { ColorMatchFigure } from '../../components/ColorMatchFigure';
import { FilmStage } from '../../components/FilmStage';
import { getFilm, videoObjectsFor } from '@/lib/films';
import { getPaper } from '@/lib/papers';
import { getGuide } from '@/lib/guides';
import { EvidenceRail, CASES } from '@/app/components/EvidenceRail';
import { JobCardRail } from '@/app/components/JobCard';
import { jobCardsForService } from '@/content/job-cards';
import { getRegistry } from '@/lib/registry/registry';
import { getProject, stillById } from '@/lib/projects';
import KenBurnsStill from '../../components/project/KenBurnsStill';
import DetailPlate from '../../components/project/DetailPlate';
import {
  getServicePages,
  getServicePage,
  serviceFor,
  priceBand,
  bandForPage,
  priceLabel,
  faqsFor,
  pillarsFor,
  termsFor,
  PRICE_PROMISE,
} from '@/lib/service-pages';
/* One fact, two drawings of it. `<id>` and `<id>-b` were briefed once and
   drawn twice; IllustrationPair alternates them by cross-fade. Not kenburns —
   see the note above IllustrationMotion in components/Illustration.tsx: a scale
   inside a fixed frame crops, and on an explanatory figure the crop removes the
   thing the figure exists to show. */
const SERVICE_PAIRS: Record<string, [string, string][]> = {
  'hardwood-installation': [['protocol-timeline-install', 'protocol-timeline-install-b'], ['concept-acclimation-72h', 'concept-acclimation-72h-b']],
  /* The section through a contained job, cross-fading with a conceptual scene
     of the same thing in an occupied home. The scene's own caption says it is
     conceptual; neither is a photograph of a named job. */
  'dust-free-sanding': [['occupancy-containment-section', 'occupancy-containment-scene']],
};

/**
 * The one Project with a documented before/after dust story: the worn/dusty
 * kitchen frames, the finished floor the cabinets landed on, and the two
 * detail plates that argue containment and refinish timing specifically.
 * Referenced by still/detail id rather than re-describing them, so this page
 * cannot drift from the registry's own alt text and dimensions.
 */
const DUST_FREE_PROJECT = getProject('stone-cottage-strip-refinish');
const DUST_FREE_STILL_IDS = ['ch1-04', 'ch1-05', 'ch2-11'] as const;
const DUST_FREE_DETAIL_IDS = ['08-03-detail-kitchen-dust-under-cabinet-feet', '07-01-detail-cabinet-box-over-finished-floor'];

/**
 * The one Project that is a stair, chaptered bare-to-stained — the same
 * curved flight and open well, sanded in chapter one and finished in
 * chapter two. No `details` array exists on this record (see the type's own
 * comment in content/projects/maple-vaughan-curved-stair.ts), so unlike
 * DUST_FREE_PROJECT this page shows no DetailPlate for it — inventing one
 * would be exactly the kind of drift stillById/DetailPlate exist to prevent.
 */
const STAIR_PROJECT = getProject('maple-vaughan-curved-stair');
const STAIR_STILL_IDS = ['ch1-04', 'ch1-05', 'ch2-03', 'ch2-04'] as const;

/**
 * The same Project as DUST_FREE_PROJECT — Stone Cottage is the one record
 * with a full worn-to-refinished arc, not just the kitchen chapter — but a
 * SEPARATE still/detail selection, so this section tells the refinish
 * story rather than repeating the dust-containment one. Both pairs below
 * are registered in the project's own `pairs` array (hallway, sage), same
 * rooms /hardwood-floor-refinishing-toronto already uses ch2-02 from —
 * this adds the "before" half that commercial page doesn't show.
 */
const REFINISH_PROJECT = getProject('stone-cottage-strip-refinish');
const REFINISH_STILL_IDS = ['ch1-01', 'ch2-02', 'ch1-02', 'ch2-05'] as const;
const REFINISH_DETAIL_IDS = ['08-01-detail-hallway-oval-patch-wear', '06-01-detail-sunshaft-on-sheen'];

/**
 * The last photographed Project with no /services strip: a hard-maple
 * field and open-riser stair, one continuous walkthrough. Biased to the
 * FLOOR here on purpose — the project also has plenty of stair-void frames
 * (ch1-01/02/03/05/06/07/08), but this is the install service page, not
 * stairs, so every still below is a plank field, a grain close-up or a
 * threshold, never the stair well. Detail ids pair 1:1 with their still by
 * the project's own numbering convention (detail-NN pairs with ch1-NN —
 * see the `detail()` factory's comment in
 * content/projects/maple-glass-residence.ts).
 */
const INSTALL_PROJECT = getProject('maple-glass-residence');
const INSTALL_STILL_IDS = ['ch1-04', 'ch1-13', 'ch1-18', 'ch1-20'] as const;
const INSTALL_DETAIL_IDS = ['detail-13', 'detail-20'];

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
    alternates: { canonical: `/services/${page.slug}`, types: { 'text/markdown': `/services/${page.slug}.md` } },
    openGraph: {
      title: `${svc?.name ?? page.h1} — Ecowoods`,
      description: svc?.blurb ?? page.standfirst,
      type: 'website',
      url,
    },
  };
}

/**
 * One image per service, keyed by slug.
 *
 * These six pages are where a buyer lands from a commercial search, and until
 * now they were the least illustrated pages on the site — no image at all,
 * while every glossary term had one. An audit of the manifests found it
 * (docs/visual/IMAGE_BRIEF.md); it was not visible from inside any single file.
 */
const SERVICE_IMAGE: Record<string, string> = {
  'hardwood-installation': 'service-installation',
  'floor-refinishing': 'service-refinishing',
  'dust-free-sanding': 'service-dust-free',
  'floor-restoration': 'service-restoration',
  'custom-inlays': 'service-inlays',
  'stair-refinishing': 'service-stairs',
};

/**
 * Colour-matching hero for the three services the 2026 pack actually photographed
 * (scripts/fixtures/color-matching-manifest.csv) — additive to SERVICE_IMAGE's
 * flat-vector diagram above, not a replacement for it.
 */
const SERVICE_COLOR_MATCH_HERO: Record<string, string> = {
  'floor-refinishing': 'service-refinish-bare-to-stained',
  'floor-restoration': 'service-restoration-hero-feather',
  'stair-refinishing': 'service-stairs-matched-flight',
};
/** floor-restoration is the one service with a second, distinct frame — the method. */
const SERVICE_COLOR_MATCH_SECOND: Record<string, string> = {
  'floor-restoration': 'service-restoration-before-after',
};

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
  const bandObject = bandForPage(page);
  const faqs = faqsFor(page);
  const pillars = pillarsFor(page);
  const terms = termsFor(page);
  /* "When this is the wrong service" — Protocol v2 §15.2. Exclusions reduce
     bad leads and raise a model's trust in the inclusions. The list lives in
     lib/registry (one per service, editorial, no figures); the same rows are
     served by /api/v1/services/{id} so the page and the API cannot disagree. */
  const reg = await getRegistry();
  const wrongWhen = reg.services.find((sv) => sv.data.slug === page.slug)?.data.wrong_when ?? [];
  const useInstead = (ref: string): { href?: string; label: string } => {
    if (ref.startsWith('service:')) {
      const target = ref.slice('service:'.length);
      return { href: `/services/${target}`, label: SERVICES.find((sv) => sv.slug === target)?.name ?? target };
    }
    if (ref === 'price:screen-and-recoat') return { href: '/pricing#screen-and-recoat', label: 'a screen and recoat' };
    if (ref === 'unsupported') return { label: 'not something Ecowoods offers' };
    return { label: 'assessed on site during the estimate' };
  };

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
    areaServed: CITIES.map((c) => placeForArea(c)),
    url,
    /* GEO-003. This read the offer's currency as the literal 'CAD' twice and
       recovered minPrice and maxPrice by running a regular expression back over
       the formatted band — `band.match(/\$([\d.]+)/)` — which cannot tell one
       currency from another and silently yields 0 if the format ever changes.
       The band object carries all three facts; it is read directly. */
    ...(bandObject
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: bandObject.currency,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              priceCurrency: bandObject.currency,
              unitText: 'square foot',
              minPrice: bandObject.min,
              maxPrice: bandObject.max,
            },
            availability: 'https://schema.org/InStock',
            url: `${SITE_URL}/#quote`,
          },
        }
      : {}),
  };

  return (
    <div className="tlx-page">
      <ProofSliderForRoute route={`/services/${slug}`} />
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
      {slug === 'dust-free-sanding' &&
        videoObjectsFor(getFilm('the-how')!).map((v) => <SchemaScript key={v.contentUrl} schema={v} />)}

      <header className="tlx-hero" id="what">
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

      {/* THE ASK, ON THE PAGE THAT EARNED IT — F-160.
          This used to be a link to `/#quote`, which is a different url whose form
          only exists after React opens a modal. Zero `<form>` elements reached the
          served HTML of any page on this site. It is here now, above every
          explanatory section, because a buyer who has read the price and decided
          should not have to navigate to act on it. */}
      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <EstimateForm source={`service-${page.slug}`} heading="Get a fixed written price" intro="A senior estimator measures, then writes one price. It does not move afterwards." />
        </div>
      </section>

      {SERVICE_IMAGE[slug] && (
        <section className="tlx-section tlx-section--flush" aria-label={`${page.h1} illustrated`}>
          <div className="shell">
            <Illustration id={SERVICE_IMAGE[slug]} priority motion="kenburns" />
          {(SERVICE_PAIRS[slug] ?? []).map((p) => (
            <IllustrationPair key={p[0]} a={p[0]} b={p[1]} />
          ))}
          </div>
        </section>
      )}

      {SERVICE_COLOR_MATCH_HERO[slug] && (
        <section className="tlx-section" aria-label="Colour matching on this job type">
          <div className="shell">
            <p className="tlx-kicker">Colour matching</p>
            <h2 className="tlx-h2">What colour matching looks like on this work</h2>
            <ColorMatchFigure id={SERVICE_COLOR_MATCH_HERO[slug]} />
            {SERVICE_COLOR_MATCH_SECOND[slug] && <ColorMatchFigure id={SERVICE_COLOR_MATCH_SECOND[slug]} />}
            <p className="tlx-note">
              Read the full process at{' '}
              <Link href="/hardwood-color-matching-toronto">hardwood colour matching in Toronto</Link>.
            </p>
          </div>
        </section>
      )}

      {slug === 'dust-free-sanding' && (
        <section className="tlx-section" aria-label="Watch the containment">
          <div className="shell">
            <p className="tlx-kicker">What the shop does</p>
            <h2 className="tlx-h2">Dust-free, on film</h2>
            <FilmStage film={getFilm('the-how')!} defaultChapter={1} />
            <p className="tlx-note">
              Extraction runs at each machine and a sealed barrier is built at the room, which is
              what makes it possible to sand a floor in a house nobody has moved out of.
            </p>
          </div>
        </section>
      )}

      {slug === 'dust-free-sanding' && DUST_FREE_PROJECT && (
        <section className="tlx-section" aria-label="A dust-free job, photographed">
          <div className="shell">
            <p className="tlx-kicker">Photographed, not modelled</p>
            <h2 className="tlx-h2">The dust, and the finished floor it came from</h2>
            <div className="pj-strip">
              {DUST_FREE_STILL_IDS.map((id) => {
                const still = stillById(DUST_FREE_PROJECT, id);
                return still ? <KenBurnsStill key={id} still={still} sizes="(max-width: 767px) 90vw, 46vw" /> : null;
              })}
            </div>
            <div className="pj-details">
              {(DUST_FREE_PROJECT.details ?? [])
                .filter((d) => DUST_FREE_DETAIL_IDS.includes(d.id))
                .map((d) => (
                  <DetailPlate key={d.id} detail={d} />
                ))}
            </div>
            <p className="tlx-note pj-note">
              The kitchen floor sat dusty under the old finish, the cabinets arrived once it was
              refinished, and the boxes went in on a floor that was already done — the sequencing
              containment makes possible. Full chapters and the honest before/after pairs are on{' '}
              <Link href={`/projects/${DUST_FREE_PROJECT.slug}`}>the photo record</Link>.
            </p>
          </div>
        </section>
      )}

      {slug === 'stair-refinishing' && STAIR_PROJECT && (
        <section className="tlx-section" aria-label="A curved stair, photographed">
          <div className="shell">
            <p className="tlx-kicker">Photographed, not modelled</p>
            <h2 className="tlx-h2">A curved stair in Maple, Vaughan — sanded, then stained</h2>
            <div className="pj-strip">
              {STAIR_STILL_IDS.map((id) => {
                const still = stillById(STAIR_PROJECT, id);
                return still ? <KenBurnsStill key={id} still={still} sizes="(max-width: 767px) 90vw, 46vw" /> : null;
              })}
            </div>
            <p className="tlx-note pj-note">
              Same stair, same open well, shot twice: once sanded back to bare wood, once after
              stain and finish. No species, square footage or price is published with it — none
              were recorded with the photographs. Full chapters and the honest before/after pairs
              are on{' '}
              <Link href={`/projects/${STAIR_PROJECT.slug}`}>the photo record</Link>.
            </p>
          </div>
        </section>
      )}

      {slug === 'floor-refinishing' && REFINISH_PROJECT && (
        <section className="tlx-section" aria-label="A hallway and a sage room, refinished">
          <div className="shell">
            <p className="tlx-kicker">Photographed, not modelled</p>
            <h2 className="tlx-h2">A sunlit hallway and a sage-walled room — worn, then refinished</h2>
            <div className="pj-strip">
              {REFINISH_STILL_IDS.map((id) => {
                const still = stillById(REFINISH_PROJECT, id);
                return still ? <KenBurnsStill key={id} still={still} sizes="(max-width: 767px) 90vw, 46vw" /> : null;
              })}
            </div>
            <div className="pj-details">
              {(REFINISH_PROJECT.details ?? [])
                .filter((d) => REFINISH_DETAIL_IDS.includes(d.id))
                .map((d) => (
                  <DetailPlate key={d.id} detail={d} />
                ))}
            </div>
            <p className="tlx-note pj-note">
              Same window, same length of floor, in both the hallway and the room beside it — worn
              and hazed in one frame, refinished to one even surface in the next. These are
              editorial reconstructions of the original job-site frames, not a locked-tripod
              measurement record, and no species, square footage or price is published with them.
              Full chapters and the honest before/after pairs are on{' '}
              <Link href={`/projects/${REFINISH_PROJECT.slug}`}>the photo record</Link>.
            </p>
          </div>
        </section>
      )}

      {slug === 'hardwood-installation' && INSTALL_PROJECT && (
        <section className="tlx-section" aria-label="A hard-maple field, photographed">
          <div className="shell">
            <p className="tlx-kicker">Photographed, not modelled</p>
            <h2 className="tlx-h2">A continuous hard-maple floor, from suite to living room</h2>
            <div className="pj-strip">
              {INSTALL_STILL_IDS.map((id) => {
                const still = stillById(INSTALL_PROJECT, id);
                return still ? <KenBurnsStill key={id} still={still} sizes="(max-width: 767px) 90vw, 46vw" /> : null;
              })}
            </div>
            <div className="pj-details">
              {(INSTALL_PROJECT.details ?? [])
                .filter((d) => INSTALL_DETAIL_IDS.includes(d.id))
                .map((d) => (
                  <DetailPlate key={d.id} detail={d} />
                ))}
            </div>
            <p className="tlx-note pj-note">
              One species and one satin finish, carried from a primary suite through a living room
              on the same select hard-maple field. This page does not publish a square footage or a
              schedule for it — the source pack's own figures are context for the crew, not a
              measured takeoff. Full chapters, including the open-riser glass stair the same floor
              runs into, are on{' '}
              <Link href={`/projects/${INSTALL_PROJECT.slug}`}>the photo record</Link>.
            </p>
          </div>
        </section>
      )}

      {wrongWhen.length > 0 && (
        <section className="tlx-section" id="wrong-service" aria-label="When this is the wrong service">
          <div className="shell">
            <p className="tlx-kicker">Before you book</p>
            <h2 className="tlx-h2">When this is the wrong service</h2>
            <p className="tlx-note">
              A service page that only says yes is not much use. These are the situations where
              this is not the right call, and what is.
            </p>
            <dl className="gd-spec">
              {wrongWhen.map((w) => {
                const alt = useInstead(w.use_instead);
                return (
                  <div className="gd-spec-row" key={w.situation}>
                    <dt>{w.situation}</dt>
                    <dd>
                      Use instead: {alt.href ? <Link href={alt.href}>{alt.label}</Link> : alt.label}.
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>
      )}

      {!band && (
        <section className="tlx-section" id="price" aria-label="Price">
          <div className="shell">
            <p className="tlx-kicker">Published price</p>
            <h2 className="tlx-h2">Quoted per project</h2>
            <dl className="gd-spec">
              <div className="gd-spec-row">
                <dt>Band</dt>
                <dd>
                  No per-square-foot band is published for this service; it is quoted per project
                  after the free in-home measure. The three published bands are on{' '}
                  <Link href="/pricing">the pricing page</Link>.
                </dd>
              </div>
              <div className="gd-spec-row">
                <dt>How it is set</dt>
                <dd>{PRICE_PROMISE}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {band && (
        <section className="tlx-section" id="price" aria-label="Price">
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

      <section className="tlx-section" id="process" aria-label="The method">
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
        <section className="tlx-section" id="faq" aria-label="Questions">
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

      {/* Sibling services and the evidence, on every service page.
          `pnpm seo:density` found that this template reached zero other service
          pages and zero case studies — so a visitor who landed on the wrong one
          of the six had no path to the right one, and a visitor on the right one
          had no proof it had been done. Both are one component away and neither
          existed. */}
      {/* Named guide links, replacing six identical "Read the guide" anchors.
          Those anchors were real links that no static audit could resolve and
          that told a crawler nothing about where they went — six edges into six
          different documents, all labelled the same. Anchor text is one of the
          few signals a site controls completely; spending it on the word
          "guide" six times is spending it on nothing. */}
      {page.guides.length > 0 && (
        <section className="tlx-section" aria-label="Decide before you book">
          <div className="shell">
            <p className="tlx-kicker">The open questions behind this service</p>
            <h2 className="tlx-h2">What to settle first</h2>
            <p className="tlx-note">
              {page.guides.map((g, i) => {
                const guide = getGuide(g);
                if (!guide) return null;
                return (
                  <span key={g}>
                    {i > 0 && ' · '}
                    <Link href={`/guides/${g}`}>{guide.question}</Link>
                  </span>
                );
              })}
            </p>
            <p className="tlx-note">
              Each is published in full with the reasoning rather than a recommendation, free to
              apply to any contractor&rsquo;s quote — see also{' '}
              <Link href="/guides">all decision guides</Link> and{' '}
              <Link href="/framework">the standard they are judged against</Link>.
              {page.hub && (
                <>
                  {' '}This service leans on{' '}
                  <Link href={page.hub.href}>{page.hub.label}</Link>, published in full.
                </>
              )}
            </p>
          </div>
        </section>
      )}

      <section className="tlx-section" id="related" aria-label="The other services">
        <div className="shell">
          <p className="tlx-kicker">If this is not quite the job</p>
          <h2 className="tlx-h2">The other five</h2>
          <p className="tlx-note">
            {SERVICES.filter((sv) => sv.slug !== page.slug).map((sv, i) => (
              <span key={sv.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${sv.slug}`}>{sv.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            Not sure which one you need? If the floor is already cupping, gapping or lifting, the
            answer is a diagnosis rather than a service —{' '}
            <Link href="/hardwood-floor-problems-toronto">what your floor is telling you</Link>{' '}
            names each symptom, its cause and which of these it lands in. For a new floor, start at{' '}
            <Link href="/hardwood-flooring-toronto">hardwood flooring in Toronto</Link>; for an
            existing one,{' '}
            <Link href="/hardwood-floor-refinishing-toronto">refinishing</Link>.
          </p>
        </div>
      </section>

      {/* The jobs that ARE this service, with their readings. Renders nothing
          when no published case study is this service — an empty proof rail is
          worse than none, and a card invented to fill it is the thing this
          repository exists to prevent. */}
      <div id="evidence">
      <JobCardRail
        heading="This service, on finished jobs"
        intro="Each one is a published case study. The reading shown is the one the job turned on."
        jobs={jobCardsForService(page.slug)}
        from={`service-${page.slug}`}
      />

      <EvidenceRail
        heading="Jobs where this was the work"
        intro={
          'Published in full, with the readings taken before anything started. Not every job below ' +
          'is this exact service — they are the ones where this service decided the outcome.'
        }
        items={[
          { ...CASES.distillery, why: 'Over a concrete slab, where the moisture test decided the assembly before a species was chosen.' },
          { ...CASES.yorkville, why: 'Below grade at a critical moisture reading, and the mitigation that made the floor possible.' },
          { ...CASES.rosedale, why: 'Stairs and a main floor over radiant heat, finished to one colour across two assemblies.' },
        ]}
      />
      </div>

      <section className="tlx-section" aria-label="Coverage">
        <div className="shell">
          <p className="tlx-kicker">Coverage</p>
          <h2 className="tlx-h2">Where this service is delivered</h2>
          {/* Links, not a comma-separated string. Sixteen area names rendered as
              prose gave a reader nowhere to go and a crawler no edge to follow —
              the mirror image of the same omission on the city pages. See F-154. */}
          <p className="tlx-note">
            {SERVICE_AREAS.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ' · '}
                <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>
              </span>
            ))}
          </p>
          <p className="tlx-note">
            Every area above has its own page: the housing stock, the neighbourhoods
            and the constraint that is specific to it. See{' '}
            <Link href="/service-areas">all service areas</Link>.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="#estimate">
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
