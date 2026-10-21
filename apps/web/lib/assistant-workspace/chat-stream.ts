/**
 * lib/assistant-workspace/chat-stream.ts — reading a model stream without
 * losing its failures.
 *
 * `streamText().textStream` yields only text deltas: a provider error
 * (bad key, overload, tool crash) arrives as an `error` part on `fullStream`
 * and `textStream` silently skips it, ending as an empty reply. The chat route
 * then answered "I heard you…" and saved it as if the model had said it. This
 * reads `fullStream` instead and throws on an error part so the route's
 * existing error path (`{type:"error"}` line, nothing persisted) runs.
 */
export interface ReplyStreamPart {
  type: string;
  text?: string;
  error?: unknown;
}

export class ModelStreamError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'model stream error');
    this.name = 'ModelStreamError';
    (this as { cause?: unknown }).cause = cause;
  }
}

/** Calls `onText` per text delta; throws ModelStreamError on an error part. Returns on `abort`/end. */
export async function readReplyStream(stream: AsyncIterable<ReplyStreamPart>, onText: (delta: string) => void): Promise<{ aborted: boolean }> {
  for await (const part of stream) {
    if (part.type === 'text-delta' && typeof part.text === 'string') onText(part.text);
    else if (part.type === 'error') throw new ModelStreamError(part.error);
    else if (part.type === 'abort') return { aborted: true };
  }
  return { aborted: false };
}
