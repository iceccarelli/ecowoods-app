/**
 * lib/quote-intelligence/workbench-state.ts — pure state helpers for the
 * estimator workbench (app/admin/quote-intelligence/[orderId]/Workbench.tsx).
 *
 * Kept out of the component so the parts that decide what gets sent to
 * compose() are unit-tested without a browser: how a blank quote starts, what
 * "mark the rest not specified" touches, how far through a quote the estimator
 * is, and how a saved draft is read back.
 *
 * A quote starts with NO findings, not with "not specified". Pre-filling a
 * status would let an estimator publish a read they never made; compose()
 * refuses a quote with any unassessed item, and the bulk action below is an
 * explicit click, applied only to what is still blank.
 */

import { allCriteria } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { FINDING_STATUSES, type Finding, type FindingStatus, type QuoteEntry } from './types';

export const QUOTE_LABELS = ['Quote A', 'Quote B', 'Quote C'] as const;

export type WorkbenchForm = {
  quotes: QuoteEntry[];
  present: string;
  missing: string;
  askInWriting: string;
  riskNotes: string;
  ifSoundSaySo: string;
};

export function emptyQuote(index: number): QuoteEntry {
  return { label: QUOTE_LABELS[index] ?? `Quote ${index + 1}`, criteria: {}, scope: {} };
}

export function emptyForm(): WorkbenchForm {
  return { quotes: [emptyQuote(0)], present: '', missing: '', askInWriting: '', riskNotes: '', ifSoundSaySo: '' };
}

/** Whether a status needs the wording quoted from the document. Mirrors compose()'s rule. */
export function needsEvidence(status: FindingStatus | undefined): boolean {
  return status === 'verified' || status === 'unclear';
}

/**
 * Set a status. Evidence already typed is kept when moving between the two
 * statuses that use it, and dropped otherwise — a "not specified" finding
 * carrying an excerpt would contradict itself.
 */
export function withStatus(existing: Finding | undefined, status: FindingStatus): Finding {
  return needsEvidence(status) && existing?.evidence ? { status, evidence: existing.evidence } : { status };
}

export function withEvidence(existing: Finding | undefined, patch: { page?: number; excerpt?: string }): Finding {
  const status = existing?.status ?? 'verified';
  const evidence = { excerpt: existing?.evidence?.excerpt ?? '', ...existing?.evidence, ...patch };
  if (patch.page === undefined && 'page' in patch) delete evidence.page;
  return { status, evidence };
}

/** Fill every still-blank criterion and scope item with `status`. Never overwrites a recorded finding. */
export function fillBlanks(quote: QuoteEntry, status: Exclude<FindingStatus, 'verified' | 'unclear'>): QuoteEntry {
  const criteria = { ...quote.criteria };
  for (const c of allCriteria()) if (!criteria[c.id]) criteria[c.id] = { status };
  const scope = { ...quote.scope };
  for (const s of SCOPE_ITEMS) if (!scope[s.id]) scope[s.id] = { status };
  return { ...quote, criteria, scope };
}

export type Progress = { assessed: number; total: number; missingEvidence: number };

export function progress(quote: QuoteEntry): Progress {
  const findings = [
    ...allCriteria().map((c) => quote.criteria[c.id]),
    ...SCOPE_ITEMS.map((s) => quote.scope[s.id]),
  ];
  return {
    total: findings.length,
    assessed: findings.filter((f) => f && FINDING_STATUSES.includes(f.status)).length,
    missingEvidence: findings.filter((f) => f && needsEvidence(f.status) && !f.evidence?.excerpt?.trim()).length,
  };
}

/**
 * Read a draft back from localStorage. Anything that does not look like a
 * WorkbenchForm yields null rather than a half-restored form — the server
 * re-validates everything anyway, but a corrupt draft should not crash the page.
 */
export function restoreDraft(raw: string | null): WorkbenchForm | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<WorkbenchForm>;
    if (!Array.isArray(d.quotes) || d.quotes.length === 0 || d.quotes.length > QUOTE_LABELS.length) return null;
    const quotes = d.quotes.map((q, i) => ({
      label: typeof q?.label === 'string' ? q.label : emptyQuote(i).label,
      statedTotal: typeof q?.statedTotal === 'number' ? q.statedTotal : undefined,
      statedAreaSqFt: typeof q?.statedAreaSqFt === 'number' ? q.statedAreaSqFt : undefined,
      criteria: q?.criteria && typeof q.criteria === 'object' ? q.criteria : {},
      scope: q?.scope && typeof q.scope === 'object' ? q.scope : {},
    }));
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      quotes,
      present: str(d.present),
      missing: str(d.missing),
      askInWriting: str(d.askInWriting),
      riskNotes: str(d.riskNotes),
      ifSoundSaySo: str(d.ifSoundSaySo),
    };
  } catch {
    return null;
  }
}

export function draftKey(orderId: string): string {
  return `quote-intelligence-draft:${orderId}`;
}
