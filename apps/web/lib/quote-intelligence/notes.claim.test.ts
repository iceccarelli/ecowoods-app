import { describe, expect, it } from 'vitest';
import {
  INTAKE_LEASE_MS,
  appendReportMarker,
  extractReportUrl,
  extractTierId,
  isIntakeClaimLive,
  isWellInstalledReviewOrder,
  readIntakeClaim,
  stripIntakeClaim,
  withIntakeClaim,
} from './notes';

const tier = 'Well-Installed Quote Review (Rush)';
const token = '11111111-2222-3333-4444-555555555555';

describe('intake claim marker', () => {
  it('round-trips and leaves the tier line and product identity intact', () => {
    const n = withIntakeClaim(tier, token, 1000);
    expect(readIntakeClaim(n)).toEqual({ token, at: 1000 });
    expect(isWellInstalledReviewOrder(n)).toBe(true);
    expect(extractTierId(n)).toBe('rush');
    expect(stripIntakeClaim(n)).toBe(tier);
  });
  it('is live inside the lease and expired after it', () => {
    const n = withIntakeClaim(tier, token, 1000);
    expect(isIntakeClaimLive(n, 1000 + INTAKE_LEASE_MS - 1)).toBe(true);
    expect(isIntakeClaimLive(n, 1000 + INTAKE_LEASE_MS)).toBe(false);
    expect(isIntakeClaimLive(tier, 1000)).toBe(false);
  });
  it('re-claiming replaces the old claim rather than stacking', () => {
    const n = withIntakeClaim(withIntakeClaim(tier, token, 1), '99999999-2222-3333-4444-555555555555', 2);
    expect(n.match(/QI_INTAKE_CLAIM/g)).toHaveLength(1);
  });
  it('coexists with the report marker', () => {
    const n = appendReportMarker(withIntakeClaim(tier, token, 5), 'https://x.test/a.pdf');
    expect(extractReportUrl(n)).toBe('https://x.test/a.pdf');
  });
});
