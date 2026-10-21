import { afterEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const createMock = vi.fn();
const executeRawMock = vi.fn();
const signAttachmentUrlMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    assistantConversation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
    assistantMessage: {
      create: (...args: unknown[]) => createMock(...args),
    },
    // Prisma's tagged-template raw-SQL call — mocked as a plain function
    // taking the same (strings, ...values) shape a template tag receives,
    // so tests can assert on the bound values without parsing SQL text.
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => executeRawMock(strings, ...values),
  },
}));

vi.mock('./attachment-storage', () => ({
  signAttachmentUrl: (...args: unknown[]) => signAttachmentUrlMock(...args),
}));

import { appendTurn, claimAttachmentForDeletion, finalizeAttachmentDeletion, loadTranscript } from './conversation-store';
import { hashAccessToken } from './conversation-access';

const TOKEN = 'T'.repeat(43);
const HASH = hashAccessToken(TOKEN);

/** Pulls the two JSON-ish template values a casSwapAttachments call bound, in the order the UPDATE statement interpolates them: SET attachments = ${next}::jsonb WHERE id = ${messageId}::uuid AND attachments = ${expected}::jsonb. */
function lastSwapValues(): { next: unknown; messageId: unknown; expected: unknown } {
  const call = executeRawMock.mock.calls.at(-1)!;
  // call = [strings, next, messageId, expected].
  return { next: JSON.parse(call[1] as string), messageId: call[2], expected: JSON.parse(call[3] as string) };
}

const VALID_DESIGN_ID = 'abcdefgh1234';
const OTHER_DESIGN_ID = 'zzyyxxwwvvtt';

describe('loadTranscript', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns [] for a missing or invalid designId — never queries the database', async () => {
    expect(await loadTranscript(undefined, null, TOKEN)).toEqual([]);
    expect(await loadTranscript('not-a-real-design-id', null, TOKEN)).toEqual([]);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns [] when no conversation exists for a valid designId', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await loadTranscript(VALID_DESIGN_ID, null, TOKEN)).toEqual([]);
  });

  it('maps stored rows to StoredTurn, preserving chronological order and structured blocks', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-01T00:01:00.000Z');
    // Queried newest-first (see the fix below); loadTranscript must restore
    // oldest-first order for display.
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          role: 'assistant',
          content: 'Here is my read.',
          blocks: [{ type: 'decision_summary', title: 'x', situation: 'y', whatMatters: ['z'], firstStep: 'w' }],
          attachments: null,
          model: 'claude-sonnet-4-6',
          createdAt: t2,
        },
        { role: 'user', content: 'What should I do first?', blocks: null, attachments: null, model: null, createdAt: t1 },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.role).toBe('user');
    expect(turns[1]!.role).toBe('assistant');
    expect(turns[1]!.blocks?.[0]?.type).toBe('decision_summary');
    expect(turns[1]!.model).toBe('claude-sonnet-4-6');
  });

  it('queries the most recent MAX_LOADED_TURNS, not the oldest — a conversation past the cap must not lose its newest turns', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: null, accessTokenHash: HASH, messages: [] });
    await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    const query = findUniqueMock.mock.calls[0]![0];
    expect(query.select.messages.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.select.messages.take).toBe(60);
  });

  it('returns [] for a conversation linked to a different account — a known designId cannot read someone else\'s account-linked transcript', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [{ role: 'user', content: 'private stuff', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    expect(await loadTranscript(VALID_DESIGN_ID, 'someone-else', TOKEN)).toEqual([]);
    expect(await loadTranscript(VALID_DESIGN_ID, null, TOKEN)).toEqual([]);
  });

  it('returns the transcript when the viewer IS the linked account', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [{ role: 'user', content: 'my project', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, 'owner-user-id', TOKEN);
    expect(turns).toHaveLength(1);
  });

  it('returns an anonymous conversation only to the holder of its access token — designId alone reads nothing', async () => {
    const row = () => ({
      userId: null,
      accessTokenHash: HASH,
      messages: [{ role: 'user', content: 'anonymous project', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    findUniqueMock.mockResolvedValueOnce(row());
    expect(await loadTranscript(VALID_DESIGN_ID, null, TOKEN)).toHaveLength(1);
    findUniqueMock.mockResolvedValueOnce(row());
    expect(await loadTranscript(VALID_DESIGN_ID, null, null)).toEqual([]);
    findUniqueMock.mockResolvedValueOnce(row());
    expect(await loadTranscript(VALID_DESIGN_ID, null, 'X'.repeat(43))).toEqual([]);
  });

  it('never throws when the database is unreachable — degrades to an empty transcript', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await loadTranscript(VALID_DESIGN_ID, null, TOKEN)).toEqual([]);
  });

  it('mints a fresh signed URL for a stored attachment rather than returning its opaque storage path', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce('https://signed.example/fresh-url');
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          role: 'user',
          content: 'my floor is cupping',
          blocks: null,
          attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', filename: 'floor.jpg', url: 'supabase://assistant-attachments/DESIGN123/att_1.jpg' }],
          model: null,
          createdAt: new Date(),
        },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    expect(signAttachmentUrlMock).toHaveBeenCalledWith('supabase://assistant-attachments/DESIGN123/att_1.jpg');
    expect(turns[0]!.attachments?.[0]?.url).toBe('https://signed.example/fresh-url');
    // The opaque storage path itself must never reach the client.
    expect(turns[0]!.attachments?.[0]?.url).not.toContain('supabase://');
  });

  it('never sends the internal consentId to the client, even though it is stored on the row', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce('https://signed.example/fresh-url');
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          role: 'user',
          content: 'see this',
          blocks: null,
          attachments: [
            { id: 'att_1', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-row-id' },
          ],
          model: null,
          createdAt: new Date(),
        },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    expect(turns[0]!.attachments?.[0]).not.toHaveProperty('consentId');
  });

  it('never exposes the preview (or the real url) for an attachment mid-deletion — status "deleting" gets the same no-preview treatment as "unavailable"', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          role: 'user',
          content: 'see this',
          blocks: null,
          attachments: [
            { id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: true },
          ],
          model: null,
          createdAt: new Date(),
        },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    expect(turns[0]!.attachments?.[0]?.url).toBeUndefined();
    expect(signAttachmentUrlMock).not.toHaveBeenCalled();
    // The cleanup bookkeeping fields are server-internal too.
    expect(turns[0]!.attachments?.[0]).not.toHaveProperty('storageDeleted');
    expect(turns[0]!.attachments?.[0]).not.toHaveProperty('consentWithdrawn');
  });

  it('degrades an attachment to no preview URL, never the raw storage path, when signing fails', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce(null);
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          role: 'user',
          content: 'see this',
          blocks: null,
          attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/x.jpg' }],
          model: null,
          createdAt: new Date(),
        },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null, TOKEN);
    expect(turns[0]!.attachments?.[0]?.url).toBeUndefined();
  });
});

