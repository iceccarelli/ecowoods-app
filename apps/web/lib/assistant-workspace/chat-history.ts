/**
 * lib/assistant-workspace/chat-history.ts — which turns of the on-screen
 * conversation the client sends to POST /api/assistant/chat.
 *
 * The route's schema (chat-schema.ts, from @ecowoods/shared/schemas) is a
 * hard contract: at most CHAT_MAX_MESSAGES messages, each at most
 * CHAT_MAX_CONTENT_CHARS characters, and a raw body under
 * CHAT_MAX_BODY_BYTES. The transcript the client holds is NOT bounded by that
 * contract — a restored transcript can be 60 turns, and one long answer
 * exceeds the per-message cap. Sending it whole made a long conversation
 * answer every new message with 400/413 forever. This keeps the most recent
 * turns that fit and clips a single oversized message, so the newest question
 * always goes through.
 */
import { CHAT_MAX_BODY_BYTES, CHAT_MAX_CONTENT_CHARS, CHAT_MAX_MESSAGES } from '@ecowoods/shared/schemas';

export interface HistoryTurn {
  role: 'user' | 'assistant';
  text: string;
  /** A send-failure placeholder or a still-streaming reply: not something Francisco said. */
  failed?: boolean;
  streaming?: boolean;
}

/** Room left in the body for the workspace snapshot, attachment refs and JSON framing. */
const BODY_BUDGET_BYTES = CHAT_MAX_BODY_BYTES - 6 * 1024;

const encoder = new TextEncoder();
const bytesOf = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

/**
 * Indices (into `turns`) to send, oldest first. Always includes the last turn
 * (the new user message, clipped if it alone is oversized), starts on a user
 * turn, and never includes failed or in-flight assistant placeholders.
 */
export function selectChatHistory<T extends HistoryTurn>(turns: T[]): { index: number; text: string }[] {
  const usable: { index: number; role: T['role']; text: string }[] = [];
  turns.forEach((t, index) => {
    const isLast = index === turns.length - 1;
    if (!isLast && t.role === 'assistant' && (t.failed || t.streaming)) return;
    const text = t.text.length > CHAT_MAX_CONTENT_CHARS ? t.text.slice(0, CHAT_MAX_CONTENT_CHARS) : t.text;
    if (!text.trim() && !isLast) return;
    usable.push({ index, role: t.role, text });
  });

  const picked: typeof usable = [];
  let used = 0;
  for (let i = usable.length - 1; i >= 0 && picked.length < CHAT_MAX_MESSAGES; i--) {
    const cost = bytesOf({ role: usable[i]!.role, content: usable[i]!.text });
    if (picked.length > 0 && used + cost > BODY_BUDGET_BYTES) break;
    used += cost;
    picked.unshift(usable[i]!);
  }
  // The model conversation must open on the homeowner's turn.
  while (picked.length > 1 && picked[0]!.role !== 'user') picked.shift();
  return picked.map(({ index, text }) => ({ index, text }));
}
