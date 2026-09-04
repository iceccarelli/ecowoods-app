import type { SVGProps } from 'react';

/* ────────────────────────────────────────────────────────────────────────────
   THE ECOWOODS LEAF — one drawing, one file.

   Before this, the mark existed as three different shapes:

     A. 24×24, filled body + inner stem      Header, SiteFooter, LoginForm,
        (Header alone also drew an           RegisterForm
         external stem, `M12 18v3`)
     B. 32×32, a different silhouette        ChatWidget, CommandPalette,
        with a thinner inner curve           FloorConfigurator

   A homeowner who opens EcowoodsGuide sees the same mark as the header — on a
   site whose entire argument is "we are the same shop, since the founding year
   in BUSINESS_NAP." Consistency of the mark is not decoration; it is the visual
   half of that claim.

   This is drawing A, without the external stem, matching the brand asset.
   It inherits `currentColor`, so it works on copper, on cream, on espresso,
   and in both themes without a single hardcoded value.

   NOTE: this is the *brand mark*. It is deliberately not used for the
   "FSC-Certified Eco Materials" pillar in page.tsx — that glyph means
   sustainability, not Ecowoods. A logo where a content icon belongs reads as
   a mistake.
   ──────────────────────────────────────────────────────────────────────────── */

export interface EcowoodsLeafProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  /** Rendered edge length in px. Defaults to 24. */
  size?: number | string;
  /** The short stalk below the leaf. Off by default — the brand asset has none. */
  withStem?: boolean;
  /** Opacity of the filled body. 0 gives a pure outline. */
  fillOpacity?: number;
}

export function EcowoodsLeaf({
  size = 24,
  withStem = false,
  fillOpacity = 0.18,
  strokeWidth = 1.6,
  ...rest
}: EcowoodsLeafProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path
        d="M12 2C9 6 6 8 6 12c0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3-6-6-10Z"
        fill="currentColor"
        fillOpacity={fillOpacity}
      />
      <path d="M12 4.5c-2 3-4 4.5-4 7.5 0 2.5 1.8 4.5 4 4.5" strokeLinecap="round" />
      {withStem && <path d="M12 18v3" strokeLinecap="round" />}
    </svg>
  );
}

export default EcowoodsLeaf;
