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

/**
 * Parses a `supabase://bucket/key` path AND rejects any bucket other than
 * this module's own `ATTACHMENT_BUCKET`.
 *
 * SECURITY: `StoredAttachment.url` is persisted from a value the CLIENT
 * sends back on the chat request (see chat-schema.ts's attachmentRefSchema)
 * — it is validated against `isOwnAttachmentPath` before persistence (see
 * chat/route.ts), but this parser is the last line of defence for every
 * caller in this module (download, sign, delete). Without a bucket
 * allowlist here, a forged path naming ANY bucket this Supabase project
 * holds — `pdfs`, `floor-graph`, anything — would be downloaded, signed, or
 * deleted exactly as if it were this feature's own object. Every caller in
 * this file goes through this one function for exactly that reason; do not
 * add a second way to parse a `supabase://` path.
 */
function parseSupabasePath(p: string): { bucket: string; key: string } | null {
  const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(p);
  if (!match) return null;
  if (match[1] !== ATTACHMENT_BUCKET) return null;
  return { bucket: match[1]!, key: match[2]! };
}

/**
 * Resolves a `file://` dev-fallback path to an absolute filesystem path,
 * and rejects anything that would escape `.assistant-attachments/` — a
 * forged `file://../../../etc/passwd`-shaped path must never be read,
 * signed or deleted. Production never takes this branch at all (see
 * storeAttachment); this still matters because `downloadAttachment` /
 * `deleteAttachment` / `signAttachmentUrl` are reachable in dev with
 * whatever path a caller hands them.
 */
function resolveLocalPath(storedPath: string): string | null {
  const PREFIX = 'file://.assistant-attachments/';
  if (!storedPath.startsWith(PREFIX)) return null;
  const root = path.join(process.cwd(), '.assistant-attachments');
  const resolved = path.resolve(root, storedPath.slice(PREFIX.length));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
}

/**
 * The one correct storage path for a given (designId, attachment id,
 * content type) — reconstructed server-side, the same way `storeAttachment`
 * built it at upload time. This is the actual authorization check for a
 * client-echoed attachment reference: the client's `url` must EQUAL one of
 * these, not merely parse as a plausible-looking path. A forged path
 * naming another design's folder, another attachment's id, or a different
 * extension is rejected outright — see this file's header and
 * chat/route.ts's attachment-validation gate for why a client-supplied path
 * is otherwise just a string with no authorization weight at all.
 */
export function expectedAttachmentPaths(designId: string, attachmentId: string, contentType: string): string[] {
  const filename = `${designId}/${attachmentId}.${extensionFor(contentType)}`;
  return [`supabase://${ATTACHMENT_BUCKET}/${filename}`, `file://.assistant-attachments/${filename}`];
}

/** Is `candidatePath` exactly the path this attachment would have been stored at? The only check that makes a client-echoed `url` trustworthy. */
export function isOwnAttachmentPath(candidatePath: string, designId: string, attachmentId: string, contentType: string): boolean {
  return expectedAttachmentPaths(designId, attachmentId, contentType).includes(candidatePath);
}

/**
 * The one `ConsentRecord.surface` value a grant for this specific attachment
 * id is ever stamped with — see the upload route (which grants it) and
 * `lib/floor-graph/consent.ts`'s `isConsentValidForAttachment` (which
 * verifies a client-echoed consentId was actually issued under it). Binding
 * the consent row to the attachment id this way, in the existing free-text
 * `surface` column, is deliberately NOT a new table or schema column — the
 * column's own documented purpose is "where it was granted, e.g.
 * 'estimate-form:photos'," and naming it per-object is a legitimate,
 * minimal use of exactly that field.
 */
export function attachmentConsentSurface(attachmentId: string): string {
  return `assistant-chat:attachments:${attachmentId}`;
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
  const localPath = resolveLocalPath(storedPath);
  if (localPath) {
    // Local dev only: no HTTP server for this directory, so hand back a data
    // URL directly rather than standing up a dev-only static route.
    try {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1);
      const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Remove the stored object. The one real "retention correctness" primitive
 * this module was missing: without it, a homeowner who attached a photo had
 * no way to make it actually go away — the bytes would sit in the bucket
 * forever. Called from the attachment-delete route; idempotent (deleting an
 * already-gone object is success, not an error — matches Supabase/fs
 * semantics for a missing key).
 */
export async function deleteAttachment(storedPath: string): Promise<boolean> {
  const supa = parseSupabasePath(storedPath);
  if (supa) {
    const supabase = await supabaseAdmin();
    if (!supabase) return false;
    try {
      const { error } = await supabase.storage.from(supa.bucket).remove([supa.key]);
      return !error;
    } catch {
      return false;
    }
  }
  const localPath = resolveLocalPath(storedPath);
  if (localPath) {
    try {
      fs.rmSync(localPath, { force: true });
      return true;
    } catch {
      return false;
    }
  }
  return false;
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
  const localPath = resolveLocalPath(storedPath);
  if (localPath) {
    try {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1);
      const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
  return null;
}
