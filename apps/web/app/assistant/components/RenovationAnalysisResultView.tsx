'use client';

/**
 * RenovationAnalysisResultView — the paid deliverable, rendered.
 *
 * Structure follows the actual engine output section-for-section
 * (lib/assistant-workspace/renovation-analysis.ts) — no section here that
 * the engine cannot populate. Every fact is tagged (known / estimated /
 * assumption / inspection-needed / external-data-unavailable) in plain
 * language, never the enum value itself.
 */
import { track } from '@/lib/analytics';
import { formatMoneyRange } from '@/lib/assistant-workspace/economics';
import type { EvidenceTag, RenovationAnalysisResult } from '@/lib/assistant-workspace/renovation-analysis';

const TAG_LABEL: Record<EvidenceTag, string> = {
  known: 'Confirmed from what you told me',
  estimated: 'Estimated',
  assumption: 'Assumption — worth confirming',
  'inspection-needed': 'Needs a measure or inspection',
  'external-data-unavailable': 'Outside Ecowoods’ scope — no invented figure',
};

function EvidenceRow({ label, tag }: { label: string; tag: EvidenceTag }) {
  return (
    <li className="aha-analysis-fact" data-tag={tag}>
      <span>{label}</span>
      <span className="aha-analysis-tag">{TAG_LABEL[tag]}</span>
    </li>
  );
}

export function RenovationAnalysisResultView({ result }: { result: RenovationAnalysisResult }) {
  return (
    <div className="aha-analysis-result" aria-label="Renovation Decision Analysis">
      <p className="aha-recommended-heading">Your renovation decision analysis</p>
      <p className="aha-message-text">{result.decision}</p>

      <p className="aha-analysis-section-heading">What I understand</p>
      <ul className="aha-analysis-facts">
        {result.currentContext.map((item, i) => (
          <EvidenceRow key={i} label={item.label} tag={item.tag} />
        ))}
      </ul>

      <p className="aha-analysis-section-heading">Recommended sequence</p>
      <ol className="aha-analysis-sequence">
        {result.recommendedSequence.map((step) => (
          <li key={step.order}>
            <p className="aha-analysis-step-title">{step.title}</p>
            <p className="aha-analysis-step-why">{step.why}</p>
          </li>
        ))}
      </ol>

      <p className="aha-analysis-section-heading">Cost view</p>
      <ul className="aha-analysis-facts">
        {result.costView.map((item, i) => (
          <li key={i} className="aha-analysis-fact" data-tag={item.tag}>
            <span>
              {item.label}
              {item.range ? ` — ${formatMoneyRange({ min: item.range.min, max: item.range.max, currency: item.range.currency })}` : ''}
            </span>
            <span className="aha-analysis-tag">{TAG_LABEL[item.tag]}</span>
            {item.note && <span className="aha-analysis-note">{item.note}</span>}
          </li>
        ))}
      </ul>

      <p className="aha-analysis-section-heading">Value and timing</p>
      {result.valueAndTiming.map((line, i) => (
        <p key={i} className="aha-message-text">
          {line}
        </p>
      ))}

      <p className="aha-analysis-section-heading">Risks and unknowns</p>
      <ul className="aha-analysis-facts">
        {result.risksAndUnknowns.map((item, i) => (
          <EvidenceRow key={i} label={item.label} tag={item.tag} />
        ))}
      </ul>

      <p className="aha-analysis-section-heading">What I&apos;d do next</p>
      <p className="aha-message-text">{result.nextStep.label}</p>
      <p className="aha-analysis-step-why">{result.nextStep.why}</p>
      {result.nextStep.action !== 'qualified-assessment' && (
        <a
          className="aha-analysis-cta"
          href="#aha-next-step"
          onClick={() => track('analysis_next_action_selected', { action: result.nextStep.action })}
        >
          Go to Next step
        </a>
      )}
    </div>
  );
}
