import { describe, expect, it } from 'vitest';
import { compose, MAX_EXCERPT_CHARS } from './compose';
import { allCriteria, score } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import type { ComposeInput, Finding, FindingStatus, QuoteEntry } from './types';

const criteria = allCriteria();
const firstCritical = criteria.find((c) => c.severity === 'critical')!;
const firstMajor = criteria.find((c) => c.severity === 'major')!;
const scopeChanging = SCOPE_ITEMS.find((s) => s.changesScope)!;

const stated = (excerpt = 'Written on the quote.', page = 1): Finding => ({ status: 'verified', evidence: { page, excerpt } });

function quote(label: string, overrides: { criteria?: Record<string, Finding>; scope?: Record<string, Finding> } = {}): QuoteEntry {
  return {
    label,
    criteria: { ...Object.fromEntries(criteria.map((c) => [c.id, stated()])), ...overrides.criteria },
    scope: { ...Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, stated()])), ...overrides.scope },
  };
}

function baseInput(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    orderId: 'order-1',
    tier: 'Standard',
    quotes: [quote('Quote A')],
    present: 'Moisture testing and substrate assessment are both documented in writing.',
    missing: '',
    ifSoundSaySo: 'This is a complete quote on what it states.',
    ...overrides,
  };
}

function ok(input: ComposeInput) {
  const result = compose(input);
  if (!result.ok) throw new Error(`expected ok, got: ${result.errors.join(' | ')}`);
  return result.report;
}

function errorsOf(input: ComposeInput): string {
  const result = compose(input);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.errors.join(' | ');
}

describe('compose — single quote', () => {
  it('produces a sound/strong verdict when the document states everything', () => {
    const report = ok(baseInput());
    expect(report.quotes).toHaveLength(1);
    expect(['sound', 'strong']).toContain(report.quotes[0].verdict);
    expect(report.quotes[0].riskFlags).toEqual([]);
    expect(report.comparison).toBeUndefined();
    expect(report.statement).toBe('This is a complete quote on what it states.');
  });

  it('treats silence on a critical criterion as the framework "no" — defect verdict, matching score()', () => {
    const q = quote('Quote A', { criteria: { [firstCritical.id]: { status: 'not_specified' } } });
    const report = ok(baseInput({ quotes: [q], missing: 'Moisture readings are absent.', ifSoundSaySo: '' }));
    const r = report.quotes[0];
    expect(r.verdict).toBe('defect');
    expect(r.failedCritical.map((c) => c.id)).toEqual([firstCritical.id]);

    const answers = Object.fromEntries(criteria.map((c) => [c.id, c.id === firstCritical.id ? 'no' : 'yes'] as const));
    expect(r.verdict).toBe(score(answers).verdict);
    expect(r.pct).toBe(score(answers).pct);
  });

  it('never counts unclear, cannot-determine or inspection-needed as met or as a failure', () => {
    for (const status of ['unclear', 'cannot_determine', 'inspection_needed'] as FindingStatus[]) {
      const finding: Finding = status === 'unclear' ? { status, evidence: { excerpt: 'Prep as required.' } } : { status };
      const q = quote('Quote A', { criteria: { [firstCritical.id]: finding } });
      const r = ok(baseInput({ quotes: [q], missing: 'One item needs settling.', ifSoundSaySo: '' })).quotes[0];
      expect(r.failedCritical).toEqual([]);
      expect(r.criteria.find((c) => c.id === firstCritical.id)!.status).toBe(status);
      expect(r.counts[status]).toBe(1);
    }
  });

  it('flags a critical criterion that needs an on-site check as high, with the framework risk and source', () => {
    const q = quote('Quote A', { criteria: { [firstCritical.id]: { status: 'inspection_needed' } } });
    const r = ok(baseInput({ quotes: [q], missing: 'Subfloor needs a look.', ifSoundSaySo: '' })).quotes[0];
    const flag = r.riskFlags.find((f) => f.refId === firstCritical.id)!;
    expect(flag.level).toBe('high');
    expect(flag.consequence).toBe(firstCritical.risk);
    expect(flag.basisHref).toMatch(/^\/papers\//);
    expect(r.questionsToAsk.find((q) => q.refId === firstCritical.id)?.source).toBe('inspection-needed');
  });

  it('orders risk flags high before medium before low', () => {
    const q = quote('Quote A', {
      criteria: { [firstMajor.id]: { status: 'not_specified' }, [firstCritical.id]: { status: 'not_specified' } },
      scope: { [SCOPE_ITEMS.find((s) => !s.changesScope)!.id]: { status: 'not_specified' } },
    });
    const levels = ok(baseInput({ quotes: [q], missing: 'Gaps.', ifSoundSaySo: '' })).quotes[0].riskFlags.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b)));
    expect(levels[0]).toBe('high');
  });

  it('turns an unspecified scope item into a neutral question, never a price', () => {
    const q = quote('Quote A', { scope: { [scopeChanging.id]: { status: 'not_specified' } } });
    const r = ok(baseInput({ quotes: [q], missing: 'Removal is not mentioned.', ifSoundSaySo: '' })).quotes[0];
    const question = r.questionsToAsk.find((x) => x.refId === scopeChanging.id)!;
    expect(question.text).toContain(scopeChanging.label);
    expect(question.text).not.toMatch(/\$|%/);
    expect(r.riskFlags.find((f) => f.refId === scopeChanging.id)?.level).toBe('medium');
  });

  it('rolls every unreadable item into one "send a readable copy" question', () => {
    const q = quote('Quote A', {
      criteria: { [firstCritical.id]: { status: 'cannot_determine' } },
      scope: { [scopeChanging.id]: { status: 'cannot_determine' } },
    });
    const r = ok(baseInput({ quotes: [q], missing: 'Page two was missing.', ifSoundSaySo: '' })).quotes[0];
    const readable = r.questionsToAsk.filter((x) => x.source === 'cannot-determine');
    expect(readable).toHaveLength(1);
    expect(readable[0].text).toContain('2 item(s)');
  });

  it('carries evidence (page + excerpt) through to the report lines', () => {
    const q = quote('Quote A', { scope: { [scopeChanging.id]: stated('Includes removal and haul-away of existing carpet.', 2) } });
    const line = ok(baseInput({ quotes: [q] })).quotes[0].scope.find((s) => s.id === scopeChanging.id)!;
    expect(line.evidence).toEqual({ page: 2, excerpt: 'Includes removal and haul-away of existing carpet.' });
  });
});

