import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isAuthorizedBearer } from '@/lib/cron-auth';

const req = (authorization?: string) =>
  new Request('https://ecowoods.ca/x', authorization === undefined ? undefined : { headers: { authorization } });

describe('isAuthorizedBearer', () => {
  it('accepts only the exact bearer secret', () => {
    expect(isAuthorizedBearer(req('Bearer s3cret'), 's3cret')).toBe(true);
  });
  it('rejects anonymous, wrong token, wrong length, wrong scheme', () => {
    expect(isAuthorizedBearer(req(), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('Bearer wrong!'), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('Bearer s3cre'), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('Bearer s3crett'), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('s3cret'), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('bearer s3cret'), 's3cret')).toBe(false);
    expect(isAuthorizedBearer(req('Basic s3cret'), 's3cret')).toBe(false);
  });
  it('fails closed when the secret is unset or empty', () => {
    for (const unset of [undefined, null, '']) {
      expect(isAuthorizedBearer(req('Bearer '), unset)).toBe(false);
      expect(isAuthorizedBearer(req('Bearer undefined'), unset)).toBe(false);
      expect(isAuthorizedBearer(req(), unset)).toBe(false);
    }
  });
});

describe('no route compares the bearer secret by hand', () => {
  const appApi = path.join(__dirname, '../app/api');
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'route.ts' ? [path.join(d, e.name)] : [],
    );
  it('every route reading CRON_SECRET goes through isAuthorizedBearer', () => {
    const offenders = walk(appApi).filter((f) => {
      const code = readFileSync(f, 'utf8');
      return code.includes('process.env.CRON_SECRET') && !code.includes('isAuthorizedBearer(');
    });
    expect(offenders).toEqual([]);
    for (const f of walk(appApi)) {
      const code = readFileSync(f, 'utf8');
      if (code.includes('CRON_SECRET')) expect(code, f).not.toMatch(/=== `Bearer|!== `Bearer|timingSafeEqual/);
    }
  });
});
