'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
  DEFAULT_FINISH,
  DEFAULT_PATTERN,
  estimateInstalledRangeCad,
} from '@ecowoods/shared/ai';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';
import { PRICE_PROMISE } from '@/lib/pricing';
import {
  designConfigFromParams,
  designEstimateHref,
  readDesignConfig,
  saveDesignConfig,
  type DesignConfig,
} from '@/lib/design-config';
import { track } from '@/lib/analytics';
import { bandForWork } from '@/content/constants/pricing';

/**
 * SpecSheet — the configuration, rendered as a document.
 *
 * Reads the querystring first (so the sheet is shareable and survives being
 * pasted into an email), then falls back to `ew-design-v1` for somebody who
 * arrives straight from the configurator. Both are read in an effect, never
 * during render — the server has neither, and a mismatch is a hydration error.
 *
 * Janka numbers live here beside the species they belong to for the same reason
 * the price bands live in one module: a hardness figure printed on a
 * specification is a claim, and it should appear in exactly one place. These
 * are the published values already shown in the configurator.
 */

const SPECIES: Record<string, { name: string; janka: string }> = {
  'white oak': { name: 'White Oak', janka: '1360' },
  'red oak': { name: 'Red Oak', janka: '1290' },
  walnut: { name: 'Black Walnut', janka: '1010' },
  maple: { name: 'Hard Maple', janka: '1450' },
  hickory: { name: 'Hickory', janka: '1820' },
};

const cad = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

export function SpecSheet() {
  /* MEAS-04 — the full DesignConfig, not a hand-rolled subset of it.
     The subset was why this page could not use the shared exit builder or
     carry a design id: it had structurally thrown both away before the render
     that needed them. */
  const [cfg, setCfg] = useState<DesignConfig | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    /* One parser, shared with the estimate form, so "what counts as a usable
       configuration in a link" has a single answer. */
    const fromQuery = designConfigFromParams(q);
    if (fromQuery) {
      const filled: DesignConfig = {
        ...fromQuery,
        finish: fromQuery.finish || DEFAULT_FINISH,
        pattern: fromQuery.pattern || DEFAULT_PATTERN,
      };
      setCfg(filled);
      // Keep the two sources agreeing: a sheet opened from a shared link
      // becomes this browser's working configuration too.
      saveDesignConfig(filled);
      return;
    }
    const stored = readDesignConfig();
    if (stored) setCfg(stored);
  }, []);

  if (!cfg) {
    return (
      <section className="tlx-section">
        <div className="shell">
          <p className="tlx-note">
            No configuration found. <Link href="/design">Design a floor first</Link> — it takes about
            a minute, and this page will then hold the specification.
          </p>
        </div>
      </section>
    );
  }

  const species = SPECIES[cfg.species] ?? { name: cfg.species, janka: '—' };
  const finish = FINISH_OPTIONS.find((f) => f.id === cfg.finish) ?? FINISH_OPTIONS[1];
  const pattern = PATTERN_OPTIONS.find((p) => p.id === cfg.pattern) ?? PATTERN_OPTIONS[0];
  const estimate = estimateInstalledRangeCad(
    { species: cfg.species, squareFeet: cfg.sqft, finish: cfg.finish, pattern: cfg.pattern },
    bandForWork(cfg.species),
  );

  const summary = `${species.name} · ${finish?.label} finish · ${pattern?.label} · ${cfg.sqft} sq ft`;
  /* MEAS-04. Was `/#quote?spec=…` — the query string placed AFTER the
     fragment, so it arrived as part of the hash and nothing ever read it. One
     builder now, shared with /design, so the two exits cannot drift apart
     again. */
  const quoteHref = designEstimateHref(cfg, 'spec-sheet');

  return (
    <section className="tlx-section">
      <div className="shell">
        <article className="ds-sheet">
          <header className="ds-sheet-head">
            <div>
              <p className="ds-sheet-kicker">Floor specification</p>
              <h2 className="ds-sheet-title">{species.name}</h2>
            </div>
            <div className="ds-sheet-org">
              <strong>{BUSINESS_NAP.legalName}</strong>
              <span>{BUSINESS_ADDRESS_LINE}</span>
              <span>
                {BUSINESS_NAP.phoneDisplay} · {BUSINESS_NAP.email}
              </span>
              <span>{HOURS_LINE}</span>
            </div>
          </header>

          <dl className="ds-spec">
            <div>
              <dt>Species</dt>
              <dd>{species.name}</dd>
            </div>
            <div>
              <dt>Hardness</dt>
              <dd>Janka {species.janka}</dd>
            </div>
            <div>
              <dt>Finish</dt>
              <dd>{finish?.label}</dd>
            </div>
            <div>
              <dt>Pattern</dt>
              <dd>{pattern?.label}</dd>
            </div>
            <div>
              <dt>Area</dt>
              <dd>{cfg.sqft.toLocaleString('en-CA')} sq ft</dd>
            </div>
            <div>
              <dt>Indicative installed range</dt>
              <dd>
                {cad(estimate.estimatedLowCad)}–{cad(estimate.estimatedHighCad)}
              </dd>
            </div>
          </dl>

          <p className="ds-sheet-note">
            <strong>This is a range, not a quote.</strong> Subfloor condition, stairs, transitions and
            moisture readings move it. {PRICE_PROMISE}
          </p>

          <div className="ds-actions ds-noprint">
            <Link
              className="btn btn-copper"
              href={quoteHref}
              /* `carried` is the whole point of MEAS-04. This event used to
                 fire on a link that discarded its payload, so the funnel
                 recorded a successful handoff every time one failed. It now
                 reports whether the configuration actually travelled. */
              onClick={() =>
                track('design_handoff', {
                  from: 'spec-sheet',
                  species: cfg.species,
                  sqft: cfg.sqft,
                  design_id: cfg.designId,
                  carried: quoteHref.includes('species='),
                })
              }
            >
              Send this spec to Ecowoods
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              Download as PDF
            </button>
            <Link className="btn btn-ghost" href="/design">
              Change something
            </Link>
          </div>

          <p className="ds-sheet-foot">
            Prepared from the Ecowoods floor designer · {BUSINESS_NAP.legalName} ·{' '}
            {BUSINESS_NAP.phoneDisplay}
          </p>
        </article>
      </div>
    </section>
  );
}
