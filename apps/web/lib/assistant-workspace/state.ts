/**
 * lib/assistant-workspace/state.ts — pure functions over Project Decision
 * State. No window, no localStorage, no React — see persistence.ts for the
 * I/O shell around these. Kept separate so the logic that matters (what a
 * valid state looks like, how a patch applies) is testable without a DOM.
 */
import type { PriceCountry } from '@/content/constants/pricing';
import { productById, widthById, FLOOR_PRODUCTS, BOARD_WIDTHS } from '@/lib/floor-studio/catalog';
import { countryOf } from '@/lib/floor-studio/studio-config';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { SERVICES } from '@/lib/seo-data';
import type {
  TradeMentionStatus,
  WorkspaceActionMemory,
  WorkspaceFloorPreference,
  WorkspaceNextAction,
  WorkspaceObjective,
  WorkspacePatch,
  WorkspacePersonalization,
  WorkspaceRoom,
  WorkspaceSellHorizon,
  WorkspaceState,
} from './types';

const OBJECTIVES: WorkspaceObjective[] = ['install', 'refinish', 'repair', 'not-sure'];
const SELL_HORIZONS: WorkspaceSellHorizon[] = ['staying', 'selling-soon', 'not-sure'];
const NEXT_ACTIONS: WorkspaceNextAction[] = ['measure', 'estimate', 'quote'];
const TRADE_MENTION_STATUSES: TradeMentionStatus[] = ['mentioned', 'planned', 'in-progress', 'done'];

export const isWorkspaceObjective = (v: unknown): v is WorkspaceObjective =>
  typeof v === 'string' && (OBJECTIVES as string[]).includes(v);

export const isWorkspaceSellHorizon = (v: unknown): v is WorkspaceSellHorizon =>
  typeof v === 'string' && (SELL_HORIZONS as string[]).includes(v);

export const isWorkspaceNextAction = (v: unknown): v is WorkspaceNextAction =>
  typeof v === 'string' && (NEXT_ACTIONS as string[]).includes(v);

export const isTradeMentionStatus = (v: unknown): v is TradeMentionStatus =>
  typeof v === 'string' && (TRADE_MENTION_STATUSES as string[]).includes(v);

/**
 * A default, unminted state. `designId` is empty — minting happens client-side
 * only, per lib/floor-studio/design-id.ts's warning against minting during
 * server render. Used for the server-rendered first paint and as the base a
 * client hydration either replaces (a saved design exists) or mints onto
 * (it doesn't).
 */
export function defaultWorkspaceState(now: () => string = () => new Date().toISOString()): WorkspaceState {
  return {
    designId: '',
    country: 'CA',
    objective: null,
    sellHorizon: null,
    stairs: false,
    rooms: [],
    currentFloor: {},
    targetFloor: {},
    selectedServiceSlugs: [],
    pendingQuestions: [],
    nextAction: null,
    personalization: { otherTrades: {} },
    actionMemory: { dismissed: [], completed: [] },
    updatedAt: now(),
  };
}

/** Only ids that resolve against the live catalog survive — see the module comment in types.ts. */
function sanitizeFloorPreference(pref: WorkspaceFloorPreference | undefined): WorkspaceFloorPreference {
  if (!pref) return {};
  const out: WorkspaceFloorPreference = {};
  if (pref.productId && productById(pref.productId)) out.productId = pref.productId;
  if (pref.finishId && FINISH_OPTIONS.some((f) => f.id === pref.finishId)) out.finishId = pref.finishId;
  if (pref.patternId && PATTERN_OPTIONS.some((p) => p.id === pref.patternId)) out.patternId = pref.patternId;
  if (pref.widthId && widthById(pref.widthId)) out.widthId = pref.widthId;
  return out;
}

function sanitizeRooms(rooms: unknown): WorkspaceRoom[] {
  if (!Array.isArray(rooms)) return [];
  return rooms
    .filter((r): r is WorkspaceRoom => !!r && typeof r === 'object' && typeof (r as WorkspaceRoom).label === 'string')
    .map((r) => ({
      label: r.label.slice(0, 80),
      ...(typeof r.squareFeet === 'number' && r.squareFeet > 0 && r.squareFeet < 20000
        ? { squareFeet: Math.round(r.squareFeet) }
        : {}),
    }));
}

