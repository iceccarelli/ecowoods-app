/**
 * scripts/verify-live-deploy.mjs — the public-contract and integration-health
 * checks, run end to end (the real script, as a subprocess) against an
 * in-process fake of the site. Proves each defect is reported as a CONFIRMED
 * failure (exit 1), each blocked/unreachable answer as INCONCLUSIVE (exit 2),
 * a healthy site as exit 0, that endpoints come from the live manifest, and
 * that the script only ever sends GETs and never a credential to the internal
 * route.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';

const script = path.resolve(__dirname, '../../../scripts/verify-live-deploy.mjs');
const SHA = 'a'.repeat(40);

type Req = { method: string; url: string; authorization?: string };
type Reply = { status: number; headers?: Record<string, string>; body?: string };
type Handler = (u: URL, req: http.IncomingMessage) => Reply | undefined;

const SEC = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(self), microphone=()',
};
const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...SEC };
const etagOf = (b: string) => `"${createHash('sha256').update(b).digest('hex').slice(0, 32)}"`;

/** A response with a strong ETag that honours If-None-Match. */
function cond(req: http.IncomingMessage, body: string, headers: Record<string, string>): Reply {
  const etag = etagOf(body);
  const inm = req.headers['if-none-match'];
  if (inm && inm.split(',').map((s) => s.trim()).includes(etag)) return { status: 304, headers: { ...headers, etag } };
  return { status: 200, headers: { ...headers, etag }, body };
}

const state = {
  services: [{ id: 'service:a' }, { id: 'service:b' }],
  prices: [{ id: 'price:a' }],
  manifestPaths: ['', '/entity', '/services', '/services/{id}', '/pricing', '/manifest', '/openapi.json', '/service-match'],
  overrides: [] as Handler[],
  requests: [] as Req[],
};

const manifestBody = () =>
  JSON.stringify({
    name: 'm',
    api: { base: 'https://ecowoods.ca/api/v1', endpoints: state.manifestPaths.map((p) => ({ method: 'GET', url: `https://ecowoods.ca/api/v1${p}`, summary: 's' })) },
  });
const listBody = (items: Array<{ id: string }>) =>
  JSON.stringify({ meta: { count: items.length, registry_version: '1.0.0', updated_at: '2026-01-01' }, items });

