/**
 * Sitemap — dynamically generate sitemap.xml with all content pages.
 * Ensures blog articles, case studies, and key pages are discoverable by crawlers.
 */

import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { CHANGELOG } from '@/lib/changelog';
import { getServicePages } from '@/lib/service-pages';
import { ILLUSTRATION_IMAGES } from '@/app/data/illustration-images';
import { EW_LOGO, EW_MARK, EW_LOGO_PORTRAIT } from '@/lib/brand';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export const revalidate = 86400;

/**
 * LASTMOD IS A CLAIM, AND IT WAS FALSE ON 72 OF 101 URLS.
 *
 * Every base page here used to carry `lastModified: new Date()`. This file
 * revalidates daily, so each of those URLs told every crawler it had changed
 * today — again tomorrow, and the day after, forever, whether or not a single
 * byte moved. Google's documented response to a lastmod it cannot trust is to
 * stop reading lastmod for the whole site. The one signal that says "this page
 * is worth fetching again" was being spent on 72 pages that had not changed,
 * and was therefore worth nothing on the ones that had.
 *
 * So a date goes in only when something dated actually backs it:
 *
 *   · a paper, guide, article or case study        → its own publish date
 *   · a page whose content is the changelog        → the newest entry for it
 *   · /market                                      → genuinely now; the Bank of
 *                                                    Canada numbers are refetched
 *                                                    hourly and the page changes
 *                                                    without a deploy
 *
 * and where nothing dated backs it — /design, /service-areas, a glossary term —
 * the field is OMITTED. `lastModified` is optional in the protocol. "I don't
 * know" is a legitimate answer and costs nothing. Inventing a date costs the
 * credibility of every other date in the file.
 *
 * scripts/verify-sitemap.mjs fails the build if `new Date()` appears here
 * outside the LIVE set below.
 */

/** Routes whose content really does change without a deploy. */
const LIVE = new Set(['/market']);

/**
 * IMAGES, DECLARED WHERE THEY APPEAR.
 *
 * F-168. Nothing on this site told Google an image existed. Google's own
 * documentation says an image sitemap is for "telling Google about other images
 * on your site, especially those that we might not otherwise find (such as
 * images your site reaches with JavaScript code)" — which describes every
 * diagram here, all of them rendered through next/image into hashed
 * /_next/static/media/ URLs that appear in no crawlable list anywhere.
 *
 * Twenty-eight technical cross-sections, drawn for this site, published under
 * CC BY, and not one of them was discoverable as an image.
 *
 * Next emits <image:image><image:loc> for the `images` field. Only <image:image>
 * and <image:loc> are used: Google removed support for <image:caption>,
 * <image:title>, <image:geo_location> and <image:license>, so anything else
 * here would be ignored markup pretending to be data.
 *
 * The URLs are derived from the same static imports the pages render, so a
 * sitemap entry cannot point at an image the page does not actually show.
 */
const abs = (u: string) => (u.startsWith('http') ? u : `${SITE_URL}${u}`);

/** Every technical diagram, as absolute URLs. */
const illustrationUrls = (): string[] =>
  Object.values(ILLUSTRATION_IMAGES).map((i) => abs(i.src));

/** The brand marks — the images a search engine needs to attach to the entity. */
const brandUrls = (): string[] => [EW_LOGO, EW_MARK, EW_LOGO_PORTRAIT].map(abs);

/** Newest changelog entry whose href is, or sits under, this route. */
const changelogDate = (route: string): Date | undefined => {
  const hit = CHANGELOG.filter(
    (e) => e.href === route || e.href.startsWith(`${route}/`),
  ).map((e) => e.date).sort().pop();
  return hit ? new Date(`${hit}T00:00:00Z`) : undefined;
};

/** Newest of a set of ISO dates, or undefined when the set is empty. */
const newest = (dates: string[]): Date | undefined => {
  const d = [...dates].filter(Boolean).sort().pop();
  return d ? new Date(d) : undefined;
};

/**
 * Drops `lastModified` when there is no date rather than defaulting it to now.
 * Written as a helper so the omission is one decision made once, not nineteen
 * places where someone can quietly type `new Date()` again.
 */
