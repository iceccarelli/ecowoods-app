import type { Metadata } from 'next';
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { formatDate } from '@/lib/content/utils';

export const metadata: Metadata = {
  title: 'Technical Articles',
  alternates: { canonical: '/blog' },
  description:
    'Technical articles on hardwood flooring: moisture testing, species selection, dust-free sanding, and finish chemistry for Toronto and the GTA.',
};

export default async function BlogPage() {
  const articles = await getArticles();
  const featured = articles.filter((a) => a.featured);
  const rest = articles.filter((a) => !a.featured);

  const renderCard = (article: (typeof articles)[number]) => (
    <Link key={article.slug} href={`/blog/${article.slug}`} className="tlx-card">
      <span className="tlx-card-tag">
        {article.category ? article.category.replace(/-/g, ' ') : 'Article'}
      </span>
      <h3>{article.title}</h3>
      <p>{article.description}</p>
      <span className="tlx-card-data">
        <span>{formatDate(article.publishedAt)}</span>
        {article.readingTimeMinutes ? <span>{article.readingTimeMinutes} min read</span> : null}
      </span>
    </Link>
  );

  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/technical-library">Technical Library</Link>
            <span aria-hidden>/</span>
            <span>Articles</span>
          </nav>
          <h1 className="tlx-title">Technical articles</h1>
          <p className="tlx-lede">
            The science behind the craft: moisture, species, sanding, and finish chemistry —
            written from the standards we hold on real job sites.
          </p>
        </div>
      </header>

      <div className="tlx-section">
        <div className="shell">
          {articles.length === 0 ? (
            <p className="tlx-note">No articles published yet. Check back soon.</p>
          ) : (
            <>
              {featured.length > 0 && (
                <>
                  <p className="tlx-kicker">Start here</p>
                  <h2 className="tlx-h2">Featured</h2>
                  <div className="tlx-grid" style={{ marginBottom: '2.5rem' }}>
                    {featured.map(renderCard)}
                  </div>
                </>
              )}
              {rest.length > 0 && (
                <>
                  <p className="tlx-kicker">All guides</p>
                  <h2 className="tlx-h2">Latest articles</h2>
                  <div className="tlx-grid">{rest.map(renderCard)}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
