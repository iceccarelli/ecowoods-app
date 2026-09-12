/**
 * The matcher's contract: every number has a sentence, and the sentence is
 * where the number came from.
 *
 * The test that matters most here is "score reconstructs from judgements". It
 * is the mechanical form of the rule in the module header — a criterion that
 * cannot explain itself is not allowed to move the score — and it is the one
 * that breaks the moment somebody adds a quiet nudge to a ranking.
 */
import { describe, expect, it } from 'vitest';
import {
  CRITERION_IDS,
  FEELS,
  MATCH_INPUT_VOCABULARY,
  ROOM_TYPES,
  hasFeelOpinion,
  isFeelTag,
  matchFloors,
  matchWithinProduct,
  recomputeScore,
  scoreConfiguration,
  type MatchInput,
} from './match';
import { DEFAULT_CONFIGURATION, isLayable, productById } from './catalog';

const base: MatchInput = { feels: ['unsure'], squareFeet: 900 };

const withRoom = (over: Partial<MatchInput>): MatchInput => ({
  ...base,
  room: { lightLevel: 'balanced', wallUndertone: 'neutral', existingFloorTone: 'mid' },
  ...over,
});

describe('every score is reconstructible from its own explanations', () => {
  it('holds for the headline matches of every feel', () => {
    for (const feel of FEELS) {
      const matches = matchFloors(withRoom({ feels: [feel.id] }), 5);
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        expect(recomputeScore(m.judgements), `${feel.id} → ${m.id}`).toBe(m.score);
      }
    }
  });

  it('holds when a budget is in play', () => {
    for (const m of matchFloors(withRoom({ feels: ['luxurious'], budgetCad: 12000 }), 5)) {
      expect(recomputeScore(m.judgements)).toBe(m.score);
    }
  });

  it('gives an evidence-free floor 50, not 4', () => {
    /* No feels with an opinion, no photo, no room type, no budget: nothing
       applied, so nothing is known. A recommender that prints a low number
       here is lying about its own certainty. */
    const m = scoreConfiguration({ feels: ['unsure'], squareFeet: 900 }, DEFAULT_CONFIGURATION)!;
    expect(m.judgements).toHaveLength(0);
    expect(m.score).toBe(50);
  });
});

describe('no number without a sentence', () => {
  it('every judgement carries prose, and every match carries at least one reason', () => {
    const matches = matchFloors(
      withRoom({ feels: ['modern', 'natural'], roomTypeId: 'kitchen', budgetCad: 18000 }),
      5,
    );
    for (const m of matches) {
      expect(m.judgements.length).toBeGreaterThan(0);
      for (const j of m.judgements) {
        expect(j.sentence.length, `${m.id} ${j.criterion}`).toBeGreaterThan(25);
        expect(j.delta).toBeGreaterThanOrEqual(-1);
        expect(j.delta).toBeLessThanOrEqual(1);
      }
      expect(m.reasons.length + m.caveats.length).toBe(m.judgements.filter((j) => j.delta !== 0).length);
    }
  });

  it('shows the caveats rather than hiding them', () => {
    const overBudget = matchFloors(withRoom({ feels: ['luxurious'], budgetCad: 1000 }), 3);
    const all = overBudget.flatMap((m) => m.caveats).join(' ');
    expect(all).toMatch(/above the number you gave us/i);
  });
});

