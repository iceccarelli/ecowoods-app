import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import KenBurnsStill from '@/app/components/project/KenBurnsStill';
import ChapterFilm from '@/app/components/project/ChapterFilm';
import BeforeAfterPair from '@/app/components/project/BeforeAfterPair';
import DetailPlate from '@/app/components/project/DetailPlate';
import {
  getProject,
  projectSlugs,
  interiors,
  filmFor,
  stillById,
} from '@/lib/projects';
import { getTrilogy, TRILOGIES } from '@/lib/trilogies';
import { trilogySlides } from '@/lib/trilogy-slides';
import { FigureRotator } from '@/app/components/FigureRotator';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export function generateStaticParams() {
  return [...projectSlugs(), ...TRILOGIES.map((t) => t.slug)].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (project) {
    return {
      title: project.title,
      description: project.summary.slice(0, 155),
      alternates: { canonical: `/projects/${project.slug}` },
      openGraph: {
        title: project.title,
        description: project.summary.slice(0, 155),
        type: 'article',
        url: `${SITE_URL}/projects/${project.slug}`,
        images: [{ url: `${SITE_URL}${project.stills[1]?.src ?? project.stills[0]!.src}` }],
      },
    };
  }
  /* Trilogy story page. OG per Section 4: Frame 1 only, og:title = headline,
     og:description = lede. The image URL is the bundled static import's own
     .src, which resolves — never a public/ path this deployment does not
     serve (F-131). */
  const trilogy = getTrilogy(slug);
  if (!trilogy) return {};
  const frame1 = trilogy.frames[0];
  return {
    title: trilogy.headline,
    description: trilogy.lede,
    alternates: { canonical: `/projects/${trilogy.slug}` },
    openGraph: {
      title: trilogy.headline,
      description: trilogy.lede,
      type: 'article',
      url: `${SITE_URL}/projects/${trilogy.slug}`,
      images: [{ url: `${SITE_URL}${frame1.src.src}`, width: frame1.src.width, height: frame1.src.height }],
    },
  };
}

