/**
 * lib/assistant-workspace/types.ts — the shape of Project Decision State.
 *
 * ASSISTANT-02. See docs/assistant-workspace/NEW_ASSISTANT_ARCHITECTURE.md's
 * `WorkspaceState` sketch — this is that object, typed for real. Fields are
 * restricted to what the Phase 0 docs allow: catalog ids the visitor picked,
 * never an invented product; a country the visitor set, never one inferred
 * from IP; square footage the visitor typed, never one guessed from a photo
 * (room.ts's own law). No money field exists here — ECONOMICS_MODEL_SPEC's
 * pure functions own that, and they don't exist yet (ASSISTANT-04).
 *
 * ONE canonical shape. Nothing in this workspace keeps a second, competing
 * state object — see docs/assistant-workspace/NO_DUPLICATION_GUARANTEE.md.
 */
import type { PriceCountry } from '@/content/constants/pricing';

/** What the visitor is here to do. Not inferred — asked, or left null. */
export type WorkspaceObjective = 'install' | 'refinish' | 'repair' | 'not-sure';

/**
 * Whether the project is for living in or for sale — bears on which value
 * scenario (ASSISTANT-05, not built yet) would even apply. Held here now so
 * that phase has something real to read instead of re-asking.
 */
export type WorkspaceSellHorizon = 'staying' | 'selling-soon' | 'not-sure';

/**
 * Catalog ids only — never a name typed free-hand. Each id is validated
 * against the live catalog before it is accepted (see state.ts), so a
 * retired product or a typo resolves to "not set," never to a stale or
 * invented entry.
 */
export interface WorkspaceFloorPreference {
  /** FLOOR_PRODUCTS id (lib/floor-studio/catalog.ts). */
  productId?: string;
  /** FINISH_OPTIONS id (packages/shared/ai). */
  finishId?: string;
  /** PATTERN_OPTIONS id (packages/shared/ai). */
  patternId?: string;
  /** BOARD_WIDTHS id (lib/floor-studio/catalog.ts). */
  widthId?: string;
}

/** One room's optional square footage. No room TYPE guess — see room.ts. */
export interface WorkspaceRoom {
  label: string;
  squareFeet?: number;
}

export type WorkspaceNextAction = 'measure' | 'estimate' | 'quote';

/**
 * A trade Ecowoods does NOT install (see chat-tools.ts's NON_FLOOR_TRADES —
 * imported, not re-listed, so there is one list of trade names). What the
 * homeowner has actually said about it — never inferred, never a guess at
 * urgency or cost.
 */
export type TradeMentionStatus = 'mentioned' | 'planned' | 'in-progress' | 'done';

/**
 * Personalization memory (Phase 2 / rule 4-5 of the directive): facts the
 * homeowner stated once, so the conversation never re-asks for them.
 * Every field here is either typed by the visitor or copied verbatim from
 * something they said — never inferred, never geocoded, never enriched.
 */
export interface WorkspacePersonalization {
  /** Neighbourhood/area as the visitor typed it (e.g. "Rexdale") — never resolved to an address or geocoded. */
  neighbourhood?: string;
  /** Free-text description of the CURRENT floor's condition as the visitor described it (e.g. "scratched and dull"). Never a diagnosis Francisco invented. */
  floorCondition?: string;
  /** Non-floor trades the visitor has mentioned wanting/needing done, and what they said about each — never a price, never an Ecowoods commitment. */
  otherTrades: Partial<Record<string, TradeMentionStatus>>;
}

/**
 * Which proposed actions (AssistantChatCard.id) this visitor has already
 * dismissed or completed — so the same card is never resurfaced after a
 * "no thanks," and a completed one doesn't linger as if untouched (rule
 * 20-21, 31-32). Ids are stable per action instance (see chat-tools.ts's
 * `actionId`), not per render.
 */
export interface WorkspaceActionMemory {
  dismissed: string[];
  completed: string[];
}

/**
 * Project Decision State — the central object. Everything else in the
 * workspace (conversation, cards, the economics rail) reads and patches
 * this, never a parallel copy of it.
 */
export interface WorkspaceState {
  /**
   * Minted via ensureDesignId() (lib/floor-studio/design-id.ts), same id
   * space as Floor Studio. Empty string until the client mints one — see
   * that module's own warning against minting during server render. Never a
   * user, session or tracking id: it names this DESIGN, so a link shared
   * with a spouse opens the same one.
   */
  designId: string;
  /**
   * The Floor Studio share code, carried verbatim when a bridge (ASSISTANT-06)
   * hands one over. Never decoded or re-rendered here — that would be a
   * second description of one floor. Absent in this phase; the field exists
   * now so ASSISTANT-06 extends this type instead of replacing it.
   */
  designCode?: string;
  country: PriceCountry;
  objective: WorkspaceObjective | null;
  sellHorizon: WorkspaceSellHorizon | null;
  stairs: boolean;
  rooms: WorkspaceRoom[];
  /** What's there now — set when the objective is refinish/repair. */
  currentFloor: WorkspaceFloorPreference;
  /** What the visitor wants. */
  targetFloor: WorkspaceFloorPreference;
  /** SERVICES slugs (lib/seo-data.ts), never an invented service. */
  selectedServiceSlugs: string[];
  /** Things this workspace still needs to know, in plain language. */
  pendingQuestions: string[];
  nextAction: WorkspaceNextAction | null;
  personalization: WorkspacePersonalization;
  actionMemory: WorkspaceActionMemory;
  /** ISO timestamp of the last change. */
  updatedAt: string;
}

/** A partial update applied against the current state — see state.ts's `applyPatch`. */
export type WorkspacePatch = Partial<
  Omit<
    WorkspaceState,
    'currentFloor' | 'targetFloor' | 'rooms' | 'selectedServiceSlugs' | 'pendingQuestions' | 'personalization' | 'actionMemory'
  >
> & {
  currentFloor?: Partial<WorkspaceFloorPreference>;
  targetFloor?: Partial<WorkspaceFloorPreference>;
  /** Whole-array replacements — callers build the next array, applyPatch doesn't merge these. */
  rooms?: WorkspaceRoom[];
  selectedServiceSlugs?: string[];
  pendingQuestions?: string[];
  /** Merges field-by-field, same discipline as currentFloor/targetFloor — a patch naming only `neighbourhood` doesn't erase `floorCondition`. */
  personalization?: Partial<Omit<WorkspacePersonalization, 'otherTrades'>> & {
    otherTrades?: Partial<Record<string, TradeMentionStatus>>;
  };
};
