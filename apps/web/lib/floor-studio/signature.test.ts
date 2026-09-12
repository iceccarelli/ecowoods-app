/**
 * lib/floor-studio/signature.test.ts — what the picture says about where it came from.
 *
 * The drawing itself needs a canvas, so what is held to a test here is the part
 * that can be wrong without anybody noticing: the host. A signature that names
 * a domain this company does not own is worse than no signature at all, and it
 * would be invisible in review because it is one string in a corner.
 */
import { describe, expect, it } from 'vitest';
import { SITE_URL } from '@/lib/seo-data';
import { SITE_HOST } from './signature';

describe('the host the picture is signed with', () => {
  it('comes from SITE_URL and never from a typed string', () => {
    expect(SITE_URL).toContain(SITE_HOST);
  });

  it('has no scheme and no trailing slash — it is a signature, not a link', () => {
    expect(SITE_HOST).not.toContain('://');
    expect(SITE_HOST.endsWith('/')).toBe(false);
    expect(SITE_HOST.length).toBeGreaterThan(4);
  });

  it('is the production host', () => {
    expect(SITE_HOST).toBe('ecowoods.ca');
  });
});
