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

`/v1/floors` returns the live catalogue: 5 species, 5 finishes, 4 patterns,
4 board widths, with the ids the other endpoints take. Read it rather than
hardcoding ids.

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

## What this does not do yet, stated plainly

- **Billing reads the log stream.** Every request writes one JSON line
  (`render_api.request`) with the key, route, status, duration and pixel count,
  and Fly ships stdout. That is a real record and it is not a ledger. A durable
  table in the app's Postgres is the next slice; nothing here changes for it,
  because the line is already the shape of a row.
- **The rate limiter is per process.** `fly.toml` pins `max_machines_count = 1`
  for exactly that reason: a second machine would silently double every
  caller's limit. Raise it only together with a shared counter.
- **No JPEG, no WebP, no HEIC.** See above.
- **Nothing is stored.** The photograph is decoded, rendered and dropped. That
  is a deliberate consequence of the privacy design in `room.ts` — PIPEDA case
  summary #2006-349 treats photographs of a dwelling's interior as personal
  information about the person who lives there — and it is worth telling a
  prospective customer, because it is their liability too.
