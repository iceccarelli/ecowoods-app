/**
 * lib/floor-plan/spec.ts — a paid StudioDesign, written out as a
 * specification. Pure: takes an already-decoded StudioDesign (Floor
 * Studio's own decodeStudioDesign() already refuses anything not isLayable —
 * see catalog.ts's header on why that boundary exists), no I/O.
 *
 * Every fact below is IMPORTED, not invented: species/finish/pattern/width
 * from the catalogue, the range from priceConfiguration() (which itself
 * delegates to estimateInstalledRangeCad — one arithmetic, three surfaces),
 * seasonal movement from movementFor() (Wood Handbook coefficients against
 * the published Toronto indoor year), and the pre-installation checklist from
 * the Well-Installed Framework's own moisture/substrate/specification
 * pillars, cited by criterion id. This module adds no fact of its own.
 */

import {
  describeConfiguration,
  finishById,
  movementFor,
  patternById,
  priceConfiguration,
  productById,
  widthById,
} from '@/lib/floor-studio/catalog';
import { studioRef, type StudioDesign } from '@/lib/floor-studio/studio-config';
import { PILLARS, sourceHref } from '@/lib/framework';
import { FLOOR_PLAN_PRODUCT } from '@/content/constants/floor-plan-product';

/** The pillars whose criteria matter before a floor like this one goes down. */
const SPEC_PILLAR_IDS = ['moisture', 'substrate', 'specification'];

export type FloorPlanChecklistItem = {
  id: string;
  question: string;
  href: string;
};

export type FloorPlanSpec = {
  orderId: string;
  designRef: string;
  scoredOn: string;
  summary: string;
  species: string;
  finish: string;
  pattern: string;
  width: string;
  squareFeet: number;
  estimateLow: number;
  estimateHigh: number;
  currency: string;
  movementSentence: string | null;
  checklist: FloorPlanChecklistItem[];
  refuses: readonly string[];
};

export function buildFloorPlanSpec(orderId: string, design: StudioDesign): FloorPlanSpec {
  const product = productById(design.config.productId);
  const finish = finishById(design.config.finishId);
  const pattern = patternById(design.config.patternId);
  const width = widthById(design.config.widthId);
  const estimate = priceConfiguration(design.config, design.squareFeet, design.country);
  const movement = movementFor(design.config);

  const checklist: FloorPlanChecklistItem[] = PILLARS.filter((p) => SPEC_PILLAR_IDS.includes(p.id)).flatMap((p) =>
    p.criteria.map((c) => ({ id: c.id, question: c.question, href: sourceHref(c) })),
  );

  return {
    orderId,
    designRef: studioRef(design),
    scoredOn: new Date().toISOString().slice(0, 10),
    summary: describeConfiguration(design.config),
    species: product?.name ?? 'Unknown',
    finish: finish?.label ?? 'Unknown',
    pattern: pattern?.label ?? 'Unknown',
    width: width?.label ?? 'Unknown',
    squareFeet: design.squareFeet,
    estimateLow: estimate.estimatedLowCad,
    estimateHigh: estimate.estimatedHighCad,
    currency: estimate.currency,
    movementSentence: movement?.sentence ?? null,
    checklist,
    refuses: FLOOR_PLAN_PRODUCT.refuses,
  };
}
