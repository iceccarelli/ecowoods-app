/**
 * MOTION-01 shared constants.
 *
 * Two physics systems live in this folder — DeluxeStage (an advancing
 * carousel: peeking neighbours squashed to scaleY(0.9), an 800ms ease-out
 * settle with a small overshoot) and StoryboardHover (a hover scrub: mouse-X
 * cuts between stills of the same job, no crossfade). Every call site pulls
 * its numbers from here so the two systems read as one product instead of a
 * pile of components each inventing their own duration.
 */

export const DELUXE = {
  durationMs: 800,
  ease: 'ease-out',
  inactiveScaleY: 0.9,
  overshoot: 1.03,
  peekPx: 72,
  gapPx: 16,
} as const;

export const STORYBOARD = {
  enterDelayMs: 180,
  cycleMs: 320,
  maxFrames: 8,
} as const;
