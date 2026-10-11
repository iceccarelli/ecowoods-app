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

  describe('expectedAttachmentPaths / isOwnAttachmentPath — the actual authorization check for a client-echoed attachment reference', () => {
    it('matches both storage forms for the exact (designId, attachmentId, contentType) it was built from', async () => {
      const { expectedAttachmentPaths, isOwnAttachmentPath, ATTACHMENT_BUCKET } = await import('./attachment-storage');
      const paths = expectedAttachmentPaths('abcdefgh1234', 'att_real1', 'image/jpeg');
      expect(paths).toEqual([`supabase://${ATTACHMENT_BUCKET}/abcdefgh1234/att_real1.jpg`, 'file://.assistant-attachments/abcdefgh1234/att_real1.jpg']);
      expect(isOwnAttachmentPath(`supabase://${ATTACHMENT_BUCKET}/abcdefgh1234/att_real1.jpg`, 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(true);
      expect(isOwnAttachmentPath('file://.assistant-attachments/abcdefgh1234/att_real1.jpg', 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(true);
    });

    it('REJECTS a path naming any other bucket — this is the actual fix for a forged storage URI "unlocking" a different bucket', async () => {
      const { isOwnAttachmentPath } = await import('./attachment-storage');
      expect(isOwnAttachmentPath('supabase://pdfs/abcdefgh1234/att_real1.jpg', 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(false);
      expect(isOwnAttachmentPath('supabase://floor-graph/abcdefgh1234/att_real1.jpg', 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(false);
    });

    it('REJECTS a path naming a different design’s namespace — a forged reference cannot reach another conversation’s photo', async () => {
      const { isOwnAttachmentPath, ATTACHMENT_BUCKET } = await import('./attachment-storage');
      expect(isOwnAttachmentPath(`supabase://${ATTACHMENT_BUCKET}/SOMEONE-ELSES-DESIGN/att_real1.jpg`, 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(false);
    });

    it('REJECTS a path naming a different attachment id within the SAME design — cannot splice one object onto another’s reference', async () => {
      const { isOwnAttachmentPath, ATTACHMENT_BUCKET } = await import('./attachment-storage');
      expect(isOwnAttachmentPath(`supabase://${ATTACHMENT_BUCKET}/abcdefgh1234/att_other.jpg`, 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(false);
    });

    it('REJECTS a path whose extension does not match the claimed contentType', async () => {
      const { isOwnAttachmentPath, ATTACHMENT_BUCKET } = await import('./attachment-storage');
      expect(isOwnAttachmentPath(`supabase://${ATTACHMENT_BUCKET}/abcdefgh1234/att_real1.png`, 'abcdefgh1234', 'att_real1', 'image/jpeg')).toBe(false);
    });
  });

  describe('cross-bucket deletion/download is actually blocked at the storage layer too (defence in depth, not just the path-reconstruction check above)', () => {
    it('deleteAttachment never calls Supabase at all for a path naming a bucket other than ATTACHMENT_BUCKET', async () => {
      const removeMock = vi.fn().mockResolvedValue({ error: null });
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: () => ({ storage: { from: () => ({ remove: removeMock }) } }),
      }));
      vi.stubEnv('NODE_ENV', 'production');
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      const { deleteAttachment } = await import('./attachment-storage');

      const result = await deleteAttachment('supabase://some-other-real-bucket/secret-object.jpg');

      expect(result).toBe(false);
      expect(removeMock).not.toHaveBeenCalled();
      vi.doUnmock('@supabase/supabase-js');
    });

    it('downloadAttachment never calls Supabase at all for a path naming a bucket other than ATTACHMENT_BUCKET', async () => {
      const downloadMock = vi.fn().mockResolvedValue({ data: new Blob(['secret']), error: null });
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: () => ({ storage: { from: () => ({ download: downloadMock }) } }),
      }));
      vi.stubEnv('NODE_ENV', 'production');
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      const { downloadAttachment } = await import('./attachment-storage');

      const result = await downloadAttachment('supabase://pdfs/some-customers-invoice.pdf');

      expect(result).toBeNull();
      expect(downloadMock).not.toHaveBeenCalled();
      vi.doUnmock('@supabase/supabase-js');
    });
  });

  describe('resolveLocalPath (dev fallback) rejects path traversal', () => {
    it('a forged file:// path that tries to escape .assistant-attachments/ cannot be downloaded, signed, or deleted', async () => {
      clearSupabaseEnv();
      vi.stubEnv('NODE_ENV', 'test');
      const { downloadAttachment, signAttachmentUrl, deleteAttachment } = await import('./attachment-storage');
      const traversal = 'file://.assistant-attachments/../../../../etc/passwd';
      expect(await downloadAttachment(traversal)).toBeNull();
      expect(await signAttachmentUrl(traversal)).toBeNull();
      // deleteAttachment is force:true/idempotent by design, but it must
      // never even ATTEMPT a path outside the root — assert it refuses
      // rather than silently no-op'ing on an out-of-root path.
      expect(await deleteAttachment(traversal)).toBe(false);
    });

    it('a path missing the exact .assistant-attachments/ prefix is rejected outright, not silently resolved to the root directory', async () => {
      clearSupabaseEnv();
      vi.stubEnv('NODE_ENV', 'test');
      const { downloadAttachment } = await import('./attachment-storage');
      expect(await downloadAttachment('file://../../../etc/passwd')).toBeNull();
    });
  });
});
