'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProductRecommendation } from '@/lib/assistant-workspace/recommendations';
import { track } from '@/lib/analytics';

/**
 * ProductCard — one real catalog entry (FLOOR_PRODUCTS), never an invented
 * SKU. `whyItFits` comes straight from recommendations.ts, itself built only
 * from the product's own fields and real Project Decision State facts.
 *
 * No price on this card. Species don't carry a band — a service does (see
 * ServiceCard) — and estimating an installed cost from a species alone is
 * exactly the per-item multiplier GEO-005 removed. "View in room" is a
 * disabled stub: the Floor Studio bridge is ASSISTANT-06's, not this
 * phase's, and a fake link there would be worse than an honest one.
 */
export function ProductCard({
  recommendation,
  onAdd,
}: {
  recommendation: ProductRecommendation;
  onAdd: (productId: string) => void;
}) {
  const { product, whyItFits, selected } = recommendation;
  const viewed = useRef(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('workspace_product_viewed', { productId: product.id });
  }, [product.id]);

  return (
    <article className="aha-card aha-product-card" aria-label={product.name} data-selected={selected}>
      <div className="aha-card-swatch" style={{ background: product.base, borderColor: product.grain }} aria-hidden="true" />
      <div className="aha-card-body">
        <p className="aha-card-title">{product.name}</p>
        <p className="aha-card-note">{product.note}</p>
        <p className="aha-card-meta">
          {product.durability[0]!.toUpperCase() + product.durability.slice(1)} durability &middot;{' '}
          {product.maintenance} maintenance
        </p>
        {showWhy && (
          <div className="aha-card-why">
            {whyItFits.length > 0 ? (
              <ul>
                {whyItFits.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="aha-card-why-empty">
                Nothing in your project points here yet — tell us more (a room, whether there are stairs, what&rsquo;s
                there now) and this fills in.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="aha-card-actions">
        <button
          type="button"
          className="aha-card-action aha-card-action--primary"
          onClick={() => {
            onAdd(product.id);
            track('workspace_product_added', { productId: product.id });
          }}
          aria-pressed={selected}
        >
          {selected ? 'Selected' : 'Add to project'}
        </button>
        <button
          type="button"
          className="aha-card-action"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
        >
          Why?
        </button>
        <button type="button" className="aha-card-action" disabled aria-disabled="true">
          Compare
        </button>
        <button
          type="button"
          className="aha-card-action"
          disabled
          aria-disabled="true"
          title="Coming in a later phase (ASSISTANT-06)"
        >
          View in room
        </button>
      </div>
    </article>
  );
}
