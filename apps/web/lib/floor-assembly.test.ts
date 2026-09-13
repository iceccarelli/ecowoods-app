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
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ASSEMBLY_DEFAULT_SPECIES,
  ASSEMBLY_LAYERS,
  ASSEMBLY_LAYER_COUNT,
  ASSEMBLY_SPECIES,
  ASSEMBLY_DEFAULT_PATTERN,
  ASSEMBLY_PATTERNS,
  assemblyDesignHref,
  boardFace,
  boardsFor,
  grainTextureFor,
  layerById,
} from './floor-assembly';
import { FLOOR_PRODUCTS } from './floor-studio/catalog';
import { PATTERN_OPTIONS } from '@ecowoods/shared/ai';

/* next/link needs a Next request context it will not have here, and the thing
   under test is the MARKUP, not the router. */
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement('a', { href }, children),
}));
import { FloorAssembly } from '@/app/components/FloorAssembly';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * Source with the COMMENTS REMOVED.
 *
 * Three assertions in this file failed the first time they ran, all the same
 * way: they searched for `Math.random`, `mix-blend-mode` and `backdrop-filter`
 * and found every one of them — in the comments explaining why the code does
 * not use them. A test that a docblock can satisfy is not a test. Anything
 * asserting about what the code does NOT contain reads through here.
 */
/**
 * Every declaration the stylesheet makes for one selector, concatenated.
 *
 * The first version of the pause assertion searched the whole VIS-06 block for
 * `animation-play-state: paused` and PASSED when that declaration was deleted
 * from `.fa-stack`, because `.fa-layer` still had one — it would have shipped a
 * stack that animates forever, off screen, on every phone that loaded the
 * homepage. The second version read only the FIRST rule for a selector and so
 * missed the later one that carries the animation. A selector can be written
 * any number of times and the cascade sees all of them, so this does too.
 */
const declarationsFor = (css: string, selector: string): string => {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1]!.trim() === selector) out.push(m[2]!);
  }
  return out.join('\n');
};

