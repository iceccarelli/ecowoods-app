import { describe, expect, it } from 'vitest';
import { allCriteria, PILLARS, sourceHref } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { deriveForQuote, pillarNameFor } from './risk';
import type { Finding, FindingStatus, QuoteEntry } from './types';

const criteria = allCriteria();
const critical = criteria.find((c) => c.severity === 'critical')!;
const major = criteria.find((c) => c.severity === 'major')!;
const advisory = criteria.find((c) => c.severity === 'advisory')!;
const changing = SCOPE_ITEMS.find((s) => s.changesScope)!;
const certainty = SCOPE_ITEMS.find((s) => !s.changesScope)!;

const stated: Finding = { status: 'verified', evidence: { excerpt: 'As written.' } };

function quoteWith(criteriaOverrides: Record<string, FindingStatus> = {}, scopeOverrides: Record<string, FindingStatus> = {}): QuoteEntry {
  const f = (s: FindingStatus): Finding => (s === 'verified' ? stated : { status: s });
  return {
    label: 'Quote A',
    criteria: Object.fromEntries(criteria.map((c) => [c.id, criteriaOverrides[c.id] ? f(criteriaOverrides[c.id]) : stated])),
    scope: Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, scopeOverrides[s.id] ? f(scopeOverrides[s.id]) : stated])),
  };
}

describe('deriveForQuote — levels are a table, not a judgement call', () => {
  it('a fully stated quote has no flags and no questions', () => {
    expect(deriveForQuote(quoteWith())).toEqual({ riskFlags: [], questionsToAsk: [] });
  });

  it.each([
    ['not_specified', 'high'],
    ['inspection_needed', 'high'],
    ['unclear', 'medium'],
    ['cannot_determine', 'medium'],
  ] as const)('critical criterion %s -> %s', (status, level) => {
    const [flag] = deriveForQuote(quoteWith({ [critical.id]: status })).riskFlags;
    expect(flag).toMatchObject({ level, refId: critical.id, status, consequence: critical.risk, basisHref: sourceHref(critical) });
  });

  it.each([
    ['not_specified', 'medium'],
    ['inspection_needed', 'medium'],
    ['unclear', 'low'],
    ['cannot_determine', 'low'],
  ] as const)('major criterion %s -> %s', (status, level) => {
    expect(deriveForQuote(quoteWith({ [major.id]: status })).riskFlags[0].level).toBe(level);
  });

  it('never flags or questions an advisory criterion', () => {
    const d = deriveForQuote(quoteWith({ [advisory.id]: 'not_specified' }));
    expect(d.riskFlags).toEqual([]);
    expect(d.questionsToAsk).toEqual([]);
  });

  it('a scope-changing item outranks a certainty item for the same status', () => {
    const d = deriveForQuote(quoteWith({}, { [changing.id]: 'not_specified', [certainty.id]: 'not_specified' }));
    expect(d.riskFlags.find((f) => f.refId === changing.id)!.level).toBe('medium');
    expect(d.riskFlags.find((f) => f.refId === certainty.id)!.level).toBe('low');
    expect(d.riskFlags.find((f) => f.refId === changing.id)!.consequence).toBe(changing.why);
  });

  it('sorts high before medium before low', () => {
    const d = deriveForQuote(quoteWith({ [major.id]: 'unclear', [critical.id]: 'not_specified' }, { [changing.id]: 'unclear' }));
    expect(d.riskFlags.map((f) => f.level)).toEqual(['high', 'medium', 'low']);
  });
});

describe('deriveForQuote — questions', () => {
  it('asks the framework question verbatim when the quote is silent', () => {
    const [q] = deriveForQuote(quoteWith({ [critical.id]: 'not_specified' })).questionsToAsk;
    expect(q).toEqual({ source: 'not-specified', refId: critical.id, text: critical.question });
  });

  it('asks who checks on site, and whether it is recorded, when inspection is needed', () => {
    const [q] = deriveForQuote(quoteWith({}, { [changing.id]: 'inspection_needed' })).questionsToAsk;
    expect(q.source).toBe('inspection-needed');
    expect(q.text).toMatch(/on-site check/);
    expect(q.text).toMatch(/recorded in writing/);
  });

  it('rolls every unreadable item into ONE request for a readable copy, counted', () => {
    const d = deriveForQuote(quoteWith({ [critical.id]: 'cannot_determine', [advisory.id]: 'cannot_determine' }, { [changing.id]: 'cannot_determine' }));
    const readable = d.questionsToAsk.filter((q) => q.source === 'cannot-determine');
    expect(readable).toHaveLength(1);
    expect(readable[0].text).toMatch(/3 item\(s\)/);
    expect(d.questionsToAsk).toHaveLength(1);
  });

  it('never puts a dollar figure, a percentage or a comparison into a derived flag or question', () => {
    const everything = Object.fromEntries(criteria.map((c) => [c.id, 'not_specified' as const]));
    const scope = Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, 'unclear' as const]));
    const d = deriveForQuote(quoteWith(everything, scope));
    for (const text of [...d.riskFlags.map((f) => f.text), ...d.questionsToAsk.map((q) => q.text)]) {
      expect(text).not.toMatch(/\$\s?\d|\d\s?%|cheaper than|better than|worse than/i);
    }
  });
});

describe('pillarNameFor', () => {
  it('resolves every criterion to its pillar, and an unknown id to empty', () => {
    for (const p of PILLARS) for (const c of p.criteria) expect(pillarNameFor(c.id)).toBe(p.name);
    expect(pillarNameFor('99.9')).toBe('');
  });
});
