#!/usr/bin/env python3
"""
scripts/textures/build-grain.py — real wood, cut from real photographs.

WHAT THIS PRODUCES

apps/web/public/textures/grain-<species>.webp — one seamless tile per catalogue
species, cut from apps/web/public/gallery/, which are photographs of the actual
products on actual floors. Plus grain-manifest.json, which records for each tile
the photograph it came from, the crop, the rotation, and — the number the
renderer cannot work without — HOW MANY INCHES OF FLOOR THE TILE MEASURES.

The renderer samples these in BOARD-LOCAL INCHES, so one texture serves every
pattern: straight, diagonal, herringbone and chevron all hand back the same two
numbers in their own block's frame, and the grain runs along each piece the way
it does on a real floor. The catalogue's geometry draws the seams and the
bevels; the photograph supplies the face.

FIVE DECISIONS, AND WHY EACH ONE IS NOT AUTOMATIC

1. THE CROP IS NAMED, NOT SEARCHED. Two scoring functions were tried and both
   picked a seam: one rewarded axial gradient, which is exactly what a board
   seam is, and the next rewarded grain over hard edges, which still landed on
   a bevel in three species out of five. A seam inside the texture is repeated
   inside every board. Twelve photographs is not a dataset; it is six decisions,
   so they are made here, by eye, and written down with the reason.

2. THE GRAIN IS TURNED TO RUN ALONG THE BOARD. This was missing, and it was the
   single largest defect in the set. Of the five original crops, ONE had its
   grain running along the axis the renderer maps to the length of a board:
   white oak's ran across it, walnut's and maple's ran at forty-five degrees
   because those photographs are of herringbone and chevron floors. The
   renderer duly painted oak with the grain running sideways across every
   plank, and the result read as crumpled foil rather than as wood. The angle
   is MEASURED — a structure tensor over the crop, whose principal direction is
   across the grain — and then the rotation is verified by measuring again. If
   the second measurement is further from vertical than the first, the sign was
   wrong and it is flipped. No sign convention is reasoned about anywhere in
   this file; it is checked.

3. THE TILE IS A STRIP, NOT A SQUARE. The previous version resized every crop
   to 512x512, which squashes a tall crop into a square and takes the grain
   with it. It also makes a tile a few inches long, and a board is four feet
   long, so that tile repeated six or eight times down every board — which is
   visible, and reads as a ripple running across the floor. Measured against
   the one accidentally-tall tile in the old set, the short ones were the only
   ones that waved. So the cut is three to one along the grain, and the aspect
   is the thing being asked for rather than a consequence of the crop.

4. THE LIGHT IS DIVIDED OUT, AT A PHYSICAL RADIUS. These are photographs of
   rooms with windows, and several carry a hard shadow. Pasted into somebody
   else's room that shadow is a false statement about their light — and the
   renderer multiplies their own light in afterwards, so it would be applied
   twice. Dividing by a heavily blurred copy removes it. The radius is in
   INCHES, not in pixels or in fractions of the tile: a fraction gave a tall
   tile a small radius, which removed the plank-scale grain along with the
   window and left nothing but pore chatter. A window falls across a floor over
   feet. Three inches is above every feature of the wood and below anything the
   room does.

5. IT TILES WITHOUT A MIRROR, AND WITHOUT A PATCHWORK. Reflecting a crop makes
   its edges match, and makes a chevron out of any diagonal in it — which then
   appears inside the straight pattern. Wood grain has no symmetry. Blending
   against a half-period roll of the whole image, which is what this did
   instead, matches the edges and leaves a rectangular patch boundary across
   the middle of the tile; see seamless() for why that was invisible until the
   tiles got wider. Only the edge bands are touched now.

WHAT THE INCHES ARE, HONESTLY

There is no scale bar in a photograph of a floor. Each source frames a known
number of boards, so the board width in the frame is readable, and a wide plank
is seven inches. `board_frac` below is that reading — the fraction of the frame
one board occupies — and the tile's width in inches follows from it. It is an
estimate with a stated basis, and it is recorded in the manifest as one. Being
twenty percent out moves the grain scale by twenty percent, which nobody can
see; being a factor of five out is what the old single constant was.

Run:  python3 scripts/textures/build-grain.py
"""
from PIL import Image, ImageFilter, ImageStat
import numpy as np
import json, math, os, sys