const entry = (
  route: string,
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  priority: number,
  lastModified?: Date,
  images?: string[],
): MetadataRoute.Sitemap[number] => ({
  url: route === '/' ? SITE_URL : `${SITE_URL}${route}`,
  ...(images && images.length ? { images } : {}),
  ...(LIVE.has(route)
    ? { lastModified: new Date() }
    : lastModified
      ? { lastModified }
      : {}),
  changeFrequency,
  priority,
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all articles and case studies
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  /**
   * Base pages. The date beside each one names the thing that dates it; where
   * the comment says "no date", the field is genuinely absent from the XML.
   */
  const newestPaper = newest(getPapers().map((x) => x.publishedAt));
  const newestGuide = newest(getGuides().map((x) => x.publishedAt));
  const newestArticle = newest(articles.map((x) => x.modifiedAt || x.publishedAt));
  const newestCase = newest(caseStudies.map((x) => x.modifiedAt || x.publishedAt));
  const newestChange = newest(CHANGELOG.map((e) => `${e.date}T00:00:00Z`));

  const basePages: MetadataRoute.Sitemap = [
    entry('/', 'weekly', 1.0, newestChange, brandUrls()),         // newest publication
    entry('/design', 'monthly', 0.85),                             // no date
    entry('/technical-library', 'weekly', 0.95, newest([
      ...articles.map((x) => x.modifiedAt || x.publishedAt),
      ...caseStudies.map((x) => x.modifiedAt || x.publishedAt),
      ...getPapers().map((x) => x.publishedAt),
    ].filter(Boolean) as string[])),                               // what it indexes
    entry('/papers', 'monthly', 0.9, newestPaper),
    entry('/products/floorforge', 'monthly', 0.8),                 // no date
    entry('/blog', 'weekly', 0.9, newestArticle),
    entry('/case-studies', 'weekly', 0.9, newestCase),
    entry('/about', 'monthly', 0.9),                              // no date
    entry('/authority', 'monthly', 0.7),                           // no date
    entry('/framework', 'monthly', 0.95, changelogDate('/framework'), illustrationUrls()),
    entry('/framework/assess', 'monthly', 0.9, changelogDate('/framework')),
    entry('/resources', 'weekly', 0.95, newestChange),             // it lists the publications
    entry('/market', 'daily', 0.85),                               // LIVE — set above
    entry('/whats-new', 'weekly', 0.9, newestChange),              // it IS the changelog
    entry('/standards', 'monthly', 0.85, changelogDate('/standards')),
    entry('/library', 'monthly', 0.8, changelogDate('/library'), [
      ...illustrationUrls(),
      ...brandUrls(),
    ]),
    entry('/data', 'monthly', 0.85, changelogDate('/data')),
    entry('/glossary', 'weekly', 0.9, changelogDate('/glossary')),
    entry('/guides', 'weekly', 0.9, newestGuide),
    entry('/services', 'monthly', 0.95),                           // no date
    entry('/service-areas', 'monthly', 0.9),                       // no date
  ];

  /**
   * The 16 GTA service-area pages. These were missing entirely: the build
   * produces 66 routes and this sitemap declared 18 of them, omitting the whole
   * local-search surface — which for a Toronto trade business is the single
   * highest-intent set of pages on the site. Derived from CITIES so the sitemap
   * cannot drift from the routes generateStaticParams actually builds.
   * See audit/FINDINGS.md F-22.
   */
  /**
   * One URL per service. Derived from SERVICE_PAGES so the sitemap cannot drift
   * from what generateStaticParams builds — and, more importantly, from the
   * `@id` the LocalBusiness graph emits for each Service. Those two were out of
   * step for the life of the project: six identifiers pointing at 404s. See F-146.
   *
   * No date: a service page changes when its price band or its linked papers
   * change, and nothing records when that last happened. Omitted rather than
   * stamped, like every other undated route here.
   */
  const servicePages: MetadataRoute.Sitemap = getServicePages().map((sp) => ({
    url: `${SITE_URL}/services/${sp.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  const cityPages: MetadataRoute.Sitemap = SERVICE_AREAS.map((city) => ({
    url: `${SITE_URL}/service-areas/${city.slug}`,
    // No date. A city page is generated from CITIES and changes when the
    // template changes, which nothing here records. Omitted rather than
    // stamped with the build time — see the note at the top of this file.
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }));

  // Article pages
  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/blog/${article.slug}`,
    lastModified: new Date(article.modifiedAt || article.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Case study pages
  const caseStudyPages: MetadataRoute.Sitemap = caseStudies.map((caseStudy) => ({
    url: `${SITE_URL}/case-studies/${caseStudy.slug}`,
    lastModified: new Date(caseStudy.modifiedAt || caseStudy.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  /**
   * Decision guides and reference installations. Derived from lib/guides.ts so
   * the sitemap cannot drift from what generateStaticParams actually builds —
   * the same rule the city pages and the papers already follow.
   */
  const guidePages: MetadataRoute.Sitemap = getGuides().map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: new Date(guide.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }));

  /**
   * One URL per glossary term. Derived from lib/glossary.ts, like every other
   * generated set here — a term that exists but is not in the sitemap is a term
   * an answer engine has to find by luck.
   */
  const glossaryPages: MetadataRoute.Sitemap = getTerms().map((term) => ({
    url: `${SITE_URL}/glossary/${term.slug}`,
    // No date. Terms carry no publish or revision field. Adding one to
    // lib/glossary.ts would make a real date available here; until then this
    // says nothing rather than saying something false.
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const paperPages: MetadataRoute.Sitemap = getPapers().map((paper) => ({
    url: `${SITE_URL}/papers/${paper.slug}`,
    lastModified: new Date(paper.publishedAt),
    changeFrequency: 'yearly' as const,
    priority: 0.85,
  }));

  return [
    ...basePages,
    ...servicePages,
    ...guidePages,
    ...glossaryPages,
    ...paperPages,
    ...cityPages,
    ...articlePages,
    ...caseStudyPages,
  ];
}
