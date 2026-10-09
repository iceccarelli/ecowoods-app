import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ORIGINAL_ENV = { ...process.env };

function clearSupabaseEnv() {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

describe('attachment-storage', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
    vi.resetModules();
    const dir = path.join(process.cwd(), '.assistant-attachments');
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores to the local dev fallback when no Supabase credentials are configured, and never in production', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'test');
    const { storeAttachment } = await import('./attachment-storage');
    const result = await storeAttachment(Buffer.from('fake-jpeg-bytes'), 'DESIGN123/att_1', 'image/jpeg');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe('file://.assistant-attachments/DESIGN123/att_1.jpg');
  });

  it('fails closed in production with no store configured — never silently drops the request', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    const { storeAttachment } = await import('./attachment-storage');
    const result = await storeAttachment(Buffer.from('x'), 'DESIGN123/att_2', 'image/jpeg');
    expect(result.ok).toBe(false);
  });

  it('round-trips through the local fallback: stored bytes can be downloaded back exactly', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'test');
    const { storeAttachment, downloadAttachment } = await import('./attachment-storage');
    const original = Buffer.from('a real photo would go here');
    const stored = await storeAttachment(original, 'DESIGN123/att_3', 'image/png');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const downloaded = await downloadAttachment(stored.path);
    expect(downloaded).not.toBeNull();
    expect(downloaded?.buffer.equals(original)).toBe(true);
    expect(downloaded?.contentType).toBe('image/png');
  });

  it('signAttachmentUrl returns a usable data: URL for the local fallback (no HTTP server exists for that directory)', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'test');
    const { storeAttachment, signAttachmentUrl } = await import('./attachment-storage');
    const stored = await storeAttachment(Buffer.from('thumbnail bytes'), 'DESIGN123/att_4', 'image/webp');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const signed = await signAttachmentUrl(stored.path);
    expect(signed).toMatch(/^data:image\/webp;base64,/);
  });

  it('downloadAttachment and signAttachmentUrl return null for an unrecognised path scheme rather than throwing', async () => {
    const { downloadAttachment, signAttachmentUrl } = await import('./attachment-storage');
    expect(await downloadAttachment('https://example.com/not-ours.jpg')).toBeNull();
    expect(await signAttachmentUrl('https://example.com/not-ours.jpg')).toBeNull();
  });

  it('deleteAttachment actually removes the local-fallback file — downloadAttachment can no longer read it afterward', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'test');
    const { storeAttachment, downloadAttachment, deleteAttachment } = await import('./attachment-storage');
    const stored = await storeAttachment(Buffer.from('a photo to be deleted'), 'DESIGN123/att_5', 'image/jpeg');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;

    expect(await downloadAttachment(stored.path)).not.toBeNull();
    expect(await deleteAttachment(stored.path)).toBe(true);
    expect(await downloadAttachment(stored.path)).toBeNull();
  });

  it('deleteAttachment is idempotent — deleting a path that was never written still reports success', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'test');
    const { deleteAttachment } = await import('./attachment-storage');
    expect(await deleteAttachment('file://.assistant-attachments/DESIGN123/never-existed.jpg')).toBe(true);
  });

  it('deleteAttachment returns false for an unrecognised path scheme and for no store configured, rather than throwing', async () => {
    clearSupabaseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    const { deleteAttachment } = await import('./attachment-storage');
    expect(await deleteAttachment('https://example.com/not-ours.jpg')).toBe(false);
    expect(await deleteAttachment('supabase://assistant-attachments/x.jpg')).toBe(false);
  });
});
