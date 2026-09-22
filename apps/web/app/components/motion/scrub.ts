/**
 * scrub.ts — the one mouse-X → frame-index calculation every hover-scrub
 * surface in the app uses: StoryboardHover, RotatingTile, and the active
 * card + lightbox stage in FloorCatalog/MachineCatalog. MOTION-01 shipped
 * this arithmetic copied four times; a second (and third, and fourth) copy
 * of "which eighth of the card is the mouse over" is how those surfaces
 * quietly drift out of sync on what a half-way scrub means. There is one
 * function now, and it is the one under test.
 */

/** Mouse and pen drive a hover scrub; touch never does — it keeps whatever
 *  tap/drag behaviour the parent already gives it. Checked from the actual
 *  PointerEvent.pointerType, never guessed from viewport width. */
export function isHoverPointer(pointerType: string): boolean {
  return pointerType === 'mouse' || pointerType === 'pen';
}

/**
 * Maps a pointer's clientX across an element's bounding rect to a frame
 * index in [0, frameCount - 1]. Pass the rect's own `left`/`width` (not the
 * DOMRect itself) so this stays a plain function callers can unit test
 * without touching the DOM.
 */
export function frameIndexFromMouseX(clientX: number, rectLeft: number, rectWidth: number, frameCount: number): number {
  if (frameCount <= 0 || rectWidth <= 0) return 0;
  const frac = Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth));
  return Math.min(frameCount - 1, Math.floor(frac * frameCount));
}

/** Left offset, as a percentage, for the 3px scrub tick under a frame stack. */
export function tickLeftPercent(index: number, frameCount: number): number {
  if (frameCount <= 1) return 0;
  return (index / (frameCount - 1)) * 100;
}
