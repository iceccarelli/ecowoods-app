/**
 * Sitemap — dynamically generate sitemap.xml with all content pages.
 * Ensures blog articles, case studies, and key pages are discoverable by crawlers.
 */

import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

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
      url: `${SITE_URL}/technical-library`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.95,
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
  ];

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

  return [...basePages, ...articlePages, ...caseStudyPages];
}
