import { SITE_URL, BUSINESS } from '@/lib/seo-data';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { getPapers } from '@/lib/papers';

export const dynamic = 'force-static';

/**
 * /feed.xml — RSS 2.0 over everything this site publishes.
 *
 * WHY THIS EXISTS
 *
 * The site publishes three kinds of dated material — articles, engineering case
 * studies and technical papers — and until now offered no way to subscribe to
 * any of them. A sitemap tells a crawler what exists; a feed tells it what
 * CHANGED, and it is the only surface a human aggregator, a newsletter tool or
 * a syndication partner can consume without scraping.
 *
 * The reference implementation for this is AWS's "What's New" feed: small dated
 * entries, one canonical URL each, published relentlessly. That feed is the
 * reason a large part of the industry finds out about AWS from AWS rather than
 * from a competitor's comparison page.
 *
 * DERIVED, NEVER TYPED. Every item here comes from a content loader or from
 * lib/papers.ts. There is no hand-maintained list, so a new article cannot be
 * missing from the feed and the feed cannot claim something that was never
 * published. Same rule as /llms.txt and the sitemap.
 *
 * Dates are the frontmatter `published-at` / `modified-at` values, which are
 * already ISO. RSS requires RFC 822, so they are converted, not reformatted by
 * hand.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rfc822 = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
};

type Item = { title: string; url: string; description: string; date: string; category: string };

export async function GET() {
  const [articles, caseStudies] = await Promise.all([getArticles(), getCaseStudies()]);

  const items: Item[] = [
    ...getPapers().map((p) => ({
      title: `${p.title} — ${p.subtitle}`,
      url: `${SITE_URL}/papers/${p.slug}`,
      description: p.abstract,
      date: p.publishedAt,
      category: 'Technical paper',
    })),
    ...articles.map((a) => ({
      title: a.title,
      url: `${SITE_URL}/blog/${a.slug}`,
      description: a.description,
      date: a.modifiedAt || a.publishedAt,
      category: 'Article',
    })),
    ...caseStudies.map((c) => ({
      title: c.title,
      url: `${SITE_URL}/case-studies/${c.slug}`,
      description: c.description,
      date: c.modifiedAt || c.publishedAt,
      category: 'Case study',
    })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const latest = items[0]?.date ?? new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(BUSINESS.name)} — Technical Publications</title>
    <link>${SITE_URL}</link>
    <description>Technical papers, engineering case studies and articles on hardwood flooring in ${esc(
      BUSINESS.region,
    )}: moisture control, substrate preparation, finish systems, refinishing sequence and dust containment.</description>
    <language>en-CA</language>
    <lastBuildDate>${rfc822(latest)}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${i.url}</link>
      <guid isPermaLink="true">${i.url}</guid>
      <description>${esc(i.description)}</description>
      <category>${esc(i.category)}</category>
      <pubDate>${rfc822(i.date)}</pubDate>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
