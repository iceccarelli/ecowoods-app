'use client';

/**
 * EconomicsRail — the right zone of the workspace shell.
 *
 * ASSISTANT-01: structure only, every value an explicit placeholder. No
 * economics engine exists yet (that's ASSISTANT-04, built as pure functions
 * over content/constants/pricing.ts — see docs/assistant-workspace/
 * ECONOMICS_MODEL_SPEC.md). Nothing here may ever render an invented dollar
 * figure; until the engine exists, that means rendering nothing but "—".
 */

const ROWS: { label: string; value: string }[] = [
  { label: 'Selected floor', value: 'Not started' },
  { label: 'Services', value: 'Not started' },
  { label: 'Cost range', value: 'Needs project state' },
  { label: 'Savings', value: 'Needs project state' },
  { label: 'Value scenario', value: 'Needs project state' },
  { label: 'Confidence', value: '—' },
];

const STATUS_LISTS: { label: string; items: string[] }[] = [
  { label: 'Known', items: [] },
  { label: 'Assumed', items: [] },
  { label: 'Needs measure', items: ['Everything — no project started yet'] },
];

export function EconomicsRail() {
  return (
    <aside className="aha-econ" aria-label="Live project economics">
      <p className="aha-econ-heading">Live project economics</p>

      <dl className="aha-econ-rows">
        {ROWS.map((row) => (
          <div key={row.label} className="aha-econ-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="aha-econ-status">
        {STATUS_LISTS.map((list) => (
          <div key={list.label} className="aha-econ-status-group">
            <p className="aha-econ-status-label">{list.label}</p>
            {list.items.length ? (
              <ul>
                {list.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="aha-econ-status-empty">Nothing yet</p>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="aha-econ-next" disabled aria-disabled="true">
        Next step — not available yet
      </button>

      <p className="aha-econ-footnote">
        Every dollar shown here will trace to a published price band. Nothing is ever estimated by the assistant
        itself.
      </p>
    </aside>
  );
}
