/**
 * PDF Storage helper.
 *
 * Priority:
 *   1. BLOB_READ_WRITE_TOKEN set → Vercel Blob (production / Vercel deploys)
 *   2. SUPABASE_SERVICE_ROLE_KEY set → Supabase Storage
 *   3. Fallback → local public/pdfs/ directory (dev only, served as static files)
 */

import { put } from '@vercel/blob';
import path from 'path';
import fs from 'fs';

export async function storePdf(buffer: Buffer, filename: string): Promise<string> {
  // ── 1. Vercel Blob ────────────────────────────────────────────────────────
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(`pdfs/${filename}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });
    return url;
  }

  // ── 2. Supabase Storage ───────────────────────────────────────────────────
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { error } = await supabase.storage
      .from('pdfs')
      .upload(filename, buffer, { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    const { data } = supabase.storage.from('pdfs').getPublicUrl(filename);
    return data.publicUrl;
  }

  // ── 3. Local dev fallback — save to public/pdfs/ ─────────────────────────
  const pdfDir = path.join(process.cwd(), 'public', 'pdfs');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  fs.writeFileSync(path.join(pdfDir, filename), buffer);
  return `/pdfs/${filename}`;
}
