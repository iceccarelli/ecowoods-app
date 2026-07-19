'use client';

import Image from 'next/image';
import { BLUR_WARM, IMG_SIZES } from '@/lib/image';

/**
 * SpeciesSwatch — a rendered plank of a given species.
 *
 * Why rendered and not a stock photo:
 *
 * The `base`/`grain` hex pairs below are lifted straight from FloorConfigurator's
 * SPECIES array — Ecowoods' OWN calibration, already used to draw the plank
 * preview in the design tool. Reusing them means the swatch beside "White Oak"
 * here is the same white oak a customer sees in the configurator. Two sources of
 * truth for what your species look like would be a bug.
 *
 * The alternative — pulling Unsplash — has a problem that is not cosmetic: I
 * cannot verify that a photo tagged "oak" is white oak rather than red oak.
 * Those are different species at different prices, and mislabelling one on a
 * page where people choose what to buy is a misrepresentation, not a design
 * choice. A rendered swatch says "this is the tone" and claims nothing it can't
 * back.
 *
 * `photo` is the upgrade path: drop in a URL of YOUR OWN floor and it takes over.
 * That is the right end state — a real Toronto install beats any stock photo,
 * and you have 5,200 of them.
 */

export type SwatchTone = { base: string; grain: string };

/** Straight from FloorConfigurator's SPECIES array — keep in sync. */
export const SPECIES_TONE: Record<string, SwatchTone> = {
  'white-oak': { base: '#c9a882', grain: '#a8865e' },
  'red-oak': { base: '#c69574', grain: '#a06f4d' },
  walnut: { base: '#6b4b34', grain: '#4a3122' },
  maple: { base: '#e0c69f', grain: '#c4a87f' },
  hickory: { base: '#c08e5e', grain: '#8a5c33' },
  /* White Ash has no configurator entry; tone read from its stated character
     ("light, Scandinavian") and kept between maple and white oak. */
  ash: { base: '#dcc7a6', grain: '#b89f7d' },
};

export default function SpeciesSwatch({
  id,
  name,
  photo,
}: {
  id: string;
  name: string;
  photo?: string;
}) {
  if (photo) {
    return (
      <div className="sp-swatch">
        <Image
          src={photo}
          alt={`${name} flooring installed by Ecowoods`}
          fill
          sizes={IMG_SIZES.swatch}
          placeholder="blur"
          blurDataURL={BLUR_WARM}
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }

  const t = SPECIES_TONE[id] ?? SPECIES_TONE['white-oak'];
  return (
    <div
      className="sp-swatch sp-swatch--drawn"
      role="img"
      aria-label={`${name} colour and grain`}
      style={
        {
          '--sw-base': t.base,
          '--sw-grain': t.grain,
        } as React.CSSProperties
      }
    />
  );
}
