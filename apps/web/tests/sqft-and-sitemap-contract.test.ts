import { describe, expect, it } from 'vitest';
import { appointmentSchema, photoTriageSchema } from '@ecowoods/shared/schemas';
import { TRILOGIES } from '@/lib/trilogies';
import sitemap from '@/app/sitemap';

describe('sqft is a whole number before it reaches the Int column', () => {
  it('rounds fractional input in the photo-triage schema', () => {
    const shape = photoTriageSchema.shape.sqft;
    expect(shape.parse(850.5)).toBe(851);
    expect(shape.parse(0.2)).toBe(1);
    expect(shape.parse('')).toBeUndefined();
  });
  it('rounds fractional input in the appointment schema', () => {
    const shape = appointmentSchema.shape.sqft;
    expect(shape.parse(849.4)).toBe(849);
  });
});

describe('sitemap covers every statically generated project route', () => {
  it('lists each trilogy page', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const t of TRILOGIES) expect(urls.some((u) => u.endsWith(`/projects/${t.slug}`))).toBe(true);
  });
});
