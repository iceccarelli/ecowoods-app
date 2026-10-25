/**
 * lib/geo/market-demand.ts — the leads this business actually received, laid
 * against the market registry. Counts only: a city string and a number, never a
 * name, email, phone or address.
 *
 * A lead's city is matched to a market by its exact name (case- and
 * punctuation-insensitive). Anything that does not match a registered market is
 * returned as `unmatched` rather than guessed at — that list is the evidence for
 * demand outside the registry, and the one place a "Mississauga, ON" typo shows
 * up instead of vanishing.
 */
import type { Market } from '@/content/geo/markets';

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export interface DemandRow { city: string | null; count: number }

export interface MarketDemand {
  /** Leads per market slug (a district keeps its own count; nothing is rolled up). */
  byMarket: Map<string, number>;
  /** Cities that matched no market, with counts, largest first. */
  unmatched: Array<{ city: string; count: number }>;
  /** Leads with no city at all. */
  noCity: number;
  total: number;
}

export function matchLeadsToMarkets(rows: DemandRow[], markets: Market[]): MarketDemand {
  /* Two markets sharing a name across the border (Niagara Falls) are matched by country-specific slug text. */
  const bySlugName = new Map<string, string[]>();
  for (const m of markets) {
    const k = norm(m.name);
    bySlugName.set(k, [...(bySlugName.get(k) ?? []), m.slug]);
  }
  const byMarket = new Map<string, number>();
  const unmatched = new Map<string, number>();
  let noCity = 0;
  let total = 0;
  for (const r of rows) {
    total += r.count;
    if (!r.city || !norm(r.city)) { noCity += r.count; continue; }
    const slugs = bySlugName.get(norm(r.city));
    /* An ambiguous name (two markets) is not guessed: it is reported as unmatched. */
    if (slugs && slugs.length === 1) byMarket.set(slugs[0], (byMarket.get(slugs[0]) ?? 0) + r.count);
    else unmatched.set(r.city.trim(), (unmatched.get(r.city.trim()) ?? 0) + r.count);
  }
  return {
    byMarket,
    unmatched: [...unmatched].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
    noCity,
    total,
  };
}
