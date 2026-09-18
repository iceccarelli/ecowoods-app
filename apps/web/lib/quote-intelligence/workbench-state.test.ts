import { describe, expect, it } from 'vitest';
import { allCriteria } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { compose } from './compose';
import {
  draftKey,
  emptyForm,
  emptyQuote,
  fillBlanks,
  needsEvidence,
  progress,
  restoreDraft,
  withEvidence,
  withStatus,
} from './workbench-state';

const TOTAL = allCriteria().length + SCOPE_ITEMS.length;

describe('workbench state', () => {
  it('starts with one quote and no findings — nothing is pre-assessed', () => {
    const f = emptyForm();
    expect(f.quotes).toHaveLength(1);
    expect(f.quotes[0]).toEqual({ label: 'Quote A', criteria: {}, scope: {} });
    expect(progress(f.quotes[0])).toEqual({ assessed: 0, total: TOTAL, missingEvidence: 0 });
    expect(emptyQuote(2).label).toBe('Quote C');
  });

  it('an untouched quote cannot be published: compose() refuses it', () => {
    const r = compose({ ...emptyForm(), orderId: 'o', tier: 'Standard', present: 'p', missing: 'm' });
    expect(r.ok).toBe(false);
  });

  it('only "stated" and "unclear" need the wording quoted', () => {
    expect(needsEvidence('verified')).toBe(true);
    expect(needsEvidence('unclear')).toBe(true);
    for (const s of ['not_specified', 'cannot_determine', 'inspection_needed', undefined] as const) expect(needsEvidence(s)).toBe(false);
  });

  it('keeps evidence between stated and unclear, drops it for statuses that contradict it', () => {
    const withEx = withEvidence({ status: 'verified' }, { page: 3, excerpt: 'Oak, select grade' });
    expect(withStatus(withEx, 'unclear')).toEqual({ status: 'unclear', evidence: { page: 3, excerpt: 'Oak, select grade' } });
    expect(withStatus(withEx, 'not_specified')).toEqual({ status: 'not_specified' });
  });

  it('clearing the page removes it rather than storing undefined or NaN', () => {
    const f = withEvidence({ status: 'verified', evidence: { page: 3, excerpt: 'x' } }, { page: undefined });
    expect(f.evidence).toEqual({ excerpt: 'x' });
  });

  it('fillBlanks only fills blanks — a recorded finding is never overwritten', () => {
    const c = allCriteria()[0].id;
    const q = { ...emptyQuote(0), criteria: { [c]: { status: 'verified' as const, evidence: { excerpt: 'As written' } } } };
    const filled = fillBlanks(q, 'not_specified');
    expect(filled.criteria[c].status).toBe('verified');
    expect(progress(filled)).toEqual({ assessed: TOTAL, total: TOTAL, missingEvidence: 0 });
    expect(Object.values(filled.scope).every((f) => f.status === 'not_specified')).toBe(true);
  });

  it('counts stated findings that still lack an excerpt', () => {
    const c = allCriteria()[0].id;
    expect(progress({ ...emptyQuote(0), criteria: { [c]: { status: 'verified' } } }).missingEvidence).toBe(1);
  });
});

describe('restoreDraft', () => {
  it('round-trips a saved form', () => {
    const f = { ...emptyForm(), present: 'p', riskNotes: 'r' };
    f.quotes[0] = fillBlanks(f.quotes[0], 'cannot_determine');
    expect(restoreDraft(JSON.stringify(f))).toEqual(f);
  });

  it.each([null, '', 'not json', '{}', '{"quotes":[]}', JSON.stringify({ quotes: [{}, {}, {}, {}] })])('returns null for %s', (raw) => {
    expect(restoreDraft(raw)).toBeNull();
  });

  it('repairs wrong-typed fields instead of crashing', () => {
    const d = restoreDraft(JSON.stringify({ quotes: [{ label: 5, statedTotal: 'x', criteria: 'no' }], present: 7 }));
    expect(d).toEqual({ quotes: [{ label: 'Quote A', statedTotal: undefined, statedAreaSqFt: undefined, criteria: {}, scope: {} }], present: '', missing: '', askInWriting: '', riskNotes: '', ifSoundSaySo: '' });
  });

  it('keys drafts per order', () => {
    expect(draftKey('a')).not.toBe(draftKey('b'));
  });
});
