/**
 * value-scenario-evidence.test.ts — ASSISTANT-05.
 *
 * The one integration point between the pure value-scenario model and real
 * `content/case-studies/*.mdx` content. Asserts the loader reads the real,
 * published files (never a fixture standing in for them) and classifies
 * them the way value-scenario.ts's module comment claims it does: every
 * published case study today documents a new-floor install with an
 * attributed testimonial.
 */
import { describe, expect, it } from 'vitest';
import { loadCaseStudyEvidence } from './value-scenario-evidence';

describe('loadCaseStudyEvidence', () => {
  it('loads every published case study with a real slug, title and url', async () => {
    const evidence = await loadCaseStudyEvidence();
    expect(evidence.length).toBeGreaterThan(0);
    for (const cs of evidence) {
      expect(cs.slug).toMatch(/^[a-z0-9-]+$/);
      expect(cs.url).toBe(`/case-studies/${cs.slug}`);
      expect(cs.title.length).toBeGreaterThan(0);
      expect(cs.squareFootage).toBeGreaterThan(0);
    }
  });

  it('classifies every published case study as a documented new-floor install today', async () => {
    // A real, current fact about this repo's content — see value-scenario.ts's
    // module comment. If this ever fails, it means a refinish-only case study
    // was published, which is good news for evidence coverage, not a bug here.
    const evidence = await loadCaseStudyEvidence();
    expect(evidence.every((cs) => cs.documentsNewFloorInstall)).toBe(true);
  });

  it('classifies every published case study as carrying an attributed testimonial today', async () => {
    const evidence = await loadCaseStudyEvidence();
    expect(evidence.every((cs) => cs.hasAttributedTestimonial)).toBe(true);
  });
});
