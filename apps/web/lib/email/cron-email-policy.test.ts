import { describe, expect, it } from 'vitest';
import { cronEmailBackoffSeconds, CRON_EMAIL_MAX_ATTEMPTS, sanitizeProviderError, SendTimeoutError, withTimeout } from './cron-email-policy';

describe('cron email policy', () => {
  it('backs off 1h, 3h, 6h, 12h after attempts 1..4, well inside the 24h idempotency window', () => {
    const waits = [1, 2, 3, 4].map(cronEmailBackoffSeconds);
    expect(waits).toEqual([3600, 10800, 21600, 43200]);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThan(24 * 3600);
    expect(CRON_EMAIL_MAX_ATTEMPTS).toBe(5);
  });

  it('redacts every email-looking string, then truncates to 300 characters', () => {
    const out = sanitizeProviderError(
      new Error('You can only send testing emails to your own email address (owner@secret.test), not "Pat.Smith+x@Example.CA"; also <a@b.co>.'),
    );
    expect(out).toBe('You can only send testing emails to your own email address ([email]), not "[email]"; also <[email]>.');
    expect(out).not.toContain('@');

    const long = sanitizeProviderError(new Error(`${'z'.repeat(295)} victim@example.test tail`));
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long).not.toContain('victim');
    expect(sanitizeProviderError('plain @handle text')).not.toContain('@');
    expect(sanitizeProviderError(undefined)).toBe('unknown');
  });

  it('withTimeout rejects with an unknown-outcome error', async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toBeInstanceOf(SendTimeoutError);
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });
});
