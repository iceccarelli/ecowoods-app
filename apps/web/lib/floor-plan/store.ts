/**
 * lib/floor-plan/store.ts — renders and stores the spec PDF via the existing
 * storePdf(). Flat filename, same reasoning as EW-0002/EW-0003's store.ts:
 * the local dev fallback in lib/pdf/storage.ts has no recursive mkdir for a
 * nested path, and that file is not edited here.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { storePdf } from '@/lib/pdf/storage';
import { FloorPlanDocument } from './report-pdf';
import type { FloorPlanSpec } from './spec';

export async function storeFloorPlanSpec(spec: FloorPlanSpec): Promise<string> {
  const element = createElement(FloorPlanDocument, { spec });
  const buffer = await renderToBuffer(element as never);
  const filename = `floor-plan-${spec.orderId}-${Date.now()}.pdf`;
  return storePdf(buffer, filename);
}
