import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import {
  gscConfig, signAssertion, windowFor, queryPerformance, classifyPage, rollup, nearMisses, type GscRow,
} from './search-console';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const cfg = { clientEmail: 'svc@example.iam.gserviceaccount.com', privateKey, site: 'sc-domain:ecowoods.ca' };

describe('gscConfig', () => {
  it('names exactly what is missing and never invents a connection', () => {
    expect(gscConfig({})).toEqual({ configured: false, missing: ['GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY', 'GSC_SITE'] });
    expect(gscConfig({ GSC_CLIENT_EMAIL: 'a', GSC_SITE: 's' })).toEqual({ configured: false, missing: ['GSC_PRIVATE_KEY'] });
  });
  it('accepts a key written with \\n sequences', () => {
    const st = gscConfig({ GSC_CLIENT_EMAIL: 'a', GSC_SITE: 's', GSC_PRIVATE_KEY: 'line1\\nline2' });
    expect(st.configured && st.config.privateKey).toBe('line1\nline2');
  });
});

describe('signAssertion', () => {
  it('produces a verifiable RS256 JWT with the read-only scope', () => {
    const jwt = signAssertion(cfg, 1_800_000_000);
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claim = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claim).toMatchObject({ iss: cfg.clientEmail, scope: 'https://www.googleapis.com/auth/webmasters.readonly', exp: 1_800_003_600 });
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('windowFor', () => {
  it('ends two days before today and spans exactly the requested days', () => {
    expect(windowFor(28, new Date('2026-10-25T12:00:00Z'))).toEqual({ startDate: '2026-09-26', endDate: '2026-10-23' });
  });
});

describe('queryPerformance', () => {
  it('exchanges the assertion, queries the encoded site and returns rows', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: String(init.body) });
      if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      return new Response(JSON.stringify({ rows: [{ keys: ['https://ecowoods.ca/'], clicks: 3, impressions: 90, ctr: 0.033, position: 7.2 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const rows = await queryPerformance(cfg, { days: 28, dimensions: ['page'] }, f);
    expect(rows).toHaveLength(1);
    expect(calls[1].url).toContain(encodeURIComponent('sc-domain:ecowoods.ca'));
    expect(JSON.parse(calls[1].body)).toMatchObject({ dimensions: ['page'], rowLimit: 1000 });
    expect(calls[0].body).toContain('jwt-bearer');
    expect(calls.map((c) => c.body).join('')).not.toContain('PRIVATE KEY');
  });
  it('fails with a status, not with the response body', async () => {
    const f = (async () => new Response('secret detail', { status: 403 })) as unknown as typeof fetch;
    await expect(queryPerformance(cfg, { days: 7, dimensions: ['page'] }, f)).rejects.toThrow('Google token request failed (403)');
  });
});

describe('classifyPage', () => {
  it('maps URLs to the things decisions are made about', () => {
    expect(classifyPage('https://ecowoods.ca/service-areas/oakville')).toMatchObject({ kind: 'service-area', slug: 'oakville' });
    expect(classifyPage('https://ecowoods.ca/services/hardwood-installation/')).toMatchObject({ kind: 'service', slug: 'hardwood-installation' });
    expect(classifyPage('/guides/hardwood-flooring-cost-toronto')).toMatchObject({ kind: 'guide' });
    expect(classifyPage('https://ecowoods.ca/')).toMatchObject({ kind: 'home' });
    expect(classifyPage('https://ecowoods.ca/estimate')).toMatchObject({ kind: 'estimate' });
    expect(classifyPage('https://ecowoods.ca/press').kind).toBe('other');
  });
});

describe('rollup and nearMisses', () => {
  const rows: GscRow[] = [
    { keys: ['a'], clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
    { keys: ['b'], clicks: 0, impressions: 300, ctr: 0, position: 8 },
    { keys: ['c'], clicks: 1, impressions: 20, ctr: 0.05, position: 6 },
  ];
  it('weights position by impressions and recomputes ctr from totals', () => {
    const [r] = rollup(rows, () => 'all');
    expect(r.clicks).toBe(11);
    expect(r.impressions).toBe(420);
    expect(r.ctr).toBeCloseTo(11 / 420);
    expect(r.position).toBeCloseTo((2 * 100 + 8 * 300 + 6 * 20) / 420);
  });
  it('flags shown-but-not-chosen pages only when there is real volume', () => {
    expect(nearMisses(rows).map((r) => r.keys[0])).toEqual(['b']);
    expect(nearMisses(rows, 500)).toEqual([]);
  });
});
