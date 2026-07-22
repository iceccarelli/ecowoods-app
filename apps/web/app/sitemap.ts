import type { MetadataRoute } from 'next';
import { SITE_URL, CITIES } from '@/lib/seo-data';

/**
 * Split sitemap. Next emits a <sitemapindex> at /sitemap.xml referencing
 * /sitemap/0.xml (core pages) and /sitemap/1.xml (service-area cities).
 * Scales cleanly as the URL footprint grows; robots.ts still points at
 * /sitemap.xml (now the index), so no change needed there.
 */
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }];
}

export default function sitemap({ id }: { id: number }): MetadataRoute.Sitemap {
  const now = new Date();

  if (id === 0) {
    return [
      { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
      { url: `${SITE_URL}/service-areas`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ];
  }

  // id === 1 — locations
  return CITIES.map((c) => ({
    url: `${SITE_URL}/service-areas/${c.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));
}
