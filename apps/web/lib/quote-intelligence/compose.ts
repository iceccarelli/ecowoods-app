/**
 * lib/quote-intelligence/compose.ts — pure: an estimator's answers become a
 * QuoteIntelligenceReport. No I/O, no Prisma, no Stripe — everything that
 * touches a database or the network lives in the API routes that call this.
 *
 * REUSES score() FROM lib/framework — this file does not reimplement the
 * verdict math. It only shapes the result into what a customer reads.
 *
 * THE GUARD IN forbiddenContent()
 *
 * Same legal line content/quote-check/scope-items.ts already draws: no price
 * put on anything a quote leaves out, no company named or ranked. That file's
 * comment explains why (Competition Act s.74.01(1)(b), Bill C-59, Energizer
 * Brands v Gillette 2023 FC 804) — this is the same risk, now in a document an
 * estimator writes free text into rather than a fixed content file, so it
 * gets a runtime guard instead of a build-time one.
 *
 * The guard REJECTS rather than silently strips. Silently deleting a clause
 * from a report a customer paid for is a worse failure than an estimator
 * seeing "remove this before you can publish" — it is invisible to the one
 * person positioned to catch it.
 */

import { allCriteria, score, type Answer } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { ESTIMATOR_DESK_NAME, QUOTE_INTELLIGENCE_REFUSES } from '@/content/constants/quote-intelligence';
import type { ComposeInput, ComposeResult, Question, QuoteIntelligenceReport } from './types';
import { FRAMEWORK_VERSION } from '@/lib/framework';

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

export function compose(input: ComposeInput): ComposeResult {
  const errors: string[] = [];
  forbiddenContent('Present', input.present, errors);
  forbiddenContent('Missing', input.missing, errors);
  forbiddenContent('Ask in writing', input.askInWriting, errors);
  forbiddenContent('If sound, say so', input.ifSoundSaySo, errors);

  if (!input.present?.trim()) errors.push('Present: describe what the quote gets right.');
  if (!input.missing?.trim() && Object.values(input.answers).every((a) => a !== 'no')) {
    // Not an error on its own — a report can say nothing is missing — but an
    // empty Missing with no "no" answers and no ifSoundSaySo is a report with
    // no content at all.
    if (!input.ifSoundSaySo?.trim()) {
      errors.push('Either Missing or "if sound, say so" must say something.');
    }
  }

  if (errors.length) return { ok: false, errors };

  const criteria = allCriteria();
  const answers: Record<string, Answer> = input.answers;
  const scored = score(answers);

  const scopeById = new Map(SCOPE_ITEMS.map((s) => [s.id, s]));
  const missingScope = SCOPE_ITEMS.filter(
    (s) => !input.presentScopeIds.includes(s.id),
  ).map((s) => ({ id: s.id, label: s.label }));

  const questions: Question[] = [];
  for (const c of scored.failedCritical) {
    questions.push({ source: 'failed-criterion', refId: c.id, text: c.question });
  }
  for (const c of criteria) {
    if (answers[c.id] === 'unsure' && c.severity !== 'advisory') {
      questions.push({ source: 'unsure-criterion', refId: c.id, text: c.question });
    }
  }
  for (const id of missingScope.map((m) => m.id)) {
    const item = scopeById.get(id);
    if (item) questions.push({ source: 'missing-scope', refId: id, text: `Why is "${item.label}" not in this quote?` });
  }
  if (input.askInWriting?.trim()) {
    for (const line of input.askInWriting.split('\n').map((l) => l.trim()).filter(Boolean)) {
      questions.push({ source: 'estimator', text: line });
    }
  }

  const statement =
    scored.verdict === 'strong' || scored.verdict === 'sound'
      ? (input.ifSoundSaySo?.trim() || 'This quote holds up against the Well-Installed Framework.')
      : `This quote has ${scored.failedCritical.length} unresolved critical item(s) and ${missingScope.length} scope item(s) not addressed. See the questions below before signing.`;

  const report: QuoteIntelligenceReport = {
    orderId: input.orderId,
    tier: input.tier,
    frameworkVersion: FRAMEWORK_VERSION,
    scoredOn: new Date().toISOString().slice(0, 10),
    verdict: scored.verdict,
    pct: scored.pct,
    failedCritical: scored.failedCritical.map((c) => ({ id: c.id, question: c.question })),
    missingScope,
    questionsToAsk: questions,
    present: input.present.trim(),
    missing: input.missing?.trim() ?? '',
    statement,
    ifSoundSaySo: input.ifSoundSaySo?.trim() || undefined,
    estimatorDesk: ESTIMATOR_DESK_NAME,
    refuses: QUOTE_INTELLIGENCE_REFUSES,
  };

  return { ok: true, report };
}
