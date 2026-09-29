import { describe, expect, it } from 'vitest';
import { composeAnswerBlocks } from './answer-composition';
import type { AssistantChatCard } from './chat-schema';

const band = (over: Partial<Extract<AssistantChatCard, { type: 'ecowoods_band' }>> = {}): AssistantChatCard => ({
  type: 'ecowoods_band',
  title: 'Ecowoods published band',
  body: 'range',
  minCad: 4000,
  maxCad: 6000,
  scope: '1000 sq ft',
  ...over,
});

describe('composeAnswerBlocks', () => {
  it('orders decision_summary before project_snapshot before cost before evidence before next_action', () => {
    const cards: AssistantChatCard[] = [
      { type: 'next_action', title: 'Next step', action: 'measure', body: 'book' },
      { type: 'evidence', title: 'Guide', sourceType: 'guide', whyItMatters: 'x', strength: 'strong' },
      band(),
      { type: 'project_snapshot', title: 'This project so far' },
      { type: 'decision_summary', title: 'What I think', situation: 's', whatMatters: ['a'], firstStep: 'f' },
    ];
    const ordered = composeAnswerBlocks(cards).map((c) => c.type);
    expect(ordered).toEqual(['decision_summary', 'project_snapshot', 'ecowoods_band', 'evidence', 'next_action']);
  });

  it('preserves original relative order within the same priority tier', () => {
    const cards: AssistantChatCard[] = [
      { type: 'evidence', title: 'A', sourceType: 'guide', whyItMatters: 'x', strength: 'strong' },
      { type: 'evidence', title: 'B', sourceType: 'paper', whyItMatters: 'y', strength: 'strong' },
    ];
    expect(composeAnswerBlocks(cards).map((c) => (c as { title: string }).title)).toEqual(['A', 'B']);
  });

  it('dedupes two ecowoods_band cards that quote the exact same range and scope', () => {
    const cards = [band(), band()];
    expect(composeAnswerBlocks(cards)).toHaveLength(1);
  });

  it('does not dedupe two ecowoods_band cards with different ranges or scope', () => {
    const cards = [band(), band({ minCad: 8000, maxCad: 12000, scope: '2000 sq ft' })];
    expect(composeAnswerBlocks(cards)).toHaveLength(2);
  });

  it('caps the total at 8, keeping the highest-priority blocks', () => {
    const many: AssistantChatCard[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'site_link' as const,
      title: `Link ${i}`,
      body: 'x',
    }));
    const withSummary: AssistantChatCard[] = [
      { type: 'decision_summary', title: 'What I think', situation: 's', whatMatters: ['a'], firstStep: 'f' },
      ...many,
    ];
    const result = composeAnswerBlocks(withSummary);
    expect(result).toHaveLength(8);
    expect(result[0]!.type).toBe('decision_summary');
  });

  it('a simple turn with one card is untouched', () => {
    const cards: AssistantChatCard[] = [band()];
    expect(composeAnswerBlocks(cards)).toEqual(cards);
  });
});
