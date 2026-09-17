/**
 * lib/quote-intelligence/compose.ts — pure: an estimator's findings on one to
 * three quotes become a QuoteIntelligenceReport. No I/O, no Prisma, no Stripe —
 * everything that touches a database or the network lives in the API routes
 * that call this.
 *
 * REUSES, DOES NOT REIMPLEMENT
 *
 *   - score() from lib/framework: the verdict math. Only a finding the document
 *     states earns credit; silence on a critical criterion is the framework's
 *     "no"; anything unsettled is its "unsure".
 *   - compare() from lib/quote-check: the like-for-like scope normalization the
 *     free /quote-check tool already publishes, including its refusal to price
 *     a gap. A scope item counts as "included" in a quote only when the
 *     document states it.
 *   - lib/quote-intelligence/risk.ts: flags and questions, by rule.
 *
 * THE GUARD IN forbiddenContent()
 *
 * Same legal line content/quote-check/scope-items.ts already draws: no price
 * put on anything a quote leaves out, no company named or ranked. That file's
 * comment explains why (Competition Act s.74.01(1)(b), Bill C-59, Energizer
 * Brands v Gillette 2023 FC 804) — this is the same risk, now in a document an
 * estimator writes free text and quote excerpts into rather than a fixed
 * content file, so it gets a runtime guard instead of a build-time one.
 *
 * The guard REJECTS rather than silently strips. Silently deleting a clause
 * from a report a customer paid for is a worse failure than an estimator
 * seeing "remove this before you can publish" — it is invisible to the one
 * person positioned to catch it.
 */

import { allCriteria, score, FRAMEWORK_VERSION, sourceHref, type Answer } from '@/lib/framework';
import { compare, SCOPE_ITEMS } from '@/lib/quote-check';
import { ESTIMATOR_DESK_NAME, QUOTE_INTELLIGENCE_REFUSES } from '@/content/constants/quote-intelligence';
import { deriveForQuote, pillarNameFor } from './risk';
import {
  FINDING_STATUSES,
  type ComparisonReadout,
  type ComposeInput,
  type ComposeResult,
  type Finding,
  type FindingStatus,
  type Question,
  type QuoteEntry,
  type QuoteIntelligenceReport,
  type QuoteReadout,
  type RiskFlag,
} from './types';

export const MAX_QUOTES = 3;
export const MAX_EXCERPT_CHARS = 300;
const MAX_LABEL_CHARS = 40;
const MAX_PAGE = 200;

const COMPARISON_WORDS =
  /\b(better than|worse than|superior to|inferior to|cheaper than|more expensive than|typically costs?|on average costs?|the best|the worst|beats|outperforms)\b/i;

const COMPANY_SUFFIX =
  /\b[A-Z][a-zA-Z&']+(?:\s+[A-Z][a-zA-Z&']+){0,3}\s+(Inc\.?|Ltd\.?|LLC|Corp\.?|Flooring|Hardwood(?:\s+Floors?)?|Floors|Company|Co\.)\b/;

const DOLLAR_OR_PERCENT = /\$\s?\d|\d\s?%/;

/** Free text a customer will read. Rejects, never rewrites. */
function forbiddenContent(label: string, text: string | undefined, errors: string[]): void {
  if (!text) return;
  if (DOLLAR_OR_PERCENT.test(text)) {
    errors.push(`${label}: remove the dollar figure or percentage — no price is put on anything a quote leaves out.`);
  }
  if (COMPARISON_WORDS.test(text)) {
    errors.push(`${label}: remove the comparison — this report never ranks against another company.`);
  }
  if (COMPANY_SUFFIX.test(text)) {
    errors.push(`${label}: remove the company name — no competitor is named in this report.`);
  }
}

const TO_FRAMEWORK_ANSWER: Record<FindingStatus, Answer> = {
  verified: 'yes',
  not_specified: 'no',
  unclear: 'unsure',
  cannot_determine: 'unsure',
  inspection_needed: 'unsure',
};

const isStatus = (s: unknown): s is FindingStatus => FINDING_STATUSES.includes(s as FindingStatus);

