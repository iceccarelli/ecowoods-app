/**
 * lib/floor-studio/live.ts — the arithmetic behind pointing a camera at a room.
 *
 * WHAT THE LIVE VIEW IS, STATED BEFORE ANYTHING ELSE
 *
 * It is the existing renderer, run on every frame of a camera stream instead of
 * once on an uploaded photograph. The floor laid into the room is drawn from a
 * configuration this company can supply and install — the same catalogue, the
 * same exact homography, the same mask, the same published price. Nothing here
 * generates a floor, and the reason is the one render.ts already gives: a
 * beautiful floor that exists nowhere cannot be bought, and showing one to a
 * homeowner is a fraud with a nice colour palette.
 *
 * So this is not "AI generates a new floor". It is every buyable floor,
 * rendered into the actual room, at video rate, with the room's own light kept.
 * That is a stronger claim, and unlike the other one it is true.
 *
 * WHY THIS FILE IS PURE
 *
 * A camera loop is the hardest thing in a codebase to test — it needs a device,
 * a permission, a user and a room. So everything that DECIDES anything lives
 * here as a pure function over numbers, and the component is left holding only
 * the parts that genuinely need a browser: getUserMedia, a canvas and a frame
 * callback. What is decided here:
 *
 *   · how big a frame to analyse, adapted to what the device can actually do
 *   · how much to trust this frame's floor estimate against the last one
 *   · when a reading has settled enough to stop moving under the viewer
 *   · what to tell someone whose camera did not open, in their terms
 */
import { DEFAULT_QUAD, estimateFloorQuad, type Pixels, type Point, type Quad } from './room';

/* ── the resolution ladder ────────────────────────────────────────────────── */

/**
 * Analysis widths, smallest first. The frame is drawn into a canvas of this
 * width and composited there, then scaled up to whatever the element is.
 *
 * Measured on the reference machine after the render path was optimised:
 * 320×240 at about 8 ms a frame, 480×360 at 18, 640×480 at 30. A phone is
 * several times slower than that, which is exactly why the ladder exists
 * rather than a constant.
 */
export const LIVE_WIDTHS = [256, 320, 400, 480, 560, 640] as const;

/** 24 fps leaves room for the browser to do everything else. */
export const FRAME_BUDGET_MS = 1000 / 24;

export type Ladder = { width: number; index: number };

export const startingLadder = (): Ladder => ({ width: LIVE_WIDTHS[2]!, index: 2 });

/**
 * Move one rung, and only on sustained evidence.
 *
 * A single slow frame is a garbage collection, not a slow device. Stepping on
 * one sample makes the picture pulse between sizes, which reads as a fault in
 * the product rather than as adaptation. So the caller passes how many
 * consecutive frames have been over or under budget, and nothing moves until
 * that run is long enough to mean something.
 */
export function stepLadder(
  current: Ladder,
  frameMs: number,
  run: { slow: number; fast: number },
  budgetMs = FRAME_BUDGET_MS,
): { ladder: Ladder; run: { slow: number; fast: number } } {
  const slow = frameMs > budgetMs ? run.slow + 1 : 0;
  /* Only climb when there is real headroom — at exactly budget the next rung
     up would immediately be over it, and the ladder would oscillate forever. */
  const fast = frameMs < budgetMs * 0.55 ? run.fast + 1 : 0;

  if (slow >= 6 && current.index > 0) {
    return { ladder: { width: LIVE_WIDTHS[current.index - 1]!, index: current.index - 1 }, run: { slow: 0, fast: 0 } };
  }
  if (fast >= 30 && current.index < LIVE_WIDTHS.length - 1) {
    return { ladder: { width: LIVE_WIDTHS[current.index + 1]!, index: current.index + 1 }, run: { slow: 0, fast: 0 } };
  }
  return { ladder: current, run: { slow, fast } };
}

/* ── the quad, frame over frame ───────────────────────────────────────────── */

/**
 * Blend this frame's estimate into the one on screen.
 *
 * The floor estimator in room.ts is a colour-run heuristic. Run once on a
 * still photograph it is a reading the visitor then corrects; run thirty times
 * a second on a moving camera it is a reading that JUMPS, and a floor boundary
 * that jumps a few percent every frame looks like a fault even when the average
 * is right. An exponential blend costs four lerps and removes all of it.
 *
 * alpha is how much of the new estimate to take. Low is calm and laggy; high is
 * responsive and nervous. It is a parameter rather than a constant because a
 * WEAK reading should barely move the boundary at all.
 */
