/**
 * services/render-api/src/server.ts — the room visualiser, as something to sell.
 *
 * WHAT THIS IS
 *
 * Ecowoods already renders a chosen floor into a photograph of a room. That
 * code is pure — lib/floor-studio/render.ts and room.ts take raw pixels and
 * return raw pixels, with no React, no Next and no database anywhere in the
 * path — which is what makes it sellable to somebody else's website without
 * lifting it out of this repository. This service IMPORTS those functions. It
 * does not copy them. A second copy of the renderer is how the product a
 * customer pays for and the product on ecowoods.ca stop being the same thing.
 *
 * WHY FLY AND NOT VERCEL
 *
 * Measured in this repository: a 640×480 composite is ~35ms of pure CPU, and a
 * still photograph from a phone is several times that. A Vercel function is
 * billed by wall-clock, cold-starts per request, and caps out; a Fly machine is
 * a warm process that holds the catalogue in memory and costs a flat rate
 * whether it renders once or ten thousand times. For CPU-bound image work that
 * is the whole difference. fly.toml pins it to Toronto (yyz), which is also
 * where the customers are.
 *
 * ZERO DEPENDENCIES, ON PURPOSE
 *
 * This service has no package.json dependencies. The repository installs with
 * `pnpm install --frozen-lockfile`, and one new package anywhere in the
 * workspace makes the lockfile stale and fails that command everywhere. So the
 * HTTP server is node:http, the PNG codec is node:zlib (src/png.ts), the auth
 * is node:crypto, and TypeScript runs through Node's own type stripping. There
 * is no build step to go wrong between here and production.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { analyseRoom, estimateFloorQuad, type Pixels, type Quad } from '@/lib/floor-studio/room';
import { compositeFloor } from '@/lib/floor-studio/render';
import { FLOOR_PRODUCTS, BOARD_WIDTHS, productById, widthById } from '@/lib/floor-studio/catalog';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { decodePng, encodePng } from './png.ts';
import { parseKeys, verify, RateLimiter, usageLine, type KeyRecord } from './keys.ts';

const PORT = Number(process.env.PORT ?? 8080);
/** A phone photograph at 12MP is 48MB of RGBA; this is the wire limit. */
const MAX_BODY = Number(process.env.MAX_BODY_BYTES ?? 8_000_000);
/** Above this the render is slower than anyone will wait for. Measured, not felt. */
const MAX_PIXELS = Number(process.env.MAX_PIXELS ?? 4_000_000);

const KEYS = parseKeys(process.env.RENDER_API_KEYS);
const limiter = new RateLimiter();
setInterval(() => limiter.sweep(), 120_000).unref();

const json = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(s), ...extra });
  res.end(s);
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let n = 0;
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > MAX_BODY) {
        reject(new Error(`body larger than ${MAX_BODY} bytes`));
        req.destroy();
        return;
      }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

/** A quad from the caller, validated. Absent means: estimate it. */
function readQuad(v: unknown): Quad | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const pts = v.map((p) => {
    const o = p as { x?: unknown; y?: unknown };
    const x = Number(o?.x);
    const y = Number(o?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } : null;
  });
  return pts.every(Boolean) ? (pts as Quad) : null;
}

/* ── the catalogue, so an integrator does not have to guess ids ───────────── */
const catalogue = () => ({
  species: FLOOR_PRODUCTS.map((p) => ({ id: p.id, name: p.name, janka: p.janka })),
  finishes: FINISH_OPTIONS.map((f) => ({ id: f.id, label: f.label })),
  patterns: PATTERN_OPTIONS.map((p) => ({ id: p.id, label: p.label })),
  widths: BOARD_WIDTHS.map((w) => ({ id: w.id, label: w.label, inches: w.inches })),
});

