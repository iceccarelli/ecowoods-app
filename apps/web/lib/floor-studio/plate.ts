/**
 * THE FLOOR PLATE — a photograph of a floor we have not photographed.
 *
 * /design showed a CSS perspective plane built from repeating-linear-gradient:
 * three stripe layers over a two-hex-colour ground, laid down with rotateX.
 * It cost nothing and it read as exactly what it was. A person choosing a
 * five-figure floor was being shown a diagram of one.
 *
 * The camera visualiser has always had the better machinery — real board
 * geometry, real species pigment, real photographed grain — and it could not be
 * used here, because compositeFloor needs a PHOTOGRAPH to paint into. It takes
 * its light from the room it is given. /design has no room.
 *
 * So this synthesises the room: a floor plane under a real perspective camera,
 * lit by one window, with the wall it runs into. Everything below the horizon
 * goes through the same samplePattern and woodColourFrom the visualiser uses,
 * at the same measured mip level, from the same photographed tile. The floor a
 * person designs here and the floor they later point their camera at are
 * rendered by the same code from the same source material, which is the only
 * way the two can ever agree.
 *
 * No dependency, no WebGL, no shader. A 720×540 plate is about 390,000 pixels
 * of the same arithmetic the visualiser already runs at video rate.
 */
import {
  type GrainTexture,
  type Mat3,
  footprintInches,
  samplePattern,
  solveHomography,
  woodColourFrom,
  woodPalette,
} from './render';
import { BOARD_WIDTHS, finishById, widthById, productById, type FloorConfiguration } from './catalog';
import type { Pixels, Quad } from './room';

/* ── the camera ───────────────────────────────────────────────────────────── */

export type PlateCamera = {
  /** Lens height above the floor, in inches. */
  eyeHeightIn: number;
  /** How far the lens is tilted down from level, in degrees. */
  pitchDeg: number;
  /** Horizontal field of view, in degrees. */
  fovDeg: number;
};

/**
 * A room photograph, as the trade actually shoots one.
 *
 * Forty-eight inches is a seated eye line, which is the height interiors are
 * photographed from because it puts the floor in the frame without making the
 * room look like a drone shot. Eighteen degrees of tilt puts the wall line
 * about a third of the way down the frame. Sixty-two degrees is a 28mm lens on
 * full-frame — wide enough to hold a room, not so wide that the near boards
 * bow. These are the numbers, and they are here as numbers rather than as a
 * hand-tuned quad so that changing the shot is changing the shot.
 */
export const DEFAULT_CAMERA: PlateCamera = { eyeHeightIn: 48, pitchDeg: 18, fovDeg: 62 };

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Where the floor meets the sky, in normalised image coordinates.
 *
 * A ray leaves the lens, is rotated down by the pitch, and hits the floor only
 * while its world-space Y component is negative. The row where that component
 * is exactly zero is the horizon, and it is the one number the whole plate is
 * built around: above it there is no floor to draw at any distance.
 */
function horizonAt(camera: PlateCamera, aspect: number): number {
  const tanX = Math.tan(rad(camera.fovDeg) / 2);
  const tanY = tanX / aspect;
  /* ndy = tan(pitch) is the ray that comes out level. ndy runs +1 at the top of
     the frame to −1 at the bottom, so this inverts to a row. */
  const ndy = Math.tan(rad(camera.pitchDeg));
  return (1 - ndy / tanY) / 2;
}

/**
 * The map from the image to the floor, in inches.
 *
 * The projection of a plane through a pinhole IS a homography, so four correct
 * correspondences define it exactly and there is nothing to approximate. Four
 * pixels are ray-cast onto the floor properly — rotate the ray by the pitch,
 * intersect y = 0 — and solveHomography, which the visualiser already relies on
 * and the suite already tests, does the rest. Writing out the 3×3 by hand would
 * have been a second implementation of a thing that is already correct.
 */
export function floorMapFor(
  camera: PlateCamera,
  aspect: number,
): { m: Mat3; horizon: number } | null {
  const tanX = Math.tan(rad(camera.fovDeg) / 2);
  const tanY = tanX / aspect;
  const cp = Math.cos(rad(camera.pitchDeg));
  const sp = Math.sin(rad(camera.pitchDeg));
  const horizon = horizonAt(camera, aspect);

  const hit = (nx: number, ny: number) => {
    const dx = (nx * 2 - 1) * tanX;
    const dy = (1 - ny * 2) * tanY;
    const dz = -1;
    /* Rotate down by the pitch: the lens looks along −Z and the tilt carries
       that toward −Y. */
    const wy = dy * cp + dz * sp;
    const wz = -dy * sp + dz * cp;
    if (wy >= -1e-6) return null;
    const t = -camera.eyeHeightIn / wy;
    /* Plan-X is lateral and plan-Y is DEPTH INTO THE ROOM, both in inches, so
       that the pattern samplers receive the units they were written for. */
    return { x: t * dx, y: -t * wz };
  };

  /* Two rows well clear of the horizon and of each other. Sampling too close
     to the horizon puts two of the four points almost on top of one another
     and the solve goes soft. */
  const nearY = 0.995;
  const farY = horizon + (1 - horizon) * 0.22;
  const corners = [hit(0.02, farY), hit(0.98, farY), hit(0.98, nearY), hit(0.02, nearY)];
  if (corners.some((c) => c === null)) return null;

  const image: Quad = [
    { x: 0.02, y: farY },
    { x: 0.98, y: farY },
    { x: 0.98, y: nearY },
    { x: 0.02, y: nearY },
  ];
  const planQuad = corners as Quad;
  const m = solveHomography(image, planQuad);
  return m ? { m, horizon } : null;
}

