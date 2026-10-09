import { afterEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const signAttachmentUrlMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    assistantConversation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
    assistantMessage: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock('./attachment-storage', () => ({
  signAttachmentUrl: (...args: unknown[]) => signAttachmentUrlMock(...args),
}));

import { appendTurn, deleteStoredAttachment, loadTranscript } from './conversation-store';

const VALID_DESIGN_ID = 'abcdefgh1234';
const OTHER_DESIGN_ID = 'zzyyxxwwvvtt';

describe('loadTranscript', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns [] for a missing or invalid designId — never queries the database', async () => {
    expect(await loadTranscript(undefined, null)).toEqual([]);
    expect(await loadTranscript('not-a-real-design-id', null)).toEqual([]);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns [] when no conversation exists for a valid designId', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await loadTranscript(VALID_DESIGN_ID, null)).toEqual([]);
  });

  it('maps stored rows to StoredTurn, preserving chronological order and structured blocks', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-01T00:01:00.000Z');
    // Queried newest-first (see the fix below); loadTranscript must restore
    // oldest-first order for display.
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
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
    const turns = await loadTranscript(VALID_DESIGN_ID, null);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.role).toBe('user');
    expect(turns[1]!.role).toBe('assistant');
    expect(turns[1]!.blocks?.[0]?.type).toBe('decision_summary');
    expect(turns[1]!.model).toBe('claude-sonnet-4-6');
  });

  it('queries the most recent MAX_LOADED_TURNS, not the oldest — a conversation past the cap must not lose its newest turns', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: null, messages: [] });
    await loadTranscript(VALID_DESIGN_ID, null);
    const query = findUniqueMock.mock.calls[0]![0];
    expect(query.select.messages.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.select.messages.take).toBe(60);
  });

  it('returns [] for a conversation linked to a different account — a known designId cannot read someone else\'s account-linked transcript', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [{ role: 'user', content: 'private stuff', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    expect(await loadTranscript(VALID_DESIGN_ID, 'someone-else')).toEqual([]);
    expect(await loadTranscript(VALID_DESIGN_ID, null)).toEqual([]);
  });

  it('returns the transcript when the viewer IS the linked account', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [{ role: 'user', content: 'my project', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, 'owner-user-id');
    expect(turns).toHaveLength(1);
  });

  it('returns the transcript for a still-anonymous conversation regardless of viewer — matches the same shareable-by-id model as Floor Studio', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
      messages: [{ role: 'user', content: 'anonymous project', blocks: null, attachments: null, model: null, createdAt: new Date() }],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID, null);
    expect(turns).toHaveLength(1);
  });

  it('never throws when the database is unreachable — degrades to an empty transcript', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await loadTranscript(VALID_DESIGN_ID, null)).toEqual([]);
  });

  it('mints a fresh signed URL for a stored attachment rather than returning its opaque storage path', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce('https://signed.example/fresh-url');
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
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
    const turns = await loadTranscript(VALID_DESIGN_ID, null);
    expect(signAttachmentUrlMock).toHaveBeenCalledWith('supabase://assistant-attachments/DESIGN123/att_1.jpg');
    expect(turns[0]!.attachments?.[0]?.url).toBe('https://signed.example/fresh-url');
    // The opaque storage path itself must never reach the client.
    expect(turns[0]!.attachments?.[0]?.url).not.toContain('supabase://');
  });

  it('never sends the internal consentId to the client, even though it is stored on the row', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce('https://signed.example/fresh-url');
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
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
    const turns = await loadTranscript(VALID_DESIGN_ID, null);
    expect(turns[0]!.attachments?.[0]).not.toHaveProperty('consentId');
  });

  it('degrades an attachment to no preview URL, never the raw storage path, when signing fails', async () => {
    signAttachmentUrlMock.mockResolvedValueOnce(null);
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
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
    const turns = await loadTranscript(VALID_DESIGN_ID, null);
    expect(turns[0]!.attachments?.[0]?.url).toBeUndefined();
  });
});

