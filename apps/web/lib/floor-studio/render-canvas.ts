/**
 * lib/floor-studio/render-canvas.ts — the thin browser edge of the renderer.
 *
 * Everything that decides what the floor looks like lives in render.ts, where
 * it is pure and tested. This file does the four things that genuinely need a
 * browser and nothing else: decode a file the visitor picked, hand back its
 * pixels at a sane size, paint pixels onto a canvas, and turn pixels into a
 * PNG the visitor can keep.
 *
 * THE DOWNSCALE IS NOT A PERFORMANCE TWEAK, IT IS THE FEATURE WORKING
 *
 * A modern phone photograph is 4032×3024 — twelve million pixels, and the
 * composite touches each one. At that size the loop takes long enough that the
 * interface stops responding, on the device most of these visitors are using.
 * At 1400px on the long edge it is about one and a half million, the pass runs
 * in a few tens of milliseconds, and nothing about the result is visibly worse
 * at the size a floor is being judged on. `MAX_EDGE` is the whole of the
 * performance story.
 *
 * EXIF ORIENTATION IS HANDLED, BECAUSE A SIDEWAYS ROOM IS A BROKEN PRODUCT
 *
 * `createImageBitmap(..., { imageOrientation: 'from-image' })` applies the
 * orientation tag. Without it, every portrait photo taken on an iPhone arrives
 * rotated, the floor estimator looks for a floor along the wrong edge, and the
 * feature appears to be broken by the most common input it will ever receive.
 */
import type { Pixels } from './room';

export const MAX_EDGE = 1400;

export type DecodedPhoto = {
  pixels: Pixels;
  /** The decoded photograph as a canvas, for painting and for download. */
  width: number;
  height: number;
};

const supportsBitmap = () => typeof createImageBitmap === 'function';

function context2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser did not give us a 2D canvas.');
  return ctx;
}

function fit(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Decode a file the visitor chose into pixels at a workable size.
 *
 * Rejects with a sentence a person can act on, never with a DOMException — the
 * studio's error states show these verbatim.
 */
export async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image. A photo from your phone or camera works best.');
  }

  let source: ImageBitmap | HTMLImageElement;
  if (supportsBitmap()) {
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error('We could not open that image. Try a JPEG or PNG straight from your camera roll.');
    }
  } else {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('We could not open that image. Try a JPEG or PNG straight from your camera roll.'));
      };
      img.src = url;
    });
  }

  const naturalWidth = 'width' in source ? source.width : 0;
  const naturalHeight = 'height' in source ? source.height : 0;
  if (!naturalWidth || !naturalHeight) {
    throw new Error('That image came through with no size. Try another photo.');
  }

  const size = fit(naturalWidth, naturalHeight);
  const ctx = context2d(size.width, size.height);
  ctx.drawImage(source as CanvasImageSource, 0, 0, size.width, size.height);
  if ('close' in source && typeof source.close === 'function') source.close();

  const imageData = ctx.getImageData(0, 0, size.width, size.height);
  return {
    pixels: { data: imageData.data, width: size.width, height: size.height },
    width: size.width,
    height: size.height,
  };
}

/** Paint pixels onto a canvas, sizing it to match. */
export function paintPixels(canvas: HTMLCanvasElement, pixels: Pixels): void {
  if (canvas.width !== pixels.width) canvas.width = pixels.width;
  if (canvas.height !== pixels.height) canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
}

/** A PNG data URL of a render, for download and for the design board. */
export function pixelsToDataUrl(pixels: Pixels): string {
  const ctx = context2d(pixels.width, pixels.height);
  ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  return ctx.canvas.toDataURL('image/png');
}
