import { afterEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const updateManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    consentRecord: {
      create: (...args: unknown[]) => createMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { isConsentValidForAttachment, withdrawConsentById } from './consent';

const LIVE_GRANT = {
  id: 'c1',
  purpose: 'ASSISTANT_PHOTOS',
  state: 'GRANTED',
  subjectEmail: null,
  userId: null,
  wording: 'Send this photo to Francisco...',
  surface: 'assistant-chat:attachments:att_1',
  version: '1',
  withdrawnAt: null,
};

describe('withdrawConsentById', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns false for a consent id that does not exist — the delete route can still clean up storage', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await withdrawConsentById('nope')).toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns false, and appends nothing, when the conditional update matches zero rows (already withdrawn or never granted)', async () => {
    findUniqueMock.mockResolvedValueOnce({ ...LIVE_GRANT, state: 'WITHDRAWN', withdrawnAt: new Date() });
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    expect(await withdrawConsentById('c1')).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('withdraws a live anonymous grant (no subjectEmail) — the case withdrawConsent(purpose, email, surface) cannot handle at all', async () => {
    findUniqueMock.mockResolvedValueOnce(LIVE_GRANT);
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    createMock.mockResolvedValueOnce({});

    const ok = await withdrawConsentById('c1');
    expect(ok).toBe(true);

    // The open grant is stamped closed via a CONDITIONAL update (guarded on
    // state/withdrawnAt, not a blind write) — see the concurrency test below
    // for why that guard is the actual correctness mechanism.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'c1', state: 'GRANTED', withdrawnAt: null },
      data: { withdrawnAt: expect.any(Date) },
    });
    // ...and a second WITHDRAWN row is appended, never a silent update-in-place
    // of what was shown — same append-only discipline as withdrawConsent.
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: 'ASSISTANT_PHOTOS',
          state: 'WITHDRAWN',
          subjectEmail: null,
          surface: 'assistant-chat:attachments:att_1',
          version: '1',
          withdrawnAt: expect.any(Date),
        }),
      }),
    );
  });

  it('two concurrent withdrawals of the same grant: only the one whose conditional update actually matched a row appends the audit row — recorded at most once', async () => {
    // Both callers read the same live row...
    findUniqueMock.mockResolvedValue(LIVE_GRANT);
    // ...but only ONE of the two conditional updates can match
    // (state: 'GRANTED', withdrawnAt: null) — Postgres serializes the two
    // UPDATEs on the same row, and the second one no longer matches the
    // WHERE clause once the first has committed. Modelled here as the first
    // call's updateMany returning count:1 and the second's returning
    // count:0, which is the real, enforced outcome of the guarded UPDATE —
    // not an assumption about ordering.
    updateManyMock.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    createMock.mockResolvedValueOnce({});

    const [first, second] = await Promise.all([withdrawConsentById('c1'), withdrawConsentById('c1')]);
    const results = [first, second].sort();

    expect(results).toEqual([false, true]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('the database-failure contract: findUnique rejecting propagates — not swallowed here, matching withdrawConsent\'s own lack of a try/catch. The attachment-delete caller is responsible for catching it.', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    await expect(withdrawConsentById('c1')).rejects.toThrow('connection refused');
  });

  it('the database-failure contract also covers the conditional update itself rejecting', async () => {
    findUniqueMock.mockResolvedValueOnce(LIVE_GRANT);
    updateManyMock.mockRejectedValueOnce(new Error('connection refused'));
    await expect(withdrawConsentById('c1')).rejects.toThrow('connection refused');
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('isConsentValidForAttachment — the actual authorization check for a client-echoed consentId', () => {
  afterEach(() => vi.clearAllMocks());

  it('is true for a live grant whose surface matches exactly', async () => {
    findUniqueMock.mockResolvedValueOnce({ purpose: 'ASSISTANT_PHOTOS', state: 'GRANTED', withdrawnAt: null, surface: 'assistant-chat:attachments:att_1' });
    expect(await isConsentValidForAttachment('c1', 'assistant-chat:attachments:att_1')).toBe(true);
  });

  it('REJECTS a real, live, GRANTED consent id whose surface names a DIFFERENT attachment — this is the actual "forged consent ID" case: a client echoing someone else’s real grant id against an unrelated attachment', async () => {
    findUniqueMock.mockResolvedValueOnce({ purpose: 'ASSISTANT_PHOTOS', state: 'GRANTED', withdrawnAt: null, surface: 'assistant-chat:attachments:att_SOMEONE_ELSES' });
    expect(await isConsentValidForAttachment('c1', 'assistant-chat:attachments:att_1')).toBe(false);
  });

  it('rejects a consent id that does not exist', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await isConsentValidForAttachment('nope', 'assistant-chat:attachments:att_1')).toBe(false);
  });

  it('rejects a withdrawn grant, even with a matching surface', async () => {
    findUniqueMock.mockResolvedValueOnce({ purpose: 'ASSISTANT_PHOTOS', state: 'GRANTED', withdrawnAt: new Date(), surface: 'assistant-chat:attachments:att_1' });
    expect(await isConsentValidForAttachment('c1', 'assistant-chat:attachments:att_1')).toBe(false);
  });

  it('rejects a grant for a different purpose, even with a matching surface string', async () => {
    findUniqueMock.mockResolvedValueOnce({ purpose: 'MODEL_TRAINING', state: 'GRANTED', withdrawnAt: null, surface: 'assistant-chat:attachments:att_1' });
    expect(await isConsentValidForAttachment('c1', 'assistant-chat:attachments:att_1')).toBe(false);
  });

  it('fails closed (false, never throws) when the database is unreachable — an unverifiable consent is never treated as valid', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    await expect(isConsentValidForAttachment('c1', 'assistant-chat:attachments:att_1')).resolves.toBe(false);
  });
});
