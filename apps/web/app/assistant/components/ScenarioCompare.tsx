'use client';

import { useEffect, useMemo, useRef } from 'react';
import { bandForCountry, type PriceCountry } from '@/content/constants/pricing';
import { calculateProjectRange, compareScenarios, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import { track } from '@/lib/analytics';

/**
 * ScenarioCompare — a thin, real two-scenario comparison.
 *
 * Not a full compare workspace (ProjectRail's "Compare" section stays "Not
 * yet available" — that's a bigger build than this phase). This is the
 * honest, minimal version the brief allows: two REAL published bands —
 * "Full Sand & Finish" and "New Hardwood Install," the same
 * `PriceBandKey`s every other pricing surface on this site uses — compared
 * at the visitor's own square footage via `compareScenarios`/
 * `calculateDelta`. No third invented scenario ("Refresh," "Replace") gets
 * a made-up label; both names here are the band's own published `.label`.
 */
export function ScenarioCompare({ squareFeet, country }: { squareFeet: number; country: PriceCountry }) {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('workspace_scenario_compared', { country });
  }, [country]);

  const comparison = useMemo(() => {
    const refinish = calculateProjectRange({ pricingKey: 'fullSandAndFinish', squareFeet, country });
    const install = calculateProjectRange({ pricingKey: 'newInstall', squareFeet, country });
    return compareScenarios([
      { label: bandForCountry('fullSandAndFinish', country).label, range: refinish },
      { label: bandForCountry('newInstall', country).label, range: install },
    ]);
  }, [squareFeet, country]);

  return (
    <div className="aha-scenario-compare">
      <p className="aha-recommended-heading">Compare at {squareFeet.toLocaleString()} sq ft</p>
      <div className="aha-scenario-grid">
        {comparison.scenarios.map((scenario) => (
          <div key={scenario.label} className="aha-scenario">
            <p className="aha-scenario-label">{scenario.label}</p>
            <p className="aha-scenario-range">{formatMoneyRange(scenario.range)}</p>
          </div>
        ))}
      </div>
      {comparison.deltas.map((d) => (
        <p key={`${d.from}-${d.to}`} className="aha-scenario-delta">
          Difference, {d.from} to {d.to}: {formatMoneyRange(d.delta)}
        </p>
      ))}
      <p className="aha-card-why-empty">
        Published bands, not a quote for either scope. The fixed price is written after a free in-home measure.
      </p>
    </div>
  );
}
