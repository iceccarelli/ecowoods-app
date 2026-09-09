'use client';

import { useMemo, useState } from 'react';
import { MACHINES, assess, circuitLoad, CONTINUOUS_LOAD_FACTOR } from '@/lib/equipment';

/**
 * The planner.
 *
 * It answers one question no manufacturer site can, because each of them only
 * describes its own machines: given the circuit in front of you, what can you
 * actually plug in — and what happens if you plug in two things at once.
 */
const SUPPLIES = [
  { label: '15 A household circuit (120 V)', volts: 120, breakerAmps: 15 },
  { label: '20 A kitchen / shop circuit (120 V)', volts: 120, breakerAmps: 20 },
  { label: '30 A dedicated circuit (240 V)', volts: 240, breakerAmps: 30 },
  { label: '50 A temporary service (240 V)', volts: 240, breakerAmps: 50 },
];

const VERDICT_LABEL: Record<string, string> = {
  runs: 'Runs',
  'runs-at-the-limit': 'At the limit',
  'needs-dedicated-circuit': 'Dedicated circuit',
  'wrong-voltage': 'Wrong voltage',
  'over-circuit': 'Over the breaker',
  unknown: 'Not published',
};

export default function CircuitPlanner() {
  const [supplyIndex, setSupplyIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const supply = SUPPLIES[supplyIndex]!;

  const assessments = useMemo(
    () => MACHINES.map((m) => ({ machine: m, result: assess(m, supply) })),
    [supply],
  );

  const chosen = MACHINES.filter((m) => selected.includes(m.id));
  const load = useMemo(() => circuitLoad(chosen, supply), [chosen, supply]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      <div className="field" style={{ maxWidth: 'min(28rem, 100%)' }}>
        <label htmlFor="eq-supply">The circuit you have</label>
        <select
          id="eq-supply"
          value={supplyIndex}
          onChange={(e) => setSupplyIndex(Number(e.currentTarget.value))}
        >
          {SUPPLIES.map((s, i) => (
            <option key={s.label} value={i}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label="Machines against this circuit">
        <table className="wm-table">
          <caption>
            Every figure is the manufacturer&rsquo;s own. A current shown as &ldquo;at least&rdquo; is
            derived from published power and is a floor, not a rating.
          </caption>
          <thead>
            <tr>
              <th scope="col">On the circuit</th>
              <th scope="col">Machine</th>
              <th scope="col">Supply</th>
              <th scope="col">Current</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {assessments.map(({ machine, result }) => (
              <tr key={machine.id} className={selected.includes(machine.id) ? 'is-on' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    id={`eq-pick-${machine.id}`}
                    aria-label={`Add the ${machine.manufacturer} ${machine.model} to this circuit`}
                    checked={selected.includes(machine.id)}
                    onChange={() => toggle(machine.id)}
                    disabled={result.usedAmps === null}
                  />
                </td>
                <th scope="row">
                  {machine.manufacturer} {machine.model}
                </th>
                <td>{result.spec ? `${result.spec.volts} V / ${result.spec.hertz} Hz` : '—'}</td>
                <td>
                  {result.usedAmps === null
                    ? '—'
                    : `${result.amperageBasis === 'derived-floor' ? '≥ ' : ''}${result.usedAmps.toFixed(1)} A`}
                </td>
                <td>{VERDICT_LABEL[result.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="wm-result" role="status" aria-live="polite" style={{ position: 'static', marginTop: '2rem' }}>
        <p className="tlx-kicker">On this one circuit</p>
        <p className="wm-figure">{load.totalAmps.toFixed(1)} A</p>
        <p className="wm-sub">{load.note}</p>
        <dl className="wm-dl">
          <div>
            <dt>Breaker</dt>
            <dd>{load.breakerAmps} A</dd>
          </div>
          <div>
            <dt>Continuous figure ({Math.round(CONTINUOUS_LOAD_FACTOR * 100)}%)</dt>
            <dd>{load.continuousLimitAmps.toFixed(1)} A</dd>
          </div>
          <div>
            <dt>Machines selected</dt>
            <dd>{chosen.length}</dd>
          </div>
          <div>
            <dt>All figures published</dt>
            <dd>{chosen.length === 0 ? '—' : load.allPublished ? 'yes' : 'no — some are floors'}</dd>
          </div>
        </dl>
        {chosen.length > 0 && (
          <ul className="wm-caveats">
            {assessments
              .filter((a) => selected.includes(a.machine.id))
              .flatMap((a) => a.result.reasons.map((r) => ({ id: `${a.machine.id}-${r}`, r })))
              .map(({ id, r }) => (
                <li key={id}>{r}</li>
              ))}
          </ul>
        )}
        <p className="wm-sub">
          This compares published numbers. It is not an electrical assessment, and whether a
          particular circuit in a particular building is adequate is a question for somebody
          licensed to answer it, on site.
        </p>
      </div>
    </>
  );
}
