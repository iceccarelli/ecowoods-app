/**
 * value-scenario.test.ts — ASSISTANT-05.
 *
 * Covers docs/assistant-workspace/VALUE_SCENARIO_SPEC.md's hard rules:
 * insufficient evidence renders a null range (not a bug — the expected,
 * honest default given today's evidence pool), confidence never reaches
 * 'high' (the type itself excludes it), no rendered string makes an absolute
 * house-value claim, and costBasis always traces to economics.ts's own
 * `projectRangeForState` — never a second, competing computation.
 */
import { describe, expect, it } from 'vitest';
import { buildValueScenario, type CaseStudyEvidence } from './value-scenario';
import { projectRangeForState } from './economics';
import { applyPatch, defaultWorkspaceState } from './state';

const installEvidence = (overrides: Partial<CaseStudyEvidence> = {}): CaseStudyEvidence => {
  const slug = overrides.slug ?? 'test-install';
  return {
    slug,
    title: 'Test install case study',
    url: `/case-studies/${slug}`,
    squareFootage: 1000,
    neighbourhood: 'Forest Hill',
    documentsNewFloorInstall: true,
    hasAttributedTestimonial: true,
    ...overrides,
  };
};

function installState(squareFeet: number) {
  return applyPatch(defaultWorkspaceState(), {
    rooms: [{ label: 'Whole project', squareFeet }],
    selectedServiceSlugs: ['hardwood-installation'],
  });
}

function refinishState(squareFeet: number) {
  return applyPatch(defaultWorkspaceState(), {
    rooms: [{ label: 'Whole project', squareFeet }],
    selectedServiceSlugs: ['floor-refinishing'],
  });
}

describe('buildValueScenario — status passthrough', () => {
  it('reports needs-sqft when the underlying cost basis does', () => {
    const state = applyPatch(defaultWorkspaceState(), { selectedServiceSlugs: ['hardwood-installation'] });
    const costBasis = projectRangeForState(state);
    expect(buildValueScenario(state, costBasis, [])).toEqual({ status: 'needs-sqft' });
  });

  it('reports needs-service when the underlying cost basis does', () => {
    const state = applyPatch(defaultWorkspaceState(), { rooms: [{ label: 'Living room', squareFeet: 500 }] });
    const costBasis = projectRangeForState(state);
    expect(buildValueScenario(state, costBasis, [])).toEqual({ status: 'needs-service' });
  });
});

describe('buildValueScenario — effect.range is always null', () => {
  it('is null with zero evidence (insufficient evidence — a valid, expected output)', () => {
    const state = installState(1000);
    const result = buildValueScenario(state, projectRangeForState(state), []);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.scenario.effect.range).toBeNull();
      expect(result.scenario.effect.unit).toBe('qualitative');
    }
  });

  it('is still null with abundant matching evidence — this system has no evidence that quantifies a value effect', () => {
    const state = installState(1000);
    const pool = [installEvidence({ slug: 'a' }), installEvidence({ slug: 'b' }), installEvidence({ slug: 'c' })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.scenario.effect.range).toBeNull();
    }
  });
});

describe('buildValueScenario — confidence never reaches high', () => {
  it('the type itself only allows low | medium', () => {
    const state = installState(1000);
    const pool = Array.from({ length: 10 }, (_, i) => installEvidence({ slug: `cs-${i}` }));
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(['low', 'medium']).toContain(result.scenario.effect.confidence);
      // @ts-expect-error — 'high' is not assignable to ValueConfidence; this line documents that the path is deleted, not just untested.
      const neverHigh: typeof result.scenario.effect.confidence = 'high';
      expect(neverHigh).not.toBe('low');
    }
  });

  it('is low with zero or one matching evidence point', () => {
    const state = installState(1000);
    expect(
      (buildValueScenario(state, projectRangeForState(state), []) as { status: 'ready'; scenario: { effect: { confidence: string } } })
        .scenario.effect.confidence,
    ).toBe('low');
    expect(
      (
        buildValueScenario(state, projectRangeForState(state), [installEvidence()]) as {
          status: 'ready';
          scenario: { effect: { confidence: string } };
        }
      ).scenario.effect.confidence,
    ).toBe('low');
  });

  it('is medium with two or more comparable-scope matches', () => {
    const state = installState(1000);
    const pool = [installEvidence({ slug: 'a' }), installEvidence({ slug: 'b' })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.scenario.effect.confidence).toBe('medium');
  });
});

