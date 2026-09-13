/**
 * design-config.test.ts — MEAS-04.
 *
 * The first describe block is the test that did not exist, and its absence is
 * why `/#quote?spec=…` shipped and stayed broken while the analytics event
 * beside it reported success every single time.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  describeDesignConfig,
  designConfigFromParams,
  designEstimateHref,
  type DesignConfig,
} from './design-config';
import { isDesignId, newDesignId } from './floor-studio/design-id';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * The same file with every comment removed.
 *
 * The first version of the test below searched the raw source and failed on
 * the DOCBLOCK that explains the bug — a comment quoting the broken URL read
 * to it exactly like the broken URL. Asserting against prose is how a test
 * starts forbidding its own explanation, so these assertions read the code.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const cfg = (over: Partial<DesignConfig> = {}): DesignConfig => ({
  species: 'white oak',
  finish: 'satin',
  pattern: 'straight',
  sqft: 900,
  savedAt: '2026-09-12T00:00:00.000Z',
  ...over,
});

describe('the bug this patch exists to end', () => {
  it('puts the query string BEFORE the fragment', () => {
    /* `/#quote?spec=…` placed it after, so the browser treated the whole thing
       as a hash and the destination never saw a single parameter. Nothing
       threw. Nothing turned red. It simply stopped working. */
    const href = designEstimateHref(cfg());
    const q = href.indexOf('?');
    const h = href.indexOf('#');
    expect(q).toBeGreaterThan(-1);
    expect(h).toBeGreaterThan(-1);
    expect(q).toBeLessThan(h);
  });

  it('survives being parsed the way a browser parses it', () => {
    const href = designEstimateHref(cfg({ sqft: 1400 }));
    const url = new URL(href, 'https://ecowoods.ca');
    expect(url.searchParams.get('species')).toBe('white oak');
    expect(url.searchParams.get('sqft')).toBe('1400');
    expect(url.hash).toBe('#form');
  });

  it('no longer points at a homepage anchor that parses nothing', () => {
    expect(designEstimateHref(cfg())).toMatch(/^\/estimate\?/);
  });

  it('is the only place either exit is built', () => {
    /* Two CTAs assembling their own URLs is how one of them broke alone. */
    for (const file of ['app/components/FloorConfigurator.tsx', 'app/design/spec/SpecSheet.tsx']) {
      const src = code(file);
      expect(src, `${file} must use the shared builder`).toContain('designEstimateHref');
      expect(src, `${file} must not hand-build a quote link`).not.toContain('/#quote?');
      expect(src, `${file} must not use the bare homepage anchor`).not.toContain('href="/#quote"');
    }
  });

  it('reports whether the configuration actually travelled', () => {
    /* design_handoff used to fire unconditionally, including on the CTA that
       lost its payload. A metric that fails in the optimistic direction is
       worse than no metric. */
    for (const file of ['app/components/FloorConfigurator.tsx', 'app/design/spec/SpecSheet.tsx']) {
      expect(code(file), `${file} must report carriage`).toContain('carried:');
    }
  });
});

describe('the round trip', () => {
  it('comes back out of its own link intact', () => {
    const original = cfg({ designId: newDesignId(), sqft: 1250, finish: 'matte' });
    const url = new URL(designEstimateHref(original), 'https://ecowoods.ca');
    const back = designConfigFromParams(url.searchParams);
    expect(back).not.toBeNull();
    expect(back!.species).toBe(original.species);
    expect(back!.finish).toBe(original.finish);
    expect(back!.pattern).toBe(original.pattern);
    expect(back!.sqft).toBe(original.sqft);
    expect(back!.designId).toBe(original.designId);
  });

  it('carries the join key as its own parameter', () => {
    const id = newDesignId();
    const url = new URL(designEstimateHref(cfg({ designId: id })), 'https://ecowoods.ca');
    expect(url.searchParams.get('did')).toBe(id);
  });

  it('omits the key entirely when there is none', () => {
    expect(designEstimateHref(cfg())).not.toContain('did=');
  });

  it('drops a design id we did not mint', () => {
    const p = new URLSearchParams({ species: 'white oak', sqft: '900', did: 'NOT-AN-ID' });
    expect(designConfigFromParams(p)?.designId).toBeUndefined();
  });

  it('refuses a half-config rather than prefilling half a form', () => {
    /* A form filled with half an answer is worse than an empty one: the
       visitor cannot tell which half came from them. */
    expect(designConfigFromParams(new URLSearchParams({ sqft: '900' }))).toBeNull();
    expect(designConfigFromParams(new URLSearchParams({ species: 'white oak' }))).toBeNull();
    expect(designConfigFromParams(new URLSearchParams({ species: 'white oak', sqft: '0' }))).toBeNull();
    expect(designConfigFromParams(new URLSearchParams({ species: 'white oak', sqft: 'x' }))).toBeNull();
    expect(designConfigFromParams(new URLSearchParams({ species: 'white oak', sqft: '-5' }))).toBeNull();
  });

  it('encodes a species with a space so the link is not truncated', () => {
    const href = designEstimateHref(cfg({ species: 'black walnut' }));
    expect(href).not.toContain('black walnut');
    const url = new URL(href, 'https://ecowoods.ca');
    expect(url.searchParams.get('species')).toBe('black walnut');
  });
});

describe('one design, one id', () => {
  it('the studio mirror reuses the studio id instead of minting a second', () => {
    /* Two ids for one design means the studio reports it under one key and a
       later /design edit reports it under the other — one customer, counted
       twice. */
    const src = code('lib/floor-studio/studio-config.ts');
    expect(src).toContain('designId: full.designId');
  });

  it('mints a real id shape when a caller has none', () => {
    const src = code('lib/design-config.ts');
    expect(src).toContain('ensureDesignId(config.designId)');
    expect(isDesignId(newDesignId())).toBe(true);
  });
});

describe('the estimate form reads the link', () => {
  it('prefers a configuration in the link over whatever this browser stored', () => {
    const src = code('app/components/EstimateForm.tsx');
    expect(src).toContain('designConfigFromParams');
  });
});

describe('the human-readable line is unchanged', () => {
  it('still describes a floor the way it always did', () => {
    expect(describeDesignConfig(cfg())).toBe('white oak · satin finish · straight · ~900 sq ft');
  });
});
