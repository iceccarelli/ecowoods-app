/**
 * Where Tab should go inside a modal surface.
 *
 * Returns the item to focus when the press would leave the ring (forward from
 * the last item, backward from the first, or from an element outside the ring),
 * or null when the browser's own order is already correct.
 */
export function trapTarget<T>(ring: readonly T[], active: T | null, shift: boolean): T | null {
  if (ring.length === 0) return null;
  const i = active === null ? -1 : ring.indexOf(active);
  if (i === -1) return shift ? ring[ring.length - 1]! : ring[0]!;
  if (!shift && i === ring.length - 1) return ring[0]!;
  if (shift && i === 0) return ring[ring.length - 1]!;
  return null;
}

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