export function blendQuad(previous: Quad, next: Quad, alpha: number): Quad {
  const a = Math.max(0, Math.min(1, alpha));
  const lerp = (p: Point, q: Point): Point => ({ x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a });
  return [
    lerp(previous[0], next[0]),
    lerp(previous[1], next[1]),
    lerp(previous[2], next[2]),
    lerp(previous[3], next[3]),
  ];
}

/** How far apart two quads are, as the mean corner distance in frame widths. */
export function quadDistance(a: Quad, b: Quad): number {
  let total = 0;
  for (let i = 0; i < 4; i += 1) total += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  return total / 4;
}

export type LiveReading = {
  quad: Quad;
  confidence: 'measured' | 'weak';
  /** true once the boundary has stopped moving meaningfully. */
  settled: boolean;
};

/** Below this mean corner movement, the boundary has stopped hunting. */
export const SETTLED_DISTANCE = 0.004;

/**
 * One step of the live estimate.
 *
 * A `weak` frame — the camera swung at a wall, someone walked through, the
 * floor left the frame — moves the boundary by almost nothing, so a moment of
 * confusion does not throw away a good reading. A `measured` frame moves it a
 * third of the way, which settles in about six frames: a quarter of a second.
 */
export function advanceLive(previous: Quad | null, frame: Pixels): LiveReading {
  const { quad, confidence } = estimateFloorQuad(frame);
  if (!previous) return { quad, confidence, settled: false };
  const alpha = confidence === 'measured' ? 0.34 : 0.05;
  const blended = blendQuad(previous, quad, alpha);
  return { quad: blended, confidence, settled: quadDistance(previous, blended) < SETTLED_DISTANCE };
}

/** The boundary a live session opens on, before any frame has arrived. */
export const openingQuad = (): Quad => [...DEFAULT_QUAD] as unknown as Quad;

/* ── when the camera does not open ────────────────────────────────────────── */

export type CameraFailure =
  | 'denied'
  | 'no-camera'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'unknown';

/**
 * Classify what the browser threw.
 *
 * Every branch here ends in a sentence the visitor can act on, because the
 * alternative — one "could not access camera" for six different causes — sends
 * somebody to reinstall a browser when the real problem is that another tab has
 * the camera open.
 */
export function classifyCameraError(err: unknown): CameraFailure {
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'insecure';
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  if (name === 'NotReadableError' || name === 'AbortError') return 'in-use';
  if (name === 'TypeError') return 'unsupported';
  return 'unknown';
}

export const CAMERA_MESSAGES: Record<CameraFailure, string> = {
  denied:
    'Your browser is blocking the camera for this site. The padlock in the address bar turns it back on — or upload a photo instead, which works exactly the same way.',
  'no-camera':
    'We could not find a camera on this device. Upload a photo of the room and everything below still works.',
  'in-use':
    'Something else is using the camera — another tab, or a video call. Close it and try again, or upload a photo instead.',
  insecure:
    'Browsers only allow the camera over a secure connection. Open this page at https://ecowoods.ca and it will work; a photo upload works either way.',
  unsupported:
    'This browser does not offer a live camera to web pages. Uploading a photo does the same thing, one frame at a time.',
  unknown:
    'The camera did not start. Upload a photo of the room instead — the studio does not lose anything by it.',
};

/** Whether it is even worth asking for a camera on this device. */
export function cameraAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/* ── what the live view is allowed to say ─────────────────────────────────── */

/**
 * The sentence under the live picture.
 *
 * It never says "measured". The still-photograph path has four draggable
 * corners and a visitor who has looked at the result; the live path has neither,
 * and AUDIT-01 recorded what happens when this codebase claims a confidence it
 * has not earned.
 */
export function liveCaption(reading: LiveReading, painted: number): string {
  if (reading.confidence === 'weak') {
    return 'Point the camera down a little so more of the floor is in the frame.';
  }
  if (painted < 0.25) {
    return 'Most of what is in frame is furniture rather than floor, so we have left it alone.';
  }
  if (!reading.settled) return 'Finding the floor…';
  return 'Hold still and change the floor below — this is your room.';
}
