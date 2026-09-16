/**
 * lib/listing-floor-report/compose.ts — pure: an estimator's read of the
 * listing photos/visit becomes a ListingFloorReport. No I/O.
 *
 * A NEW module, not an extension of lib/quote-intelligence/compose.ts (EW-0002)
 * — same idea (reject forbidden free text, never silently rewrite it), a
 * separate implementation, because this spec is explicit that EW-0002 files
 * are not to be touched and the two products must not share a marker or a
 * validation module that a future edit to one could silently change for the
 * other.
 *
 * THE GUARD
 *
 * Same market-claims risk as everywhere else on this site with a live sales
 * motion: no dollar figure invented (the only dollars in a published report
 * come from formatBand() against SCREEN_RECOAT/FULL_SAND_FINISH, computed
 * outside this guard's reach, never typed by an estimator into free text), no
 * claim that work raises sale price or beats another offer, no ranking or
 * naming of another contractor.
 */

import { computeRecoatSchedule } from './schedule';
import type { ComposeInput, ComposeResult, ListingFloorReport } from './types';
import { LISTING_FLOOR_REPORT_PRODUCT } from '@/content/constants/listing-floor-report-product';
import { formatBand, SCREEN_RECOAT, FULL_SAND_FINISH } from '@/content/constants/pricing';

const ESTIMATOR_DESK_NAME = 'Ecowoods estimating desk';

const DOLLAR_OR_PERCENT = /\$\s?\d|\d\s?%/;
const SALE_CLAIM_WORDS = /\b(will add|adds value|sale price|more money|beats? (any |the )?other offer|shorten(s)? days? on market|guarantees? a sale)\b/i;
const COMPANY_SUFFIX =
  /\b[A-Z][a-zA-Z&']+(?:\s+[A-Z][a-zA-Z&']+){0,3}\s+(Inc\.?|Ltd\.?|LLC|Corp\.?|Flooring|Hardwood(?:\s+Floors?)?|Floors|Company|Co\.|Realty|Realtors?|Brokerage)\b/;

function forbiddenContent(label: string, text: string | undefined, errors: string[]): void {
  if (!text) return;
  if (DOLLAR_OR_PERCENT.test(text)) {
    errors.push(`${label}: remove the dollar figure or percentage — published bands are quoted via formatBand(), never typed here.`);
  }
  if (SALE_CLAIM_WORDS.test(text)) {
    errors.push(`${label}: remove the sale-price/market claim — this report never promises a sale outcome.`);
  }
  if (COMPANY_SUFFIX.test(text)) {
    errors.push(`${label}: remove the company/brokerage name — no other party is named in this report.`);
  }
}

export function compose(input: ComposeInput): ComposeResult {
  const errors: string[] = [];
  forbiddenContent('Present', input.present, errors);
  forbiddenContent('Missing', input.missing, errors);
  forbiddenContent('Ask in writing', input.askInWriting, errors);

  if (!input.present?.trim()) errors.push('Present: describe what the photos/visit actually show.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.photographyDate)) {
    errors.push('Photography date: must be an ISO date (YYYY-MM-DD).');
  }

  if (errors.length) return { ok: false, errors };

  /* Physical facts a photo cannot establish default to inspection_needed for
     the photo SKU, regardless of what the estimator selected — a guess at
     moisture from a JPEG is exactly the "presenting a photo guess as a
     measured fact" this product refuses to do. The onsite SKU follows an
     actual visit, so the estimator's own finding is respected there. */
  const moisture = input.sku === 'photo' ? 'inspection_needed' : input.findings.moisture;

  const schedule = computeRecoatSchedule(input.photographyDate, input.asOf ?? new Date(), input.recommendation);

  let band: string | undefined;
  let bandCaption: string | undefined;
  if (input.recommendation === 'recoat_ok') {
    band = formatBand(SCREEN_RECOAT);
    bandCaption = 'Published Screen & Recoat range. Fixed price is written after an in-home measure.';
  } else if (input.recommendation === 'sand_required') {
    band = formatBand(FULL_SAND_FINISH);
    bandCaption = 'A recoat will not resolve this. Published Full Sand & Finish range. Fixed price is written after an in-home measure.';
  }

  const askInWriting = (input.askInWriting ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const report: ListingFloorReport = {
    orderId: input.orderId,
    sku: input.sku,
    scoredOn: new Date().toISOString().slice(0, 10),
    recommendation: input.recommendation,
    findings: { ...input.findings, moisture },
    band,
    bandCaption,
    schedule,
    present: input.present.trim(),
    missing: input.missing?.trim() ?? '',
    askInWriting,
    estimatorDesk: ESTIMATOR_DESK_NAME,
    refuses: LISTING_FLOOR_REPORT_PRODUCT.refuses,
  };

  return { ok: true, report };
}
