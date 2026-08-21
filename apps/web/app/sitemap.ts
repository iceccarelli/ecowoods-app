/**
 * Sitemap — dynamically generate sitemap.xml with all content pages.
 * Ensures blog articles, case studies, and key pages are discoverable by crawlers.
 */

import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { CITIES } from '@/lib/seo-data';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

/**
 * Regenerated daily. Every lastModified below that is `new Date()` is a claim
 * about freshness; baked once at build, that claim stops being true the moment
 * anything else on the site changes without a deploy.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all articles and case studies
  const articles = await getArticles();
  const caseStudies = await getCaseStudies();

  // Base pages (always included)
  const basePages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/design`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/technical-library`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/papers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/products/floorforge`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/case-studies`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/authority`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/framework`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/framework/assess`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/resources`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/market`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/whats-new`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/standards`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/data`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/glossary`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/guides`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/service-areas`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  /**
   * The 16 GTA service-area pages. These were missing entirely: the build
   * produces 66 routes and this sitemap declared 18 of them, omitting the whole
   * local-search surface — which for a Toronto trade business is the single
   * highest-intent set of pages on the site. Derived from CITIES so the sitemap
   * cannot drift from the routes generateStaticParams actually builds.
   * See audit/FINDINGS.md F-22.
   */
  const cityPages: MetadataRoute.Sitemap = CITIES.map((city) => ({
    url: `${SITE_URL}/service-areas/${city.slug}`,
    lastModified: new Date(),
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
    lastModified: new Date(),
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
    ...guidePages,
    ...glossaryPages,
    ...paperPages,
    ...cityPages,
    ...articlePages,
    ...caseStudyPages,
  ];
}
