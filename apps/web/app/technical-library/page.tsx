import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { buildWebPageSchema } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Technical Library | EcoWoods',
  description:
    'Engineering reference for hardwood flooring installation, finishing, and maintenance in Toronto and the GTA: moisture protocols, species science, and finish chemistry.',
  openGraph: {
    title: 'Technical Library — EcoWoods',
    description:
      'Deep-dive technical content on hardwood flooring installation, moisture management, species selection, and finishing chemistry.',
    type: 'website',
    url: 'https://ecowoods.ca/technical-library',
  },
};

const PILLARS = [
  {
    title: 'Moisture Management',
    body: "Testing protocols, acclimation timelines, subfloor preparation, and humidity control strategies specific to Toronto's seasonal climate.",
    points: ['ASTM moisture standards', 'Seasonal acclimation guides', 'EMC calculations'],
  },
  {
    title: 'Wood Science',
    body: 'Species profiles, tannin chemistry, Janka hardness comparisons, and material selection frameworks for Toronto projects.',
    points: ['Species profiles', 'Tannin risk assessment', 'Cost analysis'],
  },
  {
    title: 'Installation & Finishing',
    body: 'Dust-free techniques, polyurethane chemistry, finish selection, and quality control for residential and commercial projects.',
    points: ['HEPA extraction systems', 'Polyurethane chemistry', 'Application techniques'],
  },
];

export default async function TechnicalLibraryPage() {
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  const collectionSchema = buildWebPageSchema({
    title: 'Technical Library — EcoWoods',
    description:
      'Complete technical reference for hardwood flooring engineering, installation, and maintenance.',
    url: 'https://ecowoods.ca/technical-library',
    items: [
      ...articles.map((article) => ({
        '@type': 'TechArticle' as const,
        headline: article.title,
        url: `https://ecowoods.ca/blog/${article.slug}`,
        description: article.description,
        datePublished: article.publishedAt,
      })),
      ...caseStudies.map((caseStudy) => ({
        '@type': 'CaseStudy' as const,
        headline: caseStudy.title,
        url: `https://ecowoods.ca/case-studies/${caseStudy.slug}`,
        description: caseStudy.description,
        datePublished: caseStudy.publishedAt,
      })),
    ],
  });

  return (
    <div className="tlx-page">
      <SchemaScript schema={collectionSchema} />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Technical Library</span>
          </nav>
          <h1 className="tlx-title">Technical Library</h1>
          <p className="tlx-lede">
            The engineering reference behind our work: moisture protocols, wood science, and
            finishing chemistry for hardwood floors in Toronto and the GTA.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Core technical pillars">
        <div className="shell">
          <p className="tlx-kicker">Foundations</p>
          <h2 className="tlx-h2">Core technical pillars</h2>
          <div className="tlx-grid">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="tlx-pillar">
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
                <ul>
                  {pillar.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {articles.length > 0 && (
        <section className="tlx-section" aria-label="Technical articles">
          <div className="shell">
            <p className="tlx-kicker">Guides</p>
            <h2 className="tlx-h2">Technical articles</h2>
            <p className="tlx-note">
              In-depth guides covering installation protocols, material science, and decision
              frameworks.
            </p>
            <div className="tlx-grid">
              {articles.map((article) => (
                <Link key={article.slug} href={`/blog/${article.slug}`} className="tlx-card">
                  <span className="tlx-card-tag">
                    {article.category ? article.category.replace(/-/g, ' ') : 'Article'}
                  </span>
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                  <span className="tlx-card-data">
                    <span>{formatDate(article.publishedAt)}</span>
                    {article.readingTimeMinutes ? (
                      <span>{article.readingTimeMinutes} min read</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {caseStudies.length > 0 && (
        <section className="tlx-section" aria-label="Case studies">
          <div className="shell">
            <p className="tlx-kicker">Projects</p>
            <h2 className="tlx-h2">Case studies</h2>
            <p className="tlx-note">
              Project write-ups documenting installation protocols and problem-solving on Toronto
              homes.
            </p>
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
                    <span className="tlx-card-tag">Case study</span>
                    <h3>{caseStudy.title}</h3>
                    <p>{caseStudy.description}</p>
                    <span className="tlx-card-data">
                      <span>
                        {caseStudy.location.city}, {caseStudy.location.province}
                      </span>
                      <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
                      {species ? <span>{species}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="tlx-section" aria-label="Get an estimate">
        <div className="shell">
          <div className="tlx-cta">
            <h2>Ready to talk about your project?</h2>
            <p>Use this library as reference, then get a free in-home estimate.</p>
            <a href="/#quote" className="btn btn-copper">
              Get free estimate
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
