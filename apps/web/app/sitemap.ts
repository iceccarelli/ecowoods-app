import type { MetadataRoute } from 'next';
import { SITE_URL, CITIES } from '@/lib/seo-data';

/**
 * sitemap.xml — homepage + the /service-areas hub and every city landing page,
 * so crawlers discover the full local footprint, not just the root.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/service-areas`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...CITIES.map((c) => ({
      url: `${SITE_URL}/service-areas/${c.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
