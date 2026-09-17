import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { allCriteria } from '@/lib/framework';
import { SCOPE_ITEMS } from '@/lib/quote-check';
import { compose } from './compose';
import { QuoteIntelligenceReportDocument } from './report-pdf';
import type { Finding, QuoteEntry } from './types';

const stated = (excerpt: string, page = 1): Finding => ({ status: 'verified', evidence: { page, excerpt } });

function quote(label: string, silent: string[], inspect: string[] = []): QuoteEntry {
  const status = (id: string): Finding =>
    silent.includes(id) ? { status: 'not_specified' } : inspect.includes(id) ? { status: 'inspection_needed' } : stated('As written on the quote.', 2);
  return {
    label,
    statedTotal: 8400,
    statedAreaSqFt: 700,
    criteria: Object.fromEntries(allCriteria().map((c) => [c.id, status(c.id)])),
    scope: Object.fromEntries(SCOPE_ITEMS.map((s) => [s.id, status(s.id)])),
  };
}

describe('QuoteIntelligenceReportDocument', () => {
  it('renders a three-quote report with comparison, flags and evidence to a real PDF', async () => {
    const critical = allCriteria().find((c) => c.severity === 'critical')!.id;
    const result = compose({
      orderId: '00000000-0000-4000-8000-000000000001',
      tier: 'Rush',
      quotes: [
        quote('Quote A', []),
        quote('Quote B', ['removal-disposal', 'subfloor-prep', critical]),
        quote('Quote C', ['moisture-readings'], ['substrate-assessment']),
      ],
      present: 'All three name the species, grade and width, and the area in square feet.',
      missing: 'Quote B is silent on removal and subfloor preparation.',
      askInWriting: 'Please confirm the start date in writing.',
      riskNotes: 'Quote C was sent as photos; page order was inferred.',
    });
    if (!result.ok) throw new Error(result.errors.join(' | '));

    const buffer = await renderToBuffer(createElement(QuoteIntelligenceReportDocument, { report: result.report }) as never);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(4);

    if (process.env.QI_PDF_ARTIFACT) writeFileSync(process.env.QI_PDF_ARTIFACT, buffer);
  });
});
