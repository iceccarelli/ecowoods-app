/**
 * spec-export.test.ts — SALE-02.
 *
 * The brief's SPECIFICATION EXPORT: a document carrying the selected floor,
 * species, finish, pattern, width, area, estimated range and project id, that
 * a visitor can print or hand to a spouse, a designer or their own contractor.
 *
 * The currency test is the one that matters. This sheet formatted Canadian
 * dollars unconditionally, which was correct for as long as it only ever saw a
 * /design configuration — and would have printed an Ontario figure on a
 * specification a Buffalo homeowner was about to hand a contractor.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeStudioDesign, encodeStudioDesign, specHref, type StudioDesign } from './studio-config';
import { priceConfiguration } from './catalog';
import { newDesignId } from './design-id';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/*
 * NO COMMENT STRIPPING HERE, DELIBERATELY.
 *
 * MEAS-04 added a stripper so an assertion would not match the docblock that
 * explains the bug. Measured on this repository it removed THIRTEEN real
 * statements from FloorStudio.tsx — a regex is not a TypeScript lexer, and an
 * over-eager one turns every `not.toContain` into a test that passes because
 * the code it was looking for is gone.
 *
 * So these assertions read raw source and use needles that only real code
 * produces: `href={specHref(design)}` rather than `specHref`. A prose match is
 * then near-impossible, and the failure mode if one ever happened is a FALSE
 * FAILURE, which gets noticed, rather than a false pass, which does not.
 */

const design = (over: Partial<StudioDesign> = {}): StudioDesign => ({
  config: { productId: 'white-oak', finishId: 'satin', patternId: 'herringbone', widthId: '5' },
  squareFeet: 1100,
  feels: [],
  country: 'CA',
  savedAt: '2026-09-13T00:00:00.000Z',
  ...over,
});

describe('the link into the sheet', () => {
  it('points at the sheet that already exists, not a second one', () => {
    /* Rule #5. A studio-flavoured copy of a printable specification is exactly
       the duplication the brief forbids. */
    expect(specHref(design())).toMatch(/^\/design\/spec\?design=/);
  });

  it('round-trips the whole design through it', () => {
    const original = design({ designId: newDesignId(), feels: ['warmer'], budgetCad: 18000 });
    const url = new URL(specHref(original), 'https://ecowoods.ca');
    const back = decodeStudioDesign(decodeURIComponent(url.searchParams.get('design')!));
    expect(back?.config).toEqual(original.config);
    expect(back?.squareFeet).toBe(original.squareFeet);
    expect(back?.designId).toBe(original.designId);
    expect(back?.feels).toEqual(['warmer']);
    expect(back?.budgetCad).toBe(18000);
  });

  it('encodes the code so an ampersand inside it cannot truncate the link', () => {
    /* The share code is itself a querystring. Dropped into another one
       unencoded, everything after its first `&` becomes a sibling parameter
       and the design arrives as its first field only. */
    const href = specHref(design());
    expect(href.slice(href.indexOf('design=')).includes('&')).toBe(false);
  });
});

describe('the currency the specification prints', () => {
  it('an Ontario design prices in CAD', () => {
    expect(priceConfiguration(design().config, 1100, 'CA').currency).toBe('CAD');
  });

  it('a New York design prices in USD, and they are different figures', () => {
    const ca = priceConfiguration(design().config, 1100, 'CA');
    const us = priceConfiguration(design().config, 1100, 'US');
    expect(us.currency).toBe('USD');
    expect(us.estimatedLowCad).not.toBe(ca.estimatedLowCad);
  });

  it('the sheet formats by currency, never a hardcoded CAD', () => {
    /* The EstimateResult field names still read `…Cad` — a naming debt from
       before New York bands existed — but the VALUE follows `currency`. A
       formatter that trusted the field name would print the right number with
       the wrong symbol, which is worse than either mistake alone. */
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('estimate.currency');
    expect(src).not.toMatch(/currency:\s*'CAD'\s*,\s*maximumFractionDigits/);
  });

  it('names which band set produced the figure', () => {
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('Priced against');
  });
});

describe('what the sheet gains from a studio design', () => {
  it('reads a studio share code, preferring it over loose parameters', () => {
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('decodeStudioDesign');
    /* preferred: the studio branch returns before the loose-parameter parse */
    expect(src.indexOf('decodeStudioDesign')).toBeLessThan(src.indexOf('designConfigFromParams(q)'));
  });

  it('prints the board width, which a DesignConfig cannot hold', () => {
    expect(read('app/design/spec/SpecSheet.tsx')).toContain('BOARD_WIDTHS');
  });

  it('prints the reference and the design id', () => {
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('studioRef');
    expect(src).toContain('formatDesignId');
  });

  it('prints a room READING and never a photograph', () => {
    /* Floor Studio analyses photos in the browser and retains none. The sheet
       can say "bright light, warm walls" because the browser measured it and
       sent three words; it can never show the room. */
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('lightLevel');
    expect(src).not.toContain('<img ');
  });
});

describe('the studio offers it', () => {
  it('has an exit to the specification', () => {
    expect(read('app/components/floor-studio/FloorStudio.tsx')).toContain('href={specHref(design)}');
  });

  it('reports when it is opened, so the feature can be judged', () => {
    const src = read('app/components/floor-studio/FloorStudio.tsx');
    expect(src).toContain("track('studio_spec_opened', {");
    expect(read('lib/analytics.ts')).toContain('studio_spec_opened');
  });
});

describe('the sheet still serves the configurator it was built for', () => {
  it('keeps the /design path intact', () => {
    const src = read('app/design/spec/SpecSheet.tsx');
    expect(src).toContain('estimateInstalledRangeCad');
    expect(src).toContain('designConfigFromParams');
    expect(src).toContain('readDesignConfig');
  });
});
