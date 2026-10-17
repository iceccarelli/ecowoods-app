/**
 * Decide what a file IS from its first bytes, never from what the client says
 * it is. A multipart `type` is whatever the sender typed; a missing one used to
 * skip the type check entirely.
 */
export type SniffedImage = { contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'; ext: 'jpg' | 'png' | 'webp' | 'heic' };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

export function sniffImage(head: Uint8Array): SniffedImage | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' };
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 4) === 'PNG' && head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a)
    return { contentType: 'image/png', ext: 'png' };
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return { contentType: 'image/webp', ext: 'webp' };
  if (head.length >= 12 && ascii(head, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heif'].includes(ascii(head, 8, 12)))
    return { contentType: 'image/heic', ext: 'heic' };
  return null;
}

export async function sniffFile(file: Blob): Promise<SniffedImage | null> {
  return sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}

/**
 * What an intake route that also takes documents accepts: the images above, or
 * a PDF. Same rule — decided from the bytes. A PDF must start with `%PDF-d.d`
 * AT OFFSET 0 (not "somewhere in the first KB", which would let an HTML or
 * script polyfill pass). This verifies a file-type signature only; it does not
 * make the file safe for every parser.
 */
export type SniffedDocument =
  | SniffedImage
  | { contentType: 'application/pdf'; ext: 'pdf' };

export function sniffDocument(head: Uint8Array): SniffedDocument | null {
  if (head.length >= 8 && ascii(head, 0, 5) === '%PDF-' && /^\d\.\d$/.test(ascii(head, 5, 8))) {
    return { contentType: 'application/pdf', ext: 'pdf' };
  }
  return sniffImage(head);
}

export async function sniffDocumentFile(file: Blob): Promise<SniffedDocument | null> {
  return sniffDocument(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}

/** A filename safe to put in an email attachment header or a log line. */
export function safeFilename(name: string | undefined, ext: string, fallbackStem = 'photo'): string {
  const stem = (name ?? '').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${stem || fallbackStem}.${ext}`;
}
