import Image from 'next/image';
import { getImage, IMAGE_DIR } from '@/lib/images';

/**
 * Illustration — one image slot, rendered from the manifest.
 *
 * WHY THE PENDING STATE EXISTS
 *
 * The slots ship before the art does. A component that rendered nothing while
 * waiting would let every page reflow the moment the files arrive, and a
 * component that rendered a broken <img> would ship a broken page. This renders
 * a labelled placeholder at the exact final aspect ratio, so the layout that is
 * live today is the layout that will be live after the upload — the only thing
 * that changes is what fills the box.
 *
 * `width` and `height` always come from the manifest and are always passed to
 * next/image. That is what holds cumulative layout shift at zero; a responsive
 * image without intrinsic dimensions is the single most common cause of CLS on
 * a content site.
 *
 * The alt text is not optional and is not decorative filler. It describes the
 * INFORMATION in the diagram, because for a screen reader and for a crawler
 * that alt string is the diagram. Every prompt in the manifest forbids text
 * inside the image for the same reason: a label baked into a picture is
 * invisible to everything except human eyes.
 */

export function Illustration({
  id,
  sizes = '(max-width: 767px) 100vw, (max-width: 1200px) 90vw, 1000px',
  priority = false,
  className = '',
}: {
  id: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const img = getImage(id);
  if (!img) return null;

  const ratio = `${img.width} / ${img.height}`;

  if (img.status === 'pending') {
    return (
      <figure className={`ill ill--pending ${className}`.trim()}>
        <div className="ill-frame" style={{ aspectRatio: ratio }} role="img" aria-label={img.alt}>
          <span className="ill-pending-mark" aria-hidden="true">
            {img.kind === 'diagram' ? 'Diagram' : 'Illustration'}
          </span>
        </div>
        {img.caption && <figcaption className="ill-caption">{img.caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className={`ill ${className}`.trim()}>
      <div className="ill-frame" style={{ aspectRatio: ratio }}>
        <Image
          src={`${IMAGE_DIR}/${img.file}`}
          alt={img.alt}
          width={img.width}
          height={img.height}
          sizes={sizes}
          priority={priority}
          className="ill-img"
        />
      </div>
      {img.caption && <figcaption className="ill-caption">{img.caption}</figcaption>}
    </figure>
  );
}
