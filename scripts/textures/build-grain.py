#!/usr/bin/env python3
"""
scripts/textures/build-grain.py — real wood, cut from real photographs.

WHAT THIS PRODUCES

apps/web/public/textures/grain-<species>.webp — one seamless 512x512 tile per
catalogue species, cut from apps/web/public/gallery/<species>-wideplank-02-detail.webp,
which is a photograph of that actual product on an actual floor.

The renderer samples these in BOARD-LOCAL INCHES, so one texture serves every
pattern: straight, diagonal, herringbone and chevron all hand back the same two
numbers in their own block's frame, and the grain runs along each piece the way
it does on a real floor. The catalogue's geometry draws the seams and the
bevels; the photograph supplies the face.

THREE DECISIONS, AND WHY EACH ONE IS NOT AUTOMATIC

1. THE CROP IS NAMED, NOT SEARCHED. Two scoring functions were tried and both
   picked a seam: one rewarded axial gradient, which is exactly what a board
   seam is, and the next rewarded grain over hard edges, which still landed on
   a bevel in three species out of five. A seam inside the texture is repeated
   inside every board — white oak came out as dense vertical stripes. Twelve
   photographs is not a dataset; it is five decisions, so they are made here, by
   eye, and written down with the reason.

2. THE LIGHT IS DIVIDED OUT. These are photographs of rooms with windows, and
   several carry a hard shadow. Pasted into somebody else's room that shadow is
   a false statement about their light — and the renderer multiplies their own
   light in afterwards, so it would be applied twice. Dividing by a heavily
   blurred copy removes the low-frequency illumination and keeps grain, figure
   and knots.

3. IT TILES WITHOUT A MIRROR. Reflecting a crop makes its edges match, and makes
   a chevron out of any diagonal in it — which then appears inside the straight
   pattern. Wood grain has no symmetry. Blending against a half-period roll
   gives edges that match by construction and no symmetry at all.

Run:  python3 scripts/textures/build-grain.py
"""
from PIL import Image, ImageFilter, ImageStat
import numpy as np
import json, os, sys

SRC = 'apps/web/public/gallery'
OUT = 'apps/web/public/textures'
TILE = 512

# species → (source photo, crop as fractions of the source, why this crop)
CROPS = [
    ('white-oak', 'white-oak-wideplank', (0.02, 0.15, 0.34, 0.85),
     'the left-hand board: clean quartered face, no seam and no bevel in frame'),
    ('red-oak', 'red-oak-wideplank', (0.66, 0.30, 0.98, 0.92),
     'the right-hand board, below the window shadow that crosses the left of the frame'),
    ('black-walnut', 'walnut-wideplank', (0.02, 0.45, 0.45, 0.95),
     'the lower-left quadrant, clear of the mitred joint that runs across the top right'),
    ('hard-maple', 'maple-wideplank', (0.02, 0.70, 0.35, 0.98),
     'the bottom-left corner, below the diagonal joint that crosses the middle of the frame'),
    ('hickory', 'hickory-wideplank', (0.04, 0.06, 0.28, 0.94),
     'the left-hand board: hickory character marks without a seam, which is the species'),
]


def flatten(im: Image.Image, radius: int = 56) -> Image.Image:
    blur = im.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(im, dtype=np.float32)
    b = np.asarray(blur, dtype=np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    return Image.fromarray(np.clip(a * mean / np.maximum(b, 1.0), 0, 255).astype(np.uint8))


def smoothstep(t):
    return t * t * (3 - 2 * t)


def seamless(a: np.ndarray) -> np.ndarray:
    h, w, _ = a.shape
    x = np.abs(np.linspace(-1, 1, w, endpoint=False) + 1.0 / w)
    y = np.abs(np.linspace(-1, 1, h, endpoint=False) + 1.0 / h)
    wx = smoothstep(np.clip((0.7 - x) / 0.7, 0, 1))[None, :, None]
    wy = smoothstep(np.clip((0.7 - y) / 0.7, 0, 1))[:, None, None]
    rolled = np.roll(np.roll(a, w // 2, axis=1), h // 2, axis=0)
    m = wx * wy
    return np.clip(a * m + rolled * (1 - m), 0, 255).astype(np.uint8)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for product, photo, (l, t, r, b), why in CROPS:
        src = f'{SRC}/{photo}-02-detail.webp'
        if not os.path.exists(src):
            print(f'  MISSING {src}', file=sys.stderr)
            return 1
        im = Image.open(src).convert('RGB')
        crop = im.crop((int(l * im.width), int(t * im.height),
                        int(r * im.width), int(b * im.height)))
        square = crop.resize((TILE, TILE), Image.LANCZOS)
        tile = Image.fromarray(seamless(np.asarray(flatten(square), dtype=np.float32)))
        path = f'{OUT}/grain-{product}.webp'
        tile.save(path, 'WEBP', quality=90, method=6)
        st = ImageStat.Stat(tile)
        manifest.append({
            'product': product,
            'file': f'grain-{product}.webp',
            'source': f'{photo}-02-detail.webp',
            'crop': [l, t, r, b],
            'why': why,
            'mean': [round(v) for v in st.mean],
            'bytes': os.path.getsize(path),
        })
        print(f'  grain-{product:<14} {os.path.getsize(path):6} B  mean {[round(v) for v in st.mean]}  {why}')

    with open(f'{OUT}/grain-manifest.json', 'w') as fh:
        json.dump(manifest, fh, indent=2)
    print(f'\n{len(manifest)} species textures at {TILE}x{TILE} → {OUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
