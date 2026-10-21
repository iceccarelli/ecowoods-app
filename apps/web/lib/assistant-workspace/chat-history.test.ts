import { describe, it, expect } from 'vitest';
import { CHAT_MAX_CONTENT_CHARS, CHAT_MAX_MESSAGES, chatRequestSchema, CHAT_MAX_BODY_BYTES } from '@ecowoods/shared/schemas';
import { selectChatHistory, type HistoryTurn } from './chat-history';

const turn = (i: number, text = `m${i}`): HistoryTurn => ({ role: i % 2 === 0 ? 'user' : 'assistant', text });

describe('selectChatHistory', () => {
  it('keeps a short conversation whole', () => {
    const turns = [turn(0), turn(1), turn(2)];
    expect(selectChatHistory(turns).map((t) => t.index)).toEqual([0, 1, 2]);
  });

  it('caps a restored 60-turn transcript to what the route accepts, keeping the newest turn', () => {
    const turns = Array.from({ length: 61 }, (_, i) => turn(i));
    const picked = selectChatHistory(turns);
    expect(picked.length).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
    expect(picked[picked.length - 1]!.index).toBe(60);
    expect(turns[picked[0]!.index]!.role).toBe('user');
    const body = { messages: picked.map((p) => ({ role: turns[p.index]!.role, content: p.text })) };
    expect(chatRequestSchema.safeParse(body).success).toBe(true);
  });

  it('clips one over-long message and stays under the body limit', () => {
    const long = 'x'.repeat(CHAT_MAX_CONTENT_CHARS * 3);
    const turns: HistoryTurn[] = [];
    for (let i = 0; i < 20; i++) turns.push({ role: i % 2 === 0 ? 'user' : 'assistant', text: long });
    turns.push({ role: 'user', text: 'and now?' });
    const picked = selectChatHistory(turns);
    const body = JSON.stringify({ messages: picked.map((p, k) => ({ role: turns[p.index]!.role, content: p.text, k })) });
    expect(new TextEncoder().encode(body).length).toBeLessThan(CHAT_MAX_BODY_BYTES);
    expect(picked.every((p) => p.text.length <= CHAT_MAX_CONTENT_CHARS)).toBe(true);
    expect(picked[picked.length - 1]!.text).toBe('and now?');
  });

  it('drops failed and in-flight assistant placeholders but never the newest turn', () => {
    const turns: HistoryTurn[] = [
      { role: 'user', text: 'a' },
      { role: 'assistant', text: "I couldn't complete that analysis.", failed: true },
      { role: 'user', text: 'b' },
    ];
    expect(selectChatHistory(turns).map((t) => t.index)).toEqual([0, 2]);
  });
});
