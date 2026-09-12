/**
 * content/constants/studio-products.ts — the paid rungs of the Floor Studio
 * ladder, declared and NOT PUBLISHED.
 *
 * WHY THIS FILE EXISTS WITH EVERY PRICE SET TO null
 *
 * Floor Studio's commercial design has more than one rung: the free
 * visualisation, a paid personal floor plan, a paid professional design review,
 * samples, and then the project itself. Building the free rung without the
 * others is how a feature ends up with no path to revenue and gets cut in six
 * months. But a new dollar figure on this site is a Class C change — it is a
 * price this business has not agreed to honour, published to the public and to
 * every machine that reads /api/v1/pricing — and no engineer, and no agent, gets
 * to make that call in a patch.
 *
 * So the ladder is DECLARED here, with its rungs, its deliverables and its
 * refusals written down, and `published: false` on the paid ones. The studio
 * renders nothing for an unpublished rung: no price, no "from $X", no "coming
 * soon" that reads like a price. When the owner sets a figure, they set it here,
 * once, and every surface follows — the same contract
 * content/constants/pricing.ts already holds for the three service bands.
 *
 * `priceCad: null` is therefore not a placeholder waiting for a developer. It is
 * the correct value until a person who can honour the number types it.
 *
 * THE SAMPLE RUNG IS DIFFERENT AND IS LIVE
 *
 * Sending samples is something this business already does, by hand, when
 * somebody asks. The studio's samples CTA is a LEAD — it carries the design into
 * /estimate and the office follows up — not a checkout. It publishes no price
 * because it charges nothing, which is why it can ship today while the other two
 * wait.
 */

export type StudioProduct = {
  id: string;
  name: string;
  /** What the customer receives. Written for them, not for us. */
  deliverable: string;
  /**
   * CAD, or null where no figure has been published. A number here is a Class C
   * change: it must be patched deliberately and flagged, never introduced as a
   * side effect of a UI change.
   */
  priceCad: number | null;
  /**
   * False keeps it off every surface. The studio does not render an
   * unpublished rung at all — not greyed out, not "coming soon", not a
   * placeholder that a visitor could mistake for an offer.
   */
  published: boolean;
  /** Where a published rung would send the visitor. */
  href: string;
  /** What this rung explicitly is not, so it cannot be oversold later. */
  refuses: readonly string[];
};

export const STUDIO_PRODUCTS: readonly StudioProduct[] = [
  {
    id: 'samples',
    name: 'Send me samples',
    deliverable:
      'Physical samples of the floor you designed, so you can put them on your own floor, in your own light, at the time of day you are actually in the room.',
    priceCad: null,
    published: true,
    href: '/estimate#form',
    refuses: [
      'not a quote — a sample tells you about the wood, never about your subfloor',
      'not a colour guarantee: every board in a real floor differs from every sample',
    ],
  },
  {
    id: 'floor-plan',
    name: 'Ecowoods Personal Floor Plan',
    deliverable:
      'Your room, your configuration, and the specification written out: species, grade, width, finish schedule, direction of lay, transitions, and what the subfloor has to be doing for it to work.',
    priceCad: null,
    published: false,
    href: '/estimate#form',
    refuses: ['not a fixed price', 'not a substitute for the in-home measure'],
  },
  {
    id: 'design-review',
    name: 'Ecowoods Professional Design Review',
    deliverable:
      'A senior estimator reads your design against the room it is going into and writes back: what will work, what will not, and what they would change.',
    priceCad: null,
    published: false,
    href: '/estimate#form',
    refuses: ['not interior design', 'not a fixed price'],
  },
] as const;

export const publishedStudioProducts = (): StudioProduct[] =>
  STUDIO_PRODUCTS.filter((p) => p.published);

export const studioProductById = (id: string): StudioProduct | undefined =>
  STUDIO_PRODUCTS.find((p) => p.id === id);