function site(u: URL, req: http.IncomingMessage): Reply {
  for (const o of state.overrides) {
    const r = o(u, req);
    if (r) return r;
  }
  const p = u.pathname;
  const html = { 'content-type': 'text/html', ...SEC };
  if (p === '/api/deploy-info') return { status: 200, headers: JSON_H, body: JSON.stringify({ commitSha: SHA }) };
  if (p === '/assistant') return { status: 200, headers: html, body: `<h1>${WORKSPACE_ASSISTANT.name}</h1>` };
  if (p === '/') return { status: 200, headers: { ...html, 'strict-transport-security': 'max-age=63072000' }, body: '<html></html>' };
  if (p === '/sitemap.xml' || p === '/robots.txt') return { status: 200, headers: { 'content-type': 'text/plain' }, body: 'x' };
  if (p.startsWith('/api/cron/')) return { status: 401, headers: JSON_H, body: '{"ok":false}' };
  if (p === '/api/health') {
    return {
      status: 200,
      headers: JSON_H,
      body: JSON.stringify({ status: 'ok', checkedAt: new Date().toISOString(), series: [], standards: [], summary: {}, endpoints: {} }),
    };
  }
  if (p === '/api/knowledge') {
    const c = u.searchParams.get('collection');
    if (c === 'services') {
      return cond(req, JSON.stringify({ meta: { collections: ['services', 'pricing'] }, services: [{ id: 's' }] }), JSON_H);
    }
    return { status: 404, headers: JSON_H, body: JSON.stringify({ error: 'unknown_collection', collection: c }) };
  }
  if (p === '/api/v1/manifest') return cond(req, manifestBody(), JSON_H);
  if (p === '/api/v1/services') return cond(req, listBody(state.services), JSON_H);
  if (p === '/api/v1/pricing') return cond(req, listBody(state.prices), JSON_H);
  const one = /^\/api\/v1\/services\/(.+)$/.exec(p);
  if (one) {
    const id = decodeURIComponent(one[1]);
    return state.services.some((s) => s.id === id)
      ? { status: 200, headers: JSON_H, body: JSON.stringify({ id }) }
      : { status: 404, headers: JSON_H, body: JSON.stringify({ error: { code: 'not_found', message: 'x' } }) };
  }
  if (p === '/llms.txt') return { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: `# Ecowoods\n${'x'.repeat(300)}` };
  if (p === '/api/internal/schema-status') {
    return { status: 401, headers: { ...JSON_H, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' }, body: '{"ok":false,"error":"unauthorized"}' };
  }
  return { status: 404, headers: { 'content-type': 'text/plain' }, body: 'nf' };
}

let server: http.Server;
let base = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://x');
    state.requests.push({ method: req.method ?? '', url: u.pathname, authorization: req.headers.authorization });
    const r = site(u, req);
    res.writeHead(r.status, r.headers);
    res.end(req.method === 'HEAD' ? undefined : r.body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  state.services = [{ id: 'service:a' }, { id: 'service:b' }];
  state.prices = [{ id: 'price:a' }];
  state.manifestPaths = ['', '/entity', '/services', '/services/{id}', '/pricing', '/manifest', '/openapi.json', '/service-match'];
  state.overrides = [];
  state.requests = [];
});

function run(): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, '--base', base, '--expect', SHA], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
const on = (pathname: string, reply: Reply | ((req: http.IncomingMessage) => Reply)): Handler => (u, req) =>
  u.pathname === pathname ? (typeof reply === 'function' ? reply(req) : reply) : undefined;

