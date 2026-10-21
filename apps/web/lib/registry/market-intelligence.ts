/**
 * lib/registry/market-intelligence.ts — the INTERNAL market model.
 *
 * Expansion priorities, the opportunity scoring model and its inputs, the
 * content queue and the per-market blockers describe where the business may
 * invest next. They are working material, not customer information, so they
 * are served only from /api/internal/market-intelligence behind the bearer
 * CRON_SECRET and are referenced by no public surface (sitemap, llms*,
 * OpenAPI, manifest, /api/v1).
 *
 * Boundary note: the repository is public, so this module and the data under
 * content/geo are readable in source. Moving the report behind a secret stops
 * the deployed site publishing it; it does not make the source confidential.
 */
import {
  MARKETS,
  assess as assessMarket,
  contentQueue,
  expansionOrder,
  opportunityOrder,
  unsourcedInputs,
  MIN_CONFIDENCE,
} from '@/lib/geo';
import { INPUT_SPECS } from '@/content/geo/market-inputs';
import { allocation } from '@/lib/geo/allocation';

export function buildMarketIntelligence(country: string | null = null) {
  let rows = opportunityOrder(MARKETS);
  if (country === 'CA' || country === 'US') rows = rows.filter((x) => x.country === country);
  return {
    internal: true,
    model: {
      minimum_confidence_to_classify: MIN_CONFIDENCE,
      weights: INPUT_SPECS.map((x) => ({
        id: x.id, weight: x.weight, measures: x.measures, kind: x.kind, obtainable_from: x.obtainableFrom,
      })),
      unsourced_inputs: unsourcedInputs().map((x) => ({
        id: x.id, weight: x.weight, obtainable_from: x.obtainableFrom,
      })),
    },
    allocation: {
      target: { canada: 0.8, united_states: 0.2 },
      measured: allocation().map((x) => ({
        measure: x.measure, canada: x.ca, united_states: x.us, canada_share: x.caShare, means: x.means,
      })),
    },
    markets: rows.map((x) => ({
      slug: x.slug,
      name: x.name,
      country: x.country,
      score: x.score,
      partial_score: x.partialScore,
      confidence: x.confidence,
      classification: x.classification,
      reason: x.reason,
      components: x.components.map((c) => ({ id: c.id, weight: c.weight, score: c.score, source: c.source })),
      missing: x.missing.map((c) => ({ id: c.id, weight: c.weight, obtainable_from: c.obtainableFrom })),
    })),
    page_blockers: MARKETS.map((m) => {
      const w = assessMarket(m);
      return { slug: m.slug, status: m.status, has_page: w.indexable, why_no_page: w.indexable ? null : w.blockers };
    }),
    content_queue: contentQueue(MARKETS)
      .slice(0, 10)
      .map((w) => ({ slug: w.slug, score: w.score, blockers: w.blockers })),
    expansion_order: expansionOrder(MARKETS)
      .slice(0, 12)
      .map((e) => ({ slug: e.slug, name: e.name, score: e.score, components: e.components, next_action: e.nextAction })),
    expansion_score_excludes: expansionOrder(MARKETS)[0]?.missing ?? [],
  };
}
