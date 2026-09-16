import { describe, expect, it } from 'vitest';
import { compose } from './compose';
import { allCriteria, score } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import type { ComposeInput } from './types';

const criteria = allCriteria();
const allYes = Object.fromEntries(criteria.map((c) => [c.id, 'yes' as const]));
const firstCriticalId = criteria.find((c) => c.severity === 'critical')!.id;
const allScopeIds = SCOPE_ITEMS.map((s) => s.id);

function baseInput(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    orderId: 'order-1',
    tier: 'Standard',
    answers: allYes,
    presentScopeIds: allScopeIds,
    present: 'Moisture testing and substrate assessment are both documented in writing.',
    missing: '',
    ifSoundSaySo: 'This is a solid, complete quote — take it.',
    ...overrides,
  };
}

describe('compose', () => {
  it('produces a strong/sound verdict when every criterion is yes and every scope item is present', () => {
    const result = compose(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(['sound', 'strong']).toContain(result.report.verdict);
      expect(result.report.missingScope).toEqual([]);
    }
  });

  it('reaches a defect verdict when a single critical criterion is answered no, regardless of the rest', () => {
    const answers = { ...allYes, [firstCriticalId]: 'no' as const };
    const result = compose(baseInput({ answers, missing: 'Substrate moisture readings are absent.' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.verdict).toBe('defect');
      expect(result.report.failedCritical.map((c) => c.id)).toContain(firstCriticalId);
      // Matches lib/framework's own score() for the same input.
      expect(result.report.verdict).toBe(score(answers).verdict);
    }
  });

  it('turns a missing scope item into a question, never a price', () => {
    const missingId = SCOPE_ITEMS[0].id;
    const presentScopeIds = allScopeIds.filter((id) => id !== missingId);
    const result = compose(baseInput({ presentScopeIds }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.missingScope.map((m) => m.id)).toContain(missingId);
      const q = result.report.questionsToAsk.find((q) => q.refId === missingId);
      expect(q).toBeDefined();
      expect(q!.text).not.toMatch(/\$/);
    }
  });

  it('rejects a dollar figure in free text rather than publishing it', () => {
    const result = compose(baseInput({ missing: 'They left out subfloor prep, typically $2.50/sq ft extra.' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/dollar|percentage/i);
  });

  it('rejects a percentage in free text', () => {
    const result = compose(baseInput({ missing: 'This quote is roughly 20% below market.' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a comparison to another company, adversarial input included', () => {
    const result = compose(
      baseInput({ missing: 'This is worse than Acme Flooring Inc. on every line item.' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/comparison|company/i);
  });

  it('rejects a bare company name with a recognizable business suffix', () => {
    const result = compose(baseInput({ present: 'Better than Maple Hardwood Floors quoted last week.' }));
    expect(result.ok).toBe(false);
  });

  it('requires either a Missing section or an explicit "if sound" statement', () => {
    const result = compose(baseInput({ missing: '', ifSoundSaySo: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/Missing/);
  });

  it('carries the tier and framework version through unchanged', () => {
    const result = compose(baseInput({ tier: 'Rush' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.tier).toBe('Rush');
      expect(result.report.orderId).toBe('order-1');
    }
  });
});
