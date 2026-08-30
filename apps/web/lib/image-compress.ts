/**
 * lib/image-compress.ts — client-side photo compression for the triage track.
 *
 * WHY: three phone photos are routinely 4–12 MB each, and Vercel caps a
 * serverless request body at ~4.5 MB total. Compressing in the browser is the
 * difference between "send 3 photos" working from a phone and it failing for
 * exactly the visitors it exists for.
 *
 * TARGET ≤ 1.5 MB per image (spec), which also keeps 3 images + fields under
 * the platform body cap with headroom. Strategy: decode → downscale to a
 * longest edge of 1600 px → re-encode JPEG, stepping quality down until under
 * target.
 *
 * HEIC: browsers can *select* .heic files but almost none can decode them on a
 * canvas. If decoding fails we pass the original through when it is already
 * under target, and reject with a human message otherwise — never a silent
 * drop.
 */

export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE_PX = 1600;
const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45, 0.32];

export type CompressResult =
  | { ok: true; file: File }
  | { ok: false; reason: string };

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback decode path via object URL (covers some older Safari cases).
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
      URL.revokeObjectURL(url);
      return loaded ? img : null;
    } catch {
      return null;
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function compressPhoto(file: File): Promise<CompressResult> {
  const source = await decode(file);

  if (!source) {
    // Undecodable in this browser (typically HEIC). Pass through if small enough.
    if (file.size <= MAX_PHOTO_BYTES) return { ok: true, file };
    return {
      ok: false,
      reason: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB and this browser cannot shrink that format. Please use a JPEG/PNG, or a smaller photo.`,
    };
  }

  const w = 'width' in source ? source.width : 0;
  const h = 'height' in source ? source.height : 0;
  if (!w || !h) return file.size <= MAX_PHOTO_BYTES ? { ok: true, file } : { ok: false, reason: `Could not read ${file.name}.` };

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return file.size <= MAX_PHOTO_BYTES ? { ok: true, file } : { ok: false, reason: `Could not process ${file.name}.` };
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  for (const q of QUALITY_STEPS) {
    const blob = await toBlob(canvas, q);
    if (blob && blob.size <= MAX_PHOTO_BYTES) {
      const name = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
      return { ok: true, file: new File([blob], name, { type: 'image/jpeg' }) };
    }
  }
  return {
    ok: false,
    reason: `${file.name} could not be compressed enough. Please try a photo taken a little further back.`,
  };
}
