/**
 * lib/assistant-site.test.ts — the assistant cannot recommend what it cannot see.
 *
 * ASSIST-01 gave EcowoodsGuide a map of this website, derived from the same
 * navigation module the panels, the drawer and ⌘K read. These tests hold that
 * derivation to its purpose: every headline path must be real, the search must
 * find the pages a homeowner actually asks for in the words they actually use,
 * and the prompt block must instruct rather than merely list.
 */
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './navigation';
import { findOnSite, headlineFeatures, siteCapabilitiesBlock, splitReply } from './assistant-site';

describe('the headline features', () => {
  it('every one resolves to a page the navigation actually carries', () => {
    /* The failure this prevents: a headline list that drifts from the site and
       sends homeowners to a 404 in the voice of the company. */
    const hrefs = new Set(DESTINATIONS.map((d) => d.href));
    for (const f of headlineFeatures()) {
      expect(hrefs.has(f.href), `${f.href} is not in the site navigation`).toBe(true);
    }
  });

  it('takes its words from the navigation rather than writing its own', () => {
    const byHref = new Map(DESTINATIONS.map((d) => [d.href, d]));
    for (const f of headlineFeatures()) {
      expect(f.label).toBe(byHref.get(f.href)!.label);
      expect(f.note).toBe(byHref.get(f.href)!.note);
    }
  });

  it('leads with the live camera, and still offers the photo and the specifier', () => {
    const hrefs = headlineFeatures().map((f) => f.href);
    expect(hrefs[0]).toBe('/floor-studio#live');
    expect(hrefs).toContain('/floor-studio');
    expect(hrefs).toContain('/design');
    expect(hrefs).toContain('/pricing');
    expect(hrefs).toContain('/estimate');
  });

  it('every one says when to use it, not just that it exists', () => {
    for (const f of headlineFeatures()) expect(f.when.length).toBeGreaterThan(20);
  });
});

describe('find_on_site', () => {
  const paths = (q: string) => findOnSite(q).map((d) => d.href);

  it('finds what a homeowner asks for, in their words', () => {
    expect(paths('what does it cost')).toContain('/pricing');
    expect(paths('see it in my room')).toContain('/floor-studio');
    expect(paths('white oak')).toContain('/guides/white-oak-flooring-toronto');
    expect(paths('buffalo')).toContain('/service-areas/buffalo');
    expect(paths('compare quotes')).toContain('/quote-check');
    expect(paths('stairs')).toContain('/hardwood-stairs-toronto');
    expect(paths('how much will my floor move')).toContain('/tools/floor-movement');
  });

  it('returns nothing rather than a bad guess', () => {
    expect(findOnSite('')).toEqual([]);
    expect(findOnSite('a')).toEqual([]);
    expect(findOnSite('zzzqqq')).toEqual([]);
  });

  it('only ever returns paths the navigation carries', () => {
    const hrefs = new Set(DESTINATIONS.map((d) => d.href));
    for (const q of ['floor', 'toronto', 'oak', 'price', 'commercial', 'refinishing', 'paper']) {
      for (const d of findOnSite(q)) expect(hrefs.has(d.href)).toBe(true);
    }
  });

  it('ranks a label match above a path match', () => {
    /* "pricing" appears in the path of several pages and in the label of one.
       The one is the answer. */
    const first = findOnSite('pricing')[0];
    expect(first?.href).toBe('/pricing');
  });

  it('respects the limit, so a reply cannot become a directory', () => {
    expect(findOnSite('floor', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('the block appended to the system prompt', () => {
  const block = siteCapabilitiesBlock();

  it('names the live camera and says what it is not', () => {
    expect(block).toContain('/floor-studio#live');
    /* The honesty that has to survive into the assistant's mouth: it renders
       real floors, it does not generate imaginary ones, and that is exactly why
       the price under it means anything. */
    expect(block).toMatch(/rendering, not generation/i);
    expect(block).toMatch(/cannot be bought/i);
  });

  it('tells the model to use find_on_site rather than invent a path', () => {
    expect(block).toMatch(/never invent a path/i);
    expect(block).toContain('find_on_site');
  });

  it('caps it at one recommendation so a reply stays a reply', () => {
    expect(block).toMatch(/one per reply/i);
  });

  it('writes paths in the shape the chat window can linkify', () => {
    expect(block).toContain('ecowoods.ca/floor-studio');
  });

  it('carries every headline path', () => {
    for (const f of headlineFeatures()) expect(block).toContain(f.href);
  });
});

describe('splitReply — what the chat window can make tappable', () => {
  it('leaves a reply with no path alone', () => {
    /* No figure in this fixture, deliberately. A price written into a test is a
       second copy of a published band, and verify-pricing-source is right to
       fail on one — it caught this line. */
    const plain = 'That sounds like cupping, and the in-home diagnosis is free.';
    expect(splitReply(plain)).toEqual([{ text: plain }]);
  });

  it('pulls a path out of a sentence and keeps the sentence', () => {
    expect(splitReply('Point your phone at the room: ecowoods.ca/floor-studio#live')).toEqual([
      { text: 'Point your phone at the room: ' },
      { path: '/floor-studio#live' },
    ]);
  });

  it('gives the full stop back to the sentence', () => {
    /* The bug this prevents: a link whose href is "/pricing." — a 404, from the
       most common thing a model writes. */
    expect(splitReply('The bands are at ecowoods.ca/pricing.')).toEqual([
      { text: 'The bands are at ' },
      { path: '/pricing' },
      { text: '.' },
    ]);
  });

  it('handles a bare domain, a www, and an https', () => {
    expect(splitReply('ecowoods.ca')).toEqual([{ path: '/' }]);
    expect(splitReply('www.ecowoods.ca/design')).toEqual([{ path: '/design' }]);
    expect(splitReply('https://ecowoods.ca/estimate')).toEqual([{ path: '/estimate' }]);
  });

  it('never makes another domain clickable', () => {
    /* A model talked into emitting somebody else's link must not get a tappable
       one out of this widget. The shape it matches is the only defence needed,
       and it is asserted rather than assumed. */
    for (const hostile of [
      'Go to evil.example.com/pricing',
      'Try https://ecowoods.ca.evil.example.com/pricing',
      'See http://notecowoods.ca/pricing',
    ]) {
      for (const part of splitReply(hostile)) {
        if ('path' in part) {
          throw new Error(`made a link out of: ${hostile}`);
        }
      }
    }
    expect(true).toBe(true);
  });

  it('survives two paths in one reply', () => {
    const parts = splitReply('Either ecowoods.ca/design or ecowoods.ca/pricing works.');
    expect(parts.filter((p) => 'path' in p)).toEqual([{ path: '/design' }, { path: '/pricing' }]);
  });
});
