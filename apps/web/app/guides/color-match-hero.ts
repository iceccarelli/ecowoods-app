/**
 * Colour-matching guide slug → its MANIFEST hero frame
 * (scripts/fixtures/color-matching-manifest.csv).
 *
 * Shared between the guide detail page (apps/web/app/guides/[slug]/page.tsx,
 * the hero above the fold) and the /guides index thumbnail
 * (apps/web/app/guides/page.tsx) — one map, so the picture on the card and
 * the picture on the page it links to cannot disagree. Kept out of both
 * files rather than duplicated in each, the same reason GUIDE_IMAGE and
 * GUIDE_PAIRS live in the detail page rather than in lib/guides.ts: this is a
 * presentation concern, not a content one.
 *
 * The species/undertone guide is included here (its thumbnail uses the
 * six-species lineup frame) but the detail page's own header deliberately
 * skips it — that page renders the lineup again, full-width, in its own
 * dedicated species section below the fold, and a second copy of the same
 * image as a small header hero right above it would be redundant on the one
 * page a visitor is already looking at both.
 */
export const COLOR_MATCH_HERO: Record<string, string> = {
  'color-identification-existing-hardwood-finish': 'guide-id-hero-rug-reveal',
  'stain-matching-existing-hardwood-floor-toronto': 'guide-stain-hero-chip-vs-aged',
  'matching-new-hardwood-to-old-toronto': 'guide-newold-hero-invisible-weave',
  'stair-railing-trim-color-matching-toronto': 'guide-stair-hero-one-flight',
  'door-woodwork-finish-coordination-toronto': 'guide-door-hero-baseboard-meet',
  'when-color-match-fails-full-sand-vs-replace': 'guide-fail-hero-visible-patch',
  'sample-boards-on-site-trials-sign-off': 'guide-signoff-hero-condo-light',
  'species-undertone-guide-color-matching-toronto': 'species-same-stain-six-species',
};

/** The one guide whose detail-page header hero is intentionally skipped — see above. */
export const COLOR_MATCH_HERO_SKIP_ON_DETAIL = 'species-undertone-guide-color-matching-toronto';
