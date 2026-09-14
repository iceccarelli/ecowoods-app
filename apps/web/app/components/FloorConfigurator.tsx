'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FINISH_OPTIONS,
  PATTERN_OPTIONS,
  DEFAULT_FINISH,
  DEFAULT_PATTERN,
  estimateInstalledRangeCad,
  describeFloorForChat,
  bookMeasureIntent,
} from '@ecowoods/shared/ai';
import { openAssistant } from '@/lib/assistant';
import { designEstimateHref, readDesignConfig, saveDesignConfig } from '@/lib/design-config';
import { ensureDesignId } from '@/lib/floor-studio/design-id';
import { FLOOR_PRODUCTS, BOARD_WIDTHS, DEFAULT_WIDTH } from '@/lib/floor-studio/catalog';
import { grainTileFor, grainTileHref } from '@/lib/floor-studio/grain';
import { FloorPlate } from './FloorPlate';
import { track } from '@/lib/analytics';
import { EcowoodsLeaf } from './EcowoodsLeaf';
import { bandForWork } from '@/content/constants/pricing';

/* ────────────────────────────────────────────────────────────────────────────
   DESIGN YOUR FLOOR

   Not a pricing calculator. A pricing calculator makes people comparison-shop.
   This is a desire machine that happens to end in a number.

   Rules it obeys:
     · The number is never presented as a quote. It is a range, always labelled,
       always followed by "fixed in writing after the free measure" — which is
       the promise the rest of the site already makes.
     · Every exit leads into EcowoodsGuide, which owns the real tools.
     · It reuses estimateInstalledRangeCad() — the exact function /api/chat's
       estimate_project tool calls. The page and the agent cannot disagree.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The species list is no longer typed here.
 *
 * It was: five objects carrying a pigment, a Janka figure and a one-line note,
 * sitting beside an identical five in lib/floor-studio/catalog.ts once Floor
 * Studio landed. Two lists of the same five floors is how a visitor configures
 * white oak in one surface and meets a different white oak in the other, and
 * neither copy is wrong enough for anyone to notice until a number moves in one
 * of them.
 *
 * So the catalogue is the record and this is a projection of it. `id` stays the
 * rate key ('white oak', not 'white-oak') because that string is in every
 * shared /design link and in `ew-design-v1` in people's browsers; changing it
 * would break configurations that are already out there.
 */
type SpeciesSwatch = {
  /** Must match a key in FLOORING_RATES_CAD_PER_SQFT. */
  id: string;
  /** The catalogue's own id — what the renderer and the grain tile are keyed by. */
  productId: string;
  name: string;
  janka: string;
  base: string;
  grain: string;
  note: string;
  /** The photographed tile for this species, when there is one. */
  tile?: string;
};

const SPECIES: readonly SpeciesSwatch[] = FLOOR_PRODUCTS.map((p) => {
  const tile = grainTileFor(p.id);
  return {
    id: p.rateKey,
    productId: p.id,
    name: p.name,
    janka: `Janka ${p.janka}`,
    base: p.base,
    grain: p.grain,
    note: p.swatchNote,
    tile: tile ? grainTileHref(tile) : undefined,
  };
});

const SQFT_MIN = 200;
const SQFT_MAX = 3000;
const SQFT_STEP = 50;

const cad = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

/** Count up to a target — the number should feel like it's being calculated. */
function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  const raf = useRef<number | null>(null);
  const from = useRef(target);

  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;
    const DURATION = 420;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(origin + delta * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, enabled]);

  return value;
}