const lines = (text: string | undefined): string[] =>
  (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

function positiveNumber(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Validates one finding; returns the cleaned finding or null when invalid (errors pushed). */
function checkFinding(where: string, f: Finding | undefined, errors: string[]): Finding | null {
  if (!f || !isStatus(f.status)) return null;
  if (f.status !== 'verified' && f.status !== 'unclear') return { status: f.status };

  const excerpt = f.evidence?.excerpt?.trim() ?? '';
  if (!excerpt) {
    errors.push(`${where}: quote the wording from the document — "stated" and "unclear" must show where.`);
    return null;
  }
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    errors.push(`${where}: shorten the excerpt to ${MAX_EXCERPT_CHARS} characters.`);
  }
  forbiddenContent(`${where} excerpt`, excerpt, errors);

  const page = f.evidence?.page;
  if (page !== undefined && (!Number.isInteger(page) || page < 1 || page > MAX_PAGE)) {
    errors.push(`${where}: page must be a whole number from 1 to ${MAX_PAGE}.`);
  }
  return { status: f.status, evidence: { excerpt, ...(page !== undefined ? { page } : {}) } };
}

function checkQuote(q: QuoteEntry, errors: string[]): QuoteEntry {
  const label = q.label?.trim() ?? '';
  const name = label || 'Unlabelled quote';
  if (!label) errors.push('Every quote needs a label, e.g. "Quote A".');
  if (label.length > MAX_LABEL_CHARS) errors.push(`${name}: keep the label under ${MAX_LABEL_CHARS} characters.`);
  forbiddenContent(`${name} label`, label, errors);

  if (q.statedTotal !== undefined && !positiveNumber(q.statedTotal)) {
    errors.push(`${name}: the stated total must be a positive number, or left blank.`);
  }
  if (q.statedAreaSqFt !== undefined && !positiveNumber(q.statedAreaSqFt)) {
    errors.push(`${name}: the stated area must be a positive number, or left blank.`);
  }

  const criteria: Record<string, Finding> = {};
  const unassessedCriteria: string[] = [];
  for (const c of allCriteria()) {
    const raw = q.criteria?.[c.id];
    if (!raw || !isStatus(raw.status)) {
      unassessedCriteria.push(c.id);
      continue;
    }
    const f = checkFinding(`${name} · criterion ${c.id}`, raw, errors);
    if (f) criteria[c.id] = f;
  }
  if (unassessedCriteria.length) {
    errors.push(`${name}: ${unassessedCriteria.length} framework criteria not assessed (${unassessedCriteria.join(', ')}).`);
  }

  const scope: Record<string, Finding> = {};
  const unassessedScope: string[] = [];
  for (const s of SCOPE_ITEMS) {
    const raw = q.scope?.[s.id];
    if (!raw || !isStatus(raw.status)) {
      unassessedScope.push(s.id);
      continue;
    }
    const f = checkFinding(`${name} · ${s.label}`, raw, errors);
    if (f) scope[s.id] = f;
  }
  if (unassessedScope.length) {
    errors.push(`${name}: ${unassessedScope.length} scope item(s) not assessed (${unassessedScope.join(', ')}).`);
  }

  return { label, statedTotal: q.statedTotal, statedAreaSqFt: q.statedAreaSqFt, criteria, scope };
}

function emptyCounts(): Record<FindingStatus, number> {
  return { verified: 0, not_specified: 0, unclear: 0, cannot_determine: 0, inspection_needed: 0 };
}

function readQuote(q: QuoteEntry): QuoteReadout {
  const answers: Record<string, Answer> = {};
  for (const [id, f] of Object.entries(q.criteria)) answers[id] = TO_FRAMEWORK_ANSWER[f.status];
  const scored = score(answers);
  const counts = emptyCounts();

  const criteria = allCriteria().map((c) => {
    const f = q.criteria[c.id];
    counts[f.status]++;
    return {
      id: c.id,
      pillar: pillarNameFor(c.id),
      question: c.question,
      severity: c.severity,
      status: f.status,
      evidence: f.evidence,
      basisHref: sourceHref(c),
    };
  });

  const scope = SCOPE_ITEMS.map((s) => {
    const f = q.scope[s.id];
    counts[f.status]++;
    return {
      id: s.id,
      group: s.group,
      label: s.label,
      changesScope: s.changesScope,
      status: f.status,
      evidence: f.evidence,
      basisHref: s.cite,
    };
  });

  const { riskFlags, questionsToAsk } = deriveForQuote(q);

  return {
    label: q.label,
    statedTotal: q.statedTotal,
    statedAreaSqFt: q.statedAreaSqFt,
    verdict: scored.verdict,
    pct: scored.pct,
    failedCritical: scored.failedCritical.map((c) => ({ id: c.id, question: c.question })),
    scope,
    criteria,
    riskFlags,
    questionsToAsk,
    counts,
  };
}

/**
 * Like-for-like normalization across quotes, through the free tool's compare().
 * Also rewrites a "not specified" question into a sharper one when another
 * quote the customer holds DOES state the item — without naming that quote's
 * author, and without pricing the difference.
 */
function compareQuotes(quotes: QuoteEntry[], readouts: QuoteReadout[]): ComparisonReadout {
  const comparison = compare(
    quotes.map((q) => ({
      label: q.label,
      total: q.statedTotal,
      areaSqFt: q.statedAreaSqFt,
      includes: SCOPE_ITEMS.filter((s) => q.scope[s.id]?.status === 'verified').map((s) => s.id),
    })),
  );

  // Matched by label, not index: compare() drops a quote with nothing entered
  // (no stated scope item, no total), so readings can be shorter than readouts.
  for (const reading of comparison.readings) {
    const readout = readouts.find((r) => r.label === reading.label);
    if (!readout) continue;
    for (const item of reading.missingScope) {
      const existing = readout.questionsToAsk.find((q) => q.refId === item.id && q.source === 'not-specified');
      if (!existing) continue;
      existing.source = 'comparison';
      existing.text = `Another quote you hold states "${item.label}". Is it included in this one? Please confirm in writing.`;
    }
  }

  return {
    verdict: comparison.verdict,
    statement: comparison.statement,
    divergent: comparison.divergent.map((d) => ({ id: d.id, label: d.label })),
    absentEverywhere: comparison.absentEverywhere.map((d) => ({ id: d.id, label: d.label })),
    matrix: SCOPE_ITEMS.map((s) => ({
      id: s.id,
      label: s.label,
      changesScope: s.changesScope,
      statuses: quotes.map((q) => q.scope[s.id].status),
    })),
  };
}

/**
 * Whether a quote may be described as holding up. The framework verdict alone
 * is not enough: it scores criteria only, so a quote silent on every
 * scope-changing item could still score "strong" — and "holds up" on a
 * document that does not say what it prices is exactly the claim this report
 * must never make.
 */
export function holdsUp(r: QuoteReadout): boolean {
  return (
    (r.verdict === 'sound' || r.verdict === 'strong') &&
    !r.scope.some((s) => s.changesScope && s.status !== 'verified') &&
    !r.riskFlags.some((f) => f.level === 'high')
  );
}

function statementFor(readouts: QuoteReadout[], ifSoundSaySo: string | undefined): string {
  if (readouts.every(holdsUp)) {
    return (
      ifSoundSaySo ||
      (readouts.length === 1
        ? 'This quote holds up against the Well-Installed Framework, on what the document states.'
        : 'Each quote holds up against the Well-Installed Framework, on what the documents state.')
    );
  }
  return readouts
    .map((r) => {
      const parts = [
        `${r.failedCritical.length} critical item(s) not stated`,
        `${r.scope.filter((s) => s.status !== 'verified' && s.changesScope).length} scope-changing item(s) not settled`,
      ];
      if (r.counts.inspection_needed) parts.push(`${r.counts.inspection_needed} item(s) need an on-site check`);
      return `${r.label}: ${parts.join(', ')}.`;
    })
    .concat('See the risk flags and questions below before signing.')
    .join(' ');
}

export function compose(input: ComposeInput): ComposeResult {
  const errors: string[] = [];
  forbiddenContent('Present', input.present, errors);
  forbiddenContent('Missing', input.missing, errors);
  forbiddenContent('Ask in writing', input.askInWriting, errors);
  forbiddenContent('Risk notes', input.riskNotes, errors);
  forbiddenContent('If sound, say so', input.ifSoundSaySo, errors);

  if (!input.present?.trim()) errors.push('Present: describe what the quote gets right.');
  if (!input.missing?.trim() && !input.ifSoundSaySo?.trim()) {
    errors.push('Either Missing or "if sound, say so" must say something.');
  }

  const rawQuotes = Array.isArray(input.quotes) ? input.quotes : [];
  if (rawQuotes.length === 0) errors.push('Add at least one quote.');
  if (rawQuotes.length > MAX_QUOTES) errors.push(`At most ${MAX_QUOTES} quotes per report.`);

  const quotes = rawQuotes.slice(0, MAX_QUOTES).map((q) => checkQuote(q, errors));
  const seen = new Set<string>();
  for (const q of quotes) {
    const key = q.label.toLowerCase();
    if (key && seen.has(key)) errors.push(`Two quotes are labelled "${q.label}" — give each a different label.`);
    seen.add(key);
  }

  if (errors.length) return { ok: false, errors };

  const readouts = quotes.map(readQuote);

  const ifSound = input.ifSoundSaySo?.trim() || undefined;
  if (ifSound && !readouts.every(holdsUp)) {
    return {
      ok: false,
      errors: ['If sound, say so: the scoring does not support calling every quote sound — clear this field or fix the findings.'],
    };
  }

  const comparison = quotes.length >= 2 ? compareQuotes(quotes, readouts) : undefined;

  const generalRiskFlags: RiskFlag[] = lines(input.riskNotes).map((text) => ({ level: 'medium', text }));
  if (comparison?.verdict === 'not-comparable') {
    generalRiskFlags.unshift({
      level: 'high',
      text:
        `The totals are not like-for-like: ${comparison.divergent.length} scope-changing item(s) are stated in some quotes and not others. ` +
        'Until each quote states the same list, the difference between the totals is not a price difference.',
      basisHref: '/quote-check',
    });
  }

  const generalQuestions: Question[] = lines(input.askInWriting).map((text) => ({ source: 'estimator', text }));

  const report: QuoteIntelligenceReport = {
    orderId: input.orderId,
    tier: input.tier,
    frameworkVersion: FRAMEWORK_VERSION,
    scoredOn: new Date().toISOString().slice(0, 10),
    quotes: readouts,
    comparison,
    generalRiskFlags,
    generalQuestions,
    present: input.present.trim(),
    missing: input.missing?.trim() ?? '',
    statement: statementFor(readouts, ifSound),
    ifSoundSaySo: ifSound,
    estimatorDesk: ESTIMATOR_DESK_NAME,
    refuses: QUOTE_INTELLIGENCE_REFUSES,
  };

  return { ok: true, report };
}
