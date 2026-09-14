/**
 * The photographed grain, on the server.
 *
 * Same tiles as the website, cut by the same script from the same photographs —
 * written a second time as PNG because this service decodes PNG and nothing
 * else. It has zero dependencies by design, node:zlib gives us PNG, and there
 * is no webp decoder in the standard library. The copies are a quarter of the
 * linear resolution, which is not a compromise: 256 texels across three inches
 * is 85 texels to the inch, and the largest plate this API will render still
 * minifies that.
 *
 * WHAT IS NOT DUPLICATED IS THE SIZE IN INCHES. That number decides the grain
 * scale, and two copies of it would be two chances for the website's floor and
 * the API's floor to be different floors. GRAIN_TILES is imported, and the
 * declared inches are scaled by the ratio of actual to declared pixels — so a
 * PNG at any resolution describes the same piece of wood.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png';
import { makeGrainTexture, type GrainTexture } from '@/lib/floor-studio/render';
import { GRAIN_TILES } from '@/lib/floor-studio/grain';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEXTURES = path.join(HERE, '..', 'textures');

/* Decoded once, held for the life of the process. This is the reason the
   service is a warm machine and not a function: six tiles and their pyramids
   are about twelve megabytes and forty milliseconds each, paid once at boot
   rather than on every request. */
const cache = new Map<string, GrainTexture | null>();

export function grainFor(productId: string): GrainTexture | null {
  const hit = cache.get(productId);
  if (hit !== undefined) return hit;

  const tile = GRAIN_TILES.find((t) => t.product === productId);
  if (!tile) {
    cache.set(productId, null);
    return null;
  }
  try {
    const raw = decodePng(readFileSync(path.join(TEXTURES, `grain-${productId}.png`)));
    /* THE INCHES DO NOT SCALE WITH THE PIXELS.
     *
     * A resized copy of a photograph is the same piece of wood at fewer
     * samples. Six inches of hickory is six inches of hickory at 512 texels or
     * at 256. The first version of this line scaled the declared inches by the
     * ratio of actual pixels to declared pixels — which is right for a CROP and
     * wrong for a RESIZE — and every floor this API rendered came out at
     * double the grain scale, silently, looking like a plausible floor. It was
     * caught by printing the number rather than by looking at the picture,
     * which is the only way it was going to be caught. */
    const tex = makeGrainTexture(
      new Uint8ClampedArray(raw.data),
      raw.width,
      raw.height,
      tile.inchesAcross,
      tile.inchesAlong,
    );
    cache.set(productId, tex);
    return tex;
  } catch {
    /* A missing or unreadable tile is not an outage. The renderer draws a
       perfectly good floor from the catalogue's two pigments with no photograph
       at all, and a customer's page showing a plainer floor beats one showing a
       500. The failure is visible in /health, which counts what decoded. */
    cache.set(productId, null);
    return null;
  }
}

/** Decode every tile now, so the first paying request does not pay for it. */
export function warmGrain(): { loaded: number; missing: string[] } {
  const missing: string[] = [];
  let loaded = 0;
  for (const tile of GRAIN_TILES) {
    if (grainFor(tile.product)) loaded += 1;
    else missing.push(tile.product);
  }
  return { loaded, missing };
}
