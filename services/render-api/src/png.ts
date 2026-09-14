/**
 * services/render-api/src/png.ts — PNG in and PNG out, with no dependencies.
 *
 * WHY THIS EXISTS RATHER THAN `sharp`
 *
 * This repository installs with `pnpm install --frozen-lockfile`. A new
 * dependency anywhere in the workspace makes pnpm-lock.yaml stale and that
 * command fails — which is how a patch that adds one package breaks every
 * install in CI and in the Codespace. So this service has NO package.json
 * dependencies at all, and the one thing it genuinely needs from a library —
 * turning pixels into an image and back — is written here against `node:zlib`,
 * which is built in.
 *
 * WHAT IS AND IS NOT SUPPORTED, STATED RATHER THAN DISCOVERED
 *
 * Decode: 8-bit PNG, colour types 2 (RGB) and 6 (RGBA), non-interlaced, with
 * all five scanline filters. That is what `canvas.toBlob('image/png')` produces
 * in every browser, which is how a caller will be making these.
 *
 * NOT supported: 16-bit, palette, greyscale, and Adam7 interlacing — each
 * throws by name rather than returning something subtly wrong. JPEG is not
 * supported at all and cannot be without a dependency; a caller with a camera
 * photo converts it in one line on a canvas before sending, and the README
 * says so.
 */
import { deflateSync, inflateSync } from 'node:zlib';

export type Raw = { data: Uint8ClampedArray; width: number; height: number };

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ── CRC32, table-driven. The PNG spec's own polynomial. ─────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([len, typed, crc]);
}

/**
 * Encode RGBA to PNG.
 *
 * Filter 0 (None) on every scanline. The adaptive filter heuristic buys a few
 * percent on photographic data and costs a pass over every byte; the wire is
 * not where this service spends its time, the renderer is.
 */
export function encodePng({ data, width, height }: Raw): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(buf: Buffer): Raw {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colour = body[9]!;
      interlace = body[12]!;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }

  if (depth !== 8) throw new Error(`unsupported PNG bit depth ${depth} — 8-bit only`);
  if (colour !== 2 && colour !== 6) throw new Error(`unsupported PNG colour type ${colour} — RGB or RGBA only`);
  if (interlace !== 0) throw new Error('interlaced PNG is not supported');
  if (!width || !height) throw new Error('PNG has no IHDR');

  const channels = colour === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8ClampedArray(width * height * 4);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const base = y * (stride + 1);
    const filter = raw[base]!;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[base + 1 + i]!;
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) v = x + paeth(a, b, c);
      else throw new Error(`unknown PNG filter ${filter}`);
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s]!;
      out[d + 1] = line[s + 1]!;
      out[d + 2] = line[s + 2]!;
      out[d + 3] = channels === 4 ? line[s + 3]! : 255;
    }
    prev.set(line);
  }
  return { data: out, width, height };
}
