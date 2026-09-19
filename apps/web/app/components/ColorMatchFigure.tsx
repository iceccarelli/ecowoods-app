import Image from 'next/image';
import { colorMatchingImage, COLOR_MATCHING_META } from '@/app/data/color-matching-images';

/**
 * ColorMatchFigure — one photoreal frame from the colour-matching illustration
 * pack, with its MANIFEST-sourced alt text and caption.
 *
 * WHY THIS IS NOT <Illustration>
 *
 * <Illustration> reads apps/web/lib/images.ts — a manifest built for the
 * 162-slot flat-vector/detailed-diagram corpus, with its own href-must-resolve
 * guard, DIMS table and rotator-pool checks tied to data/rotator-slides.ts.
 * These 47 frames are a different register entirely (photoreal, generated
 * editorial scenes, sourced from scripts/fixtures/color-matching-manifest.csv
 * rather than lib/images.ts) and wiring them into that pipeline would mean
 * either bending its guards around a shape they were not written for, or
 * risking the 162 slots it already protects. A second, equally small manifest
 * reader is the honest fix — see the note at the top of data/color-matching-images.ts.
 *
 * kind is always 'illustration', never 'photograph' — see the honesty-kernel
 * rule at the top of lib/images.ts. These are generated photoreal editorial
 * frames, not a camera pointed at a real Ecowoods job.
 */
export function ColorMatchFigure({
  id,
  priority = false,
  sizes = '(max-width: 767px) 100vw, (max-width: 1200px) 90vw, 1000px',
  className = '',
  caption = true,
}: {
  id: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Render the caption below the figure. `false` when the caller shows its own. */
  caption?: boolean;
}) {
  const asset = colorMatchingImage(id);
  const meta = COLOR_MATCHING_META[id];
  if (!asset || !meta) return null;

  return (
    <figure className={`ill ill--reveal ${className}`.trim().replace(/\s+/g, ' ')}>
      <div className="ill-frame" style={{ aspectRatio: `${meta.width} / ${meta.height}` }}>
        <Image src={asset} alt={meta.alt} sizes={sizes} priority={priority} className="ill-img" />
      </div>
      {caption && <figcaption className="ill-caption">{meta.caption}</figcaption>}
    </figure>
  );
}
