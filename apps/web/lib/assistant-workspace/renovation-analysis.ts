/**
 * lib/assistant-workspace/renovation-analysis.ts — the paid product itself.
 *
 * A pure, synchronous, deterministic function over Project Decision State.
 * No LLM call, no network I/O, no invented numbers — the same discipline
 * economics.ts already holds this workspace to, applied to sequencing
 * instead of pricing. This is a deliberate choice, not a shortcut:
 *
 *   - It is what makes lib/credit-ledger.ts's transactional charge safe.
 *     A network call inside a database transaction is a lock held for as
 *     long as a third party takes to answer; a pure function returns before
 *     the transaction has done anything else.
 *   - It is what makes "the paid result is worth paying for" a claim this
 *     file can be tested against directly (renovation-analysis.test.ts),
 *     rather than a claim that depends on what a model happened to write.
 *   - It is what keeps every dollar in the result traceable to
 *     `calculateProjectRange` / `bandForCountry` — the one place this whole
 *     codebase is allowed to state an Ecowoods price — instead of a second,
 *     competing description of the same bands.
 *
 * WHAT MAKES THIS MORE THAN "A LONGER PARAGRAPH": every section is built
 * from a distinct computation (sequencing heuristic, published pricing
 * bands, an explicit known/estimated/assumption/unavailable tag per fact),
 * not from concatenating the conversation. Two homeowners with different
 * `WorkspaceSnapshot`s get different sequences, different cost views and
 * different next steps — never the same shape re-filled with their words.
 */
import { bandForCountry } from '@/content/constants/pricing';
import type { PriceCountry } from '@/content/constants/pricing';
import { SERVICES } from '@/lib/seo-data';
import { calculateProjectRange, formatMoneyRange, type Money } from './economics';
import { hydrateWorkspaceState, totalSquareFeet, describeFloorPreference } from './state';
import { pricingKeyForService } from './recommendations';
import type { WorkspaceSnapshot } from './chat-schema';
import type { WorkspaceState, WorkspaceNextAction } from './types';

export type EvidenceTag = 'known' | 'estimated' | 'assumption' | 'inspection-needed' | 'external-data-unavailable';

export interface EvidenceItem {
  label: string;
  tag: EvidenceTag;
}

export interface CostViewItem {
  label: string;
  /** Present only when a real, published Ecowoods band supports it — never a filled-in guess. */
  range?: { formatted: string; min: number; max: number; currency: string };
  tag: EvidenceTag;
  note: string;
}

export interface SequenceStep {
  order: number;
  title: string;
  why: string;
}

export interface RenovationAnalysisResult {
  /** Which version of this engine produced the result — bumped whenever the section shape changes. */
  engineVersion: 1;
  generatedAt: string;
  decision: string;
  currentContext: EvidenceItem[];
  recommendedSequence: SequenceStep[];
  costView: CostViewItem[];
  valueAndTiming: string[];
  risksAndUnknowns: EvidenceItem[];
  nextStep: { action: WorkspaceNextAction | 'qualified-assessment'; label: string; why: string };
}

function serviceName(slug: string): string {
  return SERVICES.find((s) => s.slug === slug)?.name ?? slug;
}

/** Ecowoods executes floor/stair work only — see the ecowoods skill's published-services law. */
function isEcowoodsExecutable(slug: string): boolean {
  return SERVICES.some((s) => s.slug === slug);
}

function toWorkspaceState(snapshot: WorkspaceSnapshot): WorkspaceState {
  // hydrateWorkspaceState is the SAME sanitiser persistence.ts uses on a
  // value read back from localStorage — reused here so a snapshot with a
  // stale/invalid catalog id resolves to "not set," never to an invented one,
  // and so this engine never carries a second, parallel normalisation of
  // Project Decision State.
  return hydrateWorkspaceState(snapshot as Partial<WorkspaceState>, snapshot.designId || 'renovation-analysis', new Date().toISOString());
}

/**
 * Server-side eligibility gate — re-checked here (never trusted from the
 * client) before a checkout or an analysis run is allowed. "Enough context
 * to be worth paying for," not "any context at all": an objective alone,
 * with nothing else, is not a project yet.
 */
export function isEligibleForAnalysis(snapshot: WorkspaceSnapshot): { eligible: boolean; reason?: string } {
  if (!snapshot.objective) {
    return { eligible: false, reason: 'Tell me what you want done first — install, refinish, or repair.' };
  }
  const state = toWorkspaceState(snapshot);
  const hasScope = totalSquareFeet(state) !== undefined || state.selectedServiceSlugs.length > 0;
  const hasTiming = Boolean(state.sellHorizon);
  if (!hasScope && !hasTiming) {
    return {
      eligible: false,
      reason: "I need a bit more to make this worth paying for — square footage, a service, or your timeline.",
    };
  }
  return { eligible: true };
}

