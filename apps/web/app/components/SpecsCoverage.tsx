'use client';

/**
 * SpecsCoverage — "Species & Technical Specs" + "Serving the entire GTA",
 * merged into one panel.
 *
 * Why merge: both were reference material — the answers you go looking for once
 * you're already interested. They sat as two separate cards back to back, each
 * costing a full section of scroll, neither strong enough to earn one. AWS puts
 * exactly this class of content behind tabs (pricing, specs, regions): one
 * container, one heading, switch the pane.
 *
 * What each pane must still say — the merge is only worth it if nothing is lost:
 *   Species  -> mastery + sourcing. "Over 40 species... if it exists we can
 *               source it." Janka numbers are the proof it is a trade, not taste.
 *   Coverage -> reach + consistency. "Same crew, same fixed pricing." The map
 *               makes it instant: a homeowner finds their own neighbourhood and
 *               stops wondering.
 *
 * Species leads because it is the wider audience: everyone choosing a floor
 * wants it; only locals-checking-coverage want the map. The map is one tap away
 * — "shown if wanted", never imposed.
 */

import { useId, useState } from 'react';
import CoverageMap from './CoverageMap';

export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
};

type Pane = 'species' | 'coverage';

export default function SpecsCoverage({
  species,
  areas,
}: {
  species: Species[];
  areas: string[];
}) {
  const [pane, setPane] = useState<Pane>('species');
  const uid = useId();

  const tab = (id: Pane, label: string, sub: string) => (
    <button
      type="button"
      role="tab"
      id={`${uid}-${id}-tab`}
      aria-selected={pane === id}
      aria-controls={`${uid}-${id}-panel`}
      className={`sx-tab ${pane === id ? 'is-on' : ''}`}
      onClick={() => setPane(id)}
    >
      <span className="sx-tab-label">{label}</span>
      <span className="sx-tab-sub">{sub}</span>
    </button>
  );

  return (
    <section className="section-tight" id="species">
      {/* #areas kept as an anchor: the footer and nav still link to it */}
      <span id="areas" className="sx-anchor" aria-hidden="true" />

      <div className="shell">
        <div className="sx reveal">
          <div className="sx-head">
            <span className="eyebrow">The Detail</span>
            <h2 className="sx-title">
              What we work with. <span className="serif-italic">Where we work.</span>
            </h2>
          </div>

          <div className="sx-tabs" role="tablist" aria-label="Specifications and coverage">
            {tab('species', 'Species & Specs', 'Over 40 stocked and sourced')}
            {tab('coverage', 'Where We Work', 'All 16 GTA municipalities')}
          </div>

          {pane === 'species' && (
            <div
              className="sx-panel"
              role="tabpanel"
              id={`${uid}-species-panel`}
              aria-labelledby={`${uid}-species-tab`}
            >
              <div className="species-table">
                {species.map((sp) => (
                  <div className="species-row" key={sp.id}>
                    <div className="species-name">{sp.name}</div>
                    <div className="species-spec">
                      {sp.hardness} · {sp.origin}
                    </div>
                    <div className="species-vibe">{sp.vibe}</div>
                  </div>
                ))}
              </div>
              <p className="sx-note">
                Reclaimed barn board, exotic species, smoked or fumed oak — if it exists, we can
                source it. Samples are brushed on your subfloor at the free consultation, so you
                choose in your own light, not ours.
              </p>
            </div>
          )}

          {pane === 'coverage' && (
            <div
              className="sx-panel"
              role="tabpanel"
              id={`${uid}-coverage-panel`}
              aria-labelledby={`${uid}-coverage-tab`}
            >
              <CoverageMap areas={areas} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
