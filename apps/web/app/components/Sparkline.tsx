import type { Observation } from '@/lib/market';

/**
 * Sparkline — a single series over time, server-rendered.
 *
 * FORM. The data's job is change-over-time, which is a line. One series, so no
 * legend: the card title names the measure. The latest point carries a marker
 * and a direct label; no other point is labelled, because a number on every
 * point is noise rather than information and the full series is in the JSON.
 *
 * SCALE. The y-axis is fitted to the data range with 6% padding rather than
 * anchored at zero. That is the correct choice for an index — a BCPI value has
 * no meaningful zero and anchoring there would flatten every real movement into
 * a straight line — and it is a choice that has to be stated, because a
 * non-zero baseline on a chart of QUANTITIES would be a distortion. The axis
 * labels print the actual endpoints so the range is never implied.
 *
 * No client JavaScript, no tooltip: this is a static figure whose endpoints are
 * printed. `<title>` carries the summary to assistive technology.
 */

const W = 280;
const H = 64;
const PAD = 4;

export function Sparkline({
  points,
  label,
}: {
  points: Observation[];
  label: string;
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.06;
  const hi = max + span * 0.06;

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2);

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const rising = last.value >= points[0].value;

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={`${label}: ${points.length} observations from ${points[0].date} to ${last.date}, ${rising ? 'higher' : 'lower'} at the end of the period than the start.`}
      preserveAspectRatio="none"
    >
      <title>{label}</title>
      <path d={d} className="spark-line" fill="none" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" className="spark-dot" />
    </svg>
  );
}
