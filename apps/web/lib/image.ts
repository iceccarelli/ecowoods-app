/**
 * Shared image constants for next/image.
 *
 * BLUR_WARM is a tiny (8x8) warm cream→walnut gradient used as the
 * `placeholder="blur"` for remote photos, so images fade in warm instead of
 * popping in — the premium feel, and it also reserves paint so there is no
 * layout shift. One constant, one source of truth, so every photo fades the
 * same way (the "one hand built this" rule applied to loading state).
 */
export const BLUR_WARM =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAPUlEQVR4nG3LsQ0AIAzEQJH9h2IMRmCEd76hQQJBGhcnuc3RUzJKTg1RakpRqlGUmlzHred4dB+/GkWphgW5G7qJffmxzgAAAABJRU5ErkJggg==';

/** Responsive `sizes` presets so next/image requests only the pixels it paints. */
export const IMG_SIZES = {
  swatch: '68px',
  galleryTile: '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw',
  deckCard: '(max-width: 767px) 90vw, 420px',
} as const;
