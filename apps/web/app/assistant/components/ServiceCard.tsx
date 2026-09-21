'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ServiceRecommendation } from '@/lib/assistant-workspace/recommendations';
import { track } from '@/lib/analytics';

/**
 * ServiceCard — one real entry from SERVICES (lib/seo-data.ts), never an
 * invented offering. The price band, when shown, is rendered ONLY through
 * getServicePage()/bandForCountry()/formatBand() — the same published-band
 * pipeline /pricing and every service page already use. It is a published
 * per-square-foot band, not an installed-cost range for this project; that
 * arithmetic is ASSISTANT-04's (calculateProjectRange), not built yet, so a
 * service with no band here links to its own page instead of guessing.
 */
export function ServiceCard({
  recommendation,
  onAdd,
}: {
  recommendation: ServiceRecommendation;
  onAdd: (slug: string) => void;
}) {
  const { service, whyItFits, selected, priceBand } = recommendation;
  const viewed = useRef(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('workspace_product_viewed', { serviceSlug: service.slug });
  }, [service.slug]);

  return (
    <article className="aha-card aha-service-card" aria-label={service.name} data-selected={selected}>
      <div className="aha-card-body">
        <p className="aha-card-title">{service.name}</p>
        <p className="aha-card-note">{service.blurb}</p>
        <p className="aha-card-meta">
          {priceBand ? (
            <>Published band: {priceBand.text}</>
          ) : (
            <Link href={`/services/${service.slug}`}>Price band on the service page</Link>
          )}
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
                Nothing in your project points here yet — tell us what you&rsquo;re planning and this fills in.
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
            onAdd(service.slug);
            track('workspace_service_added', { serviceSlug: service.slug });
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
      </div>
    </article>
  );
}
