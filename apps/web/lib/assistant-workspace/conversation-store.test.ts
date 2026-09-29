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

describe('loadTranscript', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns [] for a missing or invalid designId — never queries the database', async () => {
    expect(await loadTranscript(undefined)).toEqual([]);
    expect(await loadTranscript('not-a-real-design-id')).toEqual([]);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns [] when no conversation exists for a valid designId', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await loadTranscript(VALID_DESIGN_ID)).toEqual([]);
  });

  it('maps stored rows to StoredTurn, preserving order and structured blocks', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    findUniqueMock.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: 'What should I do first?', blocks: null, attachments: null, model: null, createdAt },
        {
          role: 'assistant',
          content: 'Here is my read.',
          blocks: [{ type: 'decision_summary', title: 'x', situation: 'y', whatMatters: ['z'], firstStep: 'w' }],
          attachments: null,
          model: 'claude-sonnet-4-6',
          createdAt,
        },
      ],
    });
    const turns = await loadTranscript(VALID_DESIGN_ID);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.role).toBe('user');
    expect(turns[1]!.role).toBe('assistant');
    expect(turns[1]!.blocks?.[0]?.type).toBe('decision_summary');
    expect(turns[1]!.model).toBe('claude-sonnet-4-6');
  });

  it('never throws when the database is unreachable — degrades to an empty transcript', async () => {
    findUniqueMock.mockRejectedValueOnce(new Error('connection refused'));
    expect(await loadTranscript(VALID_DESIGN_ID)).toEqual([]);
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

  it('upserts the conversation (anonymous) then creates the message', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: null, role: 'user', content: 'What should I do first?' });

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

  it('backfills userId onto an existing anonymous conversation once the visitor signs in', async () => {
    upsertMock.mockResolvedValueOnce({ id: 'conv-1' });
    createMock.mockResolvedValueOnce({});
    await appendTurn({ designId: VALID_DESIGN_ID, userId: 'user-1', role: 'user', content: 'hello again' });

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ update: { userId: 'user-1' } }));
  });

  it('never throws when the database is unreachable', async () => {
    upsertMock.mockRejectedValueOnce(new Error('down'));
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
});
