'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import type { DetailedRenovationAnalysis } from '@/lib/assistant-workspace/renovation-analysis';

/**
 * The paid deliverable's actual presentation (directive rule 22-23) — a
 * numbered priority list with real cost context per item, then assumptions
 * / uncertainty / next steps as their own short sections. Rendered inline
 * in the conversation, persisted server-side (RenovationAnalysis row), and
 * would render identically if fetched later from
 * GET /api/assistant/analysis/[id] — this component only needs the result
 * shape, not where it came from.
 */
export function AnalysisResultCard({ result }: { result: DetailedRenovationAnalysis }) {
  useEffect(() => {
    track('workspace_analysis_report_viewed', {});
  }, []);

  return (
    <div className="aha-analysis-result">
      <p className="aha-analysis-result-kicker">Your renovation priority</p>
      <ol className="aha-analysis-result-items">
        {result.items.map((item) => (
          <li key={item.key} className="aha-analysis-result-item">
            <span className="aha-analysis-result-rank">{item.rank}</span>
            <div>
              <p className="aha-analysis-result-label">{item.label}</p>
              <p className="aha-analysis-result-reason">{item.reason}</p>
              <p className="aha-analysis-result-cost">{item.costContext}</p>
              <p className="aha-analysis-result-next">{item.nextStep}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="aha-analysis-result-section">
        <p className="aha-analysis-result-section-title">Assumptions</p>
        <ul>
          {result.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      <div className="aha-analysis-result-section">
        <p className="aha-analysis-result-section-title">Still uncertain</p>
        <ul>
          {result.uncertainty.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