describe('appendTurn', () => {
  afterEach(() => vi.clearAllMocks());

  it('does nothing for an invalid designId — never mints a conversation for noise', async () => {
    await appendTurn({ designId: 'nope', userId: null, role: 'user', content: 'hi' });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does nothing for empty content with no blocks', async () => {
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: '   ' });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('the first anonymous message creates exactly one conversation', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'What should I do first?' });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { designId: VALID_DESIGN_ID },
        update: {},
        create: { designId: VALID_DESIGN_ID, userId: null },
      }),
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: 'conv-1', role: 'user' }) }),
    );
  });

  it('a subsequent message on the same designId reuses the existing conversation rather than creating another', async () => {
    upsertMock.mockResolvedValue({ id: 'conv-1' });
    createMock.mockResolvedValue({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'first' });
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'assistant', content: 'reply' });
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'second' });

    // upsert is idempotent (findOrCreate), so it's still called each turn, but
    // every call targets the SAME designId/conversation — never a second row.
    for (const call of upsertMock.mock.calls) {
      expect(call[0].where).toEqual({ designId: VALID_DESIGN_ID });
    }
    expect(createMock.mock.calls.every((c) => c[0].data.conversationId === 'conv-1')).toBe(true);
  });

  it('a signed-in continuation links the existing anonymous conversation instead of creating a second one', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' }); // anonymous first turn
    createMock.mockResolvedValue({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'anonymous turn' });

    upsertMock.mockResolvedValueOnce({ id: 'conv-1' }); // same conversation, now with a session
    await appendTurn({ designId: VALID_DESIGN_ID, userId: 'user-1', role: 'user', content: 'now signed in' });

    expect(upsertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { designId: VALID_DESIGN_ID }, update: { userId: 'user-1' } }),
    );
    // Same conversation id both times — never a second conversation minted for the same design.
    expect(createMock.mock.calls.every((c) => c[0].data.conversationId === 'conv-1')).toBe(true);
  });

  it('backfills userId onto an existing anonymous conversation once the visitor signs in', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: 'user-1', role: 'user', content: 'hello again' });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ update: { userId: 'user-1' } }));
  });

  it('never resets an already-linked conversation back to anonymous on an unauthenticated request', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'anon request after sign-in' });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it('never throws when the database is unreachable', async () => {
    upsertMock.mockRejectedValueOnce(new Error('down'));
    await expect(
      appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'assistant', content: 'reply' }),
    ).resolves.toBeUndefined();
  });

  it('never throws when the message insert itself fails after a successful conversation upsert', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockRejectedValueOnce(new Error('insert failed'));
    await expect(
      appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'assistant', content: 'reply' }),
    ).resolves.toBeUndefined();
  });

  it('stores structured blocks alongside the reply', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({
      designId: VALID_DESIGN_ID,
      userId: null,
      role: 'assistant',
      content: 'Here is my read.',
      blocks: [{ type: 'risk', title: 'r', issue: 'i', impact: 'p' }],
      model: 'claude-sonnet-4-6',
    });
    const data = createMock.mock.calls[0]![0].data;
    expect(data.blocks).toEqual([{ type: 'risk', title: 'r', issue: 'i', impact: 'p' }]);
    expect(data.model).toBe('claude-sonnet-4-6');
  });

  it('never invents a model id for a turn with no model attribution given', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'assistant', content: 'canned fallback line' });
    const data = createMock.mock.calls[0]![0].data;
    expect(data.model).toBeUndefined();
  });

  it('two different designIds never share a conversation row', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    upsertMock.mockResolvedValueOnce({ id: 'conv-2' });
    createMock.mockResolvedValue({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'design A' });
    await appendTurn({ designId: OTHER_DESIGN_ID, userId: null, role: 'user', content: 'design B' });

    expect(createMock.mock.calls[0]![0].data.conversationId).toBe('conv-1');
    expect(createMock.mock.calls[1]![0].data.conversationId).toBe('conv-2');
  });
});

describe('deleteStoredAttachment', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns not_found for a missing or invalid designId — never queries the database', async () => {
    expect(await deleteStoredAttachment(undefined, 'att_1', null)).toEqual({ ok: false, reason: 'not_found' });
    expect(await deleteStoredAttachment('not-a-real-id', 'att_1', null)).toEqual({ ok: false, reason: 'not_found' });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns not_found when no conversation exists for the designId', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns forbidden for a conversation linked to a different account', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: 'owner-user-id', messages: [] });
    expect(await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null)).toEqual({ ok: false, reason: 'forbidden' });
    findUniqueMock.mockResolvedValueOnce({ userId: 'owner-user-id', messages: [] });
    expect(await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', 'someone-else')).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('allows the linked account to delete its own conversation\'s attachment', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: 'owner-user-id',
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' }] }],
    });
    updateMock.mockResolvedValueOnce({});
    const result = await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', 'owner-user-id');
    expect(result).toEqual({ ok: true, storedPath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' });
  });

  it('returns not_found when the attachment id does not exist in any message of the conversation', async () => {
    findUniqueMock.mockResolvedValueOnce({ userId: null, messages: [{ id: 'msg-1', attachments: [{ id: 'att_other', kind: 'room_photo', status: 'analyzed' }] }] });
    expect(await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('marks the matching attachment unavailable and strips its url/consentId in the persisted row, leaving the rest of the message intact', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
      messages: [
        {
          id: 'msg-1',
          attachments: [
            { id: 'att_keep', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/keep.jpg', consentId: 'consent-keep' },
            { id: 'att_1', kind: 'room_photo', status: 'analyzed', filename: 'floor.jpg', url: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' },
          ],
        },
      ],
    });
    updateMock.mockResolvedValueOnce({});
    const result = await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null);
    expect(result).toEqual({ ok: true, storedPath: 'supabase://assistant-attachments/x.jpg', consentId: 'consent-1' });

    const written = updateMock.mock.calls[0]![0];
    expect(written.where).toEqual({ id: 'msg-1' });
    expect(written.data.attachments).toEqual([
      { id: 'att_keep', kind: 'room_photo', status: 'analyzed', url: 'supabase://assistant-attachments/keep.jpg', consentId: 'consent-keep' },
      { id: 'att_1', kind: 'room_photo', status: 'unavailable' },
    ]);
  });

  it('is idempotent — deleting an already-unavailable attachment succeeds without writing again', async () => {
    findUniqueMock.mockResolvedValueOnce({
      userId: null,
      messages: [{ id: 'msg-1', attachments: [{ id: 'att_1', kind: 'room_photo', status: 'unavailable' }] }],
    });
    const result = await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null);
    expect(result).toEqual({ ok: true });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('never throws when the database is unreachable', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await deleteStoredAttachment(VALID_DESIGN_ID, 'att_1', null)).toEqual({ ok: false, reason: 'db_error' });
  });
});
