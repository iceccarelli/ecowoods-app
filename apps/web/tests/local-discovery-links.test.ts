/**
 * Local discovery links: city pages link out to guides, corridors and projects,
 * project pages link back to their area, every job card resolves to a published
 * area, and the unsourced downtown "signature project" stays gone.
 */
import { describe, expect, it } from 'vitest';
import { JOB_CARDS, jobCardsForArea } from '@/content/job-cards';
import { SERVICE_AREAS, cityBySlug, cityContent } from '@/lib/seo-data';
import { PROJECTS } from '@/lib/projects';
import { GUIDES } from '@/lib/guides';
import { CORRIDORS, assess, marketBySlug } from '@/lib/geo';
import {
  areaForProjectLocation,
  areaPlacement,
  corridorLinkForArea,
  guidesForArea,
  projectsForArea,
} from '@/lib/area-groups';

describe('job cards resolve to published areas', () => {
  it('every card names a published area slug', () => {
    for (const j of JOB_CARDS) expect(cityBySlug(j.areaSlug), j.slug).toBeDefined();
  });

  it('the Distillery District job renders on Downtown Toronto', () => {
    const slugs = jobCardsForArea('downtown-toronto').map((j) => j.slug);
    expect(slugs).toContain('distillery-district-victorian-condo');
  });

  it('every card is reachable from exactly the area it names', () => {
    for (const j of JOB_CARDS) {
      expect(jobCardsForArea(j.areaSlug).map((x) => x.slug)).toContain(j.slug);
    }
  });
});

describe('downtown signature project', () => {
  it('is not published: no case study backs a 102-year-old east-end house', () => {
    expect(cityContent('downtown-toronto')?.signatureProject).toBeUndefined();
  });
  it('downtown still clears the worthiness gate', () => {
    const mk = marketBySlug('downtown-toronto')!;
    expect(assess(mk).indexable).toBe(true);
  });
});

describe('read-next links on city pages', () => {
  it('every area gets 2-3 guides that exist', () => {
    const real = new Set(GUIDES.map((g) => g.slug));
    for (const c of SERVICE_AREAS) {
      const g = guidesForArea(c.slug);
      expect(g.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(g.length, c.slug).toBeLessThanOrEqual(3);
      for (const x of g) expect(real.has(x.slug)).toBe(true);
    }
  });

  it('every area links a corridor page that exists', () => {
    const ids = new Set(CORRIDORS.map((c) => c.id));
    for (const c of SERVICE_AREAS) {
      const l = corridorLinkForArea(c.slug);
      expect(l, c.slug).not.toBeNull();
      expect(ids.has(l!.id as never)).toBe(true);
    }
  });

  it('a district describes where it sits using registry facts only', () => {
    const p = areaPlacement('cabbagetown')!;
    expect(p.parent.slug).toBe('toronto');
    expect(p.neighbours.map((n) => n.slug)).toEqual(['riverdale', 'downtown-toronto']);
    expect(p.corridors.length).toBeGreaterThan(0);
    expect(areaPlacement('toronto')).toBeNull();
  });
});

describe('project locations link to areas', () => {
  it('a location resolves to a published area or to null, never a guess', () => {
    for (const p of PROJECTS) {
      const a = areaForProjectLocation(p.location);
      if (a) expect(cityBySlug(a.slug)).toBeDefined();
    }
    expect(areaForProjectLocation({ neighbourhood: 'GTA', city: 'Nowhere' })).toBeNull();
    expect(areaForProjectLocation({ neighbourhood: 'Maple', city: 'Vaughan' })?.slug).toBe('vaughan');
    expect(areaForProjectLocation({ neighbourhood: 'Rosedale', city: 'Toronto' })?.slug).toBe('rosedale');
  });

  it('a project appears on the page of the area it resolves to', () => {
    for (const p of PROJECTS) {
      const a = areaForProjectLocation(p.location);
      if (a) expect(projectsForArea(a.slug).map((x) => x.slug)).toContain(p.slug);
    }
  });
});