const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

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
  it('puts nothing but the board field inside a layer', () => {
    /* VIS-05 asserted the layers were self-closing. VIS-06 put the board field
       inside layer 02, so that assertion had to change — and the thing it was
       really protecting has not: no TEXT may enter the animated element. The
       server-render suite below is what proves that now, by counting the
       actual published HTML rather than reading the source. */
    expect(src).toContain('className="fa-layer"');
    expect(src).toContain('className="fa-boards"');
    expect(src).not.toMatch(/className="fa-board"[^/]*>[A-Za-z]/);
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
    expect(src).toContain("if (onScreen) node.dataset.live = 'true';");
    expect(src).toContain("else node.dataset.collapsed = 'true';");
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
    expect(block).toContain('--fa-z: 104px;');
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


/* ══ VIS-06 ═══════════════════════════════════════════════════════════════ */

describe('the boards', () => {
  it('are laid in the shared pattern list, not a copy of it', () => {
    expect(ASSEMBLY_PATTERNS.map((p) => p.id)).toEqual(PATTERN_OPTIONS.map((p) => p.id));
    expect(ASSEMBLY_PATTERNS.some((p) => p.id === ASSEMBLY_DEFAULT_PATTERN)).toBe(true);
  });

  it('generate for every pattern the site offers', () => {
    for (const p of ASSEMBLY_PATTERNS) {
      expect(boardsFor(p.id).boards.length, p.id).toBeGreaterThan(40);
    }
  });

  /* The coordinates are produced on the server and again in the browser. One
     Math.random anywhere in here is a hydration mismatch on every single load,
     and React would blow away and re-render the whole field. */
  it('are deterministic — the same call twice gives the same floor', () => {
    for (const p of ASSEMBLY_PATTERNS) {
      expect(JSON.stringify(boardsFor(p.id)), p.id).toBe(JSON.stringify(boardsFor(p.id)));
    }
    expect(code('lib/floor-assembly.ts')).not.toContain('Math.random');
  });

  /* Herringbone STEPS; chevron's apexes line up into rows. If both were
     generated the same way one of the two labels on the page would be a lie. */
  it('turn the parquet patterns to 45 degrees and the plank patterns to zero', () => {
    for (const id of ['herringbone', 'chevron']) {
      const rots = new Set(boardsFor(id).boards.map((b) => b.rot));
      expect([...rots].sort((a, b) => a - b), id).toEqual([-45, 45]);
    }
    expect(boardsFor('straight').boards.every((b) => b.rot === 0)).toBe(true);
    expect(boardsFor('diagonal').fieldRot).toBe(45);
    expect(boardsFor('straight').fieldRot).toBe(0);
  });

  /* A rotated field must be oversized or its corners show the ground. */
  it('oversize any field that is turned', () => {
    for (const p of ASSEMBLY_PATTERNS) {
      const f = boardsFor(p.id);
      if (f.fieldRot !== 0) expect(f.scale, p.id).toBeGreaterThan(1.2);
    }
  });

  it('cover the whole field in both axes', () => {
    for (const p of ASSEMBLY_PATTERNS) {
      const bs = boardsFor(p.id).boards;
      expect(Math.min(...bs.map((b) => b.x)), p.id).toBeLessThanOrEqual(0);
      expect(Math.max(...bs.map((b) => b.x + b.w)), p.id).toBeGreaterThanOrEqual(100);
      expect(Math.min(...bs.map((b) => b.y)), p.id).toBeLessThanOrEqual(0);
      expect(Math.max(...bs.map((b) => b.y + b.h)), p.id).toBeGreaterThanOrEqual(100);
    }
  });

  it('give every board a different face, within range, deterministically', () => {
    const faces = Array.from({ length: 60 }, (_, i) => boardFace(i));
    for (const f of faces) {
      expect(f.posX).toBeGreaterThanOrEqual(0);
      expect(f.posX).toBeLessThan(100);
      expect(f.shade).toBeLessThan(0.1);
    }
    expect(new Set(faces.map((f) => `${f.posX}/${f.posY}`)).size).toBeGreaterThan(40);
    expect(boardFace(7)).toEqual(boardFace(7));
  });
});

describe('the handoff carries the pattern too', () => {
  it('sends a pattern id, which is what /design matches patterns on', () => {
    const href = assemblyDesignHref(ASSEMBLY_SPECIES[0]!, 'herringbone');
    expect(new URLSearchParams(href.slice(href.indexOf('?') + 1)).get('pattern')).toBe('herringbone');
  });

  it('refuses to send a pattern the configurator has no option for', () => {
    const href = assemblyDesignHref(ASSEMBLY_SPECIES[0]!, 'basketweave');
    expect(href).not.toContain('pattern=');
  });

  it('and FloorConfigurator really does match patterns by id', () => {
    const src = read('app/components/FloorConfigurator.tsx');
    expect(src).toContain('PATTERN_OPTIONS.some((p) => p.id === qsPattern)');
  });
});

describe('the motion is off by default and cannot be made expensive', () => {
  const css = read('app/globals.css');
  const block = css.slice(css.indexOf('VIS-06: THE ASSEMBLY IS NEVER STILL'));

  it('is paused in the stylesheet and runs only when the stage is live', () => {
    /* Per rule, not per block — see `rule` above for why. Either one of these
       losing its pause is a stack that animates forever, off screen. */
    expect(declarationsFor(css, '.fa-stack'), '.fa-stack').toContain('animation-play-state: paused');
    expect(declarationsFor(css, '.fa-layer'), '.fa-layer').toContain('animation-play-state: paused');
    expect(
      declarationsFor(css, ".fa-stage[data-live='true'] .fa-stack,\n.fa-stage[data-live='true'] .fa-layer"),
      'the live rule',
    ).toContain('animation-play-state: running');
  });

  it('animates the stack and the layers, never the boards', () => {
    expect(block).toContain('animation: fa-drift');
    expect(block).toContain('animation: fa-float');
    expect(block).not.toContain('.fa-board {');
    expect(css.slice(css.indexOf('.fa-board {'), css.indexOf('.fa-board {') + 400)).not.toContain('animation');
  });

  /* MEASURED, NOT ASSUMED. A blend mode or a backdrop filter over a moving
     ancestor is recomposited on every frame: putting the warm cast back as
     mix-blend-mode cost 23% of the frame rate (35fps -> 43fps removing it,
     software rasteriser, identical board counts). The board count itself
     changed almost nothing — 61 boards and 440 boards measured within one
     frame per second of each other — because the boards never animate. This
     guard is here so that the cheap version cannot quietly be undone. */
  it('never puts a blend mode or a backdrop filter on the moving stack', () => {
    const bare = code('app/globals.css');
    const fa = bare.slice(bare.indexOf('.fa-section {'));
    expect(fa).not.toContain('mix-blend-mode');
    expect(fa).not.toContain('backdrop-filter');
  });

  it('is removed outright, not merely paused, under reduced motion', () => {
    const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toContain('animation: none');
    expect(rm).toContain('.fa-stack');
  });
});

describe('the hero variant exists and is not what the homepage uses', () => {
  const css = read('app/globals.css');

  it('is a real, styled variant', () => {
    expect(css).toContain(".fa-section[data-variant='hero']");
    expect(read('app/components/FloorAssembly.tsx')).toContain("variant = 'section'");
  });

  /* P0.4. The hero is the LCP element and this would become it. */
  it('is not the one the homepage mounts', () => {
    expect(read('app/home-client.tsx')).not.toContain('variant="hero"');
  });
});

/* ── THE GUARD THAT WOULD HAVE CAUGHT F-205 ──────────────────────────────────
   Not a grep over the source: the component is server-rendered exactly as Next
   renders it, and every string it publishes is COUNTED. `26026+ Years in
   Toronto` reached production because three copies of one number concatenated
   in the served HTML, and no source-level assertion can see that. */
describe('the served HTML publishes every string exactly once', () => {
  const html = renderToStaticMarkup(createElement(FloorAssembly));
  const once = (needle: string) => html.split(needle).length - 1;

  it('renders at all, and substantially', () => {
    expect(html.length).toBeGreaterThan(8000);
  });

  it('publishes each layer name, description and question once', () => {
    for (const l of ASSEMBLY_LAYERS) {
      expect(once(l.title), l.title).toBe(1);
      expect(once(l.body.slice(0, 40)), `${l.id} body`).toBe(1);
      expect(once(l.ask.slice(0, 40)), `${l.id} ask`).toBe(1);
    }
  });

  it('publishes every species and every pattern name once, whichever is selected', () => {
    for (const s of ASSEMBLY_SPECIES) expect(once(`>${s.name}</button>`), s.name).toBe(1);
    for (const p of ASSEMBLY_PATTERNS) expect(once(`>${p.label}</button>`), p.label).toBe(1);
  });

  it('puts no text inside the animated element', () => {
    expect(html).toContain('class="fa-boards"');
    expect(/class="fa-board"[^>]*>[^<]/.test(html)).toBe(false);
    expect(/class="fa-layer"[^>]*>[^<]/.test(html)).toBe(false);
  });

  it('requests exactly one texture for all of the boards', () => {
    const urls = new Set([...html.matchAll(/url\((\/textures\/[^)]+)\)/g)].map((m) => m[1]));
    expect(urls.size).toBe(1);
  });

  it('ships neither the collapsed nor the live state — script owns both', () => {
    expect(html).not.toContain('data-collapsed');
    expect(html).not.toContain('data-live');
  });

  it('ships the boards server-side, so the floor is in the HTML', () => {
    const n = (html.match(/class="fa-board"/g) ?? []).length;
    expect(n).toBe(boardsFor(ASSEMBLY_DEFAULT_PATTERN).boards.length);
  });

  it('carries species and pattern on the exit link', () => {
    expect(html).toContain('species=white+oak');
    expect(html).toContain(`pattern=${ASSEMBLY_DEFAULT_PATTERN}`);
  });

  it('renders the hero variant too, with all five layers still in the HTML', () => {
    const hero = renderToStaticMarkup(createElement(FloorAssembly, { variant: 'hero' as const }));
    expect(hero).toContain('data-variant="hero"');
    for (const l of ASSEMBLY_LAYERS) expect(hero, l.title).toContain(l.title);
  });
});