function buildCurrentContext(state: WorkspaceState, sqft: number | undefined): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  items.push({
    label: `Goal: ${state.objective === 'not-sure' || !state.objective ? 'not yet decided' : state.objective}`,
    tag: state.objective && state.objective !== 'not-sure' ? 'known' : 'assumption',
  });
  items.push({
    label: state.sellHorizon
      ? `Timing: ${state.sellHorizon === 'selling-soon' ? 'selling within the next year or so' : state.sellHorizon === 'staying' ? 'staying long-term' : 'not decided yet'}`
      : 'Timing: not stated',
    tag: state.sellHorizon && state.sellHorizon !== 'not-sure' ? 'known' : 'assumption',
  });
  if (sqft !== undefined) {
    items.push({ label: `Area discussed: ${sqft.toLocaleString('en-CA')} sq ft`, tag: 'known' });
  } else {
    items.push({ label: 'Area: not measured yet', tag: 'inspection-needed' });
  }
  if (state.selectedServiceSlugs.length) {
    items.push({ label: `Services discussed: ${state.selectedServiceSlugs.map(serviceName).join(', ')}`, tag: 'known' });
  }
  const floorDesc = describeFloorPreference(state.targetFloor);
  if (floorDesc !== '—') {
    items.push({ label: `Target floor: ${floorDesc}`, tag: 'known' });
  }
  if (state.stairs) {
    items.push({ label: 'Stairs are part of this project', tag: 'known' });
  }
  return items;
}

/**
 * Rule-based, not invented per-homeowner. Two facts drive it: whether the
 * work touches structural/whole-floor scope before a cosmetic one, and
 * whether a near-term sale changes which work pays back before closing.
 * Every step names the fact that earned its position — never a "best
 * practice" sentence with nothing this homeowner said behind it.
 */
function buildSequence(state: WorkspaceState, country: PriceCountry): SequenceStep[] {
  const steps: SequenceStep[] = [];
  const sellingSoon = state.sellHorizon === 'selling-soon';
  const hasFloorWork = state.selectedServiceSlugs.some(isEcowoodsExecutable) || (state.objective === 'refinish' || state.objective === 'install');
  const otherTrades = state.selectedServiceSlugs.filter((s) => !isEcowoodsExecutable(s));

  if (hasFloorWork) {
    steps.push({
      order: steps.length + 1,
      title: state.objective === 'install' ? 'New hardwood installation' : 'Floor refinishing / repair',
      why: sellingSoon
        ? 'Floors are one of the most visible finishes to a buyer, and doing them before other cosmetic work means later trades (paint, staging) don\'t risk damaging a freshly finished floor.'
        : 'You told me this floor is the current focus — sequencing it before other cosmetic work avoids redoing protection/dust control twice.',
    });
  }

  if (otherTrades.length) {
    steps.push({
      order: steps.length + 1,
      title: `Scope and quote: ${otherTrades.map(serviceName).join(', ')}`,
      why: 'These are outside what Ecowoods executes, so the next step is a qualified quote for them — not a number invented here.',
    });
  }

  if (sellingSoon) {
    steps.push({
      order: steps.length + 1,
      title: 'Cosmetic touch-ups last, right before listing',
      why: 'Paint, staging and minor repairs hold their finish best when they happen closest to the sale — doing them earlier risks marks from the trades above.',
    });
  } else if (state.objective === 'not-sure' || !state.objective) {
    steps.push({
      order: steps.length + 1,
      title: 'Decide the primary goal',
      why: 'The rest of this sequence depends on whether this is a install, a refinish, or a repair — that has not been stated yet.',
    });
  }

  if (!steps.length) {
    steps.push({
      order: 1,
      title: 'Get a free in-home measure',
      why: 'There is not yet enough stated scope to sequence multiple trades — a measure turns the discussion into real numbers.',
    });
  }

  void country;
  return steps;
}

