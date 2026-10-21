import { describe, it, expect } from 'vitest';
import { readReplyStream, ModelStreamError, type ReplyStreamPart } from './chat-stream';

async function* parts(list: ReplyStreamPart[]) {
  for (const p of list) yield p;
}

describe('readReplyStream', () => {
  it('forwards text deltas and ignores other parts', async () => {
    const seen: string[] = [];
    const out = await readReplyStream(parts([{ type: 'start' }, { type: 'text-delta', text: 'Hel' }, { type: 'tool-call' }, { type: 'text-delta', text: 'lo' }, { type: 'finish' }]), (d) => seen.push(d));
    expect(seen.join('')).toBe('Hello');
    expect(out.aborted).toBe(false);
  });

  it('throws on a provider error part instead of ending as an empty reply', async () => {
    await expect(readReplyStream(parts([{ type: 'error', error: new Error('overloaded') }]), () => undefined)).rejects.toBeInstanceOf(ModelStreamError);
  });

  it('reports an abort', async () => {
    const out = await readReplyStream(parts([{ type: 'text-delta', text: 'a' }, { type: 'abort' }]), () => undefined);
    expect(out.aborted).toBe(true);
  });
});
