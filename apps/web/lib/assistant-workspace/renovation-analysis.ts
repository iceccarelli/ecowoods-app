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
import { estimateInstalledRangeCad } from '@ecowoods/shared/ai';
import { bandForWork } from '@/content/constants/pricing';
import { FLOOR_PRODUCTS } from '@/lib/floor-studio/catalog';
import type { WorkspaceState } from './types';
import { totalSquareFeet } from './state';

/**
 * Bumped whenever `computeRenovationSequence` or
 * `buildDetailedRenovationAnalysis`'s LOGIC changes in a way that would
 * change a past result — persisted on every `RenovationAnalysis` row
 * (`engineVersion`) so a saved paid result always says which rules produced
 * it, per directive rule 25.
 */
export const RENOVATION_ANALYSIS_ENGINE_VERSION = '2026-09-23.1';

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

export interface DetailedAnalysisItem {
  key: string;
  label: string;
  rank: number;
  reason: string;
  /** A real published band, a real "not available" gap, or the floor's own missing-input note — never an invented number. */
  costContext: string;
  nextStep: string;
}

export interface DetailedRenovationAnalysis {
  engineVersion: string;
  items: DetailedAnalysisItem[];
  assumptions: string[];
  uncertainty: string[];
}

/**
 * The paid deliverable's actual content (directive rule 21-22): the same
 * deterministic sequencing as `computeRenovationSequence`, expanded with
 * real cost context (published Ecowoods bands where the floor project has
 * enough inputs; an honest gap otherwise — never a second, invented number
 * for a non-floor trade), explicit assumptions, and what's still uncertain.
 * Pure function — no LLM call, no external API, free to compute and free to
 * re-run; what the homeowner pays for is Francisco recognizing the moment
 * and assembling this, not the computation itself (see
 * ASSISTANT_UNIT_ECONOMICS.md).
 */
export function buildDetailedRenovationAnalysis(
  state: WorkspaceState,
  sequence: RenovationSequenceResult,
): DetailedRenovationAnalysis {
  const sqft = totalSquareFeet(state);

  const items: DetailedAnalysisItem[] = sequence.items.map((item) => {
    if (item.key === 'floor') {
      const productId = state.targetFloor.productId;
      const species = productId ? FLOOR_PRODUCTS.find((p) => p.id === productId)?.name : undefined;
      let costContext: string;
      if (species && sqft) {
        const band = bandForWork(species, state.country);
        const r = estimateInstalledRangeCad({ species, squareFeet: sqft }, band);
        costContext = `Published Ecowoods band: $${r.estimatedLowCad.toLocaleString('en-CA')}–$${r.estimatedHighCad.toLocaleString('en-CA')} CAD for ${sqft} sq ft (${r.species ?? species}). Needs an in-home measure to finalize.`;
      } else {
        costContext = sqft
          ? 'Species not yet chosen — published bands need a species to quote a range.'
          : 'Square footage not yet known — published bands need an area to quote a range.';
      }
      return {
        key: item.key,
        label: item.label,
        rank: item.rank,
        reason: item.reason,
        costContext,
        nextStep: 'Book a free in-home measure to turn this into a written price.',
      };
    }
    return {
      key: item.key,
      label: item.label,
      rank: item.rank,
      reason: item.reason,
      costContext: `No verified cost data available for ${item.label.toLowerCase()} yet — Ecowoods does not install this trade, so no Ecowoods band applies here.`,
      nextStep: `Get a quote from a licensed ${item.label.toLowerCase()} contractor once the sequence above is confirmed.`,
    };
  });

  const assumptions = [
    'This order assumes none of the projects you described is an active emergency beyond what you told me (for example, an active leak) — an emergency always comes first regardless of this sequence.',
    'Each project is treated as independent unless you told me otherwise — if two projects share a contractor, material, or access window, the real sequence may shift.',
  ];

  const uncertainty: string[] = [];
  if (!sqft) uncertainty.push('Floor square footage is not yet known.');
  if (state.objective === 'install' && !state.targetFloor.productId) uncertainty.push('A species has not been chosen for the new floor.');
  for (const q of state.pendingQuestions) uncertainty.push(q);
  if (!uncertainty.length) uncertainty.push('Nothing outstanding from what you’ve told me so far — the gaps above are the ones that would change a number, not the order.');

  return { engineVersion: RENOVATION_ANALYSIS_ENGINE_VERSION, items, assumptions, uncertainty };
}
