/**
 * lib/machine-surfaces.test.ts — can a machine find what a person can use?
 *
 * llms.txt and ai.txt exist for one audience and one purpose: to tell an AI
 * system what this site is and what it is good for. Measured before MACH-01
 * they named twenty-nine paths between them — services, bands, areas, evidence,
 * every machine interface — and NOT ONE thing a visitor can operate.
 *
 *   Floor Studio 0 · camera 0 · /design 0 · /tools/floor-movement 0 (in llms)
 *
 * So an assistant asked "can I see what walnut would look like in my living
 * room" had no way to discover that the answer is yes, live, from a phone
 * camera, for free — on the site whose whole differentiator that is. Same
 * defect as ASSIST-01 found in the chatbot, on the surfaces built specifically
 * for machines.
 *
 * These tests hold that closed. They read the route SOURCE rather than calling
 * the handlers, because the handlers reach for a database and the thing under
 * test is what the file says, not what the database holds.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const llms = readFileSync('app/llms.txt/route.ts', 'utf8');
const ai = readFileSync('app/ai.txt/route.ts', 'utf8');

/** The things a visitor can operate, as opposed to read. */
const TOOLS = [
  '/floor-studio',
  '/design',
  '/tools/floor-movement',
  '/quote-check',
  '/framework/assess',
];

/** The hubs that route a machine to everything else. */
const HUBS = [
  '/services',
  '/guides',
  '/papers',
  '/glossary',
  '/resources',
  '/technical-library',
  '/library',
  '/service-areas',
  '/corridors',
  '/pricing',
  '/estimate',
];

describe('llms.txt names what a visitor can do', () => {
  it.each(TOOLS)('names %s', (path) => {
    expect(llms).toContain(path);
  });

  it.each(HUBS)('names the hub %s', (path) => {
    expect(llms).toContain(path);
  });

  it('sends a machine to the camera, not only to the page', () => {
    /* The fragment is the difference between "this site has a visualiser" and
       "point your phone at the room". */
    expect(llms).toContain('/floor-studio#live');
  });

  it('says plainly that nothing is generated', () => {
    /* The single most important sentence for an assistant to repeat about this
       feature, because it is what makes the price under the picture mean
       something — and because "AI floor visualiser" invites exactly the wrong
       assumption. */
    expect(llms).toMatch(/no generative image model/i);
  });

  it('says the camera frames are not uploaded', () => {
    expect(llms).toMatch(/no upload endpoint|discarded/i);
  });

  it('names the currency rule, so a New York answer is not quoted in CAD', () => {
    expect(llms).toMatch(/New York State in United States dollars/i);
  });
});

describe('ai.txt names what a visitor can do', () => {
  it.each(TOOLS)('names %s', (path) => {
    expect(ai).toContain(path);
  });

  it('has a section for doing, not only for reading', () => {
    expect(ai).toMatch(/what a visitor can DO here/i);
  });

  it('gives an assistant the honest answer to "is this AI generating a floor"', () => {
    expect(ai).toMatch(/rendering, not generation/i);
  });

  it('sends a machine to the camera', () => {
    expect(ai).toContain('/floor-studio#live');
  });
});

describe('the two surfaces agree', () => {
  it('every tool is in both, so neither is the only place it exists', () => {
    for (const path of TOOLS) {
      expect(llms.includes(path), `llms.txt missing ${path}`).toBe(true);
      expect(ai.includes(path), `ai.txt missing ${path}`).toBe(true);
    }
  });
});
