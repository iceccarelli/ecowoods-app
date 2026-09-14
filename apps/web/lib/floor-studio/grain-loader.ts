/**
 * Getting a photographed tile into the renderer, in a browser.
 *
 * The renderer needs pixels and a size in inches. The browser will decode a
 * webp for us and a canvas will hand back its bytes, so the whole job is: fetch
 * once, decode once, build the pyramid once, and never do any of it again for
 * the life of the page.
 *
 * ONCE IS THE WHOLE POINT. Building the pyramid for a 512×1538 tile is about
 * forty milliseconds and eleven levels of allocation. A configurator is a thing
 * people click repeatedly — six species, five finishes, four patterns, four
 * widths — and doing that work on every click would be forty milliseconds of
 * jank for an answer that has not changed since the first time. The cache is
 * keyed by product and holds the promise, not the result, so two components
 * asking at the same moment share one fetch.
 */
import { makeGrainTexture, type GrainTexture } from './render';
import { grainTileFor, grainTileHref } from './grain';

const cache = new Map<string, Promise<GrainTexture | null>>();

/**
 * The tile for this product, or null.
 *
 * Null is a real answer and not an error: the renderer draws a perfectly good
 * floor from the catalogue's two pigments without any photograph at all, and
 * that is what a person on a slow connection, a locked-down network, or a
 * browser we have not met should get. A preview that fails to appear is worse
 * than a preview without a photograph in it.
 */
export function loadGrainTexture(productId: string): Promise<GrainTexture | null> {
  const cached = cache.get(productId);
  if (cached) return cached;

  const started = decode(productId).catch(() => null);
  cache.set(productId, started);
  return started;
}

/** Whether the tile is already decoded, so a caller can skip the async path. */
export function peekGrainTexture(productId: string): Promise<GrainTexture | null> | undefined {
  return cache.get(productId);
}

async function decode(productId: string): Promise<GrainTexture | null> {
  const tile = grainTileFor(productId);
  if (!tile || typeof document === 'undefined') return null;

  const image = await loadImage(grainTileHref(tile));
  if (!image) return null;

  const w = image.width;
  const h = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  /* willReadFrequently is the opposite of what we want — this is read exactly
     once — and asking for it puts some browsers on a software backing store
     that decodes more slowly. */
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);

  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, w, h);
  } catch {
    /* A tainted canvas. Our own origin serves these, so this should not happen,
       and if it does the answer is still a floor without a photograph. */
    return null;
  }

  /* The tile's declared size in inches is what the renderer samples by; its
     declared pixel size is checked against what actually decoded, because a
     mismatch means the table and the asset have drifted and the grain would be
     rendered at the wrong scale silently. */
  const across = w === tile.width ? tile.inchesAcross : (tile.inchesAcross * w) / tile.width;
  const along = h === tile.height ? tile.inchesAlong : (tile.inchesAlong * h) / tile.height;
  return makeGrainTexture(new Uint8ClampedArray(pixels.data), w, h, across, along);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
