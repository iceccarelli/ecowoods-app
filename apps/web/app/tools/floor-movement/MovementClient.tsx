'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import {
  SPECIES,
  SPECIES_SOURCE,
  EMC_SOURCE,
  computeMovement,
  speciesById,
  type Orientation,
} from '@/lib/wood';

/**
 * The calculator.
 *
 * WHAT MAKES IT DIFFERENT FROM EVERY OTHER FLOORING TOOL ON THE INTERNET
 *
 * It computes. Every other calculator in this trade multiplies a square
 * footage by a rate. This one runs a sorption isotherm and a dimensional
 * change equation over coefficients copied from a federal reference table, and
 * it shows the reader the moisture contents in between so the answer can be
 * checked rather than believed.
 *
 * THREE DESIGN DECISIONS
 *
 * 1. THE COMPARISON TABLE IS THE PRODUCT, not the single answer. A homeowner
 *    choosing between white oak and walnut is making a decision the industry
 *    frames entirely in terms of colour and price. Nine species side by side,
 *    at their own conditions, reframes it as an engineering choice — and it is
 *    the reframing, not the arithmetic, that this business is selling.
 *
 * 2. THE ORIENTATION TOGGLE IS PROMINENT because it is the largest single
 *    lever and almost nobody knows it exists. Commercial white oak moves 2.03
 *    times as much flatsawn as quartersawn. That ratio is two columns of a
 *    published table, and it is worth more to a buyer than any adjective on
 *    this website.
 *
 * 3. THE CAVEATS RENDER. When the conditions push the calculation outside the
 *    band the published coefficients cover, the page says so in the place the
 *    number appears. A tool that stays confident outside its own validity
 *    range is the thing this site exists to argue against.
 */
const DEFAULTS = {
  speciesId: 'white-oak',
  orientation: 'flatsawn' as Orientation,
  boardWidthMm: 127,
  runWidthM: 4,
  tempC: 21,
  rhLow: 25,
  rhHigh: 60,
};

const WIDTH_PRESETS = [
  { label: '2¼″ strip', mm: 57 },
  { label: '3¼″ strip', mm: 83 },
  { label: '5″ plank', mm: 127 },
  { label: '7″ wide plank', mm: 178 },
];

const mm = (n: number) => `${n.toFixed(2)} mm`;

