/**
 * lib/quote-intelligence/store.ts — thin wrapper around the existing
 * storePdf() so callers don't hand-roll the filename.
 *
 * Deliberately a FLAT filename, not `quote-intelligence/{orderId}.pdf`: the
 * local dev fallback in lib/pdf/storage.ts does a bare
 * `fs.writeFileSync(path.join(pdfDir, filename), ...)` with no recursive
 * mkdir for a nested path, and storage.ts is an existing file this build must
 * not edit. A flat name works on all three backends unmodified.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { storePdf } from '@/lib/pdf/storage';
import { QuoteIntelligenceReportDocument } from './report-pdf';
import type { QuoteIntelligenceReport } from './types';

export async function storeQuoteIntelligenceReport(report: QuoteIntelligenceReport): Promise<string> {
  const element = createElement(QuoteIntelligenceReportDocument, { report });
  const buffer = await renderToBuffer(element as never);
  const filename = `quote-intelligence-${report.orderId}-${Date.now()}.pdf`;
  return storePdf(buffer, filename);
}