SRC = 'apps/web/public/gallery'
OUT = 'apps/web/public/textures'
# The render API decodes PNG and nothing else — it has zero dependencies and
# there is no webp decoder in node:zlib. So the same tiles are written a second
# time, as PNG, for the service. At a quarter of the linear resolution, which is
# not a compromise: a 256-texel tile across three inches is 85 texels to the
# inch, and the largest plate the API will render still MINIFIES that. It is the
# same wood, one megabyte instead of five.
API_OUT = 'services/render-api/textures'
API_TILE_WIDTH = 256

TILE_WIDTH = 512
TILE_ASPECT = 3.0          # height : width, along the grain
WIDE_PLANK_INCHES = 7.0
FLATTEN_INCHES = 3.0

# species → source photo, crop as fractions, the board's share of the frame, why
CROPS = [
    ('white-oak', 'white-oak-wideplank-02-detail', (0.54, 0.06, 0.97, 0.94), 0.48,
     'the right-hand board: no seam and no bevel in frame, and the sharper of the two'),
    ('red-oak', 'red-oak-wideplank-02-detail', (0.53, 0.34, 0.99, 0.98), 0.49,
     'the right-hand board BELOW the window shadow. The full board is wider and '
     'red oak wants width — its cathedral figure is board-scale — but the shadow '
     'across the top of that frame has an edge too sharp for a three-inch flatten '
     'to divide out, and a dark diagonal printed across every plank in the room '
     'is a worse defect than a tile that repeats'),
    ('black-walnut', 'walnut-wideplank-02-detail', (0.02, 0.60, 0.46, 0.98), 0.40,
     'the lower-left quadrant, clear of the mitred joint that runs across the top right'),
    ('hard-maple', 'maple-herringbone-02-detail', (0.03, 0.08, 0.40, 0.75), 0.34,
     'the left-hand column of blocks, above the joint that crosses the lower middle'),
    ('hickory', 'hickory-wideplank-02-detail', (0.33, 0.05, 0.61, 0.95), 0.33,
     'the second board: hickory character marks without a seam, which is the species'),
    ('white-ash', 'ash-wideplank-02-detail', (0.03, 0.04, 0.44, 0.96), 0.45,
     'the left-hand board, full height; the window fall across it is divided out'),
]


# ── measurement ───────────────────────────────────────────────────────────────

def grain_angle(im: Image.Image):
    """Degrees from horizontal, and how strongly oriented the crop is at all.

    The structure tensor's principal direction is the dominant GRADIENT, which
    on wood is across the grain; the grain is perpendicular to it. The angle is
    doubled before averaging because grain has an orientation and not a
    direction — otherwise opposite gradients cancel and every board measures
    zero.
    """
    g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float64)
    gy, gx = np.gradient(g)
    jxx = float((gx * gx).sum())
    jxy = float((gx * gy).sum())
    jyy = float((gy * gy).sum())
    theta = 0.5 * math.atan2(2 * jxy, jxx - jyy)
    coherence = math.hypot(jxx - jyy, 2 * jxy) / max(1e-9, jxx + jyy)
    deg = math.degrees(theta) + 90.0
    while deg > 90:
        deg -= 180
    while deg < -90:
        deg += 180
    return deg, coherence


def off_vertical(deg: float) -> float:
    return abs(90.0 - abs(deg))


# ── the pieces ────────────────────────────────────────────────────────────────

