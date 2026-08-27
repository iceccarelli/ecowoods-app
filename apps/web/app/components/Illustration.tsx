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

/**
 * Motion, and the one rule that governs it.
 *
 * `reveal` — a short fade and rise as the figure scrolls into view. Nothing
 * moves inside the frame, so nothing is hidden. This is the default.
 *
 * `kenburns` — a very slow scale and drift. It necessarily crops, because that
 * is what a scale inside a fixed frame does. So it is allowed ONLY on scene
 * imagery whose subject is the whole scene: the two page heroes and the six
 * service photographs. Putting it on an explanatory figure would slowly hide
 * the thing the figure exists to show, and a diagram that moves is a diagram
 * you cannot read. That is not a taste call — a cropped axis label or a
 * cropped fifth species is simply wrong.
 *
 * Both are pure CSS. `reveal` uses a scroll-driven animation-timeline behind
 * @supports, so browsers without it render the figure normally rather than
 * blank — the failure mode of a JavaScript reveal that never fires. Neither
 * needs a client component, and globals.css already zeroes every animation
 * under prefers-reduced-motion.
 */
export type IllustrationMotion = 'reveal' | 'kenburns' | 'none';

export function Illustration({
  id,
  sizes = '(max-width: 767px) 100vw, (max-width: 1200px) 90vw, 1000px',
  priority = false,
  className = '',
  motion = 'reveal',
}: {
  id: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  motion?: IllustrationMotion;
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
  const motionClass = motion === 'none' ? '' : `ill--${motion}`;

  return (
    <figure className={`ill ${motionClass} ${className}`.trim().replace(/\s+/g, ' ')}>
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

/* The paired variant lives in its own file because it is a client component
   and this one is not. It is re-exported here so a page importing figures
   imports one module — and so scripts/verify-images.mjs, which recognises a
   drawing page by this exact import path, sees pages that use only pairs. */
export { IllustrationPair } from './IllustrationPair';
