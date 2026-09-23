/**
 * lib/assistant-workspace/value-scenario.ts — honest value *scenarios*.
 *
 * ASSISTANT-05. Implements docs/assistant-workspace/VALUE_SCENARIO_SPEC.md.
 * Pure functions only: no LLM in the call graph, no network I/O, no fs read.
 * `buildValueScenario` takes Project Decision State, the project's already-
 * computed cost basis (`ProjectRangeResult` from economics.ts — never
 * recomputed here), and an evidence pool the CALLER loaded (case-study
 * content is filesystem-backed and server-only; see
 * value-scenario-evidence.ts for the thin, non-pure adapter that reads it).
 *
 * THE HONEST STARTING POINT
 *
 * Every published Ecowoods case study today documents a NEW-FLOOR
 * installation — subfloor preparation, moisture-vapor readings, species
 * selection (see each .mdx's `subfloorMoistureReading` field). None documents
 * a screen-and-recoat or sand-and-finish-only scope, and NONE records a
 * resale-value, cost-recovery or sale-price outcome of any kind — their
 * `results` are technical (moisture readings, material yield), not value
 * evidence. That is not a placeholder gap this module works around; it is
 * the real state of the evidence, and `buildValueScenario` reports it
 * exactly: `effect.range` is always `null` today, because nothing in this
 * codebase can quantify a value effect yet (E4+ evidence per the spec does
 * not exist). `confidence` still varies — it says how much documented
 * PRECEDENT exists at a comparable scope, not how confident anyone should be
 * in a dollar figure, because no dollar figure is ever produced here.
 */
import type { PricingService } from '@/lib/pricing';
import type { PriceCountry } from '@/content/constants/pricing';
import { distinctPricingKeys, type Money, type ProjectRangeResult } from './economics';
import { totalSquareFeet } from './state';
import type { WorkspaceObjective, WorkspaceState } from './types';

/**
 * E0–E7, scoped to `/assistant` only — see VALUE_SCENARIO_SPEC.md. Not
 * shared with, or imported from, any other product's evidence system.
 */
export type EvidenceTier = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7';

export interface EvidenceCitation {
  tier: EvidenceTier;
  /** E2 sources are labelled exactly this — never "verified" or "confirmed by data." */
  source: string;
  url?: string;
  /** What this evidence actually shows — plain language, never overstated. */
  note: string;
}

/**
 * `'high'` is deliberately not a member of this type. VALUE_SCENARIO_SPEC.md
 * reserves it for E4+ evidence, which does not exist in this codebase; rather
 * than gate that at runtime, the type makes emitting it impossible.
 */
export type ValueConfidence = 'low' | 'medium';

export interface ValueScenarioEffect {
  /** Always `null` today — see the module comment. Never a single figure. */
  range: { min: number; max: number } | null;
  /** 'qualitative' when no evidence quantifies a $ or % effect — the honest unit, not a placeholder. */
  unit: 'CAD' | 'USD' | 'qualitative';
  confidence: ValueConfidence;
}

export interface ValueScenarioScope {
  objective: WorkspaceObjective | null;
  squareFeet: number | undefined;
  country: PriceCountry;
  pricingKeys: PricingService[];
}

export interface ValueScenario {
  scope: ValueScenarioScope;
  /** = the project's cost basis, NET of any confirmed savings — see the module comment on double-counting. */
  costBasis: Money;
  effect: ValueScenarioEffect;
  evidence: EvidenceCitation[];
  assumptions: string[];
  limitations: string[];
  /** Always contains "scenario," "range," or "potential" — never "value"/"worth" alone. */
  label: string;
}

/** Mirrors economics.ts's own status union so callers branch on one shape, not two. */
export type ValueScenarioResult =
  | { status: 'ready'; scenario: ValueScenario }
  | { status: 'needs-sqft' }
  | { status: 'needs-service' };

/**
 * The minimal, serializable facts about a published case study this module
 * needs — never the full `CaseStudy` (content, images, challenges prose).
 * Built by value-scenario-evidence.ts from `case-study-loader.ts`'s real
 * frontmatter; nothing here is invented per-scenario.
 */
