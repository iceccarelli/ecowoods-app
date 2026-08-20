import type { Figure as Fig } from '@/lib/figures';

/**
 * Figure — a server-rendered inline SVG chart with a data table beneath it.
 *
 * DESIGN DECISIONS, AND WHY
 *
 * ONE SERIES, ONE HUE. Both figures show a single measure across categories.
 * The first draft encoded them with the site's status colours; running the
 * palette validator killed it — `--copper-text` and `--danger` sit at ΔE 6.7
 * for normal vision, which is below the 15 floor, meaning a reader with full
 * colour vision cannot reliably tell them apart. `--success` and `--warning`
 * failed too, at 11.7.
 *
 * That failure was the useful part. Neither chart actually needs two colours:
 * the safe humidity band is not a second series, it is a REFERENCE REGION —
 * context drawn recessively behind the marks, which is the standard way to show
 * "target range versus actual" and a better chart than the one I started with.
 * With one hue, the categorical colour problem does not exist.
 *
 * NO LEGEND. A legend is mandatory at two or more series and wrong at one — the
 * title names the measure, and every mark is directly labelled.
 *
 * NO CLIENT JAVASCRIPT. These are static figures inside documents. A hover
 * tooltip's job is to reveal a value the mark does not show; every value here is
 * already printed beside its bar, so a tooltip layer would add a hydration cost
 * and a print-time failure mode to reveal what is already on screen. `<title>`
 * elements carry the same information to a screen reader, and the table beneath
 * is the accessible view rather than a hidden alternative.
 *
 * DARK MODE IS SELECTED, NOT FLIPPED. Every colour is a semantic token whose
 * dark value was measured separately in globals.css.
 *
 * `approx` renders "≈" and `openEnded` renders an arrow rather than a closed
 * bar, because the sources say "≈1360" and "above 60%". Rendering those as
 * 1360 and 70 would invent two numbers.
 */

const W = 790;
// 250, not 210. At 210 the longest row label — "Safe operating band for
// hardwood" — rendered as "operating band for hardwood": SVG text does not
// wrap and does not overflow visibly, it just gets cut off by the viewBox with
// no warning. Nothing in the guard, the typecheck or the build catches that;
// only rendering the figure and looking at it does. The measured longest label
// needs ~228px at 13px, so this is the widest label plus a 22px gutter.
const PAD_L = 250;
const PAD_R = 64;
const ROW_H = 44;
const BAR_H = 18;
const AXIS_H = 34;

export function FigureChart({ figure }: { figure: Fig }) {
  const rows = figure.kind === 'range' ? (figure.rangeRows ?? []) : (figure.barRows ?? []);
  const height = rows.length * ROW_H + AXIS_H + 8;
  const plotW = W - PAD_L - PAD_R;
  const x = (v: number) => PAD_L + (Math.min(v, figure.axisMax) / figure.axisMax) * plotW;
  const titleId = `fig-${figure.id}-title`;
  const descId = `fig-${figure.id}-desc`;

  return (
    <figure className="fig" id={`fig-${figure.id}`}>
      <figcaption className="fig-head">
        <span className="fig-number">Figure {figure.number}</span>
        <h3>{figure.title}</h3>
      </figcaption>

      <div className="fig-plot">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          height="auto"
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>{figure.title}</title>
          <desc id={descId}>{figure.caption}</desc>

          {/* Grid first, so every mark sits above it. Recessive by design. */}
          {figure.axisTicks.map((t) => (
            <line
              key={`g${t}`}
              x1={x(t)}
              x2={x(t)}
              y1={0}
              y2={height - AXIS_H}
              className="fig-grid"
            />
          ))}

          {figure.kind === 'range' &&
            (figure.rangeRows ?? []).map((r, i) => {
              const y = i * ROW_H + (ROW_H - BAR_H) / 2;
              const x1 = x(r.from);
              const x2 = x(r.to);
              return (
                <g key={r.label}>
                  <title>
                    {r.label}: {r.openEnded ? `above ${r.from}` : `${r.from}–${r.to}`} {figure.unit}
                  </title>
                  <text x={PAD_L - 14} y={y + BAR_H / 2 + 4} className="fig-label" textAnchor="end">
                    {r.label}
                  </text>
                  <rect
                    x={x1}
                    y={r.reference ? y - 6 : y}
                    width={Math.max(2, x2 - x1)}
                    height={r.reference ? BAR_H + 12 : BAR_H}
                    rx={r.reference ? 3 : 4}
                    className={r.reference ? 'fig-band' : 'fig-bar'}
                  />
                  {r.openEnded && (
                    <polygon
                      points={`${x2 - 2},${y} ${x2 + 12},${y + BAR_H / 2} ${x2 - 2},${y + BAR_H}`}
                      className="fig-bar"
                    />
                  )}
                  <text
                    x={(r.openEnded ? x2 + 16 : x2) + 8}
                    y={y + BAR_H / 2 + 4}
                    className="fig-value"
                  >
                    {r.openEnded ? `${r.from}+` : `${r.from}–${r.to}`}
                  </text>
                </g>
              );
            })}

          {figure.kind === 'bar' &&
            (figure.barRows ?? []).map((r, i) => {
              const y = i * ROW_H + (ROW_H - BAR_H) / 2;
              return (
                <g key={r.label}>
                  <title>
                    {r.label}: {r.approx ? 'approximately ' : ''}
                    {r.value} {figure.unit}
                  </title>
                  <text x={PAD_L - 14} y={y + BAR_H / 2 + 4} className="fig-label" textAnchor="end">
                    {r.label}
                  </text>
                  <rect
                    x={PAD_L}
                    y={y}
                    width={Math.max(2, x(r.value) - PAD_L)}
                    height={BAR_H}
                    rx={4}
                    className="fig-bar"
                  />
                  <text x={x(r.value) + 8} y={y + BAR_H / 2 + 4} className="fig-value">
                    {r.approx ? '≈' : ''}
                    {r.value.toLocaleString('en-CA')}
                  </text>
                </g>
              );
            })}

          {/* Axis last. */}
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={height - AXIS_H}
            y2={height - AXIS_H}
            className="fig-axis"
          />
          {figure.axisTicks.map((t) => (
            <text key={`t${t}`} x={x(t)} y={height - AXIS_H + 18} className="fig-tick">
              {t.toLocaleString('en-CA')}
            </text>
          ))}
          <text x={W - PAD_R} y={height - 4} className="fig-unit" textAnchor="end">
            {figure.unit}
          </text>
        </svg>
      </div>

      <p className="fig-caption">{figure.caption}</p>

      {/* The table is the accessible view and the printable one. It is visible,
          not hidden behind a toggle: a reader who wants the exact numbers should
          not have to discover a control to get them. */}
      <table className="fig-table">
        <caption>Figure {figure.number} — source data</caption>
        <thead>
          <tr>
            <th scope="col">{figure.kind === 'range' ? 'Condition' : 'Species'}</th>
            <th scope="col">{figure.unit}</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {figure.kind === 'range'
            ? (figure.rangeRows ?? []).map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.openEnded ? `above ${r.from}%` : `${r.from}–${r.to}%`}</td>
                  <td>{r.note ?? ''}</td>
                </tr>
              ))
            : (figure.barRows ?? []).map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>
                    {r.approx ? '≈' : ''}
                    {r.value.toLocaleString('en-CA')}
                  </td>
                  <td>{r.note ?? ''}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </figure>
  );
}
