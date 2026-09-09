/**
 * lib/floor-graph/wording.ts — the consent strings, and nothing else.
 *
 * WHY THIS IS ITS OWN FILE
 *
 * These strings are rendered to a person in a CLIENT component and written to
 * the consent ledger on the SERVER, and they must be the same string in both
 * places — a ledger that stores wording nobody was shown is worse than no
 * ledger. lib/floor-graph/consent.ts imports @/lib/db, so a client component
 * that reached for the wording through it would pull Prisma into the browser
 * bundle and fail the build (scripts/verify-client-boundary.mjs exists because
 * that has happened here before).
 *
 * So the strings live here, with no imports at all, and consent.ts re-exports
 * them for server callers. One source, two consumers, no Prisma in the client.
 *
 * EDITING A STRING REQUIRES BUMPING ITS VERSION. scripts/verify-floor-graph.mjs
 * hashes each `text` against scripts/floor-graph-baseline.json and fails the
 * build when the text moved and the version did not.
 */

export type ConsentPurpose =
  | 'ASSESSMENT_PHOTOS'
  | 'MODEL_TRAINING'
  | 'BENCHMARK_CONTRIBUTION'
  | 'FLOOR_RECORD';

export type ConsentWording = {
  purpose: ConsentPurpose;
  /** Rendered to the person and written to the ledger. Same string. */
  text: string;
  /** Bump on any edit to `text`. Guarded. */
  version: string;
};

export const CONSENT_WORDING: Record<ConsentPurpose, ConsentWording> = {
  ASSESSMENT_PHOTOS: {
    purpose: 'ASSESSMENT_PHOTOS',
    text:
      'Keep these photos on file after the callback, so the estimator can compare them to what we find when we measure. We do not publish them and we do not share them. Ask us any time and we delete them.',
    version: '1',
  },
  MODEL_TRAINING: {
    purpose: 'MODEL_TRAINING',
    text:
      'You may also use these photos to improve how Ecowoods estimates floors. Separate from the above, and not required.',
    version: '1',
  },
  BENCHMARK_CONTRIBUTION: {
    purpose: 'BENCHMARK_CONTRIBUTION',
    text:
      'Add my answers to the anonymous benchmark. Only the 27 answers, the framework version and my area are sent — no name, no email, no contact of any kind, and nothing that identifies the quote or who wrote it.',
    version: '1',
  },
  FLOOR_RECORD: {
    purpose: 'FLOOR_RECORD',
    text:
      'Keep a durable record of this floor — what was installed, when, and with what — that stays with the property and can be handed to a future owner.',
    version: '1',
  },
};
