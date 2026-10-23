import { describe, it, expect } from 'vitest';
import { SERVICE_AREAS, BUSINESS, areaDisplayName, cityContent } from '@/lib/seo-data';
import { areaDescription, splitSentences, AREA_DESCRIPTION_LIMIT } from '@/lib/area-description';
import { generateMetadata } from '@/app/service-areas/[city]/page';

const descriptions = SERVICE_AREAS.map((a) => ({ a, d: areaDescription(a) }));
const CTA = `Fixed written estimates. Call ${BUSINESS.phoneDisplay}.`;

describe('area meta descriptions', () => {
  it('splits sentences without breaking after abbreviations', () => {
    expect(splitSentences('Old Glenridge sits near St. Paul Street. Floors are oak.')).toEqual([
      'Old Glenridge sits near St. Paul Street.',
      'Floors are oak.',
    ]);
  });

  it('every description fits, ends with the call to action and is never cut with an ellipsis', () => {
    for (const { a, d } of descriptions) {
      expect(d.length, a.slug).toBeLessThanOrEqual(AREA_DESCRIPTION_LIMIT);
      expect(d.endsWith(CTA), a.slug).toBe(true);
      expect(d.includes('…'), a.slug).toBe(false);
    }
  });

  it('every description names its area, so no two areas share a snippet', () => {
    for (const { a, d } of descriptions) {
      expect(d.toLowerCase(), a.slug).toContain(areaDisplayName(a).split(',')[0].toLowerCase());
    }
    expect(new Set(descriptions.map((x) => x.d)).size).toBe(descriptions.length);
  });

  it('no area with local copy falls back to the generic head and tail', () => {
    for (const { a, d } of descriptions) {
      if (cityContent(a.slug)) expect(d, a.slug).not.toMatch(/^Dust-free hardwood refinishing and installation in [^.,]+\. Fixed/);
    }
  });

  it('generateMetadata serves the same string to the description and Open Graph', async () => {
    for (const a of SERVICE_AREAS.slice(0, 8)) {
      const m = await generateMetadata({ params: Promise.resolve({ city: a.slug }) });
      expect(m.description).toBe(areaDescription(a));
      expect(m.openGraph?.description).toBe(areaDescription(a));
    }
  });
});
