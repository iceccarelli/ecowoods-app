'use client';

/**
 * SpecsCoverage — "Species & Technical Specs" + "Serving the entire GTA",
 * merged into one collapsed disclosure.
 *
 * This is reference material: the answers you go looking for once you are
 * already interested. It should cost a visitor ONE row of scroll unless they
 * ask for it. Collapsed by default, two tabs inside, same plus-toggle language
 * as the FAQ and the footer columns — one disclosure idiom across the site.
 *
 * Native <details>/<summary>: no scroll-jacking, keyboard and screen-reader
 * behaviour for free, and the content stays in the DOM (collapsed, not removed)
 * so nothing is lost for SEO.
 *
 * The detail that makes it work: the footer and nav link to #species and
 * #areas. A link that scrolls you to a closed box is a broken link. So a
 * matching hash OPENS the panel — and #areas opens it on the Coverage tab,
 * because that is what the person clicked for.
 */

import { useEffect, useId, useState } from 'react';
import CoverageMap from './CoverageMap';
import SpeciesSwatch from './SpeciesSwatch';

export type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
  /** drop in a URL of your own floor and it replaces the rendered swatch */
  photo?: string;
};

type Pane = 'species' | 'coverage';

export default function SpecsCoverage({
  species,
  areas,
}: {
  species: Species[];
  areas: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('species');
  const uid = useId();

  // A deep link must land on something readable, not a closed box.
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash;
      if (h === '#species' || h === '#areas') {
        setOpen(true);
        if (h === '#areas') setPane('coverage');
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

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
      {/* #areas kept as its own anchor: the footer still links to it */}
      <span id="areas" className="sx-anchor" aria-hidden="true" />

      <div className="shell">
        <details
          className="sx reveal"
          open={open}
          onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="sx-summary">
            <span className="sx-summary-text">
              <span className="eyebrow">The Detail</span>
              <span className="sx-title">
                What we work with. <span className="serif-italic">Where we work.</span>
              </span>
              <span className="sx-hint">
                {species.length} species with Janka ratings, plus every GTA municipality we serve
              </span>
            </span>
            <span className="sx-plus" aria-hidden="true" />
          </summary>

          <div className="sx-body">
            <div className="sx-tabs" role="tablist" aria-label="Specifications and coverage">
              {tab('species', 'Species & Specs', 'Over 40 stocked and sourced')}
              {tab('coverage', 'Where We Work', `All ${areas.length} GTA municipalities`)}
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
                      <SpeciesSwatch id={sp.id} name={sp.name} photo={sp.photo} />
                      <div className="species-body">
                        <div className="species-name">{sp.name}</div>
                        <div className="species-spec">
                          {sp.hardness} · {sp.origin}
                        </div>
                        <div className="species-vibe">{sp.vibe}</div>
                      </div>
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
        </details>
      </div>
    </section>
  );
}
