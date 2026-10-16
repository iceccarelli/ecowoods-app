import { describe, it, expect } from 'vitest';
import { serviceOpening, areaOpening, wordCount } from '@/lib/opening-answers';
import { SERVICE_PAGES } from '@/lib/service-pages';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

describe('service opening answers', () => {
  for (const page of SERVICE_PAGES) {
    it(`${page.slug}: 120–160 words with who, what, where, price and next step`, () => {
      const t = serviceOpening(page);
      const n = wordCount(t);
      expect(n, t).toBeGreaterThanOrEqual(120);
      expect(n, t).toBeLessThanOrEqual(160);
      expect(t).toContain(BUSINESS_NAP.legalName);
      expect(t).toContain(BUSINESS_NAP.region);
      expect(t).toContain(BUSINESS_NAP.phoneDisplay);
      expect(t).toMatch(/free (in-home )?(estimate|measure)/i);
      expect(t).not.toMatch(/undefined|NaN/);
    });
  }
});

describe('area opening answers', () => {
  it('every published area: 120–160 words, own name, phone, no undefined', () => {
    const bad: string[] = [];
    for (const c of SERVICE_AREAS) {
      const t = areaOpening(c);
      const n = wordCount(t);
      if (n < 120 || n > 160 || !t.includes(BUSINESS_NAP.phoneDisplay) || /undefined|NaN/.test(t)) bad.push(`${c.slug}:${n}`);
    }
    expect(bad).toEqual([]);
  });
  it('a New York page quotes US dollars and says where the shop is', () => {
    const us = SERVICE_AREAS.find((a) => a.slug === 'buffalo');
    if (!us) return;
    const t = areaOpening(us);
    expect(t).toMatch(/US dollars/);
    expect(t).toMatch(/shop is in Toronto/);
  });
});
