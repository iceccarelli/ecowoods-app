import { describe, it, expect } from 'vitest';
import { chatFailure } from './chat-failure';

describe('chatFailure', () => {
  it('429 says how long to wait and allows retry', () => {
    const f = chatFailure(429, '12');
    expect(f.text).toContain('12 seconds');
    expect(f.retryable).toBe(true);
  });
  it('429 without a usable Retry-After still reads naturally', () => {
    expect(chatFailure(429, null).text).toContain('a moment');
    expect(chatFailure(429, 'abc').text).toContain('a moment');
  });
  it('413 and 503 are not retryable and 503 keeps the phone alternative', () => {
    expect(chatFailure(413).retryable).toBe(false);
    const f = chatFailure(503);
    expect(f.retryable).toBe(false);
    expect(f.text).toMatch(/\(\d{3}\) \d{3}-\d{4}|\d{3}[ -.]\d{3}[ -.]\d{4}/);
  });
  it('never claims a charge and offers the phone on a generic failure', () => {
    for (const s of [429, 413, 500, 502, 503]) expect(chatFailure(s).text).toContain('Nothing was charged');
    expect(chatFailure(502).text).toMatch(/\d{3}/);
  });
});
