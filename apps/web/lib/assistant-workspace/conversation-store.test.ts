import { afterEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    assistantConversation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
    assistantMessage: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

import { appendTurn, loadTranscript } from './conversation-store';

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