async function handle(req: IncomingMessage, res: ServerResponse, key: KeyRecord | null): Promise<number> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.pathname;

  if (route === '/health') {
    json(res, 200, { ok: true, keys: KEYS.size, uptimeSeconds: Math.round(process.uptime()) });
    return 200;
  }

  if (route === '/v1/floors' && req.method === 'GET') {
    json(res, 200, catalogue(), { 'cache-control': 'public, max-age=300' });
    return 200;
  }

  if (req.method !== 'POST') {
    json(res, 404, { error: 'not_found', message: `no route for ${req.method} ${route}` });
    return 404;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch (e) {
    json(res, 413, { error: 'payload_too_large', message: (e as Error).message });
    return 413;
  }

  /* The photograph is PNG. JPEG decoding cannot be done without a dependency
     and this service has none — a caller converts on a canvas in one line, and
     the README says exactly which line. */
  let px: Pixels;
  let spec: Record<string, unknown> = {};
  try {
    const ct = String(req.headers['content-type'] ?? '');
    if (ct.includes('application/json')) {
      const parsed = JSON.parse(body.toString('utf8')) as Record<string, unknown>;
      spec = parsed;
      const b64 = String(parsed.image ?? '');
      px = decodePng(Buffer.from(b64.replace(/^data:image\/png;base64,/, ''), 'base64'));
    } else {
      px = decodePng(body);
      for (const [k, v] of url.searchParams) spec[k] = v;
    }
  } catch (e) {
    json(res, 400, { error: 'bad_image', message: (e as Error).message });
    return 400;
  }

  if (px.width * px.height > MAX_PIXELS) {
    json(res, 413, { error: 'image_too_large', message: `${px.width}×${px.height} exceeds ${MAX_PIXELS} pixels` });
    return 413;
  }

  if (route === '/v1/analyse') {
    const reading = analyseRoom(px);
    const { quad, confidence } = estimateFloorQuad(px);
    json(res, 200, { width: px.width, height: px.height, reading, quad, confidence });
    return 200;
  }

  if (route === '/v1/render') {
    const productId = String(spec.species ?? spec.productId ?? '');
    const widthId = String(spec.width ?? spec.widthId ?? '5');
    if (!productById(productId)) {
      json(res, 400, { error: 'unknown_species', message: `no such species: ${productId || '(missing)'}`, valid: FLOOR_PRODUCTS.map((p) => p.id) });
      return 400;
    }
    if (!widthById(widthId)) {
      json(res, 400, { error: 'unknown_width', message: `no such width: ${widthId}`, valid: BOARD_WIDTHS.map((w) => w.id) });
      return 400;
    }
    const quad = readQuad(spec.quad) ?? estimateFloorQuad(px).quad;
    const out = compositeFloor(
      px,
      quad,
      {
        productId,
        finishId: String(spec.finish ?? spec.finishId ?? 'satin'),
        patternId: String(spec.pattern ?? spec.patternId ?? 'straight'),
        widthId,
      },
      { squareFeet: Number(spec.squareFeet ?? 400) },
    );
    const png = encodePng(out.pixels);
    res.writeHead(200, {
      'content-type': 'image/png',
      'content-length': png.length,
      /* What fraction of the quad was actually painted. Below about 0.5 the
         photograph is mostly furniture, and the caller should say so rather
         than present the result as a floor. */
      'x-painted-fraction': out.painted.toFixed(4),
    });
    res.end(png);
    return 200;
  }

  json(res, 404, { error: 'not_found', message: `no route for ${req.method} ${route}` });
  return 404;
}

export const server = createServer((req, res) => {
  const started = process.hrtime.bigint();
  const route = new URL(req.url ?? '/', 'http://localhost').pathname;
  const open = route === '/health' || route === '/v1/floors';

  const key = open ? null : verify(req.headers.authorization, KEYS);
  const finish = (status: number, pixels?: number) => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(usageLine({ key: key?.id ?? (open ? 'public' : 'anonymous'), route, status, ms: Math.round(ms * 100) / 100, pixels }));
  };

  if (!open) {
    if (!key) {
      json(res, 401, { error: 'unauthorized', message: 'Authorization: Bearer ew_live_<id>_<secret>' });
      finish(401);
      return;
    }
    const allowance = limiter.take(key);
    if (!allowance) {
      json(res, 429, { error: 'rate_limited', message: `${key.limit} requests per minute` }, { 'retry-after': '60' });
      finish(429);
      return;
    }
    res.setHeader('x-ratelimit-remaining', String(allowance.remaining));
    res.setHeader('x-ratelimit-reset', String(allowance.resetSeconds));
  }

  handle(req, res, key)
    .then((status) => finish(status))
    .catch((e: unknown) => {
      /* Never the stack. An error message from a renderer can carry a file
         path, and this is somebody else's server talking to the internet. */
      console.error(JSON.stringify({ event: 'render_api.error', route, message: e instanceof Error ? e.message : 'unknown' }));
      if (!res.headersSent) json(res, 500, { error: 'internal', message: 'the render failed' });
      finish(500);
    });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(JSON.stringify({ event: 'render_api.listening', port: PORT, keys: KEYS.size })));
}
