import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_LEASE_MS,
  CONFIRMATION_MAX_AGE_MS,
  CONFIRMATION_MAX_ATTEMPTS,
  CONFIRMATION_SEND_TIMEOUT_MS,
  confirmationBackoffSeconds,
} from '@/lib/email/order-confirmation-policy';
import { orderConfirmationKey } from '@/lib/email/order-confirmation';

describe('order-confirmation delivery policy', () => {
  it('the lease outlives the provider timeout, so a live attempt is never re-claimed under itself', () => {
    expect(CONFIRMATION_LEASE_MS).toBeGreaterThan(CONFIRMATION_SEND_TIMEOUT_MS * 3);
  });

  it('backoff is positive, non-decreasing and bounded; attempts are bounded', () => {
    let prev = 0;
    for (let n = 1; n <= CONFIRMATION_MAX_ATTEMPTS + 3; n++) {
      const s = confirmationBackoffSeconds(n);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(3600);
      prev = s;
    }
    expect(confirmationBackoffSeconds(0)).toBe(confirmationBackoffSeconds(1));
    expect(CONFIRMATION_MAX_ATTEMPTS).toBeGreaterThan(1);
    expect(CONFIRMATION_MAX_ATTEMPTS).toBeLessThan(20);
  });

  it('the age rule is the 24h horizon of the provider idempotency window, and the key is stable and versioned', () => {
    expect(CONFIRMATION_MAX_AGE_MS).toBe(24 * 3600_000);
    const id = '8f0e2c1a-0000-4000-8000-000000000001';
    expect(orderConfirmationKey(id)).toBe(`order-confirmation/${id}/v1`);
    expect(orderConfirmationKey(id)).toBe(orderConfirmationKey(id));
  });
});
