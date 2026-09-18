/**
 * lib/listing-floor-report/store.ts — renders and stores the report PDF via
 * the existing storePdf(). Flat filename, same reasoning as
 * lib/quote-intelligence/store.ts: the local dev fallback in
 * lib/pdf/storage.ts has no recursive mkdir for a nested path, and that file
 * is not edited here.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { storePdf } from '@/lib/pdf/storage';
import { ListingFloorReportDocument } from './report-pdf';
import type { ListingFloorReport } from './types';

export async function storeListingFloorReport(report: ListingFloorReport): Promise<string> {
  const element = createElement(ListingFloorReportDocument, { report });
  const buffer = await renderToBuffer(element as never);
  const filename = `listing-floor-report-${report.orderId}-${Date.now()}.pdf`;
  return storePdf(buffer, filename);
}