function buildCostView(state: WorkspaceState, sqft: number | undefined): CostViewItem[] {
  const items: CostViewItem[] = [];
  const keys = new Set(state.selectedServiceSlugs.map((s) => pricingKeyForService(s)).filter((k): k is NonNullable<typeof k> => Boolean(k)));

  if (sqft !== undefined && keys.size) {
    for (const key of keys) {
      const band = bandForCountry(key, state.country);
      const range: Money = calculateProjectRange({ pricingKey: key, squareFeet: sqft, country: state.country, productId: state.targetFloor.productId });
      items.push({
        label: band.label,
        range: { formatted: formatMoneyRange(range), min: range.min, max: range.max, currency: range.currency },
        tag: 'known',
        note: `Published Ecowoods band at ${sqft.toLocaleString('en-CA')} sq ft.`,
      });
    }
  } else if (keys.size && sqft === undefined) {
    items.push({ label: 'Floor work', tag: 'inspection-needed', note: 'A published range needs square footage — not yet stated. A free in-home measure gets an exact number.' });
  }

  const otherTrades = state.selectedServiceSlugs.filter((s) => !isEcowoodsExecutable(s));
  for (const slug of otherTrades) {
    items.push({
      label: serviceName(slug),
      tag: 'external-data-unavailable',
      note: 'Ecowoods does not price or execute this trade — no invented figure. Get a quote from a qualified provider.',
    });
  }

  if (!items.length) {
    items.push({ label: 'Scope not yet priced', tag: 'inspection-needed', note: 'No service or square footage stated yet.' });
  }

  return items;
}

function buildValueAndTiming(state: WorkspaceState): string[] {
  const lines: string[] = [];
  if (state.sellHorizon === 'selling-soon') {
    lines.push(
      'Selling within the next year changes which work is worth doing: cosmetic, highly visible finishes (like floors) tend to influence buyer impression more than work a buyer cannot see, but this is a general pattern, not an appraisal of your specific house.',
    );
    lines.push('No estimate of your sale price or return on any specific renovation is given here — that requires a real appraisal or a realtor\'s opinion, not this workspace.');
  } else if (state.sellHorizon === 'staying') {
    lines.push('Since you\'re staying, sequencing can prioritize what affects daily use most, rather than what a buyer would notice first.');
  } else {
    lines.push('Timing (staying vs. selling) changes the right sequence — worth deciding before locking in an order of work.');
  }
  return lines;
}

function buildRisks(state: WorkspaceState, sqft: number | undefined): EvidenceItem[] {
  const risks: EvidenceItem[] = [];
  if (sqft === undefined) risks.push({ label: 'Exact area not measured — costs above are ranges, not quotes.', tag: 'inspection-needed' });
  if (!state.sellHorizon || state.sellHorizon === 'not-sure') risks.push({ label: 'Sale timing not decided — sequence may change once it is.', tag: 'assumption' });
  const otherTrades = state.selectedServiceSlugs.filter((s) => !isEcowoodsExecutable(s));
  if (otherTrades.length) risks.push({ label: `${otherTrades.map(serviceName).join(', ')} pricing requires a qualified provider quote — not available here.`, tag: 'external-data-unavailable' });
  if (!risks.length) risks.push({ label: 'No major open unknowns given what you\'ve told me — a free in-home measure still confirms exact figures.', tag: 'known' });
  return risks;
}

function buildNextStep(state: WorkspaceState, hasFloorWork: boolean): RenovationAnalysisResult['nextStep'] {
  if (hasFloorWork) {
    const action: WorkspaceNextAction = state.nextAction ?? 'measure';
    return {
      action,
      label: action === 'quote' ? 'Request a quote' : action === 'estimate' ? 'Get an estimate' : 'Request a free in-home measure',
      why: 'This turns the floor portion of this sequence into an exact number, from the trade this analysis can actually execute.',
    };
  }
  return {
    action: 'qualified-assessment',
    label: 'Get a qualified assessment for the non-floor work',
    why: 'The next-highest-value step is outside Ecowoods\' scope — a licensed provider for that trade, not a number invented here.',
  };
}

export function buildRenovationAnalysis(snapshot: WorkspaceSnapshot): RenovationAnalysisResult {
  const state = toWorkspaceState(snapshot);
  const sqft = totalSquareFeet(state);
  const hasFloorWork = state.selectedServiceSlugs.some(isEcowoodsExecutable) || state.objective === 'refinish' || state.objective === 'install';

  const decision =
    state.objective && state.objective !== 'not-sure'
      ? `What order to do the work in, given you want to ${state.objective} and ${
          state.sellHorizon === 'selling-soon' ? 'plan to sell within the next year or so' : state.sellHorizon === 'staying' ? 'plan to stay long-term' : 'haven\'t decided on timing yet'
        }.`
      : 'What to prioritize first, before the specific renovation goal has been decided.';

  return {
    engineVersion: 1,
    generatedAt: new Date().toISOString(),
    decision,
    currentContext: buildCurrentContext(state, sqft),
    recommendedSequence: buildSequence(state, state.country),
    costView: buildCostView(state, sqft),
    valueAndTiming: buildValueAndTiming(state),
    risksAndUnknowns: buildRisks(state, sqft),
    nextStep: buildNextStep(state, hasFloorWork),
  };
}
