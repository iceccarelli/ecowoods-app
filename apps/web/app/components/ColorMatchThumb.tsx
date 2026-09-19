import Image from 'next/image';
import { colorMatchingImage, COLOR_MATCHING_META } from '@/app/data/color-matching-images';

/**
 * The /guides index thumbnail for a colour-matching guide — the sibling of
 * IllustrationThumb (see that file's own note), sourcing from the 2026
 * colour-matching pack instead of apps/web/lib/images.ts. Kept separate for
 * the same reason ColorMatchFigure is a sibling of <Illustration>: a
 * different manifest, a different register (photoreal, not flat-vector),
 * and no shared coupling to lib/images.ts's 162-slot guard.
 *
 * Decorative by construction, same as IllustrationThumb: alt is empty, the
 * card link already carries the words, and a fixed 4:3 box keeps every card
 * in the grid the same height regardless of the source frame's own ratio
 * (these MANIFEST frames are shot at several different aspect ratios).
 */
export function ColorMatchThumb({ id, className = '' }: { id?: string; className?: string }) {
  if (!id) return null;
  const asset = colorMatchingImage(id);
  const meta = COLOR_MATCHING_META[id];
  if (!asset || !meta) return null;

  return (
    <div className={`ill-thumb ${className}`.trim()} aria-hidden="true">
      <Image src={asset} alt="" sizes="(max-width: 767px) 100vw, 320px" className="ill-thumb-img" loading="lazy" />
    </div>
  );
}
