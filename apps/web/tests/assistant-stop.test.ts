import { describe, it, expect } from 'vitest';
import { stoppedReplyText, STOPPED_MARKER } from '@/lib/assistant-workspace/stopped-reply';

describe('Stop in Ask Francisco', () => {
  it('keeps partly streamed text and marks it unfinished', () => {
    const out = stoppedReplyText('Refinishing a 400 sq ft room usually starts at');
    expect(out.startsWith('Refinishing a 400 sq ft room usually starts at')).toBe(true);
    expect(out).toContain(STOPPED_MARKER);
  });
  it('falls back to "Stopped." when nothing had streamed', () => {
    expect(stoppedReplyText('  \n')).toBe('Stopped.');
  });
});
