import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('refinishing page — search-intent order', () => {
  it('shows cost, then dust control, then the booking form', () => {
    const src = readFileSync(join(__dirname, '../app/hardwood-floor-refinishing-toronto/page.tsx'), 'utf8');
    const cost = src.indexOf("band('fullSandAndFinish')}/sq ft");
    const dust = src.indexOf('aria-label="Dust containment"');
    const book = src.indexOf('<EstimateForm');
    expect(cost).toBeGreaterThan(-1);
    expect(dust).toBeGreaterThan(cost);
    expect(book).toBeGreaterThan(dust);
  });
});
