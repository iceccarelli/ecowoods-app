# Why `apps/web/public` is copied into `public/` at build time

**Found:** 8 September 2026, verified against production.

## The defect

Every file under `apps/web/public/` — 422 tracked files — returned **404 in
production**. Not some of them. All of them.

Measured against `https://ecowoods.ca`, on a live deployment, with a
robots-respecting fetcher:

| URL | Lives in | Result |
|---|---|---|
| `/brand/ew-mark-192.png` | `public/` (repo root) | **served** |
| `/icon-192.png` | `apps/web/public/` | **404** |
| `/gallery/ash-herringbone-01-room.webp` | `apps/web/public/` | **404** |
| `/proof/maple-vaughan-curved-stair/ch2/04_….webp` | `apps/web/public/` | **404** |
| `/films/maple-vaughan-curved-stair/01_….mp4` | `apps/web/public/` | **404** |

That is as clean a discriminator as this kind of thing produces: the split is
exactly which of the two `public/` directories the file is in.

## Why

`vercel.json` sets `"outputDirectory": "apps/web/.next"` while the project root
stays the repository root. Vercel builds the app from `apps/web` and then takes
its static asset directory from the **project root** — so `public/` at the top
of the repository is the static root, and `apps/web/public/` is never copied
into the deployment at all.

## Why nobody noticed for months

Because almost nothing referenced these files by a raw path. The gallery, the
illustrations and the proof sliders all reach their images through **`next/image`
static imports** (`apps/web/app/data/slider-images.ts` and friends), and webpack
emits those into `/_next/static/media/…`, which is part of the build output and
therefore does get deployed. Only a raw string path — `src="/gallery/….webp"` —
goes looking in the static root, and until the project photo records shipped
there was almost no such path on the site.

The five files that ARE in the repo-root `public/` are the tell: `brand/`,
`qr-app.jpg`, `review-card.svg` — and `vercel.json` has a `/brand/(.*)`
cache-control rule written specifically for them. Somebody hit this once, moved
the brand assets up a level, and the general case stayed broken.

## The fix

One clause on the build command:

```
"buildCommand": "TURBO_FORCE=true pnpm build && mkdir -p public && cp -R apps/web/public/. public/"
```

`cp -R <src>/. <dst>/` merges the contents rather than nesting a directory, and
it runs after the Next build and before Vercel collects the static root.

**Why not the alternatives.** Setting the Vercel project's *Root Directory* to
`apps/web` is the textbook monorepo answer and is probably where this should end
up — but it is a dashboard setting, it cannot be expressed in this repository,
and it changes install and build resolution for the whole project. That belongs
in a deliberate migration, not in the patch that stops the images 404-ing. A
symlink does not survive git. Moving `apps/web/public` to the repo root breaks
`next/image` in development, which resolves the public directory relative to the
app.

`.gitignore` ignores the synced copies so a local `pnpm build` does not offer to
commit 422 duplicated files, while keeping the five genuinely-tracked root
assets.

## The guard

`scripts/verify-public-assets.mjs` fails the build if the sync clause is removed
from `buildCommand`, and if the same path exists in both trees with different
bytes — which would mean the root copy silently wins over the app one.

**It cannot prove the fix.** `next start` serves `apps/web/public` correctly and
always did, so every local check passes whether or not the deployment is broken.
This one is verified in production or it is not verified — the same lesson the
`Access-Control-Allow-Origin` note in `next.config.js` already records.

## What was affected

- the PWA icons `manifest.webmanifest` points at (`/icon-192.png`, `/icon-512.png`)
- every raw-path reference under `/gallery/`, `/images/`, `/illustrations/`
- the project photo records shipped in MEDIA-01 — 22 stills and 2 films
- `apps/web/public/pdfs/` is empty apart from a `.gitignore`, so no published
  paper PDF was lost
