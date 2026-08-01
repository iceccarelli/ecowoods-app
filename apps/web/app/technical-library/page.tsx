import { Metadata } from 'next';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { buildWebPageSchema } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Technical Library | EcoWoods',
  description:
    'Complete engineering reference for hardwood flooring installation, finishing, and maintenance. Comprehensive guides, case studies, and decision frameworks from Toronto\'s leading hardwood authority.',
  openGraph: {
    title: 'Technical Library — EcoWoods Engineering',
    description:
      'Deep-dive technical content on hardwood flooring installation, moisture management, species selection, and finishing chemistry.',
    type: 'website',
    url: 'https://ecowoods.ca/technical-library',
  },
};

export default async function TechnicalLibraryPage() {
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  // Build schema for the collection page
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
    <>
      <SchemaScript schema={collectionSchema} />

      {/* Hero Section */}
      <section className="section-hero" style={{ paddingBottom: '3rem' }}>
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-headline">Technical Library</h1>
            <p className="hero-subheading">
              Complete engineering reference for hardwood flooring installation, finishing, and maintenance in the Greater Toronto Area.
            </p>
            <p className="hero-description">
              Comprehensive guides, case studies, and decision frameworks from Toronto's leading hardwood authority. Learn the science behind the craft.
            </p>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="section-pillars" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '2rem', paddingBottom: '2rem' }}>
        <div className="container">
          <h2 style={{ marginBottom: '2rem', fontSize: 'var(--fs-lg)' }}>Core Technical Pillars</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Pillar 1: Moisture & Substrate */}
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '0.75rem' }}>Moisture Management</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                Testing protocols, acclimation timelines, subfloor preparation, and humidity control strategies specific to Toronto's seasonal climate.
              </p>
              <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', listStyle: 'none', paddingLeft: 0 }}>
                <li>✓ ASTM moisture standards</li>
                <li>✓ Seasonal acclimation guides</li>
                <li>✓ EMC calculations</li>
              </ul>
            </div>

            {/* Pillar 2: Wood Chemistry & Species */}
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '0.75rem' }}>Wood Science</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                Species profiles, tannin chemistry, Janka hardness comparisons, and material selection frameworks for Toronto projects.
              </p>
              <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', listStyle: 'none', paddingLeft: 0 }}>
                <li>✓ 12+ species profiles</li>
                <li>✓ Tannin risk assessment</li>
                <li>✓ Cost analysis</li>
              </ul>
            </div>

            {/* Pillar 3: Installation & Finishing */}
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '0.75rem' }}>Installation & Finishing</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                Dust-free techniques, polyurethane chemistry, finish selection, and quality control procedures for residential and commercial projects.
              </p>
              <ul style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', listStyle: 'none', paddingLeft: 0 }}>
                <li>✓ HEPA extraction systems</li>
                <li>✓ Polyurethane chemistry</li>
                <li>✓ Application techniques</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      <section className="section-articles" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="container">
          <h2 style={{ marginBottom: '2rem', fontSize: 'var(--fs-lg)' }}>Technical Articles ({articles.length})</h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '2rem' }}>
            In-depth guides covering installation protocols, material science, and decision frameworks.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
            {articles.map((article) => (
              <article
                key={article.slug}
                style={{
                  padding: '1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '0.75rem' }}>
                  <a href={`/blog/${article.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {article.title}
                  </a>
                </h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem', flex: 1, lineHeight: 1.6 }}>
                  {article.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
                  <span>{article.readingTimeMinutes} min read</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <a href={`/blog/${article.slug}`} style={{ marginTop: '1rem', color: 'var(--accent)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                  Read article →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Case Studies */}
      <section className="section-case-studies" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="container">
          <h2 style={{ marginBottom: '2rem', fontSize: 'var(--fs-lg)' }}>Engineering Case Studies ({caseStudies.length})</h2>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '2rem' }}>
            Real projects demonstrating installation protocols, problem-solving, and proprietary measurement data from Toronto homes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
            {caseStudies.map((caseStudy) => (
              <article
                key={caseStudy.slug}
                style={{
                  padding: '1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '0.75rem' }}>
                  <a href={`/case-studies/${caseStudy.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {caseStudy.title}
                  </a>
                </h3>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                  {caseStudy.location.city}, ON • {caseStudy.squareFootage?.toLocaleString()} sqft
                </p>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem', flex: 1, lineHeight: 1.6 }}>
                  {caseStudy.description}
                </p>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginBottom: '1rem' }}>
                  <strong>Species:</strong> {caseStudy.woodSpecies || 'N/A'} • <strong>Type:</strong> {caseStudy.projectType}
                </p>
                <a href={`/case-studies/${caseStudy.slug}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                  View case study →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How to Use This Library */}
      <section className="section-guide" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="container">
          <h2 style={{ marginBottom: '2rem', fontSize: 'var(--fs-lg)' }}>How to Use This Library</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '1rem' }}>For Contractors & Installers</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.6 }}>
                Use these guides for installation training, specification development, and problem-solving. Each article includes decision frameworks and real-world failure modes.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '1rem' }}>For Designers & Architects</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.6 }}>
                Reference material selection frameworks, cost analysis, and aesthetic guidance. Understand material limitations and optimal conditions for each species.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: '1rem' }}>For Homeowners</h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.6 }}>
                Learn why EcoWoods recommends specific approaches. Understand moisture management, acclimation timing, and finishing maintenance for your home.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '3rem', paddingBottom: '3rem', marginTop: '3rem' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', marginBottom: '1rem' }}>Ready to Talk About Your Project?</h2>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--muted)', marginBottom: '2rem' }}>
            Use this technical library as reference, then contact us for a free consultation.
          </p>
          <a href="/#quote" className="btn btn-copper">
            Get Free Estimate
          </a>
        </div>
      </section>
    </>
  );
}
