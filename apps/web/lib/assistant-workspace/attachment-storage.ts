/**
 * lib/assistant-workspace/attachment-storage.ts — where a photo attached in
 * Ask Francisco goes.
 *
 * Deliberately its own bucket, not lib/floor-graph/photo-storage.ts's
 * `floor-graph` bucket: that bucket's photos are retained under the
 * ASSESSMENT_PHOTOS purpose (kept past the triage callback, compared against
 * the in-home measure). A photo attached here is retained under the
 * ASSISTANT_PHOTOS purpose (kept with this conversation only, analyzed once).
 * Different purpose, different consent wording, different bucket — mixing
 * them would make one bucket's retention policy a lie for half its contents.
 *
 * Same discipline as photo-storage.ts otherwise: PRIVATE Supabase storage
 * only, never Vercel Blob (public-only) and never a public bucket. Reading a
 * stored photo back always requires a signed URL minted server-side with the
 * service-role key — see `signAttachmentUrl` — or a direct server-side
 * `downloadAttachment` for the one case that needs the bytes themselves (the
 * chat route, sending them to the model).
 */
import path from 'node:path';
import fs from 'node:fs';

export const ATTACHMENT_BUCKET = 'assistant-attachments';

export type StoreResult = { ok: true; path: string } | { ok: false; reason: string };

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

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function supabaseAdmin() {
  const creds = supabaseCreds();
  if (!creds) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(creds.url, creds.key);
}

/**
 * Store one photo under `key` (caller-chosen, must already be unguessable —
 * the upload route uses the design id plus a random id). Same three-rung
 * ladder as photo-storage.ts: private Supabase bucket, then a local dev
 * fallback outside `public/`, then fail closed.
 */
export async function storeAttachment(buffer: Buffer, key: string, contentType: string): Promise<StoreResult> {
  const filename = `${key}.${extensionFor(contentType)}`;

  const supabase = await supabaseAdmin();
  if (supabase) {
    try {
      let { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(filename, buffer, { contentType, upsert: false });
      if (error && /not.?found/i.test(error.message)) {
        // The bucket doesn't exist yet in this project — create it (private) and retry once.
        const created = await supabase.storage.createBucket(ATTACHMENT_BUCKET, { public: false });
        if (!created.error) {
          ({ error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(filename, buffer, { contentType, upsert: false }));
        }
      }
      if (error) return { ok: false, reason: `supabase: ${error.message}` };
      return { ok: true, path: `supabase://${ATTACHMENT_BUCKET}/${filename}` };
    } catch (err) {
      // A network failure or a malformed project URL throws rather than
      // resolving with `{error}` — this must degrade exactly like a returned
      // error, never crash the upload route (see photo-storage.ts, same
      // discipline).
      return { ok: false, reason: err instanceof Error ? err.message : 'supabase upload failed' };
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      // `filename` can contain a subdirectory (the upload route namespaces by
      // designId, e.g. "DESIGN123/att_1.jpg") — create that subdirectory too,
      // not just the top-level store.
      const filePath = path.join(process.cwd(), '.assistant-attachments', filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);
      return { ok: true, path: `file://.assistant-attachments/${filename}` };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'local write failed' };
    }
  }

  return {
    ok: false,
    reason:
      'no private attachment store configured (SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL).',
  };
}

function parseSupabasePath(p: string): { bucket: string; key: string } | null {
  const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(p);
  return match ? { bucket: match[1]!, key: match[2]! } : null;
}

/**
 * A short-lived URL a browser can actually load — the bucket is private, so
 * there is no other way to show a thumbnail. Used both right after upload
 * (immediate preview) and when a stored transcript is reloaded (the original
 * signed URL has long since expired by then — see conversation-store.ts).
 */
export async function signAttachmentUrl(storedPath: string, expiresInSeconds = 600): Promise<string | null> {
  const supa = parseSupabasePath(storedPath);
  if (supa) {
    const supabase = await supabaseAdmin();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.storage.from(supa.bucket).createSignedUrl(supa.key, expiresInSeconds);
      return error || !data ? null : data.signedUrl;
    } catch {
      return null;
    }
  }
  if (storedPath.startsWith('file://')) {
    // Local dev only: no HTTP server for this directory, so hand back a data
    // URL directly rather than standing up a dev-only static route.
    try {
      const rel = storedPath.slice('file://'.length);
      const buffer = fs.readFileSync(path.join(process.cwd(), rel));
      const ext = path.extname(rel).slice(1);
      const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }
  return null;
}

/** The bytes themselves — for the one caller that needs them: the chat route, sending the photo to the model. */
export async function downloadAttachment(storedPath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const supa = parseSupabasePath(storedPath);
  if (supa) {
    const supabase = await supabaseAdmin();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.storage.from(supa.bucket).download(supa.key);
      if (error || !data) return null;
      const ext = path.extname(supa.key).slice(1);
      const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
      return { buffer: Buffer.from(await data.arrayBuffer()), contentType };
    } catch {
      return null;
    }
  }
  if (storedPath.startsWith('file://')) {
    try {
      const rel = storedPath.slice('file://'.length);
      const buffer = fs.readFileSync(path.join(process.cwd(), rel));
      const ext = path.extname(rel).slice(1);
      const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
  return null;
}
