import type { Metadata } from 'next';
import Link from 'next/link';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Case Studies',
  alternates: { canonical: '/case-studies' },
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
          )}
        </div>
      </div>
    </div>
  );
}