describe('compose — evidence and completeness rules', () => {
  it('rejects "stated" without an excerpt — a finding must show where', () => {
    const q = quote('Quote A', { scope: { [scopeChanging.id]: { status: 'verified' } } });
    expect(errorsOf(baseInput({ quotes: [q] }))).toMatch(/show where/);
  });

  it('rejects "unclear" without an excerpt', () => {
    const q = quote('Quote A', { criteria: { [firstCritical.id]: { status: 'unclear', evidence: { excerpt: '  ' } } } });
    expect(errorsOf(baseInput({ quotes: [q], ifSoundSaySo: '', missing: 'x' }))).toMatch(/show where/);
  });

  it('rejects an over-long excerpt and an invalid page', () => {
    const long = quote('Quote A', { scope: { [scopeChanging.id]: stated('a'.repeat(MAX_EXCERPT_CHARS + 1)) } });
    expect(errorsOf(baseInput({ quotes: [long] }))).toMatch(/shorten/);
    const badPage = quote('Quote A', { scope: { [scopeChanging.id]: stated('ok', 0) } });
    expect(errorsOf(baseInput({ quotes: [badPage] }))).toMatch(/page must be/);
  });

  it('rejects a dollar figure or company name inside a quoted excerpt', () => {
    const dollars = quote('Quote A', { scope: { [scopeChanging.id]: stated('Removal and disposal $850') } });
    expect(errorsOf(baseInput({ quotes: [dollars] }))).toMatch(/dollar/);
    const company = quote('Quote A', { scope: { [scopeChanging.id]: stated('Maple Leaf Flooring will remove the carpet') } });
    expect(errorsOf(baseInput({ quotes: [company] }))).toMatch(/company/);
  });

  it('refuses a report with unassessed criteria or scope items, and names them', () => {
    const q = quote('Quote A');
    delete q.criteria[firstCritical.id];
    delete q.scope[scopeChanging.id];
    const errors = errorsOf(baseInput({ quotes: [q] }));
    expect(errors).toContain(`criteria not assessed (${firstCritical.id})`);
    expect(errors).toContain(`scope item(s) not assessed (${scopeChanging.id})`);
  });

  it('rejects an unknown status value rather than guessing', () => {
    const q = quote('Quote A', { criteria: { [firstCritical.id]: { status: 'probably' as FindingStatus } } });
    expect(errorsOf(baseInput({ quotes: [q] }))).toMatch(/not assessed/);
  });

  it('requires one to three quotes with distinct, non-company labels', () => {
    expect(errorsOf(baseInput({ quotes: [] }))).toMatch(/at least one/);
    expect(errorsOf(baseInput({ quotes: [quote('A'), quote('B'), quote('C'), quote('D')] }))).toMatch(/At most 3/);
    expect(errorsOf(baseInput({ quotes: [quote('Quote A'), quote('quote a')] }))).toMatch(/different label/);
    expect(errorsOf(baseInput({ quotes: [quote('Birchwood Hardwood Floors')] }))).toMatch(/company/);
  });

  it('refuses "if sound, say so" when the scoring does not support it', () => {
    const q = quote('Quote A', { criteria: { [firstCritical.id]: { status: 'not_specified' } } });
    expect(errorsOf(baseInput({ quotes: [q], missing: 'Readings absent.' }))).toMatch(/does not support/);
  });
});

