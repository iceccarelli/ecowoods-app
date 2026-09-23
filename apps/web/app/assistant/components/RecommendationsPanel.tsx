'use client';

import { useMemo } from 'react';
import { recommendProducts, recommendServices, selectionIncompatibilities } from '@/lib/assistant-workspace/recommendations';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { ProductCard } from './ProductCard';
import { ServiceCard } from './ServiceCard';

const RECOMMENDED_PRODUCT_LIMIT = 4;

/**
 * RecommendationsPanel — content for the "See recommendations" drawer
 * opened from ConversationPane's compact contextual card.
 *
 * Was the `.aha-recommended` block ConversationPane rendered permanently
 * inline below EVERY reply once an objective was set — the full ProductCard
 * / ServiceCard grid, always visible whether or not the visitor asked for
 * it. Same `recommendProducts`/`recommendServices`/`selectionIncompatibilities`
 * reads, same cards, now reachable on demand instead of crammed under the
 * chat transcript.
 */
export function RecommendationsPanel() {
  const { state, patch } = useWorkspaceState();
  const products = useMemo(() => recommendProducts(state, RECOMMENDED_PRODUCT_LIMIT), [state]);
  const services = useMemo(() => recommendServices(state), [state]);
  const incompatibilities = useMemo(() => selectionIncompatibilities(state), [state]);

  const onAddProduct = (productId: string) => patch({ targetFloor: { productId } });
  const onAddService = (slug: string) => {
    if (state.selectedServiceSlugs.includes(slug)) return;
    patch({ selectedServiceSlugs: [...state.selectedServiceSlugs, slug] });
  };

  return (
    <div className="aha-drawer-recommendations">
      {incompatibilities.length > 0 && (
        <div className="aha-incompatibility" role="alert">
          {incompatibilities.map((i) => (
            <p key={i.axis}>{i.reason}</p>
          ))}
        </div>
      )}

      <p className="aha-recommended-heading">Floors</p>
      <div className="aha-card-grid">
        {products.map((rec) => (
          <ProductCard key={rec.product.id} recommendation={rec} onAdd={onAddProduct} />
        ))}
      </div>

      <p className="aha-recommended-heading">Services</p>
      <div className="aha-card-grid">
        {services.map((rec) => (
          <ServiceCard key={rec.service.slug} recommendation={rec} onAdd={onAddService} />
        ))}
      </div>
    </div>
  );
}