def tallest_inscribed(w: float, h: float, a_deg: float, aspect: float):
    """The tallest rect of this aspect that fits inside a w x h box rotated by a.

    Not the largest rect, which comes out about as square as the source was.
    See decision 3.
    """
    a = math.radians(a_deg)
    c, s = math.cos(a), math.sin(a)

    def fits(rw, rh):
        for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            x, y = sx * rw / 2, sy * rh / 2
            if abs(x * c + y * s) > w / 2 + 1e-6:
                return False
            if abs(-x * s + y * c) > h / 2 + 1e-6:
                return False
        return True

    lo, hi = 4.0, max(w, h) * 2
    for _ in range(60):
        mid = (lo + hi) / 2
        if fits(mid, mid * aspect):
            lo = mid
        else:
            hi = mid
    return lo, lo * aspect


def flatten(im: Image.Image, px_per_inch: float) -> Image.Image:
    radius = max(2, int(round(FLATTEN_INCHES * px_per_inch)))
    blur = im.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(im, dtype=np.float32)
    b = np.asarray(blur, dtype=np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    return Image.fromarray(np.clip(a * mean / np.maximum(b, 1.0), 0, 255).astype(np.uint8))


def _smoothstep(t):
    return t * t * (3 - 2 * t)


def _wrap_axis(a: np.ndarray, axis: int, band_frac: float) -> np.ndarray:
    """Make one axis wrap, by fading the edges into a half-period roll.

    Rolling is what makes this correct rather than approximately correct. A
    cyclic roll by half the length is continuous across the tile boundary by
    construction — the two columns that meet there came from the middle of the
    original, where they were already neighbours. So a weight that reaches one
    AT the edge hands the boundary entirely to content that already matches
    across it, and there is nothing left to match up by hand.

    A cross-fade of each edge against the opposite edge, which is the obvious
    thing to write and what this was for an afternoon, does NOT have that
    property: the first column ends up a mixture of two columns and the last
    column a mixture of two DIFFERENT ones, and the seam metric said so — 16x
    the local contrast on red oak while looking fine to me in a contact sheet.
    """
    n = a.shape[axis]
    band = max(2, int(round(n * band_frac)))
    i = np.arange(n, dtype=np.float32)
    edge = np.minimum(i, n - 1 - i) / band
    w = 1.0 - _smoothstep(np.clip(edge, 0.0, 1.0))        # 1 at the edges, 0 inside
    shape = [1, 1, 1]
    shape[axis] = n
    w = w.reshape(shape)
    rolled = np.roll(a, n // 2, axis=axis)
    return a * (1 - w) + rolled * w


def seamless(a: np.ndarray, band_frac: float = 0.16) -> np.ndarray:
    """Make the tile wrap on both axes.

    ONE AXIS AT A TIME, and that is the whole correction over the version this
    replaces. That one multiplied an x weight by a y weight, so the boundary
    between "mostly original" and "mostly rolled" traced a RECTANGLE across the
    middle of the tile, and two different pieces of wood either side of a
    rectangle is a patchwork. It was invisible while the tiles repeated eight
    times across a board and unmissable the moment one repeated one and a half
    times.

    Done in sequence, each pass's weight depends on one coordinate only, so
    neither leaves a closed boundary anywhere. The second pass preserves what
    the first established: rolling along y cannot break periodicity along x,
    and a blend of two x-periodic images is x-periodic.

    Mirroring would also make the edges match, and is not used: reflecting a
    crop makes a chevron out of any diagonal in it, which then appears inside
    the straight pattern. Wood grain has no symmetry.
    """
    out = _wrap_axis(a.astype(np.float32), 1, band_frac)
    out = _wrap_axis(out, 0, band_frac)
    return np.clip(out, 0, 255).astype(np.uint8)


def seam_step(a: np.ndarray) -> tuple:
    """How visible the wrap is, against the tile's own contrast.

    The first version of this measured the step across the seam as a multiple of
    the step between neighbouring interior columns, which sounds right and is
    not. Grain runs along the tile, so neighbouring ROWS are nearly identical —
    on hard maple the mean row-to-row difference is 0.22 grey levels — and
    dividing by a number that small turns a seam of 0.87 out of 255 into a
    "3.95x" that reads like a failure. It is not one: 0.87 grey levels is below
    what a display can show.

    So the denominator is the tile's own standard deviation, which is the
    contrast a person actually sees when they look at the wood. A seam a fifth
    of that is invisible against the grain beside it; the set currently runs
    between 0.04 and 0.18. The neighbour ratio is still recorded, because it is
    the more sensitive of the two and a regression will move it first.
    """
    f = a.astype(np.float32)
    std = max(1e-6, float(f.reshape(-1, f.shape[-1]).std()))
    col_seam = float(np.abs(f[:, 0, :] - f[:, -1, :]).mean())
    row_seam = float(np.abs(f[0, :, :] - f[-1, :, :]).mean())
    col_local = max(1e-6, float(np.abs(np.diff(f, axis=1)).mean()))
    row_local = max(1e-6, float(np.abs(np.diff(f, axis=0)).mean()))
    return (round(col_seam / std, 3), round(row_seam / std, 3),
            round(col_seam / col_local, 2), round(row_seam / row_local, 2))


# ── the recipe ────────────────────────────────────────────────────────────────

def build(product, photo, box, board_frac, why):
    src = f'{SRC}/{photo}.webp'
    if not os.path.exists(src):
        raise FileNotFoundError(src)
    im = Image.open(src).convert('RGB')
    l, t, r, b = box
    crop = im.crop((int(l * im.width), int(t * im.height),
                    int(r * im.width), int(b * im.height)))
    cw, ch = crop.size

    before, _ = grain_angle(crop)
    turn = 0.0 if off_vertical(before) < 1.0 else (90.0 - abs(before)) * (1 if before >= 0 else -1)
    rotated = crop if turn == 0 else crop.rotate(turn, resample=Image.BICUBIC, expand=True)
    after, _ = grain_angle(rotated)
    if turn != 0 and off_vertical(after) > off_vertical(before):
        # The sign convention is checked, never assumed. See decision 2.
        turn = -turn
        rotated = crop.rotate(turn, resample=Image.BICUBIC, expand=True)
        after, _ = grain_angle(rotated)

    inches_across_box = WIDE_PLANK_INCHES * (r - l) / board_frac
    px_per_inch = cw / inches_across_box

    sw, sh = tallest_inscribed(cw, ch, turn, TILE_ASPECT)
    sw = max(32, int(min(sw, rotated.width) * 0.98))
    sh = max(32, int(min(sh, rotated.height) * 0.98))
    strip = rotated.crop((int((rotated.width - sw) / 2), int((rotated.height - sh) / 2),
                          int((rotated.width - sw) / 2) + sw, int((rotated.height - sh) / 2) + sh))

    flat = flatten(strip, px_per_inch)
    height = max(64, int(round(TILE_WIDTH * flat.height / flat.width)))
    scaled = flat.resize((TILE_WIDTH, height), Image.LANCZOS)
    tile = Image.fromarray(seamless(np.asarray(scaled, dtype=np.float32)))

    inches_across = round(inches_across_box * sw / cw, 2)
    inches_along = round(inches_across * height / TILE_WIDTH, 2)
    final, coherence = grain_angle(tile)
    seam_x, seam_y, near_x, near_y = seam_step(np.asarray(tile))
    return tile, {
        'product': product,
        'file': f'grain-{product}.webp',
        'source': f'{photo}.webp',
        'crop': list(box),
        'why': why,
        'rotateDeg': round(turn, 1),
        'grainDegBefore': round(before, 1),
        'grainDegAfter': round(final, 1),
        'coherence': round(coherence, 3),
        'seamAcross': seam_x,
        'seamAlong': seam_y,
        'seamVsNeighbourAcross': near_x,
        'seamVsNeighbourAlong': near_y,
        'width': TILE_WIDTH,
        'height': height,
        'inchesAcross': inches_across,
        'inchesAlong': inches_along,
        'inchesBasis': f'a wide plank is {WIDE_PLANK_INCHES:g}in and this board fills '
                       f'{board_frac:g} of the frame — an estimate, read off the photograph',
    }



TABLE = 'apps/web/lib/floor-studio/grain.ts'
TABLE_START = '// ── generated by scripts/textures/build-grain.py ──────────────────────────────'
TABLE_END = '// ── end generated ────────────────────────────────────────────────────────────'


def write_table(manifest) -> None:
    """Rewrite the table in grain.ts between its two markers.

    The bundle cannot read a JSON file at module scope, and fetching six small
    integers over the network before the first floor can be drawn is a round
    trip on the critical path. So the numbers exist twice — and two copies of a
    number are only safe if one of them is never typed by a person. This script
    writes both, and grain.test.ts asserts they still agree, which catches the
    one remaining way they can drift: somebody editing the generated block by
    hand instead of re-running this.
    """
    rows = []
    for e in manifest:
        rows.append(
            f"  {{\n"
            f"    product: '{e['product']}',\n"
            f"    file: '{e['file']}',\n"
            f"    width: {e['width']},\n"
            f"    height: {e['height']},\n"
            f"    inchesAcross: {e['inchesAcross']},\n"
            f"    inchesAlong: {e['inchesAlong']},\n"
            f"  }},"
        )
    block = (f'{TABLE_START}\n'
             'export const GRAIN_TILES: readonly GrainTile[] = [\n'
             + '\n'.join(rows) + '\n'
             '] as const;\n'
             f'{TABLE_END}')

    src = open(TABLE, encoding='utf-8').read()
    a = src.index(TABLE_START)
    b = src.index(TABLE_END) + len(TABLE_END)
    open(TABLE, 'w', encoding='utf-8').write(src[:a] + block + src[b:])
    print(f'  {TABLE} rewritten from the manifest')


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(API_OUT, exist_ok=True)
    manifest = []
    worst = 0.0
    worst_seam = 0.0
    for product, photo, box, board_frac, why in CROPS:
        try:
            tile, entry = build(product, photo, box, board_frac, why)
        except FileNotFoundError as exc:
            print(f'  MISSING {exc}', file=sys.stderr)
            return 1
        path = f'{OUT}/{entry["file"]}'
        tile.save(path, 'WEBP', quality=92, method=6)

        api_h = max(16, round(tile.height * API_TILE_WIDTH / tile.width))
        api_path = f'{API_OUT}/grain-{product}.png'
        tile.resize((API_TILE_WIDTH, api_h), Image.LANCZOS).save(api_path, 'PNG', optimize=True)
        entry['apiFile'] = f'grain-{product}.png'
        entry['apiWidth'] = API_TILE_WIDTH
        entry['apiHeight'] = api_h
        entry['mean'] = [round(v) for v in ImageStat.Stat(tile).mean]
        entry['bytes'] = os.path.getsize(path)
        manifest.append(entry)
        worst = max(worst, off_vertical(entry['grainDegAfter']))
        worst_seam = max(worst_seam, entry['seamAcross'], entry['seamAlong'])
        print(f'  grain-{product:<13} {entry["width"]}x{entry["height"]:<5} '
              f'{entry["inchesAcross"]:>5}" x {entry["inchesAlong"]:>6}"  '
              f'grain {entry["grainDegBefore"]:>6}° → {entry["rotateDeg"]:>6}° → '
              f'{entry["grainDegAfter"]:>6}°  coh {entry["coherence"]:.2f}  '
              f'seam {entry["seamAcross"]:.3f}/{entry["seamAlong"]:.3f}  '
              f'{entry["bytes"]:6} B')

    with open(f'{OUT}/grain-manifest.json', 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')

    write_table(manifest)

    print(f'\n{len(manifest)} species tiles → {OUT}')
    print(f'{len(manifest)} PNG copies at {API_TILE_WIDTH}px → {API_OUT}')
    print(f'worst grain angle off vertical: {worst:.1f}°')
    print(f'worst seam, as a fraction of the tile\'s own contrast: {worst_seam:.3f}')
    if worst > 5.0:
        print('  REFUSING: a tile whose grain does not run along the board is the defect '
              'this script exists to remove.', file=sys.stderr)
        return 1
    if worst_seam > 0.25:
        print('  REFUSING: a tile whose wrap stands out against its own grain will print '
              'that line across every board in the room.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
