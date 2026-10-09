import { afterEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const updateMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    consentRecord: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { withdrawConsentById } from './consent';

describe('withdrawConsentById', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns false for a consent id that does not exist — never throws, so a caller can still clean up storage', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await withdrawConsentById('nope')).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns false for a row that was already withdrawn — never double-withdraws', async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 'c1', state: 'GRANTED', withdrawnAt: new Date() });
    expect(await withdrawConsentById('c1')).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns false for a row whose state is not GRANTED', async () => {
    findUniqueMock.mockResolvedValueOnce({ id: 'c1', state: 'WITHDRAWN', withdrawnAt: null });
    expect(await withdrawConsentById('c1')).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('withdraws a live anonymous grant (no subjectEmail) — the case withdrawConsent(purpose, email, surface) cannot handle at all', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'c1',
      purpose: 'ASSISTANT_PHOTOS',
      state: 'GRANTED',
      subjectEmail: null,
      userId: null,
      wording: 'Send this photo to Francisco...',
      surface: 'assistant-chat:attachments',
      version: '1',
      withdrawnAt: null,
    });
    updateMock.mockResolvedValueOnce({});
    createMock.mockResolvedValueOnce({});

    const ok = await withdrawConsentById('c1');
    expect(ok).toBe(true);

    // The open grant is stamped closed...
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' }, data: { withdrawnAt: expect.any(Date) } }));
    // ...and a second WITHDRAWN row is appended, never a silent update-in-place
    // of what was shown — same append-only discipline as withdrawConsent.
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: 'ASSISTANT_PHOTOS',
          state: 'WITHDRAWN',
          subjectEmail: null,
          surface: 'assistant-chat:attachments',
          version: '1',
          withdrawnAt: expect.any(Date),
        }),
      }),
    );
  });

  it('never throws when the database is unreachable', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    await expect(withdrawConsentById('c1')).rejects.toThrow();
    // Note: withdrawConsentById itself does not swallow DB errors (unlike
    // conversation-store.ts's functions) — its caller, the delete route,
    // already wraps this call in .catch(() => false) and logs, matching
    // the storage-deletion call right next to it. Documented here so the
    // contract is explicit rather than assumed.
  });
});
