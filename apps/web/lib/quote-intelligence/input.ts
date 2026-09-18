/**
 * lib/quote-intelligence/input.ts — the one parser between an HTTP body and
 * compose(). Shared by /api/quote-intelligence/compose and /publish so the
 * preview and the published report can never read the same body differently.
 *
 * SHAPE HERE, RULES IN compose()
 *
 * This file only guarantees types: strings are strings, numbers are finite
 * numbers, arrays are arrays. It does NOT decide whether a status is valid, an
 * excerpt is present, or a label names a company — compose() owns those rules
 * and turns them into estimator-readable errors. Without this layer a body
 * like `{ quotes: [{ label: 7 }] }` would reach `label.trim()` and surface as
 * a 500 instead of a message.
 *
 * `orderId` and `tier` are deliberately absent from what this returns: both
 * come from the Order row the route loaded, never from the body.
 */

import { z } from 'zod';
import type { ComposeInput } from './types';

/** Blank inputs arrive as "" or null from the workbench; both mean "not entered". */
const optionalPositive = z.preprocess(
  (v) => (v === '' || v === null ? undefined : typeof v === 'string' ? Number(v) : v),
  z.number().finite().optional(),
);

const findingSchema = z.object({
  status: z.string().max(40),
  evidence: z
    .object({
      page: optionalPositive,
      excerpt: z.string().max(2000),
    })
    .optional(),
});

const quoteSchema = z.object({
  label: z.string().max(200),
  statedTotal: optionalPositive,
  statedAreaSqFt: optionalPositive,
  criteria: z.record(z.string().max(20), findingSchema).default({}),
  scope: z.record(z.string().max(80), findingSchema).default({}),
});

const bodySchema = z.object({
  orderId: z.string().uuid(),
  /* Bounded above MAX_QUOTES on purpose: compose() is the place that says
     "at most three quotes" in words the estimator reads. */
  quotes: z.array(quoteSchema).max(10).default([]),
  present: z.string().max(4000).default(''),
  missing: z.string().max(4000).default(''),
  askInWriting: z.string().max(4000).optional(),
  riskNotes: z.string().max(4000).optional(),
  ifSoundSaySo: z.string().max(2000).optional(),
});

export type ParsedComposeBody = {
  orderId: string;
  fields: Omit<ComposeInput, 'orderId' | 'tier'>;
};

export type ParseResult = { ok: true; body: ParsedComposeBody } | { ok: false; error: string };

export function parseComposeBody(raw: unknown): ParseResult {
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'body';
    return { ok: false, error: `Malformed request at ${where}: ${issue?.message ?? 'invalid'}` };
  }
  const { orderId, quotes, ...rest } = parsed.data;
  return {
    ok: true,
    body: {
      orderId,
      fields: {
        ...rest,
        // Status stays a string here; compose() rejects anything that is not one of the five.
        quotes: quotes as ComposeInput['quotes'],
      },
    },
  };
}
