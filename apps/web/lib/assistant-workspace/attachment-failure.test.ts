import { describe, it, expect } from 'vitest';
import { attachmentUploadFailure } from './attachment-failure';

describe('attachmentUploadFailure', () => {
  it('403 (no cookie on this device) offers a new conversation, not a retry', () => {
    const f = attachmentUploadFailure(403, 'forbidden');
    expect(f.offerNewConversation).toBe(true);
    expect(f.text).not.toMatch(/try again/i);
  });
  it('429 names the wait', () => {
    expect(attachmentUploadFailure(429, undefined, '12').text).toContain('12 seconds');
  });
  it('400 passes the server message through', () => {
    expect(attachmentUploadFailure(400, 'Use JPEG, PNG, WebP or HEIC.').text).toBe('Use JPEG, PNG, WebP or HEIC.');
  });
  it('anything else is generic and never claims success', () => {
    const f = attachmentUploadFailure(502);
    expect(f.offerNewConversation).toBe(false);
    expect(f.text).toMatch(/couldn't upload/i);
  });
});
