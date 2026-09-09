import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import KenBurnsStill from '@/app/components/project/KenBurnsStill';
import ChapterFilm from '@/app/components/project/ChapterFilm';
import BeforeAfterPair from '@/app/components/project/BeforeAfterPair';
import {
  getProject,
  projectSlugs,
  interiors,
  filmFor,
  stillById,
} from '@/lib/projects';
import { SITE_URL, BUSINESS } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export function generateStaticParams() {
  return projectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
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
  if (!project) notFound();

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