describe('compose — free-text legal guard (unchanged from EW-0002)', () => {
  it('rejects a dollar figure in free text rather than publishing it', () => {
    expect(errorsOf(baseInput({ missing: 'They left out subfloor prep, typically $2.50/sq ft extra.' }))).toMatch(/dollar|percentage/i); // pricing-allow: a fixture the composer must REJECT, never a published band
  });

  it('rejects a percentage in free text', () => {
    errorsOf(baseInput({ missing: 'This quote is roughly 20% below market.' }));
  });

  it('rejects a comparison to another company, adversarial input included', () => {
    expect(errorsOf(baseInput({ missing: 'This is worse than Acme Flooring Inc. on every line item.' }))).toMatch(/comparison|company/i);
  });

  it('rejects the same content in estimator risk notes and questions', () => {
    expect(errorsOf(baseInput({ riskNotes: 'Deposit of 50% up front' }))).toMatch(/Risk notes/);
    expect(errorsOf(baseInput({ askInWriting: 'Why is this cheaper than the other one?' }))).toMatch(/Ask in writing/);
  });

  it('requires either a Missing section or an explicit "if sound" statement', () => {
    expect(errorsOf(baseInput({ missing: '', ifSoundSaySo: '' }))).toMatch(/Missing/);
  });

  it('carries the tier, order and framework version through unchanged', () => {
    const report = ok(baseInput({ tier: 'Rush' }));
    expect(report.tier).toBe('Rush');
    expect(report.orderId).toBe('order-1');
    expect(report.frameworkVersion).toMatch(/^\d+\.\d+$/);
  });
});

describe('compose — multiple quotes', () => {
  it('normalizes through compare(): a scope item stated in one quote and silent in another is not like-for-like', () => {
    const a = quote('Quote A');
    const b = quote('Quote B', { scope: { [scopeChanging.id]: { status: 'not_specified' } } });
    const report = ok(baseInput({ quotes: [a, b], missing: 'Quote B is silent on one item.', ifSoundSaySo: '' }));

    expect(report.comparison?.verdict).toBe('not-comparable');
    expect(report.comparison?.divergent.map((d) => d.id)).toEqual([scopeChanging.id]);
    const row = report.comparison!.matrix.find((m) => m.id === scopeChanging.id)!;
    expect(row.statuses).toEqual(['verified', 'not_specified']);

    expect(report.generalRiskFlags[0].level).toBe('high');
    expect(report.generalRiskFlags[0].text).toMatch(/not like-for-like/);

    // Quote B's question is sharpened by the comparison — without naming the other quote's author.
    const q = report.quotes[1].questionsToAsk.find((x) => x.refId === scopeChanging.id)!;
    expect(q.source).toBe('comparison');
    expect(q.text).toMatch(/Another quote you hold/);
    expect(report.quotes[0].questionsToAsk.find((x) => x.refId === scopeChanging.id)).toBeUndefined();
  });

  it('reports comparable when every quote states the same list, with the per-sq-ft division from the customer\'s own numbers', () => {
    const a = { ...quote('Quote A'), statedTotal: 9000, statedAreaSqFt: 1000 };
    const b = { ...quote('Quote B'), statedTotal: 11000, statedAreaSqFt: 1000 };
    const report = ok(baseInput({ quotes: [a, b], ifSoundSaySo: 'Both quotes state the full list.' }));
    expect(report.comparison?.verdict).toBe('comparable');
    expect(report.comparison?.statement).toContain('your numbers, divided');
    expect(report.generalRiskFlags).toEqual([]);
  });

  it('keeps per-quote readouts aligned even when compare() drops a quote with nothing stated', () => {
    const blank = quote('Quote B', {
      scope: Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, { status: 'not_specified' as const }])),
    });
    const report = ok(baseInput({ quotes: [quote('Quote A'), blank], missing: 'Quote B states no scope.', ifSoundSaySo: '' }));
    expect(report.quotes.map((q) => q.label)).toEqual(['Quote A', 'Quote B']);
    expect(report.quotes[1].questionsToAsk.length).toBeGreaterThan(0);
    expect(report.statement).toContain('Quote B:');
  });

  it('rejects a stated total that is not a positive number', () => {
    expect(errorsOf(baseInput({ quotes: [{ ...quote('Quote A'), statedTotal: -5 }] }))).toMatch(/stated total/);
  });
});

describe('compose — never says "holds up" on a document that does not say what it prices', () => {
  it('a quote strong on the framework but silent on a scope-changing item does not hold up', () => {
    const q = quote('Quote A', { scope: { [scopeChanging.id]: { status: 'not_specified' } } });
    const report = ok(baseInput({ quotes: [q], missing: 'One scope item is silent.', ifSoundSaySo: '' }));
    expect(['sound', 'strong']).toContain(report.quotes[0].verdict);
    expect(report.statement).not.toMatch(/holds up/);
    expect(errorsOf(baseInput({ quotes: [q], missing: 'x' }))).toMatch(/does not support/);
  });
});