describe('buildValueScenario — evidence scope matching', () => {
  it('matches install-shaped evidence to an install project', () => {
    const state = installState(1000);
    const pool = [installEvidence({ squareFootage: 1100 })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const caseCitations = result.scenario.evidence.filter((e) => e.tier !== 'E0');
      expect(caseCitations).toHaveLength(1);
    }
  });

  it('does not match install-shaped evidence to a refinish-only project — no refinish case study is published yet', () => {
    const state = refinishState(1000);
    const pool = [installEvidence({ squareFootage: 1100 })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const caseCitations = result.scenario.evidence.filter((e) => e.tier !== 'E0');
      expect(caseCitations).toHaveLength(0);
      expect(result.scenario.effect.confidence).toBe('low');
    }
  });

  it('does not match evidence far outside the comparable square-footage band', () => {
    const state = installState(1000);
    const tooSmall = installEvidence({ squareFootage: 200 }); // ratio 0.2, below MIN_SQFT_RATIO
    const tooLarge = installEvidence({ squareFootage: 5000 }); // ratio 5.0, above MAX_SQFT_RATIO
    const result = buildValueScenario(state, projectRangeForState(state), [tooSmall, tooLarge]);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.scenario.evidence.filter((e) => e.tier !== 'E0')).toHaveLength(0);
    }
  });

  it('tiers a case study with an attributed testimonial as E3, and one without as E2', () => {
    const state = installState(1000);
    const withTestimonial = installEvidence({ slug: 'with', hasAttributedTestimonial: true });
    const withoutTestimonial = installEvidence({ slug: 'without', hasAttributedTestimonial: false });
    const result = buildValueScenario(state, projectRangeForState(state), [withTestimonial, withoutTestimonial]);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const withCite = result.scenario.evidence.find((e) => e.url === '/case-studies/with');
      const withoutCite = result.scenario.evidence.find((e) => e.url === '/case-studies/without');
      expect(withCite?.tier).toBe('E3');
      expect(withoutCite?.tier).toBe('E2');
    }
  });

  it('always carries an E0 citation naming the value-quantification gap, even with real matches', () => {
    const state = installState(1000);
    const result = buildValueScenario(state, projectRangeForState(state), [installEvidence()]);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.scenario.evidence.some((e) => e.tier === 'E0')).toBe(true);
    }
  });

  it('never labels a case-study citation as anything other than "Ecowoods project record"', () => {
    const state = installState(1000);
    const result = buildValueScenario(state, projectRangeForState(state), [installEvidence()]);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      for (const citation of result.scenario.evidence.filter((e) => e.tier === 'E2' || e.tier === 'E3')) {
        expect(citation.source).toBe('Ecowoods project record');
        expect(citation.source.toLowerCase()).not.toContain('verified');
        expect(citation.source.toLowerCase()).not.toContain('confirmed');
      }
    }
  });
});

describe('buildValueScenario — costBasis traces to economics.ts', () => {
  it('equals projectRangeForState(state).total exactly — never a second computation', () => {
    const state = installState(1200);
    const costBasis = projectRangeForState(state);
    const result = buildValueScenario(state, costBasis, []);
    expect(result.status).toBe('ready');
    expect(costBasis.status).toBe('ready');
    if (result.status === 'ready' && costBasis.status === 'ready') {
      expect(result.scenario.costBasis).toEqual(costBasis.total);
    }
  });
});

describe('buildValueScenario — no absolute house-value claim anywhere in rendered text', () => {
  const FORBIDDEN = [/worth \$/i, /your (home|house|property) (is|will be) worth/i, /adds \$[\d,]+/i, /guarantee/i];

  it('the label, assumptions and limitations never claim a future sale price', () => {
    const state = installState(1000);
    const pool = [installEvidence({ slug: 'a' }), installEvidence({ slug: 'b' })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const strings = [
        result.scenario.label,
        ...result.scenario.assumptions,
        ...result.scenario.limitations,
        ...result.scenario.evidence.map((e) => e.note),
      ];
      for (const s of strings) {
        for (const pattern of FORBIDDEN) {
          expect(s).not.toMatch(pattern);
        }
      }
    }
  });

  it('the label always contains "scenario," "range," or "potential"', () => {
    const state = installState(1000);
    const result = buildValueScenario(state, projectRangeForState(state), []);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const label = result.scenario.label.toLowerCase();
      expect(label.includes('scenario') || label.includes('range') || label.includes('potential')).toBe(true);
    }
  });

  it('never stacks or multiplies a percentage in assumptions/limitations text', () => {
    const state = installState(1000);
    const pool = [installEvidence({ slug: 'a' }), installEvidence({ slug: 'b' }), installEvidence({ slug: 'c' })];
    const result = buildValueScenario(state, projectRangeForState(state), pool);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const strings = [...result.scenario.assumptions, ...result.scenario.limitations];
      for (const s of strings) {
        expect(s).not.toMatch(/%.*%/); // no string ever combines two percentages
      }
    }
  });
});
