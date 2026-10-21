import { describe, it, expect, vi, beforeEach } from 'vitest';

const { store, grant } = vi.hoisted(() => ({
  store: vi.fn(async () => ({ ok: true as const, path: 'p/att' })),
  grant: vi.fn(async () => 'consent_1'),
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/rate-limit-durable', () => ({ enforceRateLimit: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })) }));
vi.mock('@/lib/floor-graph/consent', () => ({ grantConsent: grant }));
vi.mock('@/lib/assistant-workspace/conversation-store', () => ({
  establishConversation: vi.fn(async () => ({ ok: true as const, conversationId: 'conv-1' })),
}));
vi.mock('@/lib/assistant-workspace/attachment-storage', () => ({
  storeAttachment: store,
  signAttachmentUrl: vi.fn(async () => 'https://signed.example/x'),
  attachmentConsentSurface: (id: string) => `assistant-chat:attachment:${id}`,
}));

import { sniffImage, safeFilename } from '@/lib/image-sniff';
import { newDesignId } from '@/lib/floor-studio/design-id';
import { POST } from '@/app/api/assistant/attachments/route';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');

const upload = (bytes: Uint8Array, type: string, name = 'x.jpg') => {
  const fd = new FormData();
  fd.set('designId', newDesignId());
  fd.set('photo', new File([bytes], name, { type }));
  return POST(new Request('https://ecowoods.ca/api/assistant/attachments', { method: 'POST', body: fd }));
};

beforeEach(() => vi.clearAllMocks());

describe('image sniffing', () => {
  it('recognises real formats and rejects everything else', () => {
    expect(sniffImage(JPEG)?.contentType).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.contentType).toBe('image/png');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))?.contentType).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('\0\0\0\x18ftypheic'))?.contentType).toBe('image/heic');
    expect(sniffImage(HTML)).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
  it('makes filenames safe', () => {
    expect(safeFilename('../../etc/pass"wd\r\n.png', 'png')).toBe('etc-pass-wd.png');
    expect(safeFilename(undefined, 'jpg')).toBe('photo.jpg');
  });
});

describe('POST /api/assistant/attachments', () => {
  it('stores a real JPEG with the sniffed type', async () => {
    const res = await upload(JPEG, 'image/jpeg');
    expect(res.status).toBe(201);
    expect((await res.json()).contentType).toBe('image/jpeg');
  });
  it('rejects HTML that claims to be a JPEG', async () => {
    const res = await upload(HTML, 'image/jpeg');
    expect(res.status).toBe(400);
    expect(store).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });
  it('rejects HTML with no declared type (used to skip the check)', async () => {
    const res = await upload(HTML, '');
    expect(res.status).toBe(400);
    expect(store).not.toHaveBeenCalled();
  });
});