export default function FloorConfigurator() {
  const [speciesId, setSpeciesId] = useState<string>('white oak');
  const [designId, setDesignId] = useState<string | undefined>(undefined);
  const [finishId, setFinishId] = useState<string>(DEFAULT_FINISH);
  const [patternId, setPatternId] = useState<string>(DEFAULT_PATTERN);
  const [widthId, setWidthId] = useState<string>(DEFAULT_WIDTH);
  const [sqft, setSqft] = useState<number>(900);
  const [postal, setPostal] = useState<string>('');
  const [animate, setAnimate] = useState(false);

  // Read prefers-reduced-motion in an effect, never during render — reading it
  // during render makes the server and the client disagree on first paint.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) setAnimate(true);
  }, []);

  /* P0.5 — a shared link restores a configuration. Querystring wins over the
     stored copy, read once, in an effect (never during render: SSR match). */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qsSpecies = q.get('species');
    const qsFinish = q.get('finish');
    const qsPattern = q.get('pattern');
    const qsSqft = Number(q.get('sqft'));
    if (qsSpecies && SPECIES.some((s) => s.id === qsSpecies)) setSpeciesId(qsSpecies);
    if (qsFinish && FINISH_OPTIONS.some((f) => f.id === qsFinish)) setFinishId(qsFinish);
    if (qsPattern && PATTERN_OPTIONS.some((p) => p.id === qsPattern)) setPatternId(qsPattern);
    const qsWidth = q.get('width');
    if (qsWidth && BOARD_WIDTHS.some((w) => w.id === qsWidth)) setWidthId(qsWidth);
    if (Number.isFinite(qsSqft) && qsSqft >= SQFT_MIN && qsSqft <= SQFT_MAX) setSqft(qsSqft);
  }, []);

  /* MEAS-04 — mint the join key once, on mount, reusing whatever this browser
     already has. In an effect rather than during render: two renders would
     mint two ids and React would report a hydration mismatch. */
  useEffect(() => {
    setDesignId(ensureDesignId(readDesignConfig()?.designId));
  }, []);

  /* P0.5 — every change persists: localStorage `ew-design-v1` (the quote form
     reads it and prefills) + the querystring (reload- and share-proof). */
  useEffect(() => {
    /* Wait for the id. Saving without it would write a config with no key and
       then overwrite it a tick later, which is harmless but makes the stored
       shape briefly disagree with what the CTA is about to carry. */
    if (!designId) return;
    saveDesignConfig({ species: speciesId, finish: finishId, pattern: patternId, sqft, designId });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('species', speciesId);
      url.searchParams.set('finish', finishId);
      url.searchParams.set('pattern', patternId);
      url.searchParams.set('width', widthId);
      url.searchParams.set('sqft', String(sqft));
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* history unavailable — localStorage still carries it */
    }
  }, [speciesId, finishId, patternId, widthId, sqft, designId]);

  /* MEAS-04 — one builder, shared with the spec sheet. */
  const quoteHref = designEstimateHref(
    { species: speciesId, finish: finishId, pattern: patternId, sqft, designId, savedAt: '' },
    'design',
  );

  const species = SPECIES.find((s) => s.id === speciesId) ?? SPECIES[0];
  const finish = FINISH_OPTIONS.find((f) => f.id === finishId) ?? FINISH_OPTIONS[1];
  const pattern = PATTERN_OPTIONS.find((p) => p.id === patternId) ?? PATTERN_OPTIONS[0];
  const boardWidth = BOARD_WIDTHS.find((w) => w.id === widthId) ?? BOARD_WIDTHS[1];

  /* One object, memoised, because it is the dependency of the render effect in
     FloorPlate: a fresh literal every keystroke in the postal field would
     restart a 300ms plate render on every character. */
  const plateConfig = useMemo(
    () => ({ productId: species.productId, finishId, patternId, widthId }),
    [species.productId, finishId, patternId, widthId],
  );

  const estimate = useMemo(
    () => estimateInstalledRangeCad({ species: speciesId, squareFeet: sqft, finish: finishId, pattern: patternId }, bandForWork(speciesId)),
    [speciesId, sqft, finishId, patternId],
  );

  const low = useCountUp(estimate.estimatedLowCad, animate);
  const high = useCountUp(estimate.estimatedHighCad, animate);

  const payload = { species: speciesId, squareFeet: sqft, finish: finishId, pattern: patternId, postal: postal.trim() || undefined };

  const askEcowoodsGuide = () => openAssistant({ prefill: describeFloorForChat(payload), source: 'configurator:ask' });
  const bookMeasure = () => openAssistant({ prefill: bookMeasureIntent(payload), source: 'configurator:book' });

  return (
    <section className="section fc" id="configurator" aria-labelledby="fc-heading">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '760px' }}>
          <span className="eyebrow">Design Your Floor</span>
          <h2 id="fc-heading">
            Build it here. <span className="serif-italic">Then stand on it.</span>
          </h2>
          <p>
            Species, finish, pattern, size. The range updates live using the same numbers our
            estimator carries in the truck. It is a range, not a quote — the fixed price is written
            after we measure your subfloor.
          </p>
        </div>

        <div className="fc-grid reveal">
          {/* ── Preview ─────────────────────────────────────────── */}
          <div className="fc-preview">
            <FloorPlate
              config={plateConfig}
              label={`Preview: ${species.name}, ${finish.label} finish, ${pattern.label}, ${boardWidth.label}`}
            >
              {/* The CSS plane stays. It is what a person sees before the
                  canvas has painted, and what they keep if it never does. */}
              <div
                className={`fc-plank fc-plank--${pattern.id}`}
                aria-hidden="true"
                style={
                  {
                    '--fc-base': species.base,
                    '--fc-grain': species.grain,
                    '--fc-tint': finish.tint,
                    '--fc-sheen': finish.sheen,
                  } as React.CSSProperties
                }
              >
                <span className="fc-plank-sheen" aria-hidden="true" />
              </div>
            </FloorPlate>

            <dl className="fc-spec">
              <div><dt>Species</dt><dd>{species.name}</dd></div>
              <div><dt>Hardness</dt><dd>{species.janka}</dd></div>
              <div><dt>Finish</dt><dd>{finish.label}</dd></div>
              <div><dt>Pattern</dt><dd>{estimate.pattern === patternId ? pattern.label : 'n/a for refinishing'}</dd></div>
              <div><dt>Board</dt><dd>{boardWidth.label}</dd></div>
            </dl>
            <p className="fc-note">{finish.blurb}</p>
            <p className="fc-note">{pattern.blurb}</p>
            <p className="fc-note">{boardWidth.note}</p>
          </div>

          {/* ── Controls ────────────────────────────────────────── */}
          <div className="fc-controls">
            <fieldset className="fc-field">
              <legend><span className="fc-step">01</span> Species</legend>
              <div className="fc-swatches">
                {SPECIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="fc-swatch"
                    aria-pressed={s.id === speciesId}
                    onClick={() => setSpeciesId(s.id)}
                    title={s.note}
                  >
                    {/* The chip is the PHOTOGRAPH of the species where we have
                        one — the same tile the preview is rendered from — not
                        two hex values on a diagonal. The gradient stays as the
                        ground underneath, so a chip is never empty while its
                        image is still arriving. */}
                    <span
                      className="fc-swatch-chip"
                      style={{
                        backgroundColor: s.base,
                        backgroundImage: s.tile
                          ? `url(${s.tile}), linear-gradient(135deg, ${s.base}, ${s.grain})`
                          : `linear-gradient(135deg, ${s.base}, ${s.grain})`,
                      }}
                    />
                    <span className="fc-swatch-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="fc-field">
              <legend><span className="fc-step">02</span> Finish</legend>
              <div className="fc-pills" data-count={FINISH_OPTIONS.length}>
                {FINISH_OPTIONS.map((f) => (
                  <button key={f.id} type="button" className="fc-pill" aria-pressed={f.id === finishId} onClick={() => setFinishId(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="fc-field">
              <legend><span className="fc-step">03</span> Pattern</legend>
              <div className="fc-pills" data-count={PATTERN_OPTIONS.length}>
                {PATTERN_OPTIONS.map((p) => (
                  <button key={p.id} type="button" className="fc-pill" aria-pressed={p.id === patternId} onClick={() => setPatternId(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="fc-field">
              <legend><span className="fc-step">04</span> Board width</legend>
              <div className="fc-pills" data-count={BOARD_WIDTHS.length}>
                {BOARD_WIDTHS.map((w) => (
                  <button key={w.id} type="button" className="fc-pill" aria-pressed={w.id === widthId} onClick={() => setWidthId(w.id)} title={w.note}>
                    {w.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="fc-field">
              <legend>
                <span className="fc-step">05</span> Area
                <output className="fc-sqft" htmlFor="fc-sqft">{sqft.toLocaleString('en-CA')} sq ft</output>
              </legend>
              <input
                id="fc-sqft"
                className="fc-range"
                type="range"
                min={SQFT_MIN}
                max={SQFT_MAX}
                step={SQFT_STEP}
                value={sqft}
                onChange={(e) => setSqft(Number(e.target.value))}
                aria-label="Approximate square footage"
                aria-valuetext={`${sqft} square feet`}
              />
              <div className="fc-range-ends" aria-hidden="true">
                <span>{SQFT_MIN} · one room</span>
                <span>{SQFT_MAX.toLocaleString('en-CA')} · whole home</span>
              </div>
            </fieldset>

            <div className="fc-field">
              <label htmlFor="fc-postal" className="fc-postal-label">Postal code <span>optional — lets EcowoodsGuide check your area</span></label>
              <input
                id="fc-postal"
                className="fc-postal"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                placeholder="M4K 1N2"
                maxLength={7}
                autoComplete="postal-code"
              />
            </div>
          </div>

          {/* ── Result ──────────────────────────────────────────── */}
          <div className="fc-result">
           <div className="fc-result-inner">
            <div>
            <div className="fc-result-label">Estimated installed range</div>
            {/*
              aria-hidden: this figure re-renders ~25×/second while the count-up
              runs. With aria-live on it, a screen reader narrated every frame.
              The settled value is announced once, below, instead.
            */}
            <div className="fc-result-figure" aria-hidden="true">
              <span>{cad(low)}</span>
              <em>–</em>
              <span>{cad(high)}</span>
            </div>
            <p className="fc-sr-only" role="status" aria-live="polite" aria-atomic="true">
              Estimated installed range: {cad(estimate.estimatedLowCad)} to {cad(estimate.estimatedHighCad)} Canadian
              for {sqft.toLocaleString('en-CA')} square feet of {species.name}.
            </p>
            <div className="fc-result-sub">
              {estimate.perSqftCad} · {sqft.toLocaleString('en-CA')} sq ft · materials, labour, finish
            </div>

            <p className="fc-disclaimer">
              This is a <strong>range, not a quote.</strong> Subfloor condition, stairs, transitions
              and moisture readings move it. Your fixed price is written down after the free in-home
              measure — and then it does not change.
            </p>
            </div>

            <div>
             <div className="fc-actions">
              {/* MEAS-04. Was a bare `/#quote` carrying nothing at all —
                  continuity rested entirely on localStorage, so this link in a
                  different browser, a private window, or a message to a spouse
                  arrived empty and the visitor retyped everything. */}
              <a
                className="btn btn-copper btn-lg fc-cta"
                href={quoteHref}
                onClick={() =>
                  track('design_handoff', {
                    species: speciesId,
                    finish: finishId,
                    pattern: patternId,
                    sqft,
                    design_id: designId,
                    carried: quoteHref.includes('species='),
                  })
                }
              >
                Get this floor priced in writing
                <span className="btn-arrow" aria-hidden="true">→</span>
              </a>
              <button type="button" className="fc-secondary" onClick={bookMeasure}>
                Book my free measure
              </button>
              <a
                className="fc-secondary"
                href={`/design/spec?species=${encodeURIComponent(speciesId)}&finish=${encodeURIComponent(finishId)}&pattern=${encodeURIComponent(patternId)}&sqft=${sqft}`}
              >
                Open the spec sheet
              </a>
              <button type="button" className="fc-secondary" onClick={askEcowoodsGuide}>
<EcowoodsLeaf size={17} strokeWidth={1.7} fillOpacity={0.22} />
                Ask EcowoodsGuide about this floor
              </button>
             </div>

            <p className="fc-handoff">
              Your exact configuration travels with you — into the quote form or the chat. No retyping.
            </p>
            </div>
           </div>
          </div>
        </div>
      </div>
    </section>
  );
}
