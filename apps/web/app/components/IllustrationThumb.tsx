import Image from 'next/image';
import { getImage } from '@/lib/images';
import { illustrationImage } from '../data/illustration-images';

/**
 * The index-page thumbnail.
 *
 * WHY THIS EXISTS
 *
 * Fourteen public pages rendered no image at all, and four of them —
 * /papers, /guides, /blog, /case-studies — are indexes that list items which
 * each already HAVE an image. The artwork was paid for and shipped; the index
 * simply never showed it. A list of thirteen titles is harder to scan than a
 * list of thirteen titles with the picture beside each one, and it costs
 * nothing new to fix.
 *
 * It is deliberately not <Illustration>. That component is a <figure> with a
 * caption and a full-size link — the right thing when the image IS the content.
 * Here the image is a wayfinding aid next to a link that already carries the
 * words, so it is decorative by construction: alt is empty and the whole card
 * is the accessible target. Giving it the figure alt would make a screen reader
 * read the diagram description immediately before the title that describes the
 * same thing, twice per row.
 *
 * Layout is reserved from the manifest's own dimensions, so no thumbnail can
 * shift a list as it loads.
 */
export function IllustrationThumb({ id, className = '' }: { id?: string; className?: string }) {
  if (!id) return null;
  const img = getImage(id);
  const asset = illustrationImage(id);
  if (!img || !asset) return null;

  /*
   * ONE RATIO FOR THE WHOLE GRID, AND WHY IT IS NOT THE IMAGE'S OWN.
   *
   * The first version of this took its aspect ratio from the manifest, which is
   * exactly right for <Illustration> and exactly wrong here. Measured across the
   * eleven guides, the ratios run from 1.01 (guide-ref-condo, a square condo
   * floorplate) to 4.84 (guide-method, a wide assembly strip) — a 4.8x spread.
   * A grid of cards carrying those would have thumbnails of wildly different
   * heights sitting next to each other, which is not a grid, it is a pile.
   *
   * So the box is fixed and the image is `contain`ed inside it. Not `cover`:
   * cover crops, and cropping a decision tree or a cost chart removes the part
   * that carries the meaning. A letterboxed wide strip is honest; a cropped one
   * is wrong. The empty field is the surface colour and reads as deliberate.
   */
  return (
    <div className={`ill-thumb ${className}`.trim()} aria-hidden="true">
      <Image
        src={asset}
        alt=""
        sizes="(max-width: 767px) 100vw, 320px"
        className="ill-thumb-img"
        loading="lazy"
      />
    </div>
  );
}
