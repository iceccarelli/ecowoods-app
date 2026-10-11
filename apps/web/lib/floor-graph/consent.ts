/**
 * lib/floor-graph/consent.ts — the only way anything enters the Floor Graph.
 *
 * WHY A MODULE AND NOT A BOOLEAN
 *
 * PIPEDA case summary #2006-349 held that photographs of a dwelling's
 * interior are personal information about the person who lives there, and that
 * a notice which failed to say photographs would be taken was not consent. The
 * joint federal/provincial/territorial principles for generative AI
 * (7 December 2023) add that use of that material to train a model is a
 * SEPARATE purpose requiring its own basis. Neither of those is expressible as
 * `consented: true`.
 *
 * So consent here is a row: a purpose, the exact wording that was shown, the
 * surface it was shown on, when it was granted, and — as a second row, never
 * an update — when it was withdrawn. The ledger is append-only because "we
 * held consent on 3 March and it was withdrawn on 9 April" is a defensible
 * statement and "consent is currently false" is not.
 *
 * THE WORDING CONSTANTS ARE THE CONTRACT, AND THEY LIVE IN ./wording.ts.
 *
 * They are the strings rendered to the person AND the strings written to the
 * ledger — one source, so the record cannot drift from what was on screen.
 * They are in a separate import-free module because this one pulls in Prisma
 * and the estimate form that renders them is a client component.
 * Changing a string means bumping its version, because a consent you cannot
 * reproduce verbatim is a consent you cannot defend. scripts/verify-floor-
 * graph.mjs fails the build if a wording constant is edited without its
 * version moving.
 */
import { db } from '@/lib/db';

import { CONSENT_WORDING, type ConsentPurpose, type ConsentWording } from './wording';

export { CONSENT_WORDING };
export type { ConsentPurpose, ConsentWording };

/** Lowercased and trimmed, so a withdrawal matches every grant. */
export function normaliseSubject(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = email.trim().toLowerCase();
  return v.length > 0 ? v : null;
}

export type GrantInput = {
  purpose: ConsentPurpose;
  /** Where it was granted, e.g. 'estimate-form:photos'. */
  surface: string;
  subjectEmail?: string | null;
  userId?: string | null;
};

/**
 * Record a grant. Returns the consent row id, which is what a data-bearing row
 * stores — `AssessmentPhoto.consentId` is NOT NULL for exactly this reason:
 * a photograph whose lawful basis cannot be named is a photograph we should
 * not be holding.
 *
 * Throws on failure rather than returning null. Every caller writes personal
 * data immediately afterwards, and a caller that silently proceeded without a
 * consent id would be the one bug in this system that matters.
 */