describe('the recommendations answer the question that was asked', () => {
  it('sends a dim room a lighter floor when asked for brighter', () => {
    const [top] = matchFloors(
      withRoom({ feels: ['brighter'], room: { lightLevel: 'dim', wallUndertone: 'neutral', existingFloorTone: 'dark' } }),
      3,
    );
    expect(productById(top!.config.productId)!.tone).toBe('light');
  });

  it('sends a request for drama something dark or fumed', () => {
    const [top] = matchFloors(withRoom({ feels: ['dramatic'] }), 3);
    const product = productById(top!.config.productId)!;
    expect(product.tone === 'dark' || top!.config.finishId === 'smoked').toBe(true);
  });

  it('puts a pattern under a request for luxury', () => {
    const [top] = matchFloors(withRoom({ feels: ['luxurious'] }), 3);
    expect(['herringbone', 'chevron']).toContain(top!.config.patternId);
  });

  it('keeps a request for peace on straight plank', () => {
    const [top] = matchFloors(withRoom({ feels: ['peaceful'] }), 3);
    expect(top!.config.patternId).toBe('straight');
  });

  it('answers best value with the plainest way to lay a floor', () => {
    const [top] = matchFloors(withRoom({ feels: ['value'] }), 3);
    expect(top!.config.patternId).toBe('straight');
    expect(top!.config.finishId).toBe('natural-matte');
  });

  it('puts the hardest floor first in a kitchen', () => {
    const [top] = matchFloors(withRoom({ feels: ['unsure'], roomTypeId: 'kitchen' }), 3);
    expect(productById(top!.config.productId)!.durability).toBe('hardest');
  });
});

describe('the shape of the answer', () => {
  it('shows three different woods, not one wood in three hats', () => {
    const matches = matchFloors(withRoom({ feels: ['modern'] }), 3);
    expect(matches).toHaveLength(3);
    expect(new Set(matches.map((m) => m.config.productId)).size).toBe(3);
  });

  it('relaxes that cap when asked to', () => {
    const matches = matchFloors(withRoom({ feels: ['modern'] }), 6, 3);
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.config.productId, (counts.get(m.config.productId) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeGreaterThan(1);
  });

  it('is stable — the same input produces the same floors in the same order', () => {
    const input = withRoom({ feels: ['warmer', 'natural'], roomTypeId: 'living', budgetCad: 22000 });
    const a = matchFloors(input, 3).map((m) => m.id);
    const b = matchFloors(input, 3).map((m) => m.id);
    expect(a).toEqual(b);
  });

  it('only ever recommends a floor we can lay', () => {
    for (const feel of FEELS) {
      for (const m of matchFloors(withRoom({ feels: [feel.id] }), 5)) {
        expect(isLayable(m.config), m.id).toBe(true);
      }
    }
  });

  it('prices every recommendation with the shared estimator', () => {
    for (const m of matchFloors(withRoom({ feels: ['luxurious'] }), 3)) {
      expect(m.estimate.estimatedHighCad).toBeGreaterThan(m.estimate.estimatedLowCad);
      expect(m.estimate.disclaimer).toMatch(/free in-home measure/i);
      expect(m.estimate.speciesFallback).toBe(false);
    }
  });
});

describe('drilling into one species', () => {
  it('returns only that species, best first', () => {
    const matches = matchWithinProduct(withRoom({ feels: ['natural'] }), 'hickory', 6);
    expect(matches.length).toBeGreaterThan(1);
    expect(new Set(matches.map((m) => m.config.productId))).toEqual(new Set(['hickory']));
    for (let i = 1; i < matches.length; i += 1) {
      expect(matches[i - 1]!.score).toBeGreaterThanOrEqual(matches[i]!.score);
    }
  });
});

describe('the vocabulary a machine can read', () => {
  it('publishes exactly what the matcher accepts', () => {
    expect(MATCH_INPUT_VOCABULARY.feels).toEqual(FEELS.map((f) => f.id));
    expect(MATCH_INPUT_VOCABULARY.roomTypes).toEqual(ROOM_TYPES.map((r) => r.id));
    expect(MATCH_INPUT_VOCABULARY.criteria).toEqual(CRITERION_IDS);
  });

  it('validates a feel tag from a querystring', () => {
    expect(isFeelTag('brighter')).toBe(true);
    expect(isFeelTag('sparkly')).toBe(false);
  });

  it('knows when the visitor has given it an opinion', () => {
    expect(hasFeelOpinion(['unsure'])).toBe(false);
    expect(hasFeelOpinion([])).toBe(false);
    expect(hasFeelOpinion(['unsure', 'warmer'])).toBe(true);
  });

  it('names every criterion uniquely', () => {
    expect(new Set(CRITERION_IDS).size).toBe(CRITERION_IDS.length);
  });
});
