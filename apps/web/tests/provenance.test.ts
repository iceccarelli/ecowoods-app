import { describe, it, expect } from 'vitest';
import { getRegistry, FACTS_VERIFIED_AT } from '@/lib/registry';
import { MARKETS } from '@/lib/geo';

/**
 * Two dates that mean different things, and the day they stopped agreeing.
 *
 * `facts_verified_at` is the day a person last re-read the NAP, hours, founding
 * year and price bands on the live host. `updated_at` is the freshest thing in
 * the registry — what a consumer keys a cache on.
 *
 * `updated_at` was computed from reviews, prices and evidence and NOT from
 * locations, so the day twenty-six New York markets and forty-four pages landed
 * it did not move. The API reported 2026-09-05 through the largest factual
 * change the site has had, and anything caching on it would still be serving the
 * old territory.
 */
describe('registry freshness', () => {
  it('moves updated_at when the geography moves', async () => {
    const reg = await getRegistry();
    const newestMarket = MARKETS
      .map((m) => m.operationalTruth.verifiedAt)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1)!;
    expect(reg.updated_at >= newestMarket, `updated_at ${reg.updated_at} is older than the newest market confirmation ${newestMarket}`).toBe(true);
  });

  it('does not drag facts_verified_at along with it', async () => {
    // It means one specific thing. Moving it to look fresh is the exact
    // dishonesty its own comment forbids, and it is the field an agent reads to
    // decide whether the phone number can be trusted.
    const reg = await getRegistry();
    expect(reg.facts_verified_at).toBe(FACTS_VERIFIED_AT);
    expect(reg.updated_at >= reg.facts_verified_at).toBe(true);
  });

  it('gives every location the confirmation date of its own market', async () => {
    const reg = await getRegistry();
    for (const loc of reg.locations) {
      const market = MARKETS.find((m) => m.slug === (loc.data as { slug: string }).slug);
      if (!market?.operationalTruth.verifiedAt) continue;
      expect(loc.provenance.verified_at, (loc.data as { slug: string }).slug)
        .toBe(market.operationalTruth.verifiedAt);
    }
  });

  it('reports a later date for a market confirmed later', async () => {
    // The whole point: one date for the whole set could not say that Buffalo
    // was confirmed after Oakville was.
    const reg = await getRegistry();
    const at = (slug: string) =>
      reg.locations.find((l) => (l.data as { slug: string }).slug === slug)?.provenance.verified_at;
    expect(at('buffalo')!).toBeDefined();
    expect(at('buffalo')! > at('oakville')!).toBe(true);
  });
});