function sanitizeServiceSlugs(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return [];
  const known = new Set(SERVICES.map((s) => s.slug));
  const seen = new Set<string>();
  for (const s of slugs) {
    if (typeof s === 'string' && known.has(s)) seen.add(s);
  }
  return [...seen];
}

function sanitizeQuestions(questions: unknown): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.filter((q): q is string => typeof q === 'string').slice(0, 20).map((q) => q.slice(0, 200));
}

/** Caps size/length only — trade names are labels rendered as text, not executed, so no catalog whitelist here (chat-tools.ts's isNonFloorTrade already gates what gets written). */
function sanitizeOtherTrades(raw: unknown): WorkspacePersonalization['otherTrades'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: WorkspacePersonalization['otherTrades'] = {};
  let count = 0;
  for (const [trade, status] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 12) break;
    if (typeof trade !== 'string' || !trade.trim() || !isTradeMentionStatus(status)) continue;
    out[trade.trim().slice(0, 40).toLowerCase()] = status;
    count += 1;
  }
  return out;
}

function sanitizePersonalization(raw: Partial<WorkspacePersonalization> | undefined): WorkspacePersonalization {
  const out: WorkspacePersonalization = { otherTrades: sanitizeOtherTrades(raw?.otherTrades) };
  if (typeof raw?.neighbourhood === 'string' && raw.neighbourhood.trim()) {
    out.neighbourhood = raw.neighbourhood.trim().slice(0, 80);
  }
  if (typeof raw?.floorCondition === 'string' && raw.floorCondition.trim()) {
    out.floorCondition = raw.floorCondition.trim().slice(0, 200);
  }
  return out;
}

function sanitizeActionIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) seen.add(id.trim().slice(0, 120));
    if (seen.size >= 200) break;
  }
  return [...seen];
}

function sanitizeActionMemory(raw: Partial<WorkspaceActionMemory> | undefined): WorkspaceActionMemory {
  return {
    dismissed: sanitizeActionIds(raw?.dismissed),
    completed: sanitizeActionIds(raw?.completed),
  };
}

/**
 * Apply a patch and return a NEW state — never mutates. `currentFloor` and
 * `targetFloor` merge field-by-field (a patch naming only `productId`
 * shouldn't erase a finish already chosen); `rooms`, `selectedServiceSlugs`
 * and `pendingQuestions` are whole-array replacements, so a caller wanting
 * to add one room builds `[...state.rooms, next]` itself.
 */
export function applyPatch(
  state: WorkspaceState,
  patch: WorkspacePatch,
  now: () => string = () => new Date().toISOString(),
): WorkspaceState {
  const next: WorkspaceState = {
    ...state,
    ...patch,
    country: patch.country ? countryOf(patch.country) : state.country,
    objective: patch.objective !== undefined ? patch.objective : state.objective,
    sellHorizon: patch.sellHorizon !== undefined ? patch.sellHorizon : state.sellHorizon,
    currentFloor: sanitizeFloorPreference({ ...state.currentFloor, ...patch.currentFloor }),
    targetFloor: sanitizeFloorPreference({ ...state.targetFloor, ...patch.targetFloor }),
    rooms: patch.rooms ? sanitizeRooms(patch.rooms) : state.rooms,
    selectedServiceSlugs: patch.selectedServiceSlugs
      ? sanitizeServiceSlugs(patch.selectedServiceSlugs)
      : state.selectedServiceSlugs,
    pendingQuestions: patch.pendingQuestions ? sanitizeQuestions(patch.pendingQuestions) : state.pendingQuestions,
    nextAction: patch.nextAction !== undefined ? patch.nextAction : state.nextAction,
    personalization: patch.personalization
      ? sanitizePersonalization({
          ...state.personalization,
          ...patch.personalization,
          otherTrades: { ...state.personalization.otherTrades, ...patch.personalization.otherTrades },
        })
      : state.personalization,
    actionMemory: state.actionMemory,
    updatedAt: now(),
  };
  return next;
}

/**
 * Record that the visitor dismissed a proposed action ("not now") — the
 * action-selection layer (chat-tools.ts) and earned-catalog.ts both filter
 * against this before a card can be shown again. Append-only by design, so
 * it goes through its own function rather than the generic patch (which
 * would let a stale client snapshot silently erase dismissals — see rule 20
 * of the Phase 2 directive: no action should be repeatedly resurfaced).
 */