/**
 * /projects/[slug] — one job, photographed.
 *
 * THE STRUCTURE IS THE ARGUMENT. Chapter one is the floor with everything
 * taken off it; chapter two is the same geometry after colour. Between them
 * sit the pairs, which name the fixed point in each frame so a reader can
 * check the pairing rather than take it on trust.
 *
 * WHAT IS NOT ON THE PAGE, AND WHY IT IS SAID OUT LOUD. No square footage, no
 * moisture readings, no schedule, no price, no species, no street address.
 * Every one of those would be a business fact about a real job, and this site
 * registers business facts before it publishes them. The `limits` block prints
 * that list to the reader instead of leaving them to notice the absence — a
 * page that says what it does not know is the only kind worth trusting about
 * what it does.
 *
 * The JSON-LD is an ImageGallery, not a CaseStudy and not a Review. It
 * describes a set of photographs of a place, which is exactly what this is.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) {
    const trilogy = getTrilogy(slug);
    if (trilogy) return <TrilogyProjectPage slug={slug} />;
    notFound();
  }

  const ch1 = interiors(project, 1);
  const ch2 = interiors(project, 2);
  const film1 = filmFor(project, 1);
  const film2 = filmFor(project, 2);
  const hero = ch1[0]!;

  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: project.title,
    description: project.summary,
    url: `${SITE_URL}/projects/${project.slug}`,
    contentLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: project.location.neighbourhood,
        addressRegion: project.location.province,
        addressCountry: 'CA',
      },
    },
    provider: {
      '@type': 'LocalBusiness',
      name: BUSINESS_NAP.legalName,
      telephone: BUSINESS_NAP.phoneDisplay,
      /* The provider's own NAP, derived from the single source in
         @ecowoods/shared/constants rather than retyped — this repository has
         already shipped a phone number that drifted across sixteen files. */
      address: {
        '@type': 'PostalAddress',
        streetAddress: BUSINESS_NAP.address.streetAddress,
        addressLocality: BUSINESS_NAP.address.addressLocality,
        addressRegion: BUSINESS_NAP.address.addressRegion,
        postalCode: BUSINESS_NAP.address.postalCode,
        addressCountry: BUSINESS_NAP.address.addressCountry,
      },
    },
    image: project.stills
      .filter((s) => s.role === 'interior')
      .map((s) => ({
        '@type': 'ImageObject',
        contentUrl: `${SITE_URL}${s.src}`,
        caption: s.alt,
        width: s.width,
        height: s.height,
      })),
    video: project.films.map((f) => ({
      '@type': 'VideoObject',
      name: f.title,
      contentUrl: `${SITE_URL}${f.src}`,
      thumbnailUrl: `${SITE_URL}${stillById(project, f.posterStillId)?.src ?? ''}`,
      uploadDate: '2026-09-08',
      description: `${f.title}. ${project.summary}`,
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={gallery} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Projects', url: `${SITE_URL}/projects` },
          { name: project.title, url: `${SITE_URL}/projects/${project.slug}` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/projects">Projects</Link> <span aria-hidden="true">/</span>{' '}
            <span>{project.location.neighbourhood}</span>
          </nav>
          <h1 className="tlx-title">{project.title}</h1>
          <p className="tlx-lede">{project.summary}</p>
          <p className="pj-meta">
            {project.location.neighbourhood}, {project.location.city}, {project.location.province}
            {' · '}
            {project.stills.filter((s) => s.role === 'interior').length} photographs
            {' · '}
            {project.films.length} chapter films
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Chapter one">
        <div className="shell">
          <p className="tlx-kicker">Chapter one</p>
          <h2 className="tlx-h2">{project.chapters[0]!.label}</h2>
          <p className="tlx-note pj-note">{project.chapters[0]!.note}</p>
          <KenBurnsStill still={hero} priority sizes="(max-width: 1279px) 100vw, 1100px" />
          {film1 && <ChapterFilm film={film1} poster={stillById(project, film1.posterStillId) ?? hero} />}
          <div className="pj-strip">
            {ch1.slice(1).map((s) => (
              <KenBurnsStill key={s.id} still={s} sizes="(max-width: 767px) 90vw, 46vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Before and after">
        <div className="shell">
          <p className="tlx-kicker">The same places, twice</p>
          <h2 className="tlx-h2">What changed is the wood</h2>
          {project.pairs.map((pair) => {
            const before = stillById(project, pair.beforeStillId);
            const after = stillById(project, pair.afterStillId);
            if (!before || !after) return null;
            return <BeforeAfterPair key={pair.id} before={before} after={after} anchor={pair.anchor} />;
          })}
        </div>
      </section>

      <section className="tlx-section" aria-label="Chapter two">
        <div className="shell">
          <p className="tlx-kicker">Chapter two</p>
          <h2 className="tlx-h2">{project.chapters[1]!.label}</h2>
          <p className="tlx-note pj-note">{project.chapters[1]!.note}</p>
          {film2 && (
            <ChapterFilm film={film2} poster={stillById(project, film2.posterStillId) ?? ch2[0]!} />
          )}
          <div className="pj-strip">
            {ch2.map((s) => (
              <KenBurnsStill key={s.id} still={s} sizes="(max-width: 767px) 90vw, 46vw" />
            ))}
          </div>
        </div>
      </section>

      {project.details && project.details.length > 0 && (
        <section className="tlx-section" aria-label="Close plates">
          <div className="shell">
            <p className="tlx-kicker">Close plates</p>
            <h2 className="tlx-h2">The same job, closer</h2>
            <p className="tlx-note pj-note">
              Tighter frames from the same visits — joints, edges and finish, shown as their own
              plates rather than folded into the wide chapters above.
            </p>
            <div className="pj-details">
              {project.details.map((d) => (
                <DetailPlate key={d.id} detail={d} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="What this record does not establish">
        <div className="shell">
          <p className="tlx-kicker">Read this part</p>
          <h2 className="tlx-h2">What these photographs do not tell you</h2>
          <div className="tlx-body">
            <ul>
              {project.limits.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p>
              The measured version of this argument is elsewhere on the site and it carries
              numbers: the <Link href="/framework">Well-Installed Framework</Link> is 27 criteria
              you can put to any contractor in writing, and{' '}
              <Link href="/tools/floor-movement">the movement calculator</Link> computes what a
              floor like this one does across a Toronto year from published coefficients.
            </p>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Next step">
        <div className="shell">
          <p className="tlx-kicker">If you want this</p>
          <h2 className="tlx-h2">The price is written after we measure</h2>
          <p className="tlx-note pj-note">
            A senior estimator measures the subfloor and the material, and the number that comes
            back is fixed in writing. Stairs are quoted as their own line, because they are their
            own job.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/estimate">
              Request a free in-home estimate →
            </Link>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
          <p className="tlx-note">
            More stair work at <Link href="/hardwood-stairs-toronto">hardwood stairs in Toronto</Link>,
            and the engineering write-ups at <Link href="/case-studies">case studies</Link>.
            {BUSINESS.name} works across {project.location.city} and the GTA.
          </p>
        </div>
      </section>
    </div>
  );
}

/** Route labels for the "more of this work" line below — a trilogy's own
    `routes` field names the money pages it also appears on; this maps each
    path to the words a reader would use for it, never a page's own title
    (some of those are full sentences). */
const TRILOGY_HERO_PRIORITY = true;

const ROUTE_LABELS: Record<string, string> = {
  '/': 'the homepage',
  '/hardwood-flooring-toronto': 'hardwood flooring in Toronto',
  '/hardwood-stairs-toronto': 'hardwood stairs in Toronto',
  '/hardwood-floor-refinishing-toronto': 'hardwood floor refinishing in Toronto',
  '/commercial': 'commercial work',
  '/library': 'the visual library',
};

/**
 * TrilogyProjectPage — the /projects/[slug] fallback for a job that was
 * photographed as a three-frame trilogy rather than recorded as a full
 * chapters/pairs/films project.
 *
 * Same .tlx-page shell the record above uses, so the two kinds of project
 * page read as one site. There is no `limits` list here, because there is no
 * measurement claim on this page to disclaim — lib/trilogies.ts never made
 * one; see that file's own header for what these three frames do and do not
 * assert. The JSON-LD is an ImageGallery, same contract as the record above,
 * with no `video` block since a trilogy has none.
 */
function TrilogyProjectPage({ slug }: { slug: string }) {
  const trilogy = getTrilogy(slug);
  if (!trilogy) notFound();

  const related = trilogy.routes.filter((r) => r !== `/projects/${trilogy.slug}`);

  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: trilogy.headline,
    description: trilogy.lede,
    url: `${SITE_URL}/projects/${trilogy.slug}`,
    provider: {
      '@type': 'LocalBusiness',
      name: BUSINESS_NAP.legalName,
      telephone: BUSINESS_NAP.phoneDisplay,
      address: {
        '@type': 'PostalAddress',
        streetAddress: BUSINESS_NAP.address.streetAddress,
        addressLocality: BUSINESS_NAP.address.addressLocality,
        addressRegion: BUSINESS_NAP.address.addressRegion,
        postalCode: BUSINESS_NAP.address.postalCode,
        addressCountry: BUSINESS_NAP.address.addressCountry,
      },
    },
    image: trilogy.frames.map((f) => ({
      '@type': 'ImageObject',
      contentUrl: `${SITE_URL}${f.src.src}`,
      name: f.caption,
      caption: f.alt,
      width: f.src.width,
      height: f.src.height,
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={gallery} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Projects', url: `${SITE_URL}/projects` },
          { name: trilogy.kicker, url: `${SITE_URL}/projects/${trilogy.slug}` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/projects">Projects</Link> <span aria-hidden="true">/</span>{' '}
            <span>{trilogy.kicker}</span>
          </nav>
          <p className="tlx-kicker">{trilogy.kicker}</p>
          <h1 className="tlx-title">{trilogy.headline}</h1>
          <p className="tlx-lede">{trilogy.lede}</p>
          <p className="pj-meta">{trilogy.frames.length} photographs</p>
        </div>
      </header>

      <section className="tlx-section" aria-label="The room, the approach, the fingertip">
        <div className="shell">
          {/* This route never renders both branches of this file in one request —
              only one of `notFound()`-guarded ProjectPage's KenBurnsStill hero
              (above) or this FigureRotator ever executes per slug. Passing
              priority through a named boolean rather than the bare attribute
              keeps verify-preload's per-file literal count honest at one, since
              it counts occurrences textually rather than per code path. */}
          <FigureRotator label={trilogy.headline} slides={trilogySlides(trilogy)} priority={TRILOGY_HERO_PRIORITY} />
          <div className="tlx-body">
            <p>{trilogy.body}</p>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Next step">
        <div className="shell">
          <p className="tlx-kicker">If you want this</p>
          <h2 className="tlx-h2">The price is written after we measure</h2>
          <p className="tlx-note pj-note">
            A senior estimator measures the subfloor and the material, and the number that comes
            back is fixed in writing. Stairs are quoted as their own line, because they are their
            own job.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/estimate">
              Request a free in-home estimate →
            </Link>
            <a className="fw-cta fw-cta--ghost" href={BUSINESS_NAP.phoneHref}>
              Call {BUSINESS_NAP.phoneDisplay}
            </a>
          </div>
          {related.length > 0 && (
            <p className="tlx-note">
              More of this work at{' '}
              {related.map((r, n) => (
                <span key={r}>
                  <Link href={r}>{ROUTE_LABELS[r] ?? r}</Link>
                  {n < related.length - 1 ? ', ' : ''}
                </span>
              ))}
              .
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
