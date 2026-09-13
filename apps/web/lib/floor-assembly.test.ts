/**
 * floor-assembly.test.ts — VIS-05.
 *
 * Three classes of assertion, and only the first is about this module's own
 * arithmetic. The other two exist because both of the real defects found while
 * building this section were SILENT: a link whose parameter the receiving page
 * discards, and a texture path for a file that is not on disk. Neither throws,
 * neither logs, and both look correct in review.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSEMBLY_DEFAULT_SPECIES,
  ASSEMBLY_LAYERS,
  ASSEMBLY_LAYER_COUNT,
  ASSEMBLY_SPECIES,
  assemblyDesignHref,
  grainTextureFor,
  layerById,
} from './floor-assembly';
import { FLOOR_PRODUCTS } from './floor-studio/catalog';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

describe('the layers', () => {
  it('are five, numbered in order, top of the build-up first', () => {
    expect(ASSEMBLY_LAYER_COUNT).toBe(5);
    expect(ASSEMBLY_LAYERS.map((l) => l.n)).toEqual(['01', '02', '03', '04', '05']);
  });

  it('have unique ids and resolve through layerById', () => {
    const ids = ASSEMBLY_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(layerById(id)?.id).toBe(id);
    expect(layerById('not-a-layer')).toBeUndefined();
  });

  /* The `ask` is the commercial payload of the whole graphic. A layer without
     one is a layer that decorates instead of selling. */
  it('each carry a question a buyer can put to a contractor', () => {
    for (const l of ASSEMBLY_LAYERS) {
      expect(l.ask.length, l.id).toBeGreaterThan(30);
      /* Contains a question — not "is exactly one sentence". Two of these
         put the question and then say what the answer tells you, which is
         the more useful shape and would fail an endsWith('?') check. */
      expect(l.ask.includes('?'), `${l.id}: "${l.ask}"`).toBe(true);
    }
  });

  /* Do not invent customers, jobs, addresses or results. The layer copy
     describes how hardwood floors are built and must not describe a job. */
  it('describe the trade, never a customer or a job', () => {
    const prose = ASSEMBLY_LAYERS.map((l) => `${l.body} ${l.ask}`).join(' ').toLowerCase();
    for (const banned of ['our customer', 'client', 'testimonial', 'reviewed', 'street', 'avenue']) {
      expect(prose, banned).not.toContain(banned);
    }
  });
});

describe('the species join is the catalogue, not a copy of it', () => {
  it('is FLOOR_PRODUCTS itself', () => {
    expect(ASSEMBLY_SPECIES.map((s) => s.id)).toEqual(FLOOR_PRODUCTS.map((p) => p.id));
  });

  it('defaults to a species that exists', () => {
    expect(ASSEMBLY_SPECIES.some((s) => s.id === ASSEMBLY_DEFAULT_SPECIES)).toBe(true);
  });

  /* THE SILENT ONE. grainTextureFor computes a path. If a species is added to
     the catalogue without its crop, every browser requests a 404 and the wear
     layer silently paints as a flat gradient — which still looks deliberate. */
  it('every species has a photographed crop on disk', () => {
    for (const s of ASSEMBLY_SPECIES) {
      const path = grainTextureFor(s.id);
      expect(path, s.id).toBe(`/textures/grain-${s.id}.webp`);
      expect(existsSync(join(WEB, 'public', path)), `missing public${path}`).toBe(true);
    }
  });

  it('and the manifest records exactly those crops, no more', () => {
    const manifest = JSON.parse(read('public/textures/grain-manifest.json')) as { product: string }[];
    expect([...manifest.map((m) => m.product)].sort()).toEqual(
      [...ASSEMBLY_SPECIES.map((s) => s.id)].sort(),
    );
  });
});