describe('appendTurn', () => {
  afterEach(() => vi.clearAllMocks());

  it('does nothing without an authorised conversation id — never writes for an unauthorised caller', async () => {
    await appendTurn({ conversationId: null, role: 'user', content: 'hi' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does nothing for empty content with no blocks', async () => {
    await appendTurn({ conversationId: 'conv-1', role: 'user', content: '   ' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('writes the turn to the given conversation', async () => {
    createMock.mockResolvedValueOnce({});
    await appendTurn({ conversationId: 'conv-1', role: 'user', content: 'What should I do first?' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: 'conv-1', role: 'user' }) }),
    );
  });

  it('never throws when the message insert fails', async () => {
    createMock.mockRejectedValueOnce(new Error('insert failed'));
    await expect(appendTurn({ conversationId: 'conv-1', role: 'assistant', content: 'reply' })).resolves.toBeUndefined();
  });

  it('stores structured blocks alongside the reply, and never invents a model id', async () => {
    createMock.mockResolvedValue({});
    await appendTurn({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Here is my read.',
      blocks: [{ type: 'risk', title: 'r', issue: 'i', impact: 'p' }],
      model: 'claude-sonnet-4-6',
    });
    const data = createMock.mock.calls[0]![0].data;
    expect(data.blocks).toEqual([{ type: 'risk', title: 'r', issue: 'i', impact: 'p' }]);
    expect(data.model).toBe('claude-sonnet-4-6');
    await appendTurn({ conversationId: 'conv-1', role: 'assistant', content: 'canned fallback line' });
    expect(createMock.mock.calls[1]![0].data.model).toBeUndefined();
  });
});

describe('claimAttachmentForDeletion', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns not_found for a missing or invalid designId — never queries the database', async () => {
    expect(await claimAttachmentForDeletion(undefined, 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'not_found' });
    expect(await claimAttachmentForDeletion('not-a-real-id', 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'not_found' });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns not_found when no conversation exists for the designId', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns forbidden for a conversation linked to a different account — never claims, never writes', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: 'owner-user-id', messages: [] });
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'forbidden' });
    findUniqueMock.mockResolvedValueOnce({ userId: 'owner-user-id', messages: [] });
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', 'someone-else', TOKEN)).toEqual({ ok: false, reason: 'forbidden' });
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it('returns not_found when the attachment id does not exist in any message of the conversation', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: null, accessTokenHash: HASH, messages: [{ id: 'msg-1', attachments: [{ id: 'att_other', kind: 'room_photo', status: 'analyzed' }] }] });
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('is a true no-op for an already-unavailable attachment — reports complete without any write', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }] }],
    });
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN)).toEqual({ ok: true, alreadyComplete: true });
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it('claims a fresh analyzed attachment via a guarded compare-and-swap, keeping url/consentId (never wiping them up front) and reporting both legs outstanding', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [
        {
          id: 'msg-1',
          attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', filename: 'floor.jpg', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' }],
        },
      ],
    });
    executeRawMock.mockResolvedValueOnce(1);
    const result = await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', 'owner-user-id', TOKEN);
    expect(result).toEqual({ ok: true, alreadyComplete: false, storagePath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', needsStorage: true, needsConsent: true });

    const { next, expected } = lastSwapValues();
    expect(expected).toEqual([{ id: 'att_1', kind: 'room_photo', status: 'analyzed', filename: 'floor.jpg', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' }]);
    // url/consentId are KEPT on the claimed row — this is the actual fix:
    // the old behaviour wiped them here, before cleanup even ran.
    expect(next).toEqual([{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }]);
  });

  it('a retry of a row already "deleting" with one leg done reports only the outstanding leg, without writing again', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        {
          id: 'msg-1',
          attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: true, consentWithdrawn: false }],
        },
      ],
    });
    const result = await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN);
    expect(result).toEqual({ ok: true, alreadyComplete: false, storagePath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', needsStorage: false, needsConsent: true });
    expect(executeRawMock).not.toHaveBeenCalled(); // no write needed to re-report an already-claimed row
  });

  it('retries the compare-and-swap when a concurrent writer changed the row first (affected !== 1), and succeeds on the next read', async () => {
    findUniqueMock
      .mockResolvedValueOnce({
        userId: null, accessTokenHash: HASH,
        messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' }] }],
      })
      .mockResolvedValueOnce({
        // Someone else already claimed it by the time we re-read.
        userId: null, accessTokenHash: HASH,
        messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] }],
      });
    executeRawMock.mockResolvedValueOnce(0); // our swap lost the race
    const result = await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN);
    expect(result).toEqual({ ok: true, alreadyComplete: false, storagePath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', needsStorage: true, needsConsent: true });
    expect(executeRawMock).toHaveBeenCalledTimes(1); // the second read found it already 'deleting' — no second swap attempt needed
  });

  it('never throws when the database is unreachable', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN)).toEqual({ ok: false, reason: 'db_error' });
  });

  /**
   * Found live, against this sandbox's own Postgres, while integration-
   * testing this feature: the SAME attachment id ended up persisted into
   * THREE separate messages (one legitimate upload, two inert rows left by
   * rejected forged refs that happened to reuse the real id — see
   * chat/route.ts's provenance gate, which rejects the forged ref's
   * url/consentId but still writes a `status: 'failed'` row under the id it
   * claimed). DELETE on that id reported `complete: true` after clearing
   * only the FIRST matching row it found — the real photo, in a DIFFERENT
   * message, was never touched: file still on disk, consent still GRANTED,
   * confirmed directly in Postgres. This is the regression test for the fix.
   */
  it('claims EVERY message that holds this attachment id, not just the first one found — the exact bug found live in this sandbox', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        { id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' }] },
        { id: 'msg-2', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'failed' }] }, // inert duplicate: a rejected forged ref that reused this id
      ],
    });
    executeRawMock.mockResolvedValue(1);
    const result = await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN);
    expect(result).toEqual({ ok: true, alreadyComplete: false, storagePath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', needsStorage: true, needsConsent: true });
    // BOTH rows were claimed into 'deleting' — not just msg-1.
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    const calls = executeRawMock.mock.calls.map((c) => ({ next: JSON.parse(c[1] as string), messageId: c[2] }));
    const msg1 = calls.find((c) => c.messageId === 'msg-1')!;
    const msg2 = calls.find((c) => c.messageId === 'msg-2')!;
    expect(msg1.next[0].status).toBe('deleting');
    expect(msg1.next[0].url).toBe('supabase://assistant-attachments/x.jpg'); // the real data, kept
    expect(msg2.next[0].status).toBe('deleting'); // the inert duplicate converges too, not left stranded at 'failed'
  });

  it('reports alreadyComplete only once EVERY occurrence is unavailable, not just one of several', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        { id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }] },
        { id: 'msg-2', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: true, consentWithdrawn: false }] },
      ],
    });
    const result = await claimAttachmentForDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN);
    // msg-1 is done, but msg-2 is NOT — this must not be reported complete.
    expect(result).toEqual({ ok: true, alreadyComplete: false, storagePath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', needsStorage: false, needsConsent: true });
  });
});