/* ── the light ────────────────────────────────────────────────────────────── */

/**
 * One window, off to the left, and the room it lights.
 *
 * A floor plate lit by a flat gradient looks like a flat gradient. What makes
 * an interior photograph read as one is that the light has a PLACE: a pool on
 * the boards that stays where it is when the pattern changes, a wall that goes
 * dark in the corner it meets, and a specular return that stretches away from
 * the lens rather than sitting in the middle of the frame.
 *
 * All of it is computed in PLAN INCHES, not in image space. That is the whole
 * difference: light measured in image space slides across the floor when the
 * camera moves and betrays itself instantly.
 */
export type PlateLight = {
  /** Where the pool of window light lands, in plan inches. */
  poolX: number;
  poolY: number;
  /** How far it reaches, in inches, across and into the room. */
  poolAcross: number;
  poolDeep: number;
  /** Peak lift at the centre of the pool, as a multiplier. */
  poolGain: number;
  /** How dark the floor goes where it meets the wall. */
  contact: number;
};

export const DEFAULT_LIGHT: PlateLight = {
  poolX: -26,
  poolY: 96,
  poolAcross: 82,
  poolDeep: 150,
  poolGain: 0.34,
  contact: 0.4,
};

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ── the plate ────────────────────────────────────────────────────────────── */

export type PlateOptions = {
  width: number;
  height: number;
  /**
   * Reuse this buffer instead of allocating one, and compute only these rows.
   *
   * A photographic plate at preview size is a fifth of a second of arithmetic.
   * Run on the main thread in one call that is a fifth of a second in which the
   * page does not respond to anything — every chip on /design would feel broken
   * on a phone. So the render is resumable: the caller allocates once with
   * createPlateBuffer, asks for a band of rows, paints it, yields, and asks for
   * the next. No worker, no bundler entry, no second copy of the renderer, and
   * the page stays at sixty frames while the floor fills in.
   */
  into?: Pixels;
  /** Half-open row range, [from, to). Defaults to the whole plate. */
  rows?: [number, number];
  config: FloorConfiguration;
  /** The photographed tile for this species, when one has been decoded. */
  grain?: GrainTexture;
  camera?: PlateCamera;
  light?: PlateLight;
  /** Draw the wall and baseboard above the horizon. */
  wall?: boolean;
};

/**
 * Render one floor, as a photograph would have caught it.
 *
 * Returns a Pixels the caller can put straight into a canvas or encode. It
 * never returns null and never throws: an unknown product or width falls back
 * to the catalogue defaults, because a preview that disappears is worse than a
 * preview of the default floor.
 */
