import Image from 'next/image';
import { getImage, IMAGE_DIR } from '@/lib/images';
import { illustrationImage } from '../data/illustration-images';

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

  /* The bytes come from a static import, not from a public/ URL. This
     deployment does not serve apps/web/public — /icon-192.png has 404'd there
     since long before this work, while /qr-app.jpg in the REPO-ROOT public/
     returns 200. Every diagram written to apps/web/public/illustrations was
     therefore a broken-image icon on the live site while every guard passed,
     because the file was genuinely on disk and genuinely committed.
     data/floor-images.ts has carried this same workaround, and said so in its
     first line, since long before I arrived. See F-131. */
  const asset = illustrationImage(id);

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

  /* The full-size link is a plain anchor to the file, not a lightbox.
     There are already two lightboxes on this site (FloorCatalog, MachineCatalog)
     and a third would be a third way to do one thing — the same mistake the
     design system rule exists to prevent. An anchor also works with no
     JavaScript, works from a keyboard for free, survives the print stylesheet,
     and is what technical documentation actually does. */
  return (
    <figure className={`ill ${className}`.trim()}>
      <div className="ill-frame" style={{ aspectRatio: ratio }}>
        {asset ? (
          <Image
            src={asset}
            alt={img.alt}
            sizes={sizes}
            priority={priority}
            className="ill-img"
          />
        ) : null}
      </div>
      <figcaption className="ill-caption">
        {img.caption}
        <a
          className="ill-full"
          href={asset?.src ?? `${IMAGE_DIR}/${img.file}`}
          target="_blank"
          rel="noopener"
        >
          View full size <span aria-hidden="true">↗</span>
          <span className="sr-only"> — {img.alt}</span>
        </a>
      </figcaption>
    </figure>
  );
}