export async function grantConsent(input: GrantInput): Promise<string> {
  const wording = CONSENT_WORDING[input.purpose];
  const row = await db.consentRecord.create({
    data: {
      purpose: input.purpose,
      state: 'GRANTED',
      subjectEmail: normaliseSubject(input.subjectEmail),
      userId: input.userId ?? null,
      wording: wording.text,
      surface: input.surface,
      version: wording.version,
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Withdraw. Appends a WITHDRAWN row and stamps the open grants, so the ledger
 * reads as a history rather than a current value. Returns how many grants were
 * closed — zero is a legitimate answer and the caller should say so plainly
 * rather than reporting success.
 */
export async function withdrawConsent(
  purpose: ConsentPurpose,
  subjectEmail: string,
  surface: string,
): Promise<number> {
  const subject = normaliseSubject(subjectEmail);
  if (!subject) return 0;
  const wording = CONSENT_WORDING[purpose];
  const now = new Date();

  const closed = await db.consentRecord.updateMany({
    where: { purpose, subjectEmail: subject, state: 'GRANTED', withdrawnAt: null },
    data: { withdrawnAt: now },
  });

  await db.consentRecord.create({
    data: {
      purpose,
      state: 'WITHDRAWN',
      subjectEmail: subject,
      wording: wording.text,
      surface,
      version: wording.version,
      withdrawnAt: now,
    },
  });

  return closed.count;
}

/**
 * Withdraw one specific grant by its row id, rather than by (purpose,
 * subjectEmail). `withdrawConsent` above cannot close an anonymous grant at
 * all — `normaliseSubject(undefined)` is `null`, which it refuses to act on
 * — and Ask Francisco's attachments are anonymous-first, consented without
 * an email the way the estimate-form triage flow collects one. A caller
 * that already holds the exact grant id (e.g. deleting one specific photo)
 * needs a way to close exactly that row regardless of whether a subject was
 * ever named. Same append-only discipline as `withdrawConsent`: the open
 * row is stamped, and a second WITHDRAWN row is appended — never a bare
 * update-in-place that would leave no trace of when the row was open.
 *
 * CONCURRENCY: the stamp is a single conditional `updateMany` guarded on
 * `state: 'GRANTED', withdrawnAt: null` — not a read-then-write. Two
 * concurrent calls for the same id race on that one UPDATE; Postgres row
 * locking lets exactly one of them match and flip the row, so only that
 * caller's `count` comes back 1 and only that caller appends the audit
 * row. The loser's `count` is 0 and it returns false without writing
 * anything — "recorded at most once" is enforced by the database, not by
 * a race the caller has to avoid triggering.
 *
 * ERROR CONTRACT: returns false for a row that does not exist, was already
 * withdrawn, or lost the race above — this is the expected, non-exceptional
 * "nothing to do" outcome. A database connectivity failure is NOT swallowed
 * here (consistent with `withdrawConsent` above, which also has no
 * try/catch of its own) — it propagates as a thrown rejection. The one
 * caller of this function (the attachment-delete path in
 * conversation-store.ts) is expected to catch and log that case itself,
 * exactly as it already does for the storage-deletion call beside it.
 */
export async function withdrawConsentById(consentId: string): Promise<boolean> {
  const row = await db.consentRecord.findUnique({ where: { id: consentId } });
  if (!row) return false;
  const now = new Date();
  const claimed = await db.consentRecord.updateMany({
    where: { id: consentId, state: 'GRANTED', withdrawnAt: null },
    data: { withdrawnAt: now },
  });
  if (claimed.count !== 1) return false;
  await db.consentRecord.create({
    data: {
      purpose: row.purpose,
      state: 'WITHDRAWN',
      subjectEmail: row.subjectEmail,
      userId: row.userId,
      wording: row.wording,
      surface: row.surface,
      version: row.version,
      withdrawnAt: now,
    },
  });
  return true;
}

/**
 * Does `consentId` name a currently-live ASSISTANT_PHOTOS grant whose
 * `surface` matches `expectedSurface` exactly?
 *
 * WHY THIS EXISTS: `consentId` travels back from the upload route to the
 * client, and the client echoes it on the chat request that persists the
 * attachment (see chat-schema.ts's attachmentRefSchema). An echoed id is
 * not proof of anything by itself — a client could send ANY syntactically
 * valid id. What makes it trustworthy is that `grantConsent` stamps each
 * grant's `surface` with the SERVER-GENERATED attachment id it was issued
 * for (see attachment-storage.ts's `attachmentConsentSurface`), so this
 * check — purpose, state, and an EXACT surface match against the id the
 * caller claims this consent belongs to — is the only way a client-echoed
 * consentId is ever trusted. A UUID for someone else's real, live,
 * unrelated grant fails this check every time, because its surface names a
 * different attachment id. Called from chat/route.ts before an attachment
 * is persisted at all — a ref that fails this is dropped, never stored.
 *
 * Fails closed: any lookup error (including the database being
 * unreachable) is treated as "not valid," never as "assume it's fine."
 */
export async function isConsentValidForAttachment(consentId: string, expectedSurface: string): Promise<boolean> {
  try {
    const row = await db.consentRecord.findUnique({
      where: { id: consentId },
      select: { purpose: true, state: true, withdrawnAt: true, surface: true },
    });
    return !!row && row.purpose === 'ASSISTANT_PHOTOS' && row.state === 'GRANTED' && !row.withdrawnAt && row.surface === expectedSurface;
  } catch {
    return false;
  }
}

/** Is there a live grant for this purpose right now? */
export async function hasLiveConsent(
  purpose: ConsentPurpose,
  subjectEmail: string,
): Promise<boolean> {
  const subject = normaliseSubject(subjectEmail);
  if (!subject) return false;
  const found = await db.consentRecord.findFirst({
    where: { purpose, subjectEmail: subject, state: 'GRANTED', withdrawnAt: null },
    select: { id: true },
  });
  return found !== null;
}

/**
 * A checkbox value from a form, read strictly.
 *
 * Browsers send an unchecked checkbox as ABSENT, not as 'false'. Anything
 * present that is not an explicit affirmative is treated as no — a form that
 * posts `photoConsent=maybe` gets no consent rather than the benefit of the
 * doubt.
 */
export function readCheckbox(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1' || v === 'yes';
}
