/**
 * lib/floor-studio/region.test.ts — GC-026, and the rule it broke.
 *
 * GEO-004 set the rule the rest of this site holds: a New York surface shows no
 * Canadian figure and an Ontario surface shows no United States one.
 * `verify-geo` enforces it on every page that NAMES a market. The studio names
 * none, so the rule never reached it — and the header and footer link the
 * studio from all 26 New York markets, every one of them priced in Canadian
 * dollars.
 *
 * These are the assertions that make the rule reach it.
 */
import { describe, expect, it } from 'vitest';
import {
  NEW_INSTALL,
  US_NEW_INSTALL,
  bandForWork,
  type PriceCountry,
} from '@/content/constants/pricing';
import { DEFAULT_CONFIGURATION, priceConfiguration } from './catalog';
import { matchFloors } from './match';
import {
  STUDIO_COUNTRIES,
  countryOf,
  decodeStudioDesign,
  emptyStudioDesign,
  encodeStudioDesign,
  estimateHref,
  studioLeadNote,
  type StudioDesign,
} from './studio-config';

const design = (country: PriceCountry): StudioDesign => ({
  ...emptyStudioDesign(new Date('2026-01-01T00:00:00Z'), country),
  squareFeet: 900,
});

describe('the money follows the band', () => {
  it('an Ontario design is in CAD and a New York one is in USD', () => {
    expect(priceConfiguration(DEFAULT_CONFIGURATION, 900, 'CA').currency).toBe('CAD');
    expect(priceConfiguration(DEFAULT_CONFIGURATION, 900, 'US').currency).toBe('USD');
  });

  it('the default is the home country, so every caller from before GEO-006 is unchanged', () => {
    expect(priceConfiguration(DEFAULT_CONFIGURATION, 900).currency).toBe('CAD');
    expect(bandForWork('installation').currency).toBe('CAD');
  });

  it('the figures come from the country’s own published band, not a conversion', () => {
    /* The failure this prevents: a rate multiplied by an exchange rate nobody
       published. Both band sets are written down, and the arithmetic is the
       band times the area — GEO-005. */
    const ca = priceConfiguration(DEFAULT_CONFIGURATION, 1000, 'CA');
    const us = priceConfiguration(DEFAULT_CONFIGURATION, 1000, 'US');
    expect(ca.perSqftLowCad).toBe(NEW_INSTALL.min);
    expect(ca.perSqftHighCad).toBe(NEW_INSTALL.max);
    expect(us.perSqftLowCad).toBe(US_NEW_INSTALL.min);
    expect(us.perSqftHighCad).toBe(US_NEW_INSTALL.max);
  });

  it('a New York design never carries a Canadian figure', () => {
    const us = priceConfiguration(DEFAULT_CONFIGURATION, 900, 'US');
    const ca = priceConfiguration(DEFAULT_CONFIGURATION, 900, 'CA');
    expect(us.estimatedLowCad).not.toBe(ca.estimatedLowCad);
    expect(us.estimatedHighCad).not.toBe(ca.estimatedHighCad);
  });
});

describe('the recommendations are ranked against the right prices', () => {
  it('a New York visitor is matched on New York money', () => {
    const input = { feels: [], squareFeet: 900 } as const;
    const ca = matchFloors({ ...input, country: 'CA' });
    const us = matchFloors({ ...input, country: 'US' });
    expect(ca[0]!.estimate.currency).toBe('CAD');
    expect(us[0]!.estimate.currency).toBe('USD');
  });

  it('omitting the country still means Ontario', () => {
    expect(matchFloors({ feels: [], squareFeet: 900 })[0]!.estimate.currency).toBe('CAD');
  });
});

describe('the region travels', () => {
  it('a share link opens in the currency it was built in', () => {
    const us = design('US');
    const back = decodeStudioDesign(encodeStudioDesign(us));
    expect(back?.country).toBe('US');
    expect(priceConfiguration(back!.config, back!.squareFeet, back!.country).currency).toBe('USD');
  });

  it('an Ontario link stays exactly as short as it was before GEO-006', () => {
    /* The home country is the absence of a parameter, so no existing shared
       link changes meaning and none of them grew. */
    expect(encodeStudioDesign(design('CA'))).not.toContain('n=');
    expect(encodeStudioDesign(design('US'))).toContain('n=US');
  });

  it('a link with no region, or a broken one, opens on the home country', () => {
    expect(countryOf(null)).toBe('CA');
    expect(countryOf('')).toBe('CA');
    expect(countryOf('nonsense')).toBe('CA');
    expect(countryOf('US')).toBe('US');
    expect(countryOf('us')).toBe('US');
  });

  it('the estimating desk is told which band set produced the figure', () => {
    /* Without this the fixed price gets written against the wrong band, which
       is the same defect one step further down the funnel. */
    expect(estimateHref(design('US'))).toContain('region=US');
    expect(estimateHref(design('CA'))).toContain('region=CA');
  });

  it('the lead note says the currency in words, not just a symbol', () => {
    const note = studioLeadNote(design('US'));
    expect(note).toMatch(/United States bands/);
    expect(note).toContain('USD');
    expect(studioLeadNote(design('CA'))).toMatch(/Ontario bands/);
  });
});

describe('what the visitor is shown about it', () => {
  it('both regions are offered, and each says where it applies', () => {
    expect(STUDIO_COUNTRIES.map((c) => c.id)).toEqual(['CA', 'US']);
    for (const c of STUDIO_COUNTRIES) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.where.length).toBeGreaterThan(20);
    }
  });

  it('the New York option names New York places and the Ontario one names Ontario places', () => {
    const us = STUDIO_COUNTRIES.find((c) => c.id === 'US')!;
    const ca = STUDIO_COUNTRIES.find((c) => c.id === 'CA')!;
    expect(us.where).toMatch(/Buffalo|Rochester|Erie|Niagara County/);
    expect(ca.where).toMatch(/Toronto|GTA/);
  });
});
