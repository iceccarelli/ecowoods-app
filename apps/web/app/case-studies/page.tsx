import type { Metadata } from 'next';
import { JobCardRail } from '@/app/components/JobCard';
import { JOB_CARDS } from '@/content/job-cards';
import Link from 'next/link';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { formatDate } from '@/lib/content/utils';
import { illustrationImage } from '@/app/data/illustration-images';

export const metadata: Metadata = {
  title: 'Case Studies',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    images: [{ url: illustrationImage('og-case-studies')?.src ?? '/illustrations/og-case-studies.webp', width: 1200, height: 630 }],
  },
  description:
    'Hardwood flooring project write-ups from Toronto and the GTA: moisture engineering, species selection, staircases, and radiant-heat installations.',
};

export default async function CaseStudiesPage() {
  const caseStudies = await getCaseStudies();

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <span>Case Studies</span>
          </nav>
          <h1 className="tlx-title">Case studies</h1>
          <p className="tlx-lede">
            Project write-ups documenting how we handle moisture, substrates, species, and
            finishes on Toronto homes.
          </p>
        </div>
      </header>

      <div className="tlx-section">
        <div className="shell">
          {caseStudies.length === 0 ? (
            <p className="tlx-note">No case studies published yet. Check back soon.</p>
          ) : (
            <>
              {/* At a glance, in the units the jobs were measured in. The cards
                  below carry the prose; this carries the numbers, and every one
                  of them is checked against the .mdx by verify-job-cards. */}
              <JobCardRail
                kicker="At a glance"
                heading="Every published job, with its readings"
                intro="Neighbourhood, size, substrate, species, and the measurement each job turned on."
                jobs={JOB_CARDS}
                from="case-studies-index"
              />

            <div className="tlx-grid">
              {caseStudies.map((caseStudy) => {
                const species = Array.isArray(caseStudy.woodSpecies)
                  ? caseStudy.woodSpecies.join(' · ')
                  : caseStudy.woodSpecies;
                return (
                  <Link
                    key={caseStudy.slug}
                    href={`/case-studies/${caseStudy.slug}`}
                    className="tlx-card"
                  >
                    <span className="tlx-card-tag">
                      {caseStudy.projectType ? caseStudy.projectType.replace(/-/g, ' ') : 'Project'}
                    </span>
                    <h2>{caseStudy.title}</h2>
                    <p>{caseStudy.description}</p>
                    <span className="tlx-card-data">
                      <span>
                        {caseStudy.location.city}, {caseStudy.location.province}
                      </span>
                      <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
                      {species ? <span>{species}</span> : null}
                      <span>{formatDate(caseStudy.publishedAt)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            </>
          )}

          {/* The photo records are the same work without the instruments. They
              are linked from here rather than mixed in above, because a case
              study on this site carries moisture readings and a project does
              not — and the difference is the whole reason both exist. */}
          <p className="tlx-note" style={{ marginTop: '2.5rem' }}>
            Looking for the pictures rather than the measurements?{' '}
            <Link href="/projects">Projects, photographed</Link> is completed work in chapters —
            the floor sanded to bare, then the same rooms after colour.
          </p>
        </div>
      </div>
    </div>
  );
}
