import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const KEYS = ['RESEND_API_KEY', 'SMTP_HOST', 'VERCEL_ENV'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

const send = async () => (await import('@/lib/email')).sendEmail({ to: 'a@b.ca', subject: 's', html: '<p>x</p>' });

describe('sendEmail without a configured provider', () => {
  it('throws in production so the caller logs a failure instead of silently dropping the lead email', async () => {
    process.env.VERCEL_ENV = 'production';
    await expect(send()).rejects.toThrow(/not configured in production/);
  });
  it('stays a console no-op in development and preview', async () => {
    process.env.VERCEL_ENV = 'preview';
    await expect(send()).resolves.toBeUndefined();
  });
});
