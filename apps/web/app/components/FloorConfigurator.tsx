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
import { saveDesignConfig } from '@/lib/design-config';
import { track } from '@/lib/analytics';
import { EcowoodsLeaf } from './EcowoodsLeaf';

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

type SpeciesSwatch = {
  /** Must match a key in FLOORING_RATES_CAD_PER_SQFT. */
  id: string;
  name: string;
  janka: string;
  base: string;
  grain: string;
  note: string;
};

const SPECIES: readonly SpeciesSwatch[] = [
  { id: 'white oak', name: 'White Oak',  janka: 'Janka 1360', base: '#c9a882', grain: '#a8865e', note: 'Calm, modern, takes any stain' },
  { id: 'red oak',   name: 'Red Oak',    janka: 'Janka 1290', base: '#c69574', grain: '#a06f4d', note: 'The Canadian heritage floor' },
  { id: 'walnut',    name: 'Black Walnut',     janka: 'Janka 1010', base: '#6b4b34', grain: '#4a3122', note: 'Deep, quiet, expensive-looking' },
  { id: 'maple',     name: 'Hard Maple', janka: 'Janka 1450', base: '#e0c69f', grain: '#c4a87f', note: 'Bright, uniform, contemporary' },
  { id: 'hickory',   name: 'Hickory',    janka: 'Janka 1820', base: '#c08e5e', grain: '#8a5c33', note: 'Hardest we lay. Family-proof.' },
] as const;

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
  const [finishId, setFinishId] = useState<string>(DEFAULT_FINISH);
  const [patternId, setPatternId] = useState<string>(DEFAULT_PATTERN);
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
    if (Number.isFinite(qsSqft) && qsSqft >= SQFT_MIN && qsSqft <= SQFT_MAX) setSqft(qsSqft);
  }, []);

  /* P0.5 — every change persists: localStorage `ew-design-v1` (the quote form
     reads it and prefills) + the querystring (reload- and share-proof). */
  useEffect(() => {
    saveDesignConfig({ species: speciesId, finish: finishId, pattern: patternId, sqft });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('species', speciesId);
      url.searchParams.set('finish', finishId);
      url.searchParams.set('pattern', patternId);
      url.searchParams.set('sqft', String(sqft));
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* history unavailable — localStorage still carries it */
    }
  }, [speciesId, finishId, patternId, sqft]);

  const species = SPECIES.find((s) => s.id === speciesId) ?? SPECIES[0];
  const finish = FINISH_OPTIONS.find((f) => f.id === finishId) ?? FINISH_OPTIONS[1];
  const pattern = PATTERN_OPTIONS.find((p) => p.id === patternId) ?? PATTERN_OPTIONS[0];

  const estimate = useMemo(
    () => estimateInstalledRangeCad({ species: speciesId, squareFeet: sqft, finish: finishId, pattern: patternId }),
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
            <div
              className={`fc-plank fc-plank--${pattern.id}`}
              role="img"
              aria-label={`Preview: ${species.name}, ${finish.label} finish, ${pattern.label}`}
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

            <dl className="fc-spec">
              <div><dt>Species</dt><dd>{species.name}</dd></div>
              <div><dt>Hardness</dt><dd>{species.janka}</dd></div>
              <div><dt>Finish</dt><dd>{finish.label}</dd></div>
              <div><dt>Pattern</dt><dd>{estimate.pattern === patternId ? pattern.label : 'n/a for refinishing'}</dd></div>
            </dl>
            <p className="fc-note">{finish.blurb}</p>
            <p className="fc-note">{pattern.blurb}</p>
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
                    <span className="fc-swatch-chip" style={{ background: `linear-gradient(135deg, ${s.base}, ${s.grain})` }} />
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
              <legend>
                <span className="fc-step">04</span> Area
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
              <a
                className="btn btn-copper btn-lg fc-cta"
                href="/#quote"
                onClick={() => track('design_handoff', { species: speciesId, finish: finishId, pattern: patternId, sqft })}
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
