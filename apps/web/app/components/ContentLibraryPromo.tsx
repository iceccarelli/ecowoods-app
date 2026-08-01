/**
 * ContentLibraryPromo — compact homepage strip surfacing the technical
 * library, rendered BELOW pricing: it serves the researcher after the
 * price is on the table, never as a detour before the ask.
 * Server component; styled with site tokens (.tlx-card / .clp-more).
 */
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { formatDate } from '@/lib/content/utils';

export async function ContentLibraryPromo() {
  const articles = await getArticles();
  if (articles.length === 0) return null;

  const featured = articles.filter((a) => a.featured);
  const display = (featured.length > 0 ? featured : articles).slice(0, 2);

  return (
    <section className="section-tight paper-texture">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '640px' }}>
          <span className="eyebrow">Still researching?</span>
          <h2>
            The science behind <span className="serif-italic">the price.</span>
          </h2>
          <p>
            Moisture testing, finish chemistry, dust-free methodology — the technical standards
            the estimate is built on, documented from the job site.
          </p>
        </div>

        <div className="tlx-grid" style={{ marginTop: '2rem' }}>
          {display.map((article) => (
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
          ))}
        </div>

        <Link href="/technical-library" className="clp-more">
          Browse the full technical library <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
