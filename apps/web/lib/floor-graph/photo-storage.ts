/**
 * lib/floor-graph/photo-storage.ts — where a retained assessment photograph goes.
 *
 * THIS FILE REFUSES TO USE VERCEL BLOB, AND THAT IS THE POINT.
 *
 * lib/pdf/storage.ts writes quotes and invoices to Vercel Blob with
 * `access: 'public'`, which is the only access Blob offers. For a PDF the
 * customer is about to be emailed a link to, an unguessable public URL is a
 * defensible trade. For a photograph of the inside of somebody's house it is
 * not: PIPEDA case summary #2006-349 treats interior photographs as personal
 * information about the person who lives there, and "public but hard to guess"
 * is not a safeguard, it is a hope.
 *
 * So the ladder here is deliberately shorter and deliberately fails closed:
 *
 *   1. Supabase Storage, PRIVATE bucket → the stored path is returned. Reading
 *      one back requires a signed URL minted by a caller holding the service
 *      role key, which is the admin and nobody else.
 *   2. Local filesystem, OUTSIDE public/ → development only.
 *   3. Nothing configured → `{ ok: false }`. The caller keeps its existing
 *      behaviour (the photographs still reach the estimating desk by email)
 *      and simply does not retain them.
 *
 * A misconfigured environment therefore loses a data point. It never quietly
 * publishes a customer's living room.
 */
import path from 'node:path';
import fs from 'node:fs';

export const PHOTO_BUCKET = 'floor-graph';

export type StoredPhoto = { ok: true; url: string } | { ok: false; reason: string };

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function extensionFor(contentType: string): string {
  return EXT[contentType] ?? 'bin';
}

/**
 * Store one photograph. `key` is caller-chosen and must already be
 * unguessable — the assessment id plus an ordinal is what the triage route
 * uses.
 */
export async function storePhoto(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<StoredPhoto> {
  const filename = `${key}.${extensionFor(contentType)}`;

  // ── 1. Supabase Storage, private bucket ──────────────────────────────────
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(filename, buffer, { contentType, upsert: false });
      if (error) return { ok: false, reason: `supabase: ${error.message}` };
      /* The PATH, not a public URL. There is no public URL for this bucket,
         and storing one would defeat the reason the bucket is private. */
      return { ok: true, url: `supabase://${PHOTO_BUCKET}/${filename}` };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'supabase upload failed' };
    }
  }

  // ── 2. Local development, outside public/ ────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dir = path.join(process.cwd(), '.floor-graph', 'photos');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
      return { ok: true, url: `file://.floor-graph/photos/${filename}` };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'local write failed' };
    }
  }

  // ── 3. Nothing configured. Fail closed. ──────────────────────────────────
  return {
    ok: false,
    reason:
      'no private photo store configured (SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL). ' +
      'Photographs were emailed to the estimating desk and not retained.',
  };
}
