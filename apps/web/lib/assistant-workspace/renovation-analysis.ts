/**
 * lib/assistant-workspace/renovation-analysis.ts — a real, deterministic
 * capability behind `analyze_renovation_priorities` (chat-tools.ts).
 *
 * Phase 2 directive rule 26: "This must be a real capability. Not a
 * paywalled paragraph." So this is a pure function over Project Decision
 * State — no LLM call, no invented facts about THIS house. It only:
 *
 *  1. Reads which trades the visitor has actually mentioned
 *     (state.personalization.otherTrades, state.objective for floors) —
 *     never infers a trade nobody mentioned.
 *  2. Applies two GENERAL renovation-sequencing principles (envelope before
 *     finishes; resale-impact-first when selling soon) — standard contractor
 *     guidance, not a claim about condition/severity this house's data
 *     doesn't support. It never says "your roof is failing" or invents a
 *     timeline; it says why one thing conventionally comes before another.
 *  3. Never assigns a dollar figure — that stays get_ecowoods_band's job for
 *     floors/stairs, and get_market_cost's (honest pending_key) for
 *     everything else.
 *
 * This runs free every time — see ASSISTANT_MONETIZATION_SPEC.md for why the
 * deeper, written/paid version is architecture-only in this pass rather than
 * wired to a real price.
 */
import type { WorkspaceState } from './types';
import { totalSquareFeet } from './state';

export interface RenovationPriorityItem {
  /** 'floor' | 'stairs' | a key from otherTrades (e.g. 'roof', 'kitchen'). */
  key: string;
  label: string;
  /** 1 = do first. */
  rank: number;
  reason: string;
}

export interface RenovationSequenceResult {
  items: RenovationPriorityItem[];
  /** How many independent, visitor-stated signals this ran on — see deepAnalysisEligible. */
  knownSignals: number;
  /** One sentence Francisco can say close to verbatim. */
  summary: string;
  /**
   * True once there's enough stated project context (3+ signals: at least
   * two projects plus one of sell horizon / floor condition / square
   * footage) that a deeper, written comparison would carry real information
   * beyond what this free pass already said — the gate `propose_paid_analysis`
   * checks before offering the deeper product (rule 26's "worth paying for"
   * moment), not a turn-count or engagement-time heuristic.
   */
  deepAnalysisEligible: boolean;
}

const TRADE_LABELS: Record<string, string> = {
  roof: 'Roof',
  roofing: 'Roof',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  windows: 'Windows',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  siding: 'Siding',
  foundation: 'Foundation',
  addition: 'Addition',
  landscaping: 'Landscaping',
  pool: 'Pool',
};

/** Envelope/structural trades — conventionally sequenced before interior finish work regardless of sell horizon. */
const ENVELOPE_TRADES = new Set(['roof', 'roofing', 'foundation', 'siding', 'windows']);

/** Shared by chat-tools.ts (market-cost card titles) so there is one trade-label map, not two. */
export function tradeLabel(key: string): string {
  return TRADE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Rule-based sequencing over whatever the visitor has actually named. Returns
 * null when fewer than two distinct projects are known — there is nothing to
 * sequence yet (directive: zero cards is a valid, correct outcome).
 */
export function computeRenovationSequence(state: WorkspaceState): RenovationSequenceResult | null {
  const items: { key: string; label: string; envelope: boolean }[] = [];

  const otherTrades = state.personalization.otherTrades ?? {};
  for (const [key, status] of Object.entries(otherTrades)) {
    if (!status) continue;
    items.push({ key, label: tradeLabel(key), envelope: ENVELOPE_TRADES.has(key) });
  }

  const floorMentioned =
    state.objective === 'refinish' ||
    state.objective === 'repair' ||
    (state.objective === 'install' && Boolean(state.targetFloor.productId)) ||
    Boolean(state.personalization.floorCondition);
  if (floorMentioned) {
    items.push({ key: 'floor', label: state.stairs ? 'Floors and stairs' : 'Floors', envelope: false });
  }

  if (items.length < 2) return null;

  const sellingSoon = state.sellHorizon === 'selling-soon';
  const ranked = [...items].sort((a, b) => {
    // Envelope work first regardless of sell horizon — water/structure damage compounds into whatever's finished after it.
    if (a.envelope !== b.envelope) return a.envelope ? -1 : 1;
    // Among non-envelope items, selling soon favours the ones with the most direct resale/showing impact (floors) first.
    if (sellingSoon) {
      if (a.key === 'floor' !== (b.key === 'floor')) return a.key === 'floor' ? -1 : 1;
    }
    return 0;
  });

  const reasonFor = (item: (typeof items)[number], rank: number): string => {
    if (item.envelope) {
      return 'Envelope and structural work conventionally comes first — finish work done before it is at risk of redoing.';
    }
    if (sellingSoon && item.key === 'floor') {
      return 'Selling within a year — floors are one of the first things a buyer’s agent photographs, so they carry more showing impact per dollar than most interior work.';
    }
    if (rank === 1) return 'Nothing else you’ve mentioned depends on this being done first.';
    return 'Reasonable to sequence after the items above, based on what you’ve told me so far.';
  };

  const rankedItems: RenovationPriorityItem[] = ranked.map((item, i) => ({
    key: item.key,
    label: item.label,
    rank: i + 1,
    reason: reasonFor(item, i + 1),
  }));

  const knownSignals =
    rankedItems.length +
    (state.sellHorizon ? 1 : 0) +
    (state.personalization.floorCondition ? 1 : 0) +
    (totalSquareFeet(state) !== undefined ? 1 : 0) +
    (state.personalization.neighbourhood ? 1 : 0);

  const order = rankedItems.map((i) => i.label).join(', then ');
  const summary = `Based on what you've told me, a reasonable order is: ${order}.`;

  return {
    items: rankedItems,
    knownSignals,
    summary,
    deepAnalysisEligible: rankedItems.length >= 2 && knownSignals >= 4,
  };
}
