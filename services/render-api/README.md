# Ecowoods Render API

Send a photograph of a room and a floor specification. Get the room back with
that floor in it.

This is the same renderer that runs on ecowoods.ca, exposed as something other
people can pay to call. It **imports** `apps/web/lib/floor-studio/render.ts` and
`room.ts` rather than copying them: a second copy is how the product a customer
pays for and the product on the site stop being the same thing.

---

## Why this is a service and not a Vercel function

Measured in this repository, on one core, per request:

| image | decode | render | encode | total | renders/min/core |
|-------|-------:|-------:|-------:|------:|-----------------:|
| 640×480   |  11ms |  62ms |  23ms |  96ms | 624 |
| 1280×960  |  35ms | 190ms |  84ms | 309ms | 194 |
| 1600×1200 |  66ms | 301ms | 129ms | 496ms | 121 |
| 2048×1536 |  85ms | 561ms | 215ms | 862ms |  69 |

That is CPU, not waiting. A serverless function bills wall-clock, cold-starts
per request and caps out; a Fly machine is a warm process that holds the
catalogue in memory and costs the same whether it renders once or ten thousand
times. `primary_region = "yyz"` is Toronto, where the customers are.

`shared-cpu-2x` at 2GB was $10.70/month and `performance-1x` $31/month when this
was written — check <https://fly.io/docs/about/pricing/>, it moves. At 2GB
shared-cpu-2x the table above says roughly 190 renders a minute at 1280×960
before the queue builds, which is the rung to leave it on until p95 says
otherwise.

## Running its tests

```bash
pnpm test:render-api          # from the repository root
```

**This service needs Node 22.6 or newer, and the devcontainer pins node:20.**
It is TypeScript that Node strips at load time, which is what
`--experimental-strip-types` does, and that flag arrived in 22.6. On Node 20 the
answer is `node: bad option: --experimental-strip-types`, which says nothing
about versions; scripts/render-api-test.mjs checks first and says what is
actually wrong.

Production is unaffected — the Dockerfile pins `node:24-slim` — and so is the
website, which touches none of this. What cannot be done on Node 20 is running
or testing this service locally. Either use the image it deploys from:

```bash
docker run --rm -v "$PWD":/app -w /app node:24-slim \
  node --experimental-strip-types scripts/render-api-test.mjs
```

or raise `.devcontainer/devcontainer.json` to `node:22-bookworm` and rebuild.
That second one changes the environment for everything else in this repository,
so it belongs to whoever owns the repository rather than to this README.

NOT `pnpm --filter @ecowoods/render-api test`, which answers "No projects
matched the filters" — `services/*` is not in `pnpm-workspace.yaml`, so this
package is not a workspace member and pnpm cannot see it.

That is deliberate, and it is the same decision as the section below. Adding
`services/*` to the workspace adds an importer entry to `pnpm-lock.yaml`, and
this repository installs with `--frozen-lockfile`: a lockfile that does not
match the workspace fails the install for everyone, everywhere, including every
other agent working in this tree. A package with no dependencies gains nothing
from being an importer. It gains a script at the root, which is what it has.

## Zero dependencies, deliberately

`package.json` has no dependencies and there is no build step. The repository
installs with `pnpm install --frozen-lockfile`, and **one new package anywhere
in the workspace makes the lockfile stale and fails that command for everyone**.
So: the HTTP server is `node:http`, the PNG codec is `node:zlib` (`src/png.ts`),
auth is `node:crypto`, and TypeScript runs through Node's own type stripping.

`src/png.ts` is proven pixel-exact against `sharp` in both directions, across
all five PNG scanline filters, RGB and RGBA.

## Deploying

```bash
fly launch --no-deploy --copy-config --name ecowoods-render-api
fly secrets set RENDER_API_KEYS="acme:$(printf %s "$SECRET" | shasum -a 256 | cut -d' ' -f1):200"
fly deploy --dockerfile services/render-api/Dockerfile
fly logs                      # the usage lines are the billing record
```

Build the context from the repository ROOT, not from this directory — the
service imports the renderer out of `apps/web`, which is the point.

## Authentication

```
Authorization: Bearer ew_live_<id>_<secret>
```

Keys live in `RENDER_API_KEYS` as `id:sha256-of-secret:requests-per-minute`,
comma separated. **The secret is never stored** — only its SHA-256 — so a
leaked environment does not leak a working key, and the comparison is
timing-safe.

## Endpoints

### `GET /health` · `GET /v1/floors` — open, no key

`/v1/floors` returns the live catalogue: every species, finish, pattern and
board width, with the ids the other endpoints take, and a `photographed` flag
per species saying whether that floor renders from a photograph of the wood or
from the catalogue's two pigments. Read it rather than hardcoding ids — the list
grows.

`/health` also reports how many grain tiles decoded at boot. A missing tile is
not an outage: that species renders from its pigments instead, which is a
plainer floor and not a broken one. It is reported rather than hidden.

### `GET /v1/plate` — a floor, with no photograph required

```bash
curl -G https://ecowoods-render-api.fly.dev/v1/plate \
  -H "Authorization: Bearer ew_live_<id>_<secret>" \
  -d species=hickory -d pattern=herringbone -d width=7 -d finish=satin \
  -d w=1200 -d h=900 \
  -o hickory-herringbone.png
```