export default function MovementClient() {
  const [speciesId, setSpeciesId] = useState(DEFAULTS.speciesId);
  const [orientation, setOrientation] = useState<Orientation>(DEFAULTS.orientation);
  const [boardWidthMm, setBoardWidthMm] = useState(DEFAULTS.boardWidthMm);
  const [runWidthM, setRunWidthM] = useState(DEFAULTS.runWidthM);
  const [rhLow, setRhLow] = useState(DEFAULTS.rhLow);
  const [rhHigh, setRhHigh] = useState(DEFAULTS.rhHigh);

  const species = speciesById(speciesId) ?? SPECIES[0]!;

  /* MEAS-03 — this tool had ZERO analytics. A visitor could spend five minutes
     tuning it to their exact floor and no report anywhere would know the page
     had been used, which made it impossible to argue for connecting it to
     anything.

     Fires ONCE, and only when an input actually moves off its default. A page
     view is not use of a calculator, and counting arrivals as usage would have
     made the least-used tool on the site look like one of the busiest. The
     parameters are the species and board width chosen from fixed lists —
     nothing typed, nothing about the person, and no result. */
  const usedRef = useRef(false);
  useEffect(() => {
    if (usedRef.current) return;
    const touched =
      speciesId !== DEFAULTS.speciesId ||
      orientation !== DEFAULTS.orientation ||
      boardWidthMm !== DEFAULTS.boardWidthMm ||
      runWidthM !== DEFAULTS.runWidthM ||
      rhLow !== DEFAULTS.rhLow ||
      rhHigh !== DEFAULTS.rhHigh;
    if (!touched) return;
    usedRef.current = true;
    track('movement_calculated', { species: speciesId, orientation, board_mm: boardWidthMm });
  }, [speciesId, orientation, boardWidthMm, runWidthM, rhLow, rhHigh]);

  const result = useMemo(
    () =>
      computeMovement({
        species,
        orientation,
        boardWidthMm,
        runWidthM,
        tempC: DEFAULTS.tempC,
        rhLowPct: rhLow,
        rhHighPct: rhHigh,
      }),
    [species, orientation, boardWidthMm, runWidthM, rhLow, rhHigh],
  );

  const comparison = useMemo(
    () =>
      SPECIES.map((s) => ({
        species: s,
        flat: computeMovement({
          species: s,
          orientation: 'flatsawn',
          boardWidthMm,
          tempC: DEFAULTS.tempC,
          rhLowPct: rhLow,
          rhHighPct: rhHigh,
        }),
        quarter: computeMovement({
          species: s,
          orientation: 'quartersawn',
          boardWidthMm,
          tempC: DEFAULTS.tempC,
          rhLowPct: rhLow,
          rhHighPct: rhHigh,
        }),
      })).sort((a, b) => (a.flat?.boardMovementMm ?? 0) - (b.flat?.boardMovementMm ?? 0)),
    [boardWidthMm, rhLow, rhHigh],
  );

  return (
    <>
      <section className="tlx-section" aria-label="Your floor">
        <div className="shell">
          <div className="wm-grid">
            <div className="wm-controls">
              <div className="field">
                <label htmlFor="wm-species">Species</label>
                <select
                  id="wm-species"
                  value={speciesId}
                  onChange={(e) => setSpeciesId(e.currentTarget.value)}
                >
                  {SPECIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="wm-orientation">How the board was cut</label>
                <div className="wm-toggle" id="wm-orientation" role="group" aria-label="Grain orientation">
                  {(['flatsawn', 'quartersawn'] as Orientation[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      className={`wm-toggle-btn${orientation === o ? ' is-on' : ''}`}
                      aria-pressed={orientation === o}
                      onClick={() => setOrientation(o)}
                    >
                      {o === 'flatsawn' ? 'Flatsawn / plainsawn' : 'Quartersawn / rift'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="wm-width">Board face width — {boardWidthMm} mm</label>
                <input
                  id="wm-width"
                  type="range"
                  min={40}
                  max={250}
                  step={1}
                  value={boardWidthMm}
                  onChange={(e) => setBoardWidthMm(Number(e.currentTarget.value))}
                />
                <div className="wm-presets">
                  {WIDTH_PRESETS.map((p) => (
                    <button
                      key={p.mm}
                      type="button"
                      className={`wm-chip${boardWidthMm === p.mm ? ' is-on' : ''}`}
                      onClick={() => setBoardWidthMm(p.mm)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="wm-run">Room width across the boards — {runWidthM} m</label>
                <input
                  id="wm-run"
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={runWidthM}
                  onChange={(e) => setRunWidthM(Number(e.currentTarget.value))}
                />
              </div>

              <div className="field">
                <label htmlFor="wm-rh-low">Winter indoor humidity — {rhLow}% RH</label>
                <input
                  id="wm-rh-low"
                  type="range"
                  min={10}
                  max={45}
                  step={1}
                  value={rhLow}
                  onChange={(e) => setRhLow(Math.min(Number(e.currentTarget.value), rhHigh - 1))}
                />
              </div>

              <div className="field">
                <label htmlFor="wm-rh-high">Summer indoor humidity — {rhHigh}% RH</label>
                <input
                  id="wm-rh-high"
                  type="range"
                  min={40}
                  max={85}
                  step={1}
                  value={rhHigh}
                  onChange={(e) => setRhHigh(Math.max(Number(e.currentTarget.value), rhLow + 1))}
                />
                <em className="wm-hint">
                  Defaults are the published Toronto indoor range —{' '}
                  <Link href="/papers/toronto-hardwood-climate-moisture-protocol">
                    Climate Mastery, §1
                  </Link>
                  .
                </em>
              </div>
            </div>

            <div className="wm-result" role="status" aria-live="polite">
              {result === null ? (
                <p>Adjust the humidity range — the winter value has to be the lower one.</p>
              ) : (
                <>
                  <p className="tlx-kicker">Each board moves</p>
                  <p className="wm-figure">{mm(result.boardMovementMm)}</p>
                  <p className="wm-sub">
                    across its width, between {rhLow}% and {rhHigh}% RH — that is{' '}
                    {result.boardMovementPctOfWidth.toFixed(2)}% of the board.
                  </p>

                  <dl className="wm-dl">
                    <div>
                      <dt>Moisture content, winter</dt>
                      <dd>{result.emcLowPct.toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt>Moisture content, summer</dt>
                      <dd>{result.emcHighPct.toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt>Swing</dt>
                      <dd>{result.mcSwingPct.toFixed(1)} points</dd>
                    </div>
                    <div>
                      <dt>Boards across {runWidthM} m</dt>
                      <dd>{result.boardsAcrossRun}</dd>
                    </div>
                    <div>
                      <dt>Total the floor absorbs</dt>
                      <dd>{result.runMovementMm === null ? '—' : mm(result.runMovementMm)}</dd>
                    </div>
                    <div>
                      <dt>Flatsawn vs quartersawn</dt>
                      <dd>{result.orientationRatio.toFixed(2)}×</dd>
                    </div>
                  </dl>

                  {result.caveats.length > 0 && (
                    <ul className="wm-caveats">
                      {result.caveats.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}

                  <p className="wm-sub">
                    This is unrestrained movement in solid wood. A real floor is fastened and
                    restrained, so the total does not appear at one seam — it is the amount the
                    installation has to absorb somewhere. Engineered flooring is not modelled here:
                    its cross-ply core exists to defeat this calculation.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Every species at these conditions">
        <div className="shell">
          <p className="tlx-kicker">The comparison nobody publishes</p>
          <h2 className="tlx-h2">All nine, at {boardWidthMm} mm wide, in your conditions</h2>
          <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label="Species comparison">
            <table className="wm-table">
              <caption>
                Movement across the width of one board between {rhLow}% and {rhHigh}% RH at{' '}
                {DEFAULTS.tempC} °C. Sorted least to most.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Species</th>
                  <th scope="col">Flatsawn</th>
                  <th scope="col">Quartersawn</th>
                  <th scope="col">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(({ species: s, flat, quarter }) => (
                  <tr key={s.id} className={s.id === speciesId ? 'is-on' : undefined}>
                    <th scope="row">{s.label}</th>
                    <td>{flat ? mm(flat.boardMovementMm) : '—'}</td>
                    <td>{quarter ? mm(quarter.boardMovementMm) : '—'}</td>
                    <td>{flat ? `${flat.orientationRatio.toFixed(2)}×` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tlx-note">
            Coefficients: {SPECIES_SOURCE.table}, {SPECIES_SOURCE.basis}. Moisture content:{' '}
            {EMC_SOURCE.equation}. Both are United States Forest Products Laboratory publications,
            and this page&rsquo;s implementation of them is asserted against {EMC_SOURCE.table} in
            the test suite — if the physics ever stops agreeing with the published values, the
            build fails.
          </p>
        </div>
      </section>
    </>
  );
}
