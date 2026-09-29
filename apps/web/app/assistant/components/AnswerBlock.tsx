'use client';

import type { AssistantChatCard } from '@/lib/assistant-workspace/chat-schema';

/**
 * One renderer per block type — the typed contract's whole point is that
 * every kind of thing Ask Francisco can show has its own shape, so it gets
 * its own presentation instead of the old one-size title+body+link card.
 * `renovation_analysis_offer` is NOT handled here — ConversationPane keeps
 * routing that one to the existing <RenovationAnalysisOffer> component
 * unchanged, since it owns real checkout/credit-balance state this
 * stateless renderer has no business touching.
 */
export function AnswerBlock({ card }: { card: AssistantChatCard }) {
  switch (card.type) {
    case 'decision_summary':
      return (
        <div className="aha-block aha-block--decision">
          <p className="aha-block-kicker">What I think is happening</p>
          <p className="aha-block-lede">{card.situation}</p>
          {card.whatMatters.length > 0 && (
            <ul className="aha-block-list">
              {card.whatMatters.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          <p className="aha-block-first-step">
            <strong>First:</strong> {card.firstStep}
          </p>
        </div>
      );

    case 'project_snapshot': {
      const rows: [string, string][] = [];
      if (card.objective) rows.push(['Objective', card.objective]);
      if (card.sellHorizon) rows.push(['Timeline', card.sellHorizon]);
      if (card.squareFeet) rows.push(['Area', `${card.squareFeet.toLocaleString('en-CA')} sq ft`]);
      if (card.rooms?.length) rows.push(['Rooms', card.rooms.join(', ')]);
      if (typeof card.stairs === 'boolean') rows.push(['Stairs', card.stairs ? 'Included' : 'Not included']);
      if (card.targetFloor) rows.push(['Floor', card.targetFloor]);
      if (card.selectedServices?.length) rows.push(['Services', card.selectedServices.join(', ')]);
      return (
        <div className="aha-block aha-block--snapshot">
          <p className="aha-block-kicker">{card.title}</p>
          <dl className="aha-block-facts">
            {rows.map(([k, v]) => (
              <div key={k} className="aha-block-fact">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }

    case 'ecowoods_band':
      return (
        <div className="aha-block aha-block--cost">
          <p className="aha-block-kicker">{card.title}</p>
          {card.minCad != null && card.maxCad != null ? (
            <p className="aha-block-range">
              ${card.minCad.toLocaleString('en-CA')}–${card.maxCad.toLocaleString('en-CA')} {card.currency ?? 'CAD'}
              {card.scope ? <span className="aha-block-scope"> · {card.scope}</span> : null}
            </p>
          ) : null}
          <p className="aha-block-body">{card.body}</p>
          <p className="aha-block-source-tag">Published Ecowoods band</p>
        </div>
      );

    case 'scenario_comparison':
      return (
        <div className="aha-block aha-block--scenarios">
          <p className="aha-block-kicker">{card.title}</p>
          <div className="aha-block-scenario-grid">
            {card.scenarios.map((s, i) => (
              <div key={i} className="aha-block-scenario">
                <p className="aha-block-scenario-label">{s.label}</p>
                {s.minCad != null && s.maxCad != null ? (
                  <p className="aha-block-range">
                    ${s.minCad.toLocaleString('en-CA')}–${s.maxCad.toLocaleString('en-CA')} {s.currency ?? 'CAD'}
                  </p>
                ) : (
                  <p className="aha-block-unavailable">Not quantified</p>
                )}
                {s.assumptions.length > 0 && (
                  <ul className="aha-block-list aha-block-list--tight">
                    {s.assumptions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case 'evidence':
      return (
        <div className="aha-block aha-block--evidence" data-strength={card.strength}>
          <p className="aha-block-kicker">Evidence · {sourceTypeLabel(card.sourceType)}</p>
          <p className="aha-block-lede">{card.title}</p>
          <p className="aha-block-body">{card.whyItMatters}</p>
          {card.href ? (
            <a className="aha-block-link" href={card.href} target="_blank" rel="noopener noreferrer">
              Read the source
            </a>
          ) : null}
        </div>
      );

    case 'risk':
      return (
        <div className="aha-block aha-block--risk" role="note">
          <p className="aha-block-kicker">Worth flagging</p>
          <p className="aha-block-lede">{card.issue}</p>
          <p className="aha-block-body">{card.impact}</p>
          {card.unknown ? (
            <p className="aha-block-body">
              <strong>Unknown:</strong> {card.unknown}
            </p>
          ) : null}
          {card.resolvedBy ? (
            <p className="aha-block-body">
              <strong>Resolved by:</strong> {card.resolvedBy}
            </p>
          ) : null}
        </div>
      );

    case 'sequence':
      return (
        <div className="aha-block aha-block--sequence">
          <p className="aha-block-kicker">{card.title}</p>
          <ol className="aha-block-sequence">
            {card.steps.map((s, i) => (
              <li key={i}>
                <span className="aha-block-sequence-label">{s.label}</span>
                {s.rationale ? <span className="aha-block-sequence-rationale"> — {s.rationale}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      );

    case 'property_context':
    case 'market_context':
      return (
        <div className="aha-block aha-block--context" data-status={card.status}>
          <p className="aha-block-kicker">
            {card.title}
            {card.status !== 'ok' ? <span className="aha-block-status-tag"> · {statusLabel(card.status)}</span> : null}
          </p>
          <p className="aha-block-body">{card.body}</p>
          {'source' in card && card.source ? <p className="aha-block-source-tag">Source: {card.source}</p> : null}
        </div>
      );

    case 'next_action':
      return (
        <div className="aha-block aha-block--next-action">
          <p className="aha-block-kicker">Next step</p>
          <p className="aha-block-body">{card.body}</p>
          {card.href ? (
            <a className="aha-block-link aha-block-link--primary" href={card.href} target="_blank" rel="noopener noreferrer">
              {nextActionLabel(card.action)}
            </a>
          ) : null}
        </div>
      );

    case 'analysis_result':
      return (
        <div className="aha-block aha-block--analysis">
          <p className="aha-block-kicker">{card.title}</p>
          <p className="aha-block-body">{card.body}</p>
          <a className="aha-block-link aha-block-link--primary" href={card.href} target="_blank" rel="noopener noreferrer">
            Open the full analysis
          </a>
        </div>
      );

    case 'pending_provider':
      return (
        <div className="aha-block aha-block--pending">
          <p className="aha-block-kicker">{card.title}</p>
          <p className="aha-block-body">{card.body}</p>
        </div>
      );

    case 'site_link':
      return (
        <div className="aha-block aha-block--link">
          <p className="aha-block-kicker">{card.title}</p>
          <p className="aha-block-body">{card.body}</p>
          {card.href ? (
            <a className="aha-block-link" href={card.href} target="_blank" rel="noopener noreferrer">
              See this page
            </a>
          ) : null}
        </div>
      );

    case 'conversion_proposed':
      return (
        <div className="aha-block aha-block--conversion">
          <p className="aha-block-kicker">{card.title}</p>
          <p className="aha-block-body">{card.body}</p>
        </div>
      );

    case 'renovation_analysis_offer':
      // Rendered by <RenovationAnalysisOffer> at the call site instead.
      return null;
  }
}

function sourceTypeLabel(t: string): string {
  switch (t) {
    case 'guide':
      return 'guide';
    case 'paper':
      return 'technical paper';
    case 'framework':
      return 'Well-Installed Framework';
    case 'case_study':
      return 'case study';
    case 'review':
      return 'review';
    default:
      return t;
  }
}

function statusLabel(s: string): string {
  return s === 'pending_key' ? 'not yet available' : s === 'unavailable' ? 'unavailable' : s;
}

function nextActionLabel(action: string): string {
  switch (action) {
    case 'floor_studio':
      return 'Open Floor Studio';
    case 'quote_check':
      return 'Open Quote Check';
    case 'document_upload':
      return 'Review a document';
    case 'external_trade_followup':
      return 'Learn more';
    case 'measure':
      return 'Request a free measure';
    case 'estimate':
      return 'Request an estimate';
    case 'quote':
      return 'Request a quote';
    default:
      return 'Continue';
  }
}
