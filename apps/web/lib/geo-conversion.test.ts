/**
 * geo-conversion.test.ts — SALE-03.
 *
 * The geographic pages are the largest surface on this site and the one with
 * the highest local commercial intent: 100 city pages and 11 corridor pages
 * out of 261 indexed URLs. Every one of them shipped without a form.
 *
 * EstimateForm's own docblock records F-160 fixing exactly this pattern —
 * "Every commercial page's primary button pointed at /#quote. That anchor is on
 * a DIFFERENT url" — and the fix reached /services, /pricing, /commercial,
 * /realtors and the four Toronto landing pages while never reaching these. A
 * regression that a commit message already describes is one a test should be
 * holding, so this is that test.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const CITY = 'app/service-areas/[city]/page.tsx';
const CORRIDOR = 'app/corridors/[id]/page.tsx';

describe('the geographic pages can be converted on', () => {
  it('both templates render the form', () => {
    for (const f of [CITY, CORRIDOR]) {
      expect(read(f), `${f} must render EstimateForm`).toContain('<EstimateForm');
    }
  });

  it('both anchor it at #quote, so a same-page CTA has a target', () => {
    for (const f of [CITY, CORRIDOR]) {
      expect(read(f), `${f} needs id="quote"`).toContain('id="quote"');
    }
  });

  it('no primary button on either template still points at the homepage', () => {
    /* The whole defect in one assertion: `/#quote` is a CROSS-PAGE anchor.
       `#quote` is this page. One character, one extra page load, on 111 URLs
       that a homeowner reached by searching for their own city. */
    for (const f of [CITY, CORRIDOR]) {
      expect(read(f), `${f} must not send visitors to the homepage to convert`).not.toContain(
        'href="/#quote"',
      );
    }
  });

  it('the city CTAs are same-page anchors', () => {
    const src = read(CITY);
    expect(src).toContain('href="#quote"');
    /* both of them — hero and closing */
    expect(src.split('href="#quote"').length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe('the lead knows where it came from', () => {
  it('a city lead carries its city', () => {
    /* This is what MEAS-01 and MEAS-02 arriving first bought. "Which cities
       actually produce deposits" stops being an assumption, and the answer
       decides where the next real job photograph should come from — which
       matters because content/job-cards.ts holds five real jobs, all in Toronto
       proper, so 96 of these pages currently carry no local proof at all. */
    /* Split so no `${` sits inside a plain string: parse-scan flags that
       shape because it is almost always a template literal someone typed with
       the wrong quotes, and a test is not worth an exception to a rule that
       has caught real bugs. */
    const src = read(CITY);
    expect(src).toContain('source={`service-area-');
    expect(src).toContain('city.slug}`}');
  });

  it('a corridor lead carries its route', () => {
    const src = read(CORRIDOR);
    expect(src).toContain('source={`corridor-');
    expect(src).toContain('corridor.id}`}');
  });

  it('neither invents a location for the lead', () => {
    /* `source` is which PAGE produced the lead. It is not a claim about where
       the visitor is, and it must never be written into the address field —
       somebody reading a Whitby page from a Toronto office is not a Whitby job,
       and a postal code the visitor typed is the only location this business
       acts on. */
    for (const f of [CITY, CORRIDOR]) {
      const src = read(f);
      const call = src.slice(src.indexOf('<EstimateForm'));
      const props = call.slice(0, call.indexOf('/>'));
      for (const forbidden of ['postal', 'city={', 'address']) {
        expect(props, `${f} must not prefill ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe('the local content still comes before the ask', () => {
  it('the form sits after the local housing prose, not above it', () => {
    /* A visitor reads the reason to believe this business works here, then is
       asked. Leading with the form on a page whose only job is to establish
       local credibility spends the credibility before it is earned. */
    const src = read(CITY);
    expect(src.indexOf('localHousing')).toBeLessThan(src.indexOf('<EstimateForm'));
  });

  it('the NAP block is still last, and still interpolated', () => {
    /* A local landing page that states the address differently from the
       homepage is the most common reason a local entity fails to resolve. */
    const src = read(CITY);
    expect(src.indexOf('<EstimateForm')).toBeLessThan(src.indexOf('area-nap'));
    expect(src).toContain('BUSINESS_NAP');
  });
});
