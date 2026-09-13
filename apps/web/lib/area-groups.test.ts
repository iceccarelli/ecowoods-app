/**
 * area-groups.test.ts — GROUP-01.
 *
 * The assertion that matters is the count: a grouped index that drops or
 * duplicates a city is worse than the flat grid it replaced, and neither
 * failure is visible by looking at the page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { areaGroups, groupedCityCount } from './area-groups';
import { SERVICE_AREAS } from './seo-data';
import { CORRIDORS } from './geo';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const groups = areaGroups();

describe('every city survives the grouping', () => {
  it('the total is exactly the number of published areas', () => {
    expect(groupedCityCount(groups)).toBe(SERVICE_AREAS.length);
  });

  it('no city is listed twice', () => {
    /* A market can sit on two corridors. Listing it under both would turn a
       hundred links into more than a hundred, make every summary count wrong,
       and give a crawler duplicate paths to one page from one document. */
    const slugs = groups.flatMap((g) => g.cities.map((c) => c.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('no city is dropped', () => {
    const grouped = new Set(groups.flatMap((g) => g.cities.map((c) => c.slug)));
    const missing = SERVICE_AREAS.filter((c) => !grouped.has(c.slug)).map((c) => c.slug);
    expect(missing, `dropped: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('the groups are the corridors this business already publishes', () => {
  it('every group id is a real corridor, or the explicit fallback', () => {
    const ids = new Set<string>(CORRIDORS.map((c) => c.id));
    for (const g of groups) {
      expect(ids.has(g.id) || g.id === 'elsewhere', `${g.id} must be a corridor`).toBe(true);
    }
  });

  it('carries a real name for each, not an id', () => {
    for (const g of groups) {
      expect(g.name.length).toBeGreaterThan(3);
      expect(g.name).not.toBe(g.id);
    }
  });

  it('omits corridors with no published area rather than showing a zero', () => {
    /* An empty accordion is a promise of content that is not there. */
    for (const g of groups) expect(g.cities.length).toBeGreaterThan(0);
    expect(groups.length).toBeLessThan(CORRIDORS.length + 1);
  });

  it('puts the largest group first, so the one open by default is the likely one', () => {
    for (let i = 1; i < groups.length; i += 1) {
      if (groups[i]!.id === 'elsewhere') continue;
      expect(groups[i - 1]!.cities.length).toBeGreaterThanOrEqual(groups[i]!.cities.length);
    }
  });

  it('actually distributes — this is not one group with everything in it', () => {
    /* If a future data change collapsed every city into one corridor, the page
       would still render and would still be a marathon. */
    expect(groups.length).toBeGreaterThanOrEqual(5);
    expect(groups[0]!.cities.length).toBeLessThan(SERVICE_AREAS.length * 0.75);
  });
});

describe('the page keeps every link reachable', () => {
  it('uses native details, not JavaScript', () => {
    /* The same mechanism the footer already uses on mobile. No client bundle,
       and it works before hydration. */
    const src = read('app/service-areas/page.tsx');
    expect(src).toContain('<details');
    expect(src).toContain('<summary');
    expect(src).not.toContain('useState');
  });

  it('leaves the links in the DOM whether a group is open or shut', () => {
    /* Collapsed <details> content is still parsed and still crawled, so the
       grouping costs discoverability nothing. A JS-gated list would not be. */
    /* The first version asserted the source contains no "hidden" and failed on
       `aria-hidden` in the jump nav — the fourth word-shaped needle this
       session to match prose instead of code. It now checks the two things
       that would ACTUALLY remove a link from the document: a conditional
       render gated on open state, and a display:none. */
    const src = read('app/service-areas/page.tsx');
    /* Split, because a `${` inside a plain string is the shape parse-scan
       flags — almost always a template literal typed with the wrong quotes. */
    expect(src).toContain('href={`/service-areas/');
    expect(src).toContain("c.slug}`}");
    expect(src).not.toContain("display: 'none'");
    expect(src).not.toMatch(/\{\s*(isOpen|open)\s*&&/);
  });

  it('offers a jump nav so a human and a machine can both skip', () => {
    expect(read('app/service-areas/page.tsx')).toContain('Jump to a corridor');
  });

  it('opens the first group so the page never looks empty', () => {
    expect(read('app/service-areas/page.tsx')).toContain('open={gi === 0}');
  });
});
