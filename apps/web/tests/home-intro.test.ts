import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { HomeIntro } from '@/app/components/HomeIntro';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { PRICING } from '@/lib/pricing';

describe('homepage opening answer', () => {
  const text = renderToStaticMarkup(createElement(HomeIntro)).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  it('states who, what, where and the next step from the registries', () => {
    expect(text).toContain(BUSINESS_NAP.legalName);
    expect(text).toContain(BUSINESS_NAP.region);
    expect(text).toContain(BUSINESS_NAP.phoneDisplay);
    expect(text).toMatch(/request a free estimate/i);
    expect(text).toMatch(/hardwood floors and stairs/);
  });

  it('prices are the canonical bands', () => {
    for (const k of Object.keys(PRICING) as (keyof typeof PRICING)[]) {
      expect(text).toContain(`$${PRICING[k].min.toFixed(2)}–$${PRICING[k].max.toFixed(2)}`);
    }
  });

  it('is a speakable length (60–120 words) so the hero plus this stays inside 160', () => {
    const n = text.trim().split(' ').length;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(120);
  });
});