`/v1/render` needs a room. That is the flagship and it is useless to anybody who
has not taken a photograph yet — which is everybody, on the first page they land
on. This draws the floor on its own, under a real perspective camera in a
synthesised room, from a query string. One GET, no body, no upload.

The answer is a pure function of the query string, so it is returned
`immutable` with a one-year max-age. Put it straight in an `<img src>` on a
catalogue page and a CDN pays for each variant once, not once per visitor.

| parameter | default | notes |
| --- | --- | --- |
| `species` | — | required; see `/v1/floors` |
| `pattern` | `straight` | straight, diagonal, herringbone, chevron |
| `width` | `5` | board width id, not inches |
| `finish` | `satin` | |
| `w`, `h` | 1200 × 900 | capped at `MAX_PLATE_PIXELS` (default 2.4M) |
| `pitch` | 18 | degrees the lens is tilted down, 2–40 |
| `eye` | 48 | lens height above the floor, inches, 18–96 |
| `fov` | 62 | horizontal field of view, degrees, 20–100 |
| `wall` | on | `wall=0` replaces the wall with flat white |

`x-grain-source` on the response says `photograph` or `catalogue-pigment`, so a
caller can tell which they got without looking at the picture.

The camera is a camera: 48 inches is the seated eye line interiors are shot
from, 62 degrees is a 28mm lens on full frame, and the wall line is a
consequence of the pitch rather than four corners chosen by eye.

That matters for two things people will want. **Floor edge to edge, no horizon:**
raise `pitch` past the point where the wall line leaves the top of the frame —
about 24 degrees on a 4:3 plate, and `pitch=35` is safely past it at any aspect.
Do not use `wall=0` for this; it paints flat white where the wall was, which is
for compositing your own background behind the floor, and above the horizon
there is no floor to draw at any tilt. **A tighter crop of the boards:** lower
`fov`. A long lens flattens the perspective and fills the frame with wood, which
is what a catalogue thumbnail wants; the default 62 degrees is a room.

### `POST /v1/analyse` — what the photograph contains

```bash
curl -X POST https://ecowoods-render-api.fly.dev/v1/analyse \
  -H "Authorization: Bearer $KEY" -H 'content-type: image/png' \
  --data-binary @room.png
```

Returns the room's light level, wall colour, existing floor tone, a suggested
floor quad, and `confidence: "measured" | "weak"`. **It does not return a square
footage.** A single uncalibrated photograph with no object of known size in it
cannot yield an area, and every product in this category that claims otherwise
is guessing. Ask the customer.

### `POST /v1/render` — the floor, in the room

```bash
curl -X POST https://ecowoods-render-api.fly.dev/v1/render \
  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"image":"<base64 png>","species":"white-oak","finish":"satin",
       "pattern":"herringbone","width":"5",
       "quad":[{"x":0.18,"y":0.46},{"x":0.82,"y":0.46},{"x":1,"y":1},{"x":0,"y":1}]}'
```

`quad` is optional; omitted, it is estimated. Returns `image/png` and
`x-painted-fraction` — the share of the quad that was actually floor. **Below
about 0.5 the photograph is mostly furniture**, and a caller should say so
rather than present the result as a floor.

## PNG in, PNG out — and JPEG is not supported

Decoding JPEG cannot be done without a dependency, and this service has none.
A camera photo converts in one line before you send it:

```js
const png = await new Promise(r => canvas.toBlob(r, 'image/png'));
```

16-bit, palette and interlaced PNG are refused **by name**, not silently.

Out, the encoder uses Sub filtering, and `/v1/plate` drops the alpha channel
because a plate is opaque by construction. Measured on a 900×675 hickory plate:
710 KB with neither, 518 KB with both — 27% off every byte the endpoint serves,
for one subtraction per byte. Egress is metered; the renderer is where the time
goes, but the wire is where some of the money does.

## What this does not do yet, stated plainly

- **Billing reads the log stream.** Every request writes one JSON line
  (`render_api.request`) with the key, route, status, duration and pixel count,
  and Fly ships stdout. That is a real record and it is not a ledger. A durable
  table in the app's Postgres is the next slice; nothing here changes for it,
  because the line is already the shape of a row.
- **The rate limiter is per process.** `fly.toml` pins `max_machines_count = 1`
  for exactly that reason: a second machine would silently double every
  caller's limit. Raise it only together with a shared counter.
- **No JPEG, no WebP, no HEIC.** See above. This is also why the grain tiles
  exist twice: the website serves webp and this service reads PNG copies of the
  same tiles, cut by the same script from the same photographs, at a quarter of
  the linear resolution. What is *not* duplicated is their size in inches, which
  is imported — two copies of that number would be two chances for the website's
  floor and the API's floor to be different floors.
- **Nothing is stored.** The photograph is decoded, rendered and dropped. That
  is a deliberate consequence of the privacy design in `room.ts` — PIPEDA case
  summary #2006-349 treats photographs of a dwelling's interior as personal
  information about the person who lives there — and it is worth telling a
  prospective customer, because it is their liability too.
