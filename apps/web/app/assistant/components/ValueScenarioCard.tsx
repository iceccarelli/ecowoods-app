'use client';

import { useEffect, useRef } from 'react';
import { formatMoneyRange } from '@/lib/assistant-workspace/economics';
import type { ValueScenario } from '@/lib/assistant-workspace/value-scenario';
import { track } from '@/lib/analytics';

const CONFIDENCE_LABEL: Record<ValueScenario['effect']['confidence'], string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
};

const TIER_LABEL: Record<string, string> = {
  E0: 'Assumption',
  E1: 'General industry pattern',
  E2: 'Ecowoods project record',
  E3: 'Ecowoods project record, with a published testimonial',
};

/**
 * ValueScenarioCard — ASSISTANT-05.
 *
 * Renders a `ValueScenario` from `lib/assistant-workspace/value-scenario.ts`
 * exactly as computed — no rounding, no rewording that could soften "not
 * quantified" into something that reads like a number. `effect.range` is
 * `null` today for every scenario this workspace can produce (see that
 * module's comment); this card never hides that behind a friendlier label,
 * per VALUE_SCENARIO_SPEC.md's UI contract: "a scenario with effect.range
 * null still opens the same drawer, showing why it couldn't be quantified —
 * never a dead end."
 */
export function ValueScenarioCard({ scenario }: { scenario: ValueScenario }) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('workspace_value_scenario_viewed', { confidence: scenario.effect.confidence, quantified: scenario.effect.range !== null });
  }, [scenario.effect.confidence, scenario.effect.range]);

  return (
    <div className="aha-value-scenario">
      <p className="aha-value-scenario-label">{scenario.label}</p>
      <p className="aha-value-scenario-effect">
        {scenario.effect.range
          ? `${scenario.effect.range.min}–${scenario.effect.range.max} ${scenario.effect.unit}`
          : 'Not quantified'}
      </p>
      <p className="aha-value-scenario-confidence">{CONFIDENCE_LABEL[scenario.effect.confidence]}</p>

      <details className="aha-value-scenario-drawer">
        <summary>Why this number?</summary>

        <div className="aha-value-scenario-drawer-body">
          <p className="aha-value-scenario-drawer-heading">This project&rsquo;s cost basis</p>
          <p className="aha-value-scenario-drawer-text">
            {formatMoneyRange(scenario.costBasis)} — the published band applied to your square footage
            (lib/assistant-workspace/economics.ts), net of any confirmed savings. Not a value figure; shown here
            only so the formula behind this scenario is traceable.
          </p>

          <p className="aha-value-scenario-drawer-heading">Assumptions</p>
          <ul>
            {scenario.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          <p className="aha-value-scenario-drawer-heading">Limitations</p>
          <ul>
            {scenario.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>

          <p className="aha-value-scenario-drawer-heading">Evidence</p>
          <ul className="aha-value-scenario-evidence">
            {scenario.evidence.map((e, i) => (
              <li key={`${e.tier}-${e.url ?? i}`}>
                <span className="aha-value-scenario-evidence-tier">{e.tier}</span>{' '}
                {e.url ? (
                  <a href={e.url}>{TIER_LABEL[e.tier] ?? e.source}</a>
                ) : (
                  <span>{TIER_LABEL[e.tier] ?? e.source}</span>
                )}
                <span className="aha-value-scenario-evidence-note"> — {e.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
