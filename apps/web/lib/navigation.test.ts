/**
 * lib/navigation.test.ts — the three surfaces cannot drift again.
 *
 * NAV-03 collapsed three copies of "where can you get to from here" into one.
 * These tests are what stops a fourth appearing: they assert the SHAPE the
 * derived list has to keep for the palette, the panels and the drawer to stay
 * the same site.
 *
 * They are tests, not guards. They add nothing to verify-all.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  DESTINATIONS,
  LIBRARY_MENU,
  MOBILE_GROUPS,
  SERVICES_LAYOUT,
  SERVICES_MENU,
  TOP_LINKS,
} from './navigation';

describe('the menus', () => {
  it('every href is a path, never a bare fragment', () => {
    /* A bare `#services` is what the command palette used to store, and it is
       why five of its actions did nothing anywhere but the homepage. A path
       resolves from any page; a fragment only resolves where the section is. */
    const all = [...TOP_LINKS, ...SERVICES_MENU.flatMap((c) => c.items), ...LIBRARY_MENU.flatMap((c) => c.items)];
    for (const item of all) expect(item.href.startsWith('/')).toBe(true);
    for (const col of [...SERVICES_MENU, ...LIBRARY_MENU]) {
      if (col.href) expect(col.href.startsWith('/')).toBe(true);
    }
  });

  it('the desktop layout names every Services column exactly once', () => {
    /* The panel renders from SERVICES_LAYOUT. A column missing from it is a
       column that exists on a phone and not on a desktop. */
    const laid = SERVICES_LAYOUT.flat();
    const titles = SERVICES_MENU.map((c) => c.title);
    expect([...laid].sort()).toEqual([...titles].sort());
  });

  it('the mobile drawer carries both menus in full', () => {
    const services = MOBILE_GROUPS.find((g) => g.key === 'services');
    const library = MOBILE_GROUPS.find((g) => g.key === 'library');
    expect(services?.cols).toBe(SERVICES_MENU);
    expect(library?.cols).toBe(LIBRARY_MENU);
  });

  it('no label means two different pages', () => {
    /* The nav quietly teaching someone that a word means two things is the
       failure verify-navigation catches in the chrome. Same rule, in the data. */
    const byLabel = new Map<string, Set<string>>();
    for (const d of DESTINATIONS) {
      const set = byLabel.get(d.label) ?? new Set<string>();
      set.add(d.href);
      byLabel.set(d.label, set);
    }
    const ambiguous = [...byLabel.entries()].filter(([, hrefs]) => hrefs.size > 1);
    expect(ambiguous).toEqual([]);
  });
});

describe('DESTINATIONS — what ⌘K searches', () => {
  it('is derived from the menus and adds nothing of its own', () => {
    const menuHrefs = new Set([
      ...TOP_LINKS.map((l) => l.href),
      ...SERVICES_MENU.flatMap((c) => [c.href, ...c.items.map((i) => i.href)]),
      ...LIBRARY_MENU.flatMap((c) => [c.href, ...c.items.map((i) => i.href)]),
    ].filter(Boolean) as string[]);
    for (const d of DESTINATIONS) expect(menuHrefs.has(d.href)).toBe(true);
  });

  it('lists each page once', () => {
    const hrefs = DESTINATIONS.map((d) => d.href);
    expect(hrefs.length).toBe(new Set(hrefs).size);
  });

  it('names all eight colour-matching guides, plus the hub, in the chrome', () => {
    /* The hub used to be the only colour-matching entry in the menus — a
       visitor had to open it and read its own grid to find any of the eight
       guides it indexes. Named individually, not counted, for the same
       reason as the NAV-03 list below: a count passes while the list
       silently changes underneath it. */
    const hrefs = new Set(DESTINATIONS.map((d) => d.href));
    for (const href of [
      '/hardwood-color-matching-toronto',
      '/guides/color-identification-existing-hardwood-finish',
      '/guides/stain-matching-existing-hardwood-floor-toronto',
      '/guides/matching-new-hardwood-to-old-toronto',
      '/guides/sample-boards-on-site-trials-sign-off',
      '/guides/species-undertone-guide-color-matching-toronto',
      '/guides/stair-railing-trim-color-matching-toronto',
      '/guides/door-woodwork-finish-coordination-toronto',
      '/guides/when-color-match-fails-full-sand-vs-replace',
    ]) {
      expect(hrefs.has(href), `${href} must be reachable from the chrome`).toBe(true);
    }
  });

  it('carries the pages the palette could not reach before NAV-03', () => {
    /* The ten a visitor is most likely hunting when they press ⌘K. Named
       individually rather than counted, because a count passes while the list
       silently changes underneath it. */
    const hrefs = new Set(DESTINATIONS.map((d) => d.href));
    for (const href of [
      '/floor-studio',
      '/design',
      '/pricing',
      '/service-areas',
      '/corridors',
      '/estimate',
      '/guides',
      '/papers',
      '/case-studies',
      '/quote-check',
      '/framework',
      '/where-we-work',
    ]) {
      expect(hrefs.has(href), `${href} must be reachable from the chrome`).toBe(true);
    }
  });

  it('every destination keeps the group it came from, so the palette reads as the site', () => {
    for (const d of DESTINATIONS) expect(d.group.length).toBeGreaterThan(0);
    expect(new Set(DESTINATIONS.map((d) => d.group)).size).toBeGreaterThan(5);
  });
});
