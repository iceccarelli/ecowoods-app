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

  return (
    <div
      className={`ill-thumb ${className}`.trim()}
      style={{ aspectRatio: `${img.width} / ${img.height}` }}
      aria-hidden="true"
    >
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
