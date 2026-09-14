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
  ASSEMBLY_CHOICE_COUNT,
  ASSEMBLY_DEFAULT_FINISH,
  ASSEMBLY_DEFAULT_PATTERN,
  ASSEMBLY_DEFAULT_SPECIES,
  ASSEMBLY_DEFAULT_WIDTH,
  ASSEMBLY_FINISHES,
  ASSEMBLY_LAYERS,
  ASSEMBLY_LAYER_COUNT,
  ASSEMBLY_PATTERNS,
  ASSEMBLY_SPECIES,
  ASSEMBLY_WIDTHS,
  UNDER_THE_BOARD,
  assemblyDesignHref,
  boardFace,
  boardsFor,
  fieldWidthFor,
  grainTextureFor,
  layerById,
} from './floor-assembly';
import { BOARD_WIDTHS, FLOOR_PRODUCTS } from './floor-studio/catalog';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';

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
  /* VIS-07 — THREE. A board has three layers; the five-layer version drew the
     installation as though it were part of the board, which it is not. */
  it('are three, numbered in order, top of the board first', () => {
    expect(ASSEMBLY_LAYER_COUNT).toBe(3);
    expect(ASSEMBLY_LAYERS.map((l) => l.n)).toEqual(['01', '02', '03']);
    expect(ASSEMBLY_LAYERS.map((l) => l.id)).toEqual(['finish', 'wear-layer', 'cross-ply-core']);
  });

  it('keep the three installation questions, numbered on from the board', () => {
    expect(UNDER_THE_BOARD.map((l) => l.n)).toEqual(['04', '05', '06']);
    expect(UNDER_THE_BOARD.map((l) => l.id)).toEqual(['fastening', 'moisture-control', 'substrate']);
  });

  it('have unique ids and resolve through layerById', () => {
    const ids = [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(layerById(id)?.id).toBe(id);
    expect(layerById('not-a-layer')).toBeUndefined();
  });

  /* The `ask` is the commercial payload of the whole graphic. A layer without
     one is a layer that decorates instead of selling. */
  it('each carry a question a buyer can put to a contractor', () => {
    for (const l of [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD]) {
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
    const prose = [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD]
      .map((l) => `${l.body} ${l.ask}`)
      .join(' ')
      .toLowerCase();
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
    expect(src).toContain('className="fa-stage"');
    expect(src).toContain('aria-hidden="true"');
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
    /* HEADING-SHAPED, NOT WORD-SHAPED. Counting the bare title fails on
       "Finish", which also occurs inside the "Finished in" chip label and an
       aria-label — three substring hits for one published heading. F-205 is
       about a VALUE published twice, so count the element that publishes it. */
    for (const l of [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD]) {
      expect(once(`<p class="fa-t">${l.title}</p>`), l.title).toBe(1);
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
    expect(n).toBe(
      boardsFor(ASSEMBLY_DEFAULT_PATTERN, { width: fieldWidthFor(ASSEMBLY_DEFAULT_WIDTH) }).boards.length,
    );
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

/* ══ VIS-07 ═══════════════════════════════════════════════════════════════ */

describe('eighteen choices, and not one of them is new', () => {
  it('offers at least fifteen options across the four axes', () => {
    expect(ASSEMBLY_CHOICE_COUNT).toBeGreaterThanOrEqual(15);
    expect(ASSEMBLY_CHOICE_COUNT).toBe(
      ASSEMBLY_SPECIES.length + ASSEMBLY_FINISHES.length + ASSEMBLY_PATTERNS.length + ASSEMBLY_WIDTHS.length,
    );
  });

  /* Every axis is the catalogue's own list. A copy is how the homepage comes
     to offer a finish that /design does not have and pricing does not price. */
  it('takes every axis from the catalogue rather than copying it', () => {
    expect(ASSEMBLY_SPECIES.map((s) => s.id)).toEqual(FLOOR_PRODUCTS.map((p) => p.id));
    expect(ASSEMBLY_FINISHES.map((f) => f.id)).toEqual(FINISH_OPTIONS.map((f) => f.id));
    expect(ASSEMBLY_PATTERNS.map((p) => p.id)).toEqual(PATTERN_OPTIONS.map((p) => p.id));
    expect(ASSEMBLY_WIDTHS.map((w) => w.id)).toEqual(BOARD_WIDTHS.map((w) => w.id));
  });

  it('defaults to options that exist on their own axis', () => {
    expect(ASSEMBLY_FINISHES.some((f) => f.id === ASSEMBLY_DEFAULT_FINISH)).toBe(true);
    expect(ASSEMBLY_WIDTHS.some((w) => w.id === ASSEMBLY_DEFAULT_WIDTH)).toBe(true);
  });

  /* A choice that does not change the picture is a decoration pretending to
     be a configurator. Width is the one that is easiest to fake, so it is the
     one asserted: the board count must follow the REAL inches. */
  it('makes width change the picture in proportion to its real inches', () => {
    const counts = ASSEMBLY_WIDTHS.map((w) => ({
      inches: w.inches,
      boards: boardsFor('straight', { width: fieldWidthFor(w.id) }).boards.length,
    }));
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]!.inches, 'widths ascend').toBeGreaterThan(counts[i - 1]!.inches);
      expect(counts[i]!.boards, `${counts[i]!.inches}" lays fewer boards`).toBeLessThan(counts[i - 1]!.boards);
    }
    const narrow = counts[0]!.boards;
    const widest = counts[counts.length - 1]!.boards;
    expect(narrow).toBeGreaterThan(widest * 2);
  });

  it('derives the field width from inches rather than a hand-made table', () => {
    for (const w of ASSEMBLY_WIDTHS) {
      expect(fieldWidthFor(w.id), w.id).toBeCloseTo((w.inches / 5) * 7.5, 2);
    }
    /* An unknown width must fall back, never produce NaN and a blank floor. */
    expect(Number.isFinite(fieldWidthFor('not-a-width'))).toBe(true);
  });
});

describe('the handoff carries what /design reads, and nothing it does not', () => {
  const href = assemblyDesignHref(ASSEMBLY_SPECIES[0]!, 'chevron', 'wire-brushed');
  const q = new URLSearchParams(href.slice(href.indexOf('?') + 1));

  it('carries species, finish and pattern', () => {
    expect(q.get('species')).toBe(ASSEMBLY_SPECIES[0]!.rateKey);
    expect(q.get('finish')).toBe('wire-brushed');
    expect(q.get('pattern')).toBe('chevron');
  });

  it('refuses a finish the configurator has no option for', () => {
    expect(assemblyDesignHref(ASSEMBLY_SPECIES[0]!, 'straight', 'lacquered')).not.toContain('finish=');
  });

  /* THE SILENT DROP, AVOIDED FOR THE THIRD TIME. FloorConfigurator reads four
     parameters and has no width control, so `width=` would be read by nobody. */
  it('does not send a width, because nothing reads one', () => {
    expect(href).not.toContain('width=');
    const cfg = read('app/components/FloorConfigurator.tsx');
    expect(cfg).not.toContain("q.get('width')");
  });

  it('and FloorConfigurator really does match finishes by id', () => {
    expect(read('app/components/FloorConfigurator.tsx')).toContain(
      'FINISH_OPTIONS.some((f) => f.id === qsFinish)',
    );
  });
});

describe('the board is described the way the glossary describes it', () => {
  const glossary = read('lib/glossary.ts');

  /* The homepage and the glossary must not drift. These are the load-bearing
     phrases: if the glossary is reworded, this fails and someone decides. */
  it('uses the published definition of the wear layer', () => {
    const wear = ASSEMBLY_LAYERS.find((l) => l.id === 'wear-layer')!;
    expect(wear.body).toContain('above the core');
    expect(glossary).toContain('The thickness of real hardwood above the core');
  });

  it('uses the published definition of the cross-ply core', () => {
    const core = ASSEMBLY_LAYERS.find((l) => l.id === 'cross-ply-core')!;
    expect(core.body).toContain('90°');
    expect(glossary).toContain('each layer oriented at 90° to the one beside it');
  });

  /* Do not put a competitor's product claim in this company's mouth. The
     reference for this section was another manufacturer's page describing
     THEIR board — a two-layer solid core with a UV-cured urethane finish.
     Ecowoods sells solid or engineered; it does not sell that product. */
  it('makes no claim copied from another manufacturer', () => {
    const prose = [...ASSEMBLY_LAYERS, ...UNDER_THE_BOARD]
      .map((l) => `${l.title} ${l.body} ${l.ask}`)
      .join(' ')
      .toLowerCase();
    for (const claim of ['two-layer', 'solid core', 'uv cured', 'uv-cured', 'toxic-free']) {
      expect(prose, claim).not.toContain(claim);
    }
  });
});

describe('the finish is applied, not just labelled', () => {
  const src = read('app/components/FloorAssembly.tsx');
  const css = read('app/globals.css');

  it('passes the published sheen and tint into the render', () => {
    expect(src).toContain("'--fa-sheen': String(finish.sheen)");
    expect(src).toContain("'--fa-tint': finish.tint");

    /* The tint must be in the BOARD's own background stack, not merely
       declared as a variable somewhere. Read that one declaration and check
       it there — asserting on the whole file would pass on the --fa-tint line
       alone, and asserting on the template text would need a literal ${...}
       inside a plain string, which parse-scan rightly refuses. */
    const at = src.indexOf('backgroundImage:');
    expect(at, 'no backgroundImage on the board').toBeGreaterThan(-1);
    const decl = src.slice(at, src.indexOf('\n', at + 1));
    expect(decl, 'the board is not tinted by the finish').toContain('finish.tint');
    expect(src).toContain("backgroundBlendMode: 'multiply, multiply, normal'");
  });

  it('and the stylesheet actually reads the sheen', () => {
    expect(css).toContain('var(--fa-sheen');
  });

  it('every finish carries a sheen that can differ on screen', () => {
    const sheens = new Set(ASSEMBLY_FINISHES.map((f) => f.sheen));
    expect(sheens.size).toBeGreaterThan(1);
    for (const f of ASSEMBLY_FINISHES) expect(f.tint, f.id).toContain('rgba');
  });
});

describe('the motion has amplitude a person can see', () => {
  const css = read('app/globals.css');

  /* The first version turned 15° over 26 seconds, which is real motion and is
     below the threshold at which someone glancing at it believes it moves. */
  it('turns far enough, and does not retrace its own path', () => {
    const drift = css.slice(css.indexOf('@keyframes fa-drift'), css.indexOf('@keyframes fa-float'));
    const degs = [...drift.matchAll(/\+ (\d+)deg/g)].map((m) => Number(m[1]));
    expect(Math.max(...degs, 0)).toBeGreaterThanOrEqual(20);
    expect(drift).toContain('35%');
    expect(drift).toContain('70%');
  });

  it('floats the layers far enough to read as separate', () => {
    const float = css.slice(css.indexOf('@keyframes fa-float'));
    expect(float.slice(0, 200)).toMatch(/translate: 0 0 (\d\d)px/);
  });

  it('gives all three layers different periods so they never re-sync', () => {
    const durations = [...css.matchAll(/\.fa-layer\[data-i='\d'\] \{ animation-duration: (\d+)s/g)].map((m) =>
      Number(m[1]),
    );
    expect(durations.length).toBe(3);
    expect(new Set(durations).size).toBe(3);
  });
});