describe('finalizeAttachmentDeletion', () => {
  afterEach(() => vi.clearAllMocks());

  it('flips to unavailable and WIPES url/consentId only once both legs actually succeeded', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] }],
    });
    executeRawMock.mockResolvedValueOnce(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: true });
    expect(result).toEqual({ ok: true, complete: true });
    const { next } = lastSwapValues();
    expect(next).toEqual([{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }]);
  });

  it('a legacy attachment with no consentId at all completes on storage success alone — never fabricates a consent withdrawal that never happened', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', storageDeleted: false, consentWithdrawn: false }] }],
    });
    executeRawMock.mockResolvedValueOnce(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: false });
    expect(result).toEqual({ ok: true, complete: true });
  });

  it('a storage failure keeps the row "deleting" WITH url/consentId retained — not wiped — so a retry can still find them', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] }],
    });
    executeRawMock.mockResolvedValueOnce(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: false, consentWithdrawn: true });
    expect(result).toEqual({ ok: true, complete: false });
    const { next } = lastSwapValues();
    expect(next).toEqual([{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: true }]);
  });

  it('a consent-withdrawal failure alone also keeps the row retryable, with storageDeleted already recorded true so a retry never re-deletes the (already-gone) object', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] }],
    });
    executeRawMock.mockResolvedValueOnce(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: false });
    expect(result).toEqual({ ok: true, complete: false });
    const { next } = lastSwapValues();
    expect((next as { storageDeleted: boolean }[])[0]!.storageDeleted).toBe(true);
    expect((next as { consentWithdrawn: boolean }[])[0]!.consentWithdrawn).toBe(false);
  });

  it('a prior-finalize flag is never regressed — once storageDeleted is true on the row, a later finalize call reporting false for THIS attempt still keeps it true', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: true, consentWithdrawn: false }] }],
    });
    executeRawMock.mockResolvedValueOnce(1);
    // This call's OWN outcome only attempted the consent leg (storageDeleted
    // wasn't re-attempted, so it reports false for "did I just do it" —
    // finalize must OR it with what the row already recorded, not overwrite.
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: false, consentWithdrawn: false });
    expect(result).toEqual({ ok: true, complete: false });
    const { next } = lastSwapValues();
    expect((next as { storageDeleted: boolean }[])[0]!.storageDeleted).toBe(true);
  });

  it('returns complete:true without writing when a concurrent finalize already won', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }] }],
    });
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: true });
    expect(result).toEqual({ ok: true, complete: true });
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it('respects the same account-linked authorization boundary as claim', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: 'owner-user-id', messages: [] });
    expect(await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', 'someone-else', TOKEN, { storageDeleted: true, consentWithdrawn: true })).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('never throws when the database is unreachable', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: true })).toEqual({ ok: false, reason: 'db_error' });
  });

  it('finalizes EVERY message holding this attachment id — the regression test for the live-found multi-row bug, at the finalize stage', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        { id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] },
        { id: 'msg-2', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', storageDeleted: false, consentWithdrawn: false }] }, // the inert duplicate, already claimed
      ],
    });
    executeRawMock.mockResolvedValue(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: true, consentWithdrawn: true });
    expect(result).toEqual({ ok: true, complete: true });
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    const calls = executeRawMock.mock.calls.map((c) => ({ next: JSON.parse(c[1] as string), messageId: c[2] }));
    expect(calls.find((c) => c.messageId === 'msg-1')!.next[0]).toEqual({ id: 'att_1', kind: 'room_photo', status: 'unavailable' });
    expect(calls.find((c) => c.messageId === 'msg-2')!.next[0]).toEqual({ id: 'att_1', kind: 'room_photo', status: 'unavailable' });
  });

  it('does not report complete while ANY occurrence still has an outstanding leg, even if others are already done', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null, accessTokenHash: HASH,
      messages: [
        { id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }] },
        { id: 'msg-2', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'deleting', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1', storageDeleted: false, consentWithdrawn: false }] },
      ],
    });
    executeRawMock.mockResolvedValue(1);
    const result = await finalizeAttachmentDeletion(VALID_DESIGN_ID, 'att_1', null, TOKEN, { storageDeleted: false, consentWithdrawn: true });
    expect(result).toEqual({ ok: true, complete: false });
    // msg-1 (already unavailable) must not be touched again.
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });
});
