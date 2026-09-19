/**
 * lib/trilogy-slides.ts — a trilogy's three frames, as FigureRotator slides.
 *
 * Every inline placement of a trilogy (guide-style captioned rotator: the
 * stairs page blocks, the commercial page, a project story page) reuses
 * FigureRotator directly rather than a second carousel — this is the one
 * conversion point between lib/trilogies.ts's own frame shape and the
 * RotatorSlide shape FigureRotator expects. Width/height come from the
 * StaticImageData import itself (frame.src.width/.height), not a second,
 * driftable dims table.
 *
 * The homepage hero is the one placement that does NOT use this — a full-bleed
 * backdrop behind rotating headline text has nothing in common with a
 * captioned documentation figure, so it has its own small component,
 * TrilogyHero, that reads frames directly. See that file's own note.
 */
import type { RotatorSlide } from '@/app/components/FigureRotator';
import type { Trilogy } from './trilogies';

/** All three frames of a trilogy, in order, as FigureRotator slides. */
export function trilogySlides(trilogy: Trilogy, href?: string): RotatorSlide[] {
  return trilogy.frames.map((f) => ({
    id: `${trilogy.slug}-${f.id}`,
    src: f.src,
    alt: f.alt,
    caption: f.caption,
    href,
    width: f.src.width,
    height: f.src.height,
  }));
}
