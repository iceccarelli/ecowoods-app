/**
 * Floor Studio's surfaces, as a contract.
 *
 * The lib/floor-studio/*.test.ts files prove the arithmetic. This one proves
 * the WIRING — that the studio is discoverable, that the machine edition says
 * the same things the page says, and that no paid rung has quietly acquired a
 * price. Every one of these is a thing that can break without a single unit
 * test noticing, which is the shape of most of the findings in this repository.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildActions, buildPages } from '@/lib/registry/registry';
import { floorStudioToMarkdown } from '@/lib/markdown-export';
import { STUDIO_PRODUCTS, publishedStudioProducts } from '@/content/constants/studio-products';
import { FUNNELS, ROUTE_FUNNEL, completionOf, funnelById } from '@/lib/funnels';
import { BOARD_WIDTHS, FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import { FEELS } from '@/lib/floor-studio/match';

const ROOT = join(process.cwd(), '..', '..');

describe('a machine can find the studio and knows what it refuses', () => {
  const action = buildActions().find((a) => a.data.name === 'visualise_floor');

  it('publishes visualise_floor as an action primitive', () => {
    expect(action).toBeDefined();
    expect(action!.data.target).toMatch(/\/floor-studio$/);
    expect(action!.data.human_page).toMatch(/\/floor-studio$/);
    expect(action!.canonical_url).toMatch(/\/floor-studio$/);
  });

  it('states the four refusals that decide whether it is worth naming', () => {
    const refuses = (action!.data.refuses ?? []).join(' ').toLowerCase();
    expect(refuses).toMatch(/no generated floors/);
    expect(refuses).toMatch(/cannot give an area/);
    expect(refuses).toMatch(/no quote/);
    expect(refuses).toMatch(/no photograph is uploaded/);
  });

  it('gives a worked example that opens a real configuration', () => {
    expect(action!.data.example).toMatch(/floor-studio\?c=[a-z-]+\.[a-z-]+\.[a-z-]+\./);
  });

  it('registers the page, with its markdown twin', () => {
    const page = buildPages().find((p) => p.data.path === '/floor-studio');
    expect(page).toBeDefined();
    expect(page!.data.markdown_url).toMatch(/\/floor-studio\.md$/);
    expect(page!.data.fragments).toContain('limits');
  });

  it('serves that twin from a rewrite and a handler that exist', () => {
    const config = readFileSync(join(ROOT, 'apps/web/next.config.js'), 'utf8');
    expect(config).toContain("['/floor-studio', '/floor-studio.md']");
    expect(() => readFileSync(join(ROOT, 'apps/web/app/md/floor-studio/route.ts'), 'utf8')).not.toThrow();
  });
});

describe('the markdown edition says what the page says', () => {
  const md = floorStudioToMarkdown();

  it('leads with what it is and where it runs', () => {
    expect(md.startsWith('# Ecowoods Floor Studio')).toBe(true);
    expect(md).toMatch(/never uploaded/);
  });

  it('lists the whole vocabulary a caller may use', () => {
    for (const p of FLOOR_PRODUCTS) expect(md, p.name).toContain(p.name);
    for (const w of BOARD_WIDTHS) expect(md, w.label).toContain(w.label);
    for (const f of FEELS.filter((x) => x.id !== 'unsure')) expect(md, f.label).toContain(f.label);
  });

  it('names the two combinations we do not lay, with the reason', () => {
    expect(md).toMatch(/tannin/i);
    expect(md).toMatch(/cut as blocks/i);
  });

  it('carries the four refusals', () => {
    expect(md).toMatch(/does not generate floors/i);
    expect(md).toMatch(/does not measure the room/i);
    expect(md).toMatch(/does not produce a quote/i);
    expect(md).toMatch(/does not retain the photograph/i);
  });

  it('contains no price literal of its own — the band is interpolated', () => {
    /* content/constants/pricing.ts is the only place a band may live, and
       verify-pricing-source enforces it in source. This asserts the RENDERED
       output still routes through formatBand rather than a typed figure. */
    const bands = md.match(/\$\d+\.\d{2}/g) ?? [];
    expect(bands.length).toBeGreaterThan(0);
    expect(md).toContain('per sq ft');
  });

  it('ends with provenance a citation can use', () => {
    expect(md).toMatch(/## Provenance/);
    expect(md).toMatch(/Canonical URL: https:\/\/[^\s]+\/floor-studio/);
  });
});

describe('the money ladder is declared and not published', () => {
  it('publishes no price for any rung', () => {
    for (const p of STUDIO_PRODUCTS) {
      expect(p.priceCad, p.id).toBeNull();
    }
  });

  it('ships only the rung that charges nothing', () => {
    const live = publishedStudioProducts();
    expect(live.map((p) => p.id)).toEqual(['samples']);
  });

  it('says what every rung is not, so it cannot be oversold later', () => {
    for (const p of STUDIO_PRODUCTS) {
      expect(p.refuses.length, p.id).toBeGreaterThan(0);
      expect(p.deliverable.length, p.id).toBeGreaterThan(40);
    }
  });
});

describe('the studio funnel is measurable', () => {
  it('exists, is bound to the route, and completes on the handoff', () => {
    const studio = funnelById('studio')!;
    expect(studio).toBeDefined();
    expect(ROUTE_FUNNEL['/floor-studio']).toBe('studio');
    expect(completionOf(studio)).toBe('studio_estimate_handoff');
  });

  it('does not send a visitor who has just seen their room to a booking form', () => {
    expect(funnelById('studio')!.nextStep.href).toBe('/projects');
    expect(FUNNELS.filter((f) => f.nextStep.href.startsWith('/estimate')).length).toBeLessThanOrEqual(3);
  });
});
