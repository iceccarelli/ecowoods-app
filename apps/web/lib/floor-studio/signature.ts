/**
 * lib/floor-studio/signature.ts — ecowoods.ca, in the pixels.
 *
 * WHY THIS IS NOT CSS
 *
 * The single most shared artefact this feature will ever produce is a
 * screenshot. Somebody points their phone at their living room, watches walnut
 * herringbone appear in it, and sends the picture to their partner, their group
 * chat, their contractor. A screenshot carries no DOM — so a mark that lives in
 * HTML around the canvas is a mark that is not in the thing that travels.
 *
 * The same is true of the downloaded PNG, of a screen recording, and of the
 * photograph somebody takes OF the screen with a second phone. Drawn into the
 * pixels it survives all four.
 *
 * WHY IT IS A SIGNATURE AND NOT A WATERMARK
 *
 * A watermark is defensive: it is there to stop you using the image. This is
 * the opposite — the image is meant to travel, and every copy of it should say
 * where it came from. So it sits in one corner, at a size that reads on a phone
 * and does not fight the floor, over a gradient that keeps it legible whether
 * the corner underneath is a dark walnut or a blown highlight.
 *
 * WHAT IT SAYS, AND WHY EACH PART IS THERE
 *
 *   the mark          this is a company, not a filter
 *   the floor's name  the thing in the picture, by its catalogue name
 *   the range         what it costs, labelled an estimate, never a quote
 *   ecowoods.ca       where to get it
 *
 * The host comes from SITE_URL and the range from the estimate that produced
 * the picture, so a signature can never name a domain nobody owns or a price
 * nobody published.
 */
import { SITE_URL } from '@/lib/seo-data';

export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

export type Signature = {
  /** The configuration, in the catalogue's own words. */
  floor: string;
  /** The estimated installed range, already formatted with its currency. */
  price?: string;
  /** The Ecowoods mark, loaded. Omitted before it decodes; the text still draws. */
  mark?: HTMLImageElement | null;
};

/**
 * Draw the signature into the bottom-left of a canvas context.
 *
 * Sizes are proportional to the canvas width so the same call is right on a
 * 320-pixel live preview and on a 1400-pixel downloaded still.
 */
export function drawSignature(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sig: Signature,
): void {
  const pad = Math.round(width * 0.028);
  const size = Math.max(18, Math.round(width * 0.062));
  const fontL = Math.max(11, Math.round(width * 0.028));
  const fontS = Math.max(9, Math.round(width * 0.021));

  ctx.save();

  /* A readable plate. A camera frame can be any colour, and white type on a
     white wall is not a design. */
  const plate = (size + pad) * 1.6;
  const grad = ctx.createLinearGradient(0, height - plate, 0, height);
  grad.addColorStop(0, 'rgba(24, 18, 12, 0)');
  grad.addColorStop(1, 'rgba(24, 18, 12, 0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, height - plate, width, plate);

  if (sig.mark?.complete && sig.mark.naturalWidth > 0) {
    ctx.drawImage(sig.mark, pad, height - pad - size, size, size);
  }

  const textLeft = pad + size + pad * 0.6;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 252, 245, 0.96)';
  ctx.font = `600 ${fontL}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(sig.floor, textLeft, height - pad - size * 0.52);

  ctx.font = `400 ${fontS}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255, 252, 245, 0.82)';
  ctx.fillText(
    sig.price ? `${sig.price} · estimated installed, not a quote` : 'Estimated installed range, not a quote',
    textLeft,
    height - pad - size * 0.08,
  );

  /* The host, right-aligned — the signature proper. */
  ctx.textAlign = 'right';
  ctx.font = `600 ${fontS}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255, 252, 245, 0.74)';
  ctx.fillText(SITE_HOST, width - pad, height - pad - size * 0.3);

  ctx.restore();
}

/**
 * The mark, loaded once per page and shared by every surface that signs.
 *
 * Returns null on the server and while it is still decoding, which every caller
 * treats as "draw the text and not the mark" rather than as an error: a
 * signature missing its glyph is a small loss, a picture that failed to render
 * because a logo was slow is a large one.
 */
let markPromise: Promise<HTMLImageElement | null> | null = null;

export function loadMark(src: string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (markPromise) return markPromise;
  markPromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  return markPromise;
}
