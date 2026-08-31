import Image from 'next/image';
import { FLOOR_IMAGES } from '../data/floor-images';

/**
 * HeroBackdrop — the LCP element, served from our own build.
 *
 * WHAT THIS REPLACED, AND WHY IT WAS THE WORST PERFORMANCE DEFECT ON THE SITE
 *
 * The hero image used to come from `<RotatingBackground>`, which — on the
 * busiest URL this business owns — did the following before anything appeared:
 *
 *   1. ship the HTML with no image in it at all
 *   2. download and execute the client bundle
 *   3. hydrate
 *   4. fetch /api/backgrounds
 *   5. which called the Unsplash search API server-side
 *   6. then finally request a JPEG from images.unsplash.com
 *
 * Six sequential steps, two of them across the public internet to a third
 * party, before the Largest Contentful Paint could even begin. No amount of
 * `fetchpriority="high"` helps an image whose URL is not known until after
 * hydration — the browser's preload scanner never sees it. And when
 * UNSPLASH_ACCESS_KEY is unset, the whole chain returns an empty array and the
 * hero renders with no image whatsoever.
 *
 * There was a second cost, and it is the one that mattered more. The image was
 * a stock photograph of a floor laid by somebody else, at the top of a page
 * whose entire argument is that everything here is first-party and checkable.
 *
 * NOW: a `StaticImageData` import. Next fingerprints it into _next/static,
 * emits width/height (so the box is reserved and CLS is zero), generates the
 * blur placeholder at build time, and `priority` puts a real <link rel=preload>
 * in the document head. The preload scanner finds it in the first bytes of
 * HTML. Zero JavaScript, zero third parties, zero runtime dependency.
 *
 * The image is one of the 36 already bundled and published in the collection
 * section of this same page, so nothing new is being claimed by showing it —
 * and the hero copy above it makes no assertion about whose floor it is.
 *
 * `RotatingBackground` is untouched and still runs on the craft section further
 * down the page, where a lazy third-party image costs nothing.
 */
export function HeroBackdrop({
  scrim = 'linear-gradient(115deg, rgba(26,15,8,0.62) 0%, rgba(26,15,8,0.35) 45%, rgba(26,15,8,0.68) 100%)',
}: {
  scrim?: string;
}) {
  const img = FLOOR_IMAGES['white-oak-wideplank']?.room;
  if (!img) return null;

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <Image
        src={img}
        alt=""
        priority
        fetchPriority="high"
        placeholder="blur"
        sizes="100vw"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: scrim }} />
    </div>
  );
}
