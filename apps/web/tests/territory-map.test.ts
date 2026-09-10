import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORRIDORS, MARKETS } from '@/lib/geo';
import { SPINES, along, jitter, VIEWBOX } from '@/app/components/TerritoryMap';

/**
 * The map is generated from the registry, so what has to be tested is not the
 * picture but the contract between the two: every corridor can be drawn, and
 * nothing it draws lands outside the frame.
 */
describe('the territory map', () => {
  it('has a spine for every corridor — a corridor without one is invisible', () => {
    for (const c of CORRIDORS) {
      expect(SPINES[c.id], `${c.id} has no spine and would not be drawn`).toBeDefined();
      expect(SPINES[c.id]!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('draws no spine for a corridor that does not exist', () => {
    const ids = new Set(CORRIDORS.map((c) => c.id as string));
    for (const id of Object.keys(SPINES)) expect(ids.has(id), `${id} is not a corridor`).toBe(true);
  });

  it('places every municipality inside the frame, with room for its halo', () => {
    const pad = 4;
    for (const c of CORRIDORS) {
      const pts = SPINES[c.id]!;
      const n = c.members.length;
      c.members.forEach((slug, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const [x, y] = along(pts, 0.06 + t * 0.88);
        const [jx, jy] = jitter(slug);
        expect(x + jx, `${slug} x`).toBeGreaterThan(pad);
        expect(x + jx, `${slug} x`).toBeLessThan(VIEWBOX.w - pad);
        expect(y + jy, `${slug} y`).toBeGreaterThan(pad);
        expect(y + jy, `${slug} y`).toBeLessThan(VIEWBOX.h - pad);
      });
    }
  });

  it('jitters deterministically — a random offset would break hydration', () => {
    expect(jitter('buffalo')).toEqual(jitter('buffalo'));
    expect(jitter('buffalo')).not.toEqual(jitter('pittsford'));
    for (const [dx, dy] of MARKETS.map((m) => jitter(m.slug))) {
      expect(Math.abs(dx)).toBeLessThanOrEqual(3.2);
      expect(Math.abs(dy)).toBeLessThanOrEqual(3.2);
    }
  });

  it('names both countries and the border in what a machine is told', () => {
    const src = readFileSync(join(process.cwd(), 'app/components/TerritoryMap.tsx'), 'utf8');
    expect(src).toMatch(/Canada · United States/);
    expect(src).toMatch(/aria-label=/);
    // The territory has to exist as text, not only as an SVG.
    expect(src).toMatch(/tm-index/);
    expect(src).toMatch(/role="img"/);
  });

  it('carries no second list of places — the registry is the only source', () => {
    const src = readFileSync(join(process.cwd(), 'app/components/TerritoryMap.tsx'), 'utf8');
    for (const name of ['Buffalo', 'Rochester', 'Hamilton', 'Oakville', 'Pittsford']) {
      // Municipality names may appear in prose comments; none may appear in a
      // data literal that would drift from content/geo/markets.ts.
      const inCode = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(inCode.includes(`'${name}'`), `${name} is hardcoded in the map`).toBe(false);
    }
  });
});