export function recordActionDismissed(state: WorkspaceState, actionId: string): WorkspaceState {
  if (!actionId || state.actionMemory.dismissed.includes(actionId)) return state;
  return {
    ...state,
    actionMemory: { ...state.actionMemory, dismissed: [...state.actionMemory.dismissed, actionId].slice(-200) },
  };
}

/** Record that a proposed action actually completed — moves it out of "still pending," never re-offered as if untouched. */
export function recordActionCompleted(state: WorkspaceState, actionId: string): WorkspaceState {
  if (!actionId || state.actionMemory.completed.includes(actionId)) return state;
  return {
    ...state,
    actionMemory: { ...state.actionMemory, completed: [...state.actionMemory.completed, actionId].slice(-200) },
  };
}

/** Total square footage across every room that has one — undefined if none do. */
export function totalSquareFeet(state: WorkspaceState): number | undefined {
  const known = state.rooms.map((r) => r.squareFeet).filter((n): n is number => typeof n === 'number');
  if (!known.length) return undefined;
  return known.reduce((a, b) => a + b, 0);
}

/** A human label for a floor preference — "—" for any axis not yet chosen. */
export function describeFloorPreference(pref: WorkspaceFloorPreference): string {
  const parts: string[] = [];
  const product = pref.productId ? productById(pref.productId) : undefined;
  const finish = pref.finishId ? FINISH_OPTIONS.find((f) => f.id === pref.finishId) : undefined;
  const pattern = pref.patternId ? PATTERN_OPTIONS.find((p) => p.id === pref.patternId) : undefined;
  const width = pref.widthId ? widthById(pref.widthId) : undefined;
  if (product) parts.push(product.name);
  if (finish) parts.push(finish.label);
  if (pattern) parts.push(pattern.label);
  if (width) parts.push(width.label);
  return parts.length ? parts.join(', ') : 'Not set';
}

/** What this workspace still needs before a next step makes sense. Computed, not stored twice. */
export function computedNeedsMeasure(state: WorkspaceState): string[] {
  const out: string[] = [];
  if (!state.objective) out.push('What you’re here to do');
  if (totalSquareFeet(state) === undefined) out.push('Square footage');
  if (state.objective === 'install' && !state.targetFloor.productId) out.push('A species for the new floor');
  if (state.objective && state.objective !== 'not-sure' && state.nextAction === null) out.push('A next step — measure, estimate, or quote');
  return out;
}

/**
 * Rebuild a full, sanitized WorkspaceState from an untrusted partial object —
 * JSON parsed from localStorage, or (in a later phase) a patch decoded from
 * a share link. Every field is revalidated against its own sanitizer rather
 * than trusted; a field this version doesn't recognize is dropped, not
 * carried through. `designId` and `updatedAt` are the caller's
 * responsibility (persistence.ts validates those before calling this, since
 * an invalid designId should fail the whole load, not silently reset it).
 */
export function hydrateWorkspaceState(
  raw: Partial<WorkspaceState>,
  designId: string,
  updatedAt: string,
): WorkspaceState {
  return {
    designId,
    ...(raw.designCode && typeof raw.designCode === 'string' ? { designCode: raw.designCode } : {}),
    country: countryOf(typeof raw.country === 'string' ? raw.country : null),
    objective: isWorkspaceObjective(raw.objective) ? raw.objective : null,
    sellHorizon: isWorkspaceSellHorizon(raw.sellHorizon) ? raw.sellHorizon : null,
    stairs: raw.stairs === true,
    rooms: sanitizeRooms(raw.rooms),
    currentFloor: sanitizeFloorPreference(raw.currentFloor),
    targetFloor: sanitizeFloorPreference(raw.targetFloor),
    selectedServiceSlugs: sanitizeServiceSlugs(raw.selectedServiceSlugs),
    pendingQuestions: sanitizeQuestions(raw.pendingQuestions),
    nextAction: isWorkspaceNextAction(raw.nextAction) ? raw.nextAction : null,
    personalization: sanitizePersonalization(raw.personalization),
    actionMemory: sanitizeActionMemory(raw.actionMemory),
    updatedAt,
  };
}

export { FLOOR_PRODUCTS, BOARD_WIDTHS, FINISH_OPTIONS, PATTERN_OPTIONS, SERVICES };
export type { PriceCountry };