describe('the handoff is keyed the way the receiving page reads it', () => {
  /* THE OTHER SILENT ONE. FloorConfigurator builds its SPECIES list as
     `id: p.rateKey`, then ignores any species param that does not match one.
     A link built from the catalogue id ('white-oak' rather than 'white oak')
     is dropped on arrival with no error, and the visitor lands on a
     configurator showing the default floor as though they had chosen it. */
  it('sends the rateKey, which is what /design matches on', () => {
    for (const s of ASSEMBLY_SPECIES) {
      const href = assemblyDesignHref(s);
      const q = new URLSearchParams(href.slice(href.indexOf('?') + 1));
      expect(q.get('species'), s.id).toBe(s.rateKey);
      expect(q.get('source')).toBe('assembly');
      expect(href.startsWith('/design?')).toBe(true);
    }
  });

  it('and FloorConfigurator really does key its list by rateKey', () => {
    /* If this line ever changes, the assertion above is testing a fiction. */
    const src = read('app/components/FloorConfigurator.tsx');
    expect(src).toContain('id: p.rateKey');
    expect(src).toContain("q.get('species')");
    expect(src).toContain('SPECIES.some((s) => s.id === qsSpecies)');
  });

  /* Not /estimate. designConfigFromParams returns null without a positive
     sqft, so a direct link would carry a species the form throws away. */
  it('does not link straight to the estimate form, which would drop it', () => {
    for (const s of ASSEMBLY_SPECIES) {
      expect(assemblyDesignHref(s)).not.toContain('/estimate');
    }
  });
});

describe('the component keeps text out of the animated element (F-205)', () => {
  const src = read('app/components/FloorAssembly.tsx');

  /* The stack is five self-closing divs. If a child is ever nested inside one,
     that text is inside the element the transition and the opacity rules act
     on — which is how a hero stat came to publish three times. */
  it('renders the layers as childless elements', () => {
    const at = src.indexOf('className="fa-layer"');
    expect(at).toBeGreaterThan(-1);

    /* A REGEX CANNOT ASK THIS QUESTION. `/className="fa-layer"[^]*?>/` finds
       the first '>' anywhere in the file, including one inside an arrow
       function in the style prop — it passes whatever the markup says, which
       is a test that only looks like a test. So walk the element: from the
       class name, track brace and quote depth, stop at the '>' that actually
       closes the tag, and require the character before it to be '/'. */
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = at; i < src.length; i++) {
      const c = src[i]!;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    expect(end, 'no closing angle bracket for the fa-layer element').toBeGreaterThan(-1);
    const tag = src.slice(at, end + 1);
    expect(src.slice(0, end).trimEnd().endsWith('/'), `fa-layer is not self-closing: ...${tag.slice(-60)}`).toBe(true);
  });

  it('hides the stage from the accessibility tree, since the legend carries the words', () => {
    expect(src).toContain('className="fa-stage" ref={stageRef} aria-hidden="true"');
  });

  it('paints the wear layer from grainTextureFor rather than a hardcoded path', () => {
    expect(src).toContain('grainTextureFor(species.id)');
    expect(src).not.toMatch(/url\(\/textures\/grain-[a-z-]+\.webp\)/);
  });

  /* The reveal must never collapse a stack somebody is already looking at. */
  it('refuses to collapse when the section is already on screen, or motion is reduced', () => {
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches) return");
    expect(src).toContain('if (onScreen) return;');
  });
});

describe('the stylesheet keeps the readable state as the default', () => {
  const css = read('app/globals.css');

  /* THE WHOLE NO-JS ARGUMENT IN ONE DECLARATION. If --fa-t ever loses its
     fallback of 1, the stack ships flat to everything that does not run
     script — which includes the answer engines this site is written for. */
  it('falls back to exploded when --fa-t is never set', () => {
    expect(css).toContain('var(--fa-z) * var(--fa-f, 0) * var(--fa-t, 1)');
    expect(css).toContain(".fa-stage[data-collapsed='true'] {");
  });

  it('paints with semantic tokens only — no raw pigment on a dark section', () => {
    const block = css.slice(css.indexOf('VIS-05 — THE EXPLODED FLOOR ASSEMBLY'));
    expect(block).not.toMatch(/var\(--(?:walnut|oak|cream|maple)-/);
  });

  it('is rescaled rather than re-laid-out on a phone', () => {
    const block = css.slice(css.indexOf('VIS-05 — THE EXPLODED FLOOR ASSEMBLY'));
    expect(block).toContain('--fa-z: 88px;');
    expect(block).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('the homepage actually renders it', () => {
  const home = read('app/home-client.tsx');

  it('imports and mounts the section', () => {
    expect(home).toContain("import { FloorAssembly } from './components/FloorAssembly';");
    expect(home).toContain('<FloorAssembly />');
  });

  /* Below the price, which is the narrative order: what it costs, then what
     the cost is buying. And below the hero, which is P0.4. */
  it('mounts it after the published bands and never inside the hero', () => {
    expect(home.indexOf('<FloorAssembly />')).toBeGreaterThan(home.indexOf('<PricingSection />'));
    const hero = home.slice(home.indexOf('<section className="hero"'), home.indexOf('id="start"'));
    expect(hero).not.toContain('FloorAssembly');
  });
});