export function renderFloorPlate(options: PlateOptions): Pixels {
  const width = Math.max(16, Math.round(options.width));
  const height = Math.max(16, Math.round(options.height));
  const out: Pixels =
    options.into && options.into.width === width && options.into.height === height
      ? options.into
      : { data: new Uint8ClampedArray(width * height * 4), width, height };
  const rowFrom = Math.max(0, Math.min(height, options.rows ? options.rows[0] : 0));
  const rowTo = Math.max(rowFrom, Math.min(height, options.rows ? options.rows[1] : height));
  if (rowFrom >= rowTo) return out;

  const camera = options.camera ?? DEFAULT_CAMERA;
  const light = options.light ?? DEFAULT_LIGHT;
  const board = widthById(options.config.widthId) ?? BOARD_WIDTHS[1]!;
  const finish = finishById(options.config.finishId);
  const sheen = finish?.sheen ?? 0.16;
  const product = productById(options.config.productId);
  const palette = woodPalette(product?.id ?? 'white-oak', options.config.finishId, options.grain);

  const map = floorMapFor(camera, width / height);
  const horizon = map ? map.horizon : 0.36;

  /* THE WALL.
     Warm white, because a gallery-grey wall makes every species look cold and
     the species is the thing being chosen. It darkens toward the floor, which
     is what a wall does where it stops receiving bounce, and the baseboard
     carries the line that tells a viewer this is a room and not a swatch. */
  const wallTop = { r: 243, g: 240, b: 235 };
  const wallBottom = { r: 224, g: 218, b: 209 };
  const wantWall = options.wall !== false;
  const baseTop = Math.max(0, horizon - (1 - horizon) * 0.055);

  for (let y = rowFrom; y < rowTo; y += 1) {
    const ny = (y + 0.5) / height;
    if (ny >= horizon) break;
    const t = horizon <= 0 ? 0 : Math.min(1, ny / horizon);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!wantWall) {
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
        continue;
      }
      /* The window is on the left, so the wall is brighter there too. A room
         lit from one side and shaded uniformly is the tell that gives away a
         rendering. */
      const nx = (x + 0.5) / width;
      const side = 1 + 0.06 * (1 - nx) - 0.05 * nx;
      const base = ny >= baseTop;
      const k = base ? 0.99 : 1;
      out.data[i] = clamp255((wallTop.r + (wallBottom.r - wallTop.r) * t) * side * k);
      out.data[i + 1] = clamp255((wallTop.g + (wallBottom.g - wallTop.g) * t) * side * k);
      out.data[i + 2] = clamp255((wallTop.b + (wallBottom.b - wallTop.b) * t) * side * k);
      out.data[i + 3] = 255;
    }
  }

  if (!map) return out;
  const m = map.m;
  const invW = 1 / width;
  const invH = 1 / height;

  const firstFloorRow = Math.max(0, Math.floor(horizon * height));
  for (let y = Math.max(firstFloorRow, rowFrom); y < rowTo; y += 1) {
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const nx = (x + 0.5) / width;
      const w = m[6] * nx + m[7] * ny + m[8];
      if (w > -1e-12 && w < 1e-12) continue;
      const planX = (m[0] * nx + m[1] * ny + m[2]) / w;
      const planY = (m[3] * nx + m[4] * ny + m[5]) / w;
      /* Behind the lens, or on the far side of the horizon: there is no floor
         there and painting one is how a plate grows a second, upside-down room
         above the wall line. */
      if (!Number.isFinite(planX) || !Number.isFinite(planY) || planY <= 0) continue;

      const sample = samplePattern(planX, planY, options.config.patternId, board.inches);
      const footprintIn = footprintInches(m, planX, planY, w, invW, invH);
      const wood = woodColourFrom(palette, sample, board.inches, footprintIn);

      /* THE POOL OF WINDOW LIGHT, in plan inches, so it belongs to the floor
         and not to the frame. */
      const dx = (planX - light.poolX) / light.poolAcross;
      const dy = (planY - light.poolY) / light.poolDeep;
      /* A rational falloff, not a Gaussian. Same shape to the eye — peak of
         one at the centre, smooth, monotone, never negative — and no
         transcendental in the innermost loop. There were two exp() per pixel
         here, six hundred thousand a frame at preview size, for a soft pool of
         light whose exact profile nobody can name. */
      const r2 = dx * dx + dy * dy;
      const pool = 1 / ((1 + r2) * (1 + r2));

      /* Distance falloff and the contact shadow where the floor meets the
         wall. A floor that stays the same brightness all the way to the wall
         line is the single loudest tell in a rendered interior. */
      const depth = smoothstep(0, 210, planY);
      const shade =
        (1 - light.contact * depth) * (1 + light.poolGain * pool) * (1 - 0.1 * smoothstep(40, 0, planY));

      /* SPECULAR. On a floor, the reflection of a window is not a spot — it is
         drawn out along the line between the lens and the light, and it grows
         toward the horizon because the angle to the surface gets shallower. So
         the lobe is wide in depth, narrow across, and gains with distance. */
      const sx = (planX - light.poolX * 0.4) / (light.poolAcross * 1.5);
      const grazing = smoothstep(20, 260, planY);
      const spec = (sheen * (0.35 + 1.5 * grazing)) / (1 + sx * sx);

      /* A lens vignettes, and so does the eye. Image space is the right space
         for this one, because it is a property of the optics and not of the
         floor. */
      const vx = (nx - 0.5) * 2;
      const vig = 1 - 0.14 * vx * vx;

      const k = shade * vig;
      const lift = 255 * spec * 0.55;
      out.data[i] = clamp255(wood.r * k + lift);
      out.data[i + 1] = clamp255(wood.g * k + lift * 0.99);
      out.data[i + 2] = clamp255(wood.b * k + lift * 0.96);
      out.data[i + 3] = 255;
    }
  }

  /* The shadow the baseboard casts onto the floor. Two or three rows, no more:
     it is a joint, not a piece of furniture. */
  if (wantWall) {
    const rows = Math.max(2, Math.round(height * 0.012));
    for (let r = 0; r < rows; r += 1) {
      const y = firstFloorRow + r;
      if (y < rowFrom || y >= rowTo) continue;
      const k = 0.62 + 0.38 * (r / rows);
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        out.data[i] = clamp255(out.data[i]! * k);
        out.data[i + 1] = clamp255(out.data[i + 1]! * k);
        out.data[i + 2] = clamp255(out.data[i + 2]! * k);
        out.data[i + 3] = 255;
      }
    }
  }

  return out;
}

/**
 * A buffer for renderFloorPlate to fill, band by band.
 *
 * Opaque white rather than transparent black, so a plate that is still being
 * filled in reads as an empty frame and not as a hole in the page.
 */
export function createPlateBuffer(width: number, height: number): Pixels {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));
  const data = new Uint8ClampedArray(w * h * 4);
  data.fill(255);
  return { data, width: w, height: h };
}
