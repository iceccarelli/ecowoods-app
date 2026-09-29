/**
 * lib/assistant-workspace/answer-composition.ts — orders and caps a turn's
 * cards into a coherent answer stack.
 *
 * Replaces the flat `final.cards.slice(0, 2)` that used to run in
 * ConversationPane regardless of what the two cards actually were — an
 * arbitrary cut, not a composition. This is not "show everything": it is
 * "show the right things in the right order, with a safety cap so an
 * unusually tool-heavy turn can't flood the transcript." A typical turn
 * produces 1-4 cards; MAX_BLOCKS only ever matters on the rare complex one.
 */
import type { AssistantChatCard } from './chat-schema';

/**
 * Direct answer/decision framing first, then the facts a decision rests on
 * (project state, cost/scenario numbers), then supporting evidence, then
 * what's still uncertain, then what to do about it. Same shape the
 * directive itself asks for: answer → facts → numbers → evidence →
 * uncertainty → next action.
 */
const PRIORITY: Record<AssistantChatCard['type'], number> = {
  decision_summary: 0,
  project_snapshot: 1,
  analysis_result: 1,
  ecowoods_band: 2,
  scenario_comparison: 2,
  evidence: 3,
  risk: 4,
  property_context: 5,
  market_context: 5,
  pending_provider: 5,
  sequence: 6,
  next_action: 7,
  conversion_proposed: 7,
  site_link: 8,
  renovation_analysis_offer: 9,
};

const MAX_BLOCKS = 8;

/** Two ecowoods_band cards quoting the identical range are the same fact said twice — keep the first. */
function dedupeCostRanges(cards: AssistantChatCard[]): AssistantChatCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (c.type !== 'ecowoods_band' || c.minCad == null || c.maxCad == null) return true;
    const key = `${c.minCad}-${c.maxCad}-${c.scope ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function composeAnswerBlocks(cards: AssistantChatCard[]): AssistantChatCard[] {
  return dedupeCostRanges(cards)
    .map((card, index) => ({ card, index }))
    .sort((a, b) => PRIORITY[a.card.type] - PRIORITY[b.card.type] || a.index - b.index)
    .slice(0, MAX_BLOCKS)
    .map((x) => x.card);
}
