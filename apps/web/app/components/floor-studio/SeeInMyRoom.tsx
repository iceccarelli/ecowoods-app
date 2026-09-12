import Link from 'next/link';
import {
  DEFAULT_FINISH,
  DEFAULT_PATTERN,
} from '@ecowoods/shared/ai';
import {
  DEFAULT_WIDTH,
  isLayable,
  productById,
  type FloorConfiguration,
} from '@/lib/floor-studio/catalog';

/**
 * SEE THIS IN MY ROOM — the line that turns a page about a floor into a page
 * that sells one.
 *
 * WHY THIS COMPONENT EXISTS RATHER THAN A LINK
 *
 * A species dossier is a good page and a dead end. Somebody reads two thousand
 * words about white oak, decides they like it, and then has to go and find the
 * thing that shows it to them. Every one of those pages now carries the floor
 * it is about, preloaded, one click away — which is the difference between an
 * article and a product surface.
 *
 * It is a SERVER component and it stays one. A CTA that ships a kilobyte of
 * JavaScript to a reference page so it can fire an event is a bad trade; the
 * `src` parameter tells the studio where the visitor came from, and the studio —
 * which is already a client island — reports it.
 *
 * The configuration is validated before it is linked. A dossier for a species
 * this company does not lay renders NOTHING rather than a link into a floor
 * that does not exist: white ash has a guide and no catalogue entry, and the
 * honest behaviour there is silence.
 */
export function SeeInMyRoom({
  productId,
  patternId = DEFAULT_PATTERN,
  finishId = DEFAULT_FINISH,
  widthId = DEFAULT_WIDTH,
  source,
  label,
}: {
  productId: string;
  patternId?: string;
  finishId?: string;
  widthId?: string;
  /** Where the click came from, for the funnel. Short and route-shaped. */
  source: string;
  /** Overrides the default sentence where the page has a better one. */
  label?: string;
}) {
  const product = productById(productId);
  const config: FloorConfiguration = { productId, finishId, patternId, widthId };
  if (!product || !isLayable(config)) return null;

  const params = new URLSearchParams({
    c: [productId, finishId, patternId, widthId].join('.'),
    a: '900',
    src: source,
  });

  return (
    <aside className="fs-cta" aria-label={`See ${product.name} in your room`}>
      <p className="fs-cta-kicker">Floor Studio</p>
      <p className="fs-cta-line">
        {label ?? `Don’t imagine ${product.name.toLowerCase()} in your house. See it.`}
      </p>
      <Link className="btn btn-copper" href={`/floor-studio?${params.toString()}`}>
        See this in my room <span aria-hidden="true">→</span>
      </Link>
      <p className="fs-cta-fine">
        Upload a photo and this floor goes into it, with a live estimated installed range. The photo
        stays on your device.
      </p>
    </aside>
  );
}
