import { getImage } from '@/lib/images';
import { illustrationImage } from './illustration-images';
import type { RotatorSlide } from '../components/FigureRotator';

/**
 * The curated rotation pools.
 *
 * Not every one of the 74 belongs in a spotlight. These are the figures that
 * make the argument on their own — a stranger who reads only the caption learns
 * something true and specific about hardwood in this climate. Order is
 * deliberate: it runs moisture → movement → failure → method → cost, which is
 * the shape of the argument the papers make at length.
 *
 * A slot that does not resolve is dropped rather than rendered empty, so a
 * renamed id degrades the rotation instead of breaking the page — and
 * verify-images.mjs fails the build on the rename long before anyone sees it.
 */
const build = (ids: string[]): RotatorSlide[] => {
  const out: RotatorSlide[] = [];
  for (const id of ids) {
    const img = getImage(id);
    const src = illustrationImage(id);
    if (!img || !src || !img.caption) continue;
    out.push({
      id,
      src,
      alt: img.alt,
      caption: img.caption,
      href: img.href,
      width: img.width,
      height: img.height,
    });
  }
  return out;
};

/** Homepage — the broadest case, one figure from each part of the argument. */
export const HOME_ROTATION = build([
  'concept-mc-differential',
  'fig-climate-rh-bands',
  'term-anisotropic',
  'failure-cupping',
  'fig-four-machines-roles',
  'concept-expansion-gap',
  'fig-species-janka',
  'fig-installed-cost-bands',
]);

/** /resources — the corpus, shown rather than listed. */
export const RESOURCES_ROTATION = build([
  'fig-method-substrate-matrix',
  'term-cross-ply-core',
  'fig-grit-progression',
  'fig-failure-cascade',
  'term-wear-layer',
  'guide-herringbone-parquet',
  'fig-protocol-gates',
  'term-hepa-containment',
]);
