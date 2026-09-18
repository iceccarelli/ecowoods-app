/**
 * lib/floor-plan/share-code.ts — turning whatever a customer pastes into the
 * bare querystring decodeStudioDesign() expects.
 *
 * There are two live link shapes on this site (see
 * lib/floor-studio/studio-config.ts and app/components/floor-studio/FloorStudio.tsx):
 *   1. A /floor-studio address-bar link, where the design IS the page's own
 *      querystring: `.../floor-studio?c=white-oak.satin.herringbone.5&a=900`.
 *   2. A /design/spec link, where the code is the VALUE of a `design` param:
 *      `.../design/spec?design=c%3Dwhite-oak...%26a%3D900`.
 * A customer copying "the share link" could reasonably hand us either shape,
 * or just the bare `c=...&a=...` code itself. This normalizes all three to
 * the bare code, or returns it unchanged if none of the URL shapes match —
 * decodeStudioDesign() is the actual validator; this only reshapes the input
 * so it gets a fair chance to run.
 */

export function parseShareCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Not a URL — either a bare code or a leading "?querystring". Pass through.
    return trimmed;
  }

  const designParam = url.searchParams.get('design');
  if (designParam) return designParam;

  return url.search.startsWith('?') ? url.search.slice(1) : url.search;
}
