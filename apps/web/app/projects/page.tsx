import type { Metadata } from 'next';
import Link from 'next/link';
import { StoryboardHover } from '@/app/components/motion';
import { PROJECTS, interiors, storyboardFramesFor } from '@/lib/projects';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Projects — photographed',
  description:
    'Jobs Ecowoods has done, photographed in chapters. Photographic records rather than engineering case studies: no invented measurements, no street addresses, and nothing the camera did not see.',
  alternates: { canonical: '/projects' },
  openGraph: {
    title: 'Projects — photographed',
    description: 'Jobs photographed in chapters. What the camera saw, and nothing else.',
    type: 'website',
    url: `${SITE_URL}/projects`,
  },
};

/**
 * /projects — the index.
 *
 * Deliberately separate from /case-studies. A case study on this site carries
 * substrate type, moisture readings, install days and cure days, and is
 * written to be cited. A project is a set of photographs. Mixing them would
 * either dilute the case studies into galleries or push galleries into a
 * schema that demands measurements nobody took — and the second of those is
 * how five fabricated case studies got published here once already.
 */
export default function ProjectsIndex() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Projects', url: `${SITE_URL}/projects` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Projects</span>
          </nav>
          <h1 className="tlx-title">Projects, photographed</h1>
          <p className="tlx-lede">
            Jobs in chapters: the floor with everything taken off it, then the same rooms after
            colour. These are photographic records, not engineering case studies — they publish
            what the camera saw and nothing that was not measured.
          </p>
          <p className="fw-privacy">
            The measured write-ups, with moisture readings and substrate detail, are the{' '}
            <Link href="/case-studies">case studies</Link>. The standard any of it should be judged
            against is the <Link href="/framework">Well-Installed Framework</Link>.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="All projects">
        <div className="shell">
          <div className="pj-index">
            {PROJECTS.map((p) => {
              const cover = interiors(p, 2)[0] ?? interiors(p)[0]!;
              const frames = storyboardFramesFor(p, cover);
              return (
                <article key={p.slug} className="pj-card">
                  <Link href={`/projects/${p.slug}`} className="pj-card-link">
                    <div className="pj-plate" style={{ aspectRatio: `${cover.width} / ${cover.height}` }}>
                      <StoryboardHover frames={frames} sizes="(max-width: 767px) 92vw, 46vw" />
                    </div>
                    <h2 className="pj-card-title">{p.title}</h2>
                  </Link>
                  <p className="tlx-note pj-note">
                    {p.location.neighbourhood}, {p.location.city} ·{' '}
                    {p.stills.filter((s) => s.role === 'interior').length} photographs ·{' '}
                    {p.films.length} chapter films
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