export interface CaseStudyEvidence {
  slug: string;
  title: string;
  /** `/case-studies/${slug}` — built once by the loader, never re-derived here. */
  url: string;
  squareFootage: number;
  neighbourhood: string;
  /**
   * True when the case study documents subfloor preparation (a
   * `subfloorMoistureReading`) — the signature of a NEW-FLOOR install,
   * distinct from resurfacing an existing one. Computed once by the loader
   * from a real, genuinely-optional frontmatter field, not guessed here.
   */
  documentsNewFloorInstall: boolean;
  /** True when the case study carries a published, attributed testimonial (VALUE_SCENARIO_SPEC's E3 bar). */
  hasAttributedTestimonial: boolean;
}

const LABEL = 'Potential resale-readiness scenario';

/**
 * A case study counts as "comparable scope" when it is shaped like the
 * project in state (install-vs-not, per `documentsNewFloorInstall`) and its
 * square footage is within a 0.4x–2.5x band of the project's own — a coarse,
 * documented heuristic for "roughly the same size job," not a market model.
 * Nothing here claims the case study is otherwise similar (species, budget,
 * neighbourhood) — that nuance belongs in the citation's `note`, not in
 * whether it counts.
 */
const MIN_SQFT_RATIO = 0.4;
const MAX_SQFT_RATIO = 2.5;

function isComparableScope(cs: CaseStudyEvidence, squareFeet: number, wantsInstall: boolean): boolean {
  if (cs.documentsNewFloorInstall !== wantsInstall) return false;
  const ratio = cs.squareFootage / squareFeet;
  return ratio >= MIN_SQFT_RATIO && ratio <= MAX_SQFT_RATIO;
}

/**
 * `buildValueScenario` — the one function that turns Project Decision State
 * plus its cost basis plus a real evidence pool into a `ValueScenario`.
 *
 * Never computes a dollar figure for `effect.range`: no evidence source
 * wired into this codebase (case studies, `claims.ts`, pricing constants)
 * quantifies a resale/value effect, so there is nothing honest to compute.
 * `confidence` is deterministic from evidence COUNT at a comparable scope —
 * never vibes, never raised to compensate for a null range.
 */
export function buildValueScenario(
  state: WorkspaceState,
  costBasis: ProjectRangeResult,
  evidencePool: readonly CaseStudyEvidence[],
): ValueScenarioResult {
  if (costBasis.status !== 'ready') return { status: costBasis.status };

  const squareFeet = totalSquareFeet(state);
  const pricingKeys = [...distinctPricingKeys(state)];
  /* Every published case study documents a new-floor install (see module
     comment) — so evidence can only match a project whose scope includes
     `newInstall`. A refinish-only or repair-only project gets zero matches
     today, honestly, not a fallback to a differently-shaped case study. */
  const wantsInstall = pricingKeys.includes('newInstall');

  const matched = squareFeet === undefined ? [] : evidencePool.filter((cs) => isComparableScope(cs, squareFeet, wantsInstall));

  const evidence: EvidenceCitation[] = matched.map((cs) => ({
    tier: cs.hasAttributedTestimonial ? 'E3' : 'E2',
    source: 'Ecowoods project record',
    url: cs.url,
    note: `${cs.squareFootage.toLocaleString()} sq ft documented project in ${cs.neighbourhood} — a technical/quality outcome record, not a resale-value measurement.`,
  }));
  evidence.push({
    tier: 'E0',
    source: 'Assumption',
    note: 'No Ecowoods data, independent study or market feed in this system quantifies a resale or sale-price effect for any renovation scope yet.',
  });

  const confidence: ValueConfidence = matched.length >= 2 ? 'medium' : 'low';

  const assumptions: string[] = [
    matched.length
      ? `Ecowoods has documented ${matched.length} comparable project${matched.length === 1 ? '' : 's'} at a similar scope and square footage.`
      : 'No documented Ecowoods project matches this scope and square footage yet.',
    'No independent market, appraisal, lending or resale data is used — none is wired into this system.',
    'This is a scenario, not an appraisal, and not a projection of any specific property’s future sale price.',
  ];

  const limitations: string[] = [
    'No evidence available to this system quantifies how this project affects resale value, sale price or buyer demand.',
    'Case-study evidence describes documented technical outcomes (moisture control, installation quality, material yield) — not price or market behaviour.',
    ...(wantsInstall ? [] : ['No published case study documents a refinish-only or repair-only scope yet.']),
  ];

  return {
    status: 'ready',
    scenario: {
      scope: { objective: state.objective, squareFeet, country: state.country, pricingKeys },
      costBasis: costBasis.total,
      effect: { range: null, unit: 'qualitative', confidence },
      evidence,
      assumptions,
      limitations,
      label: LABEL,
    },
  };
}