describe('verify-live-deploy — public contract checks', () => {
  it('exits 0 on a healthy site, derives endpoints from the manifest, and only ever GETs', async () => {
    const r = await run();
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain('live deploy verified');
    for (const m of ['/api/health: ok', '/api/knowledge: ', 'ETag + 304 ok', '/api/v1/services: 2 items', '/api/v1/pricing: 1 items', '/llms.txt', 'listed id resolves', '<unknown id>: 404 JSON', 'anonymous -> 401']) {
      expect(r.out).toContain(m);
    }
    expect(state.requests.every((q) => q.method === 'GET')).toBe(true);
    // no credential ever reaches the internal route
    expect(state.requests.filter((q) => q.url.startsWith('/api/internal/')).every((q) => !q.authorization)).toBe(true);
  });

  it('takes collections from the live manifest, not from names in the script', async () => {
    state.manifestPaths = ['/manifest', '/pricing', '/faq'];
    state.overrides.push(on('/api/v1/faq', (req) => cond(req, listBody([{ id: 'faq:1' }]), JSON_H)));
    const r = await run();
    expect(r.code).toBe(0);
    expect(r.out).toContain('/api/v1/pricing: 1 items');
    expect(r.out).toContain('/api/v1/faq: 1 items');
    expect(state.requests.some((q) => q.url === '/api/v1/services')).toBe(false);
  });

  it('does not require an {id} route when the manifest lists none', async () => {
    state.manifestPaths = ['/manifest', '/services', '/pricing'];
    expect((await run()).code).toBe(0);
  });

  it.each([
    ['schema-status answers 200 to an anonymous caller', on('/api/internal/schema-status', { status: 200, headers: JSON_H, body: '{"ok":true}' }), 'publicly readable'],
    ['schema-status is a 500', on('/api/internal/schema-status', { status: 500, body: 'boom' }), 'expected 401'],
    ['schema-status route is not deployed (404)', on('/api/internal/schema-status', { status: 404, body: 'nf' }), 'route not deployed'],
    ['health JSON lost its shape', on('/api/health', { status: 200, headers: JSON_H, body: '{"status":"ok"}' }), 'shape changed'],
    ['health leaks migration state', on('/api/health', { status: 200, headers: JSON_H, body: JSON.stringify({ status: 'ok', checkedAt: new Date().toISOString(), series: [], standards: [], summary: {}, endpoints: {}, migrations: 3 }) }), 'internal state'],
    ['health says down', on('/api/health', { status: 503, headers: JSON_H, body: JSON.stringify({ status: 'down', checkedAt: new Date().toISOString(), series: [], standards: [], summary: {}, endpoints: {} }) }), 'reports "down"'],
    ['knowledge ignores If-None-Match', on('/api/knowledge', (req) => (req.headers['if-none-match'] ? { status: 200, headers: { ...JSON_H, etag: '"x"' }, body: '{}' } : { status: 200, headers: { ...JSON_H, etag: '"x"' }, body: JSON.stringify({ meta: { collections: ['services'] }, services: [{ id: 's' }] }) })), 'expected 304'],
    ['knowledge has no ETag', on('/api/knowledge', { status: 200, headers: JSON_H, body: JSON.stringify({ meta: { collections: ['services'] }, services: [{ id: 's' }] }) }), 'no ETag'],
    ['knowledge returns the corpus for an unknown collection', (u: URL) => (u.pathname === '/api/knowledge' && u.searchParams.get('collection') === 'zz-no-such-collection' ? { status: 200, headers: JSON_H, body: '{}' } : undefined), 'unknown collection returned 200'],
    ['manifest ETag is missing', on('/api/v1/manifest', { status: 200, headers: JSON_H, body: manifestBody() }), '/api/v1/manifest has no ETag'],
    ['a listed collection is empty', on('/api/v1/pricing', (req) => cond(req, listBody([]), JSON_H)), 'meta.count > 0'],
    ['a listed endpoint 404s', on('/api/v1/pricing', { status: 404, headers: JSON_H, body: '{}' }), 'listed in the manifest but returned 404'],
    ['an unknown id returns 200', (u: URL) => (u.pathname.startsWith('/api/v1/services/ecowoods-no-such-id') ? { status: 200, headers: JSON_H, body: '{}' } : undefined), 'expected 404'],
    ['an unknown id 404 is not JSON', (u: URL) => (u.pathname.startsWith('/api/v1/services/ecowoods-no-such-id') ? { status: 404, headers: { 'content-type': 'text/html' }, body: JSON.stringify({ error: { code: 'not_found' } }) } : undefined), 'not application/json'],
    ['llms.txt is a 404', on('/llms.txt', { status: 404, body: 'nf' }), '/llms.txt returned 404'],
    ['security headers are missing on /', on('/', { status: 200, headers: { 'content-type': 'text/html', 'permissions-policy': 'camera=(self)' }, body: 'x' }), 'security headers on /'],
  ])('exits 1 (confirmed failure) when %s', async (_name, handler, expected) => {
    state.overrides.push(handler as Handler);
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.err).toContain(expected);
  });

  it.each([
    ['schema-status is blocked by a WAF (403)', on('/api/internal/schema-status', { status: 403, body: 'blocked' })],
    ['schema-status 401 comes from something else', on('/api/internal/schema-status', { status: 401, headers: { 'content-type': 'text/html' }, body: 'login' })],
    ['health is a gateway error (502)', on('/api/health', { status: 502, body: 'bad gateway' })],
    ['the manifest is rate limited (429)', on('/api/v1/manifest', { status: 429, body: 'slow down' })],
    ['llms.txt is a 504', on('/llms.txt', { status: 504, body: 'timeout' })],
  ])('exits 2 (inconclusive, never green) when %s', async (_name, handler) => {
    state.overrides.push(handler);
    const r = await run();
    expect(r.code).toBe(2);
    expect(r.err).toContain('INCONCLUSIVE');
    expect(r.out).not.toContain('live deploy verified');
  });

  it('a confirmed failure outranks an inconclusive check', async () => {
    state.overrides.push(on('/llms.txt', { status: 404, body: 'nf' }), on('/api/health', { status: 502, body: 'bg' }));
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.err).toContain('[unknown]');
  });
});
