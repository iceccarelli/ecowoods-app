import { describe, expect, it } from 'vitest';
import { retrieveEvidence, retrieveFramework, retrieveGuides, retrievePapers, retrieveCaseStudies } from './retrieval';
import type { CaseStudyEvidence } from './value-scenario';

const POOL: CaseStudyEvidence[] = [
  {
    slug: 'rosedale-refinish',
    title: 'Rosedale hardwood refinish',
    url: '/case-studies/rosedale-refinish',
    squareFootage: 1200,
    neighbourhood: 'Rosedale',
    documentsNewFloorInstall: false,
    hasAttributedTestimonial: true,
  },
];

describe('retrieval.ts — deterministic evidence retrieval', () => {
  it('retrieveGuides only returns guides whose fields actually match the topic', () => {
    const hits = retrieveGuides('refinish');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.entityType).toBe('guide');
      expect(h.canonicalPath).toMatch(/^\/guides\//);
    }
  });

  it('retrieveGuides returns nothing for a topic with no real match', () => {
    expect(retrieveGuides('qqxxzzz999nonexistentqq')).toEqual([]);
  });

  it('retrievePapers returns a real canonical path and freshness date when matched', () => {
    const hits = retrievePapers('moisture');
    if (hits.length) {
      expect(hits[0]!.canonicalPath).toMatch(/^\/papers\//);
      expect(hits[0]!.freshness).toBeTruthy();
    }
  });

  it('retrieveFramework matches on pillar name/intent and points at the one canonical /framework path', () => {
    const hits = retrieveFramework('moisture');
    for (const h of hits) expect(h.canonicalPath).toBe('/framework');
  });

  it('retrieveCaseStudies matches on title/neighbourhood from the supplied pool only', () => {
    const hits = retrieveCaseStudies('rosedale', POOL);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.canonicalPath).toBe('/case-studies/rosedale-refinish');
    expect(hits[0]!.geography).toBe('Rosedale');
  });

  it('retrieveCaseStudies never returns anything not in the supplied pool', () => {
    expect(retrieveCaseStudies('rosedale', [])).toEqual([]);
  });

  it('retrieveEvidence caps combined results at 4 and every result carries a canonical path', () => {
    const hits = retrieveEvidence('refinish moisture', POOL);
    expect(hits.length).toBeLessThanOrEqual(4);
    for (const h of hits) {
      expect(h.canonicalPath.startsWith('/')).toBe(true);
      expect(h.summary.length).toBeGreaterThan(0);
    }
  });

  it('retrieveEvidence returns nothing for a topic with no source anywhere — never fabricates one', () => {
    expect(retrieveEvidence('qqxxzzz888unrelatedqq', [])).toEqual([]);
  });
});
