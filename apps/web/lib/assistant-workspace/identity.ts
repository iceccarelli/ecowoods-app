/**
 * lib/assistant-workspace/identity.ts — the workspace's name, in one place.
 *
 * NOT lib/assistant-identity.ts. That file names the corner Quick Assistant,
 * "EcowoodsGuide" — a widget mounted on every page, built around a chat
 * transcript. This file names a different product: a dedicated workspace at
 * /assistant, built around a project's decision state, not a transcript.
 *
 * ASSISTANT-01 named this workspace "AI Home Advisor." It is now "Ask
 * Francisco" — the same workspace, renamed to put a named, sourced person
 * (Francisco Oller, owner and lead craftsman — content/claims.ts
 * workforce.francisco) behind the voice instead of a generic product label.
 * "AI Home Advisor" is retired; `scripts/verify-assistant.mjs` guards against
 * it resurfacing the same way it guards the corner widget's retired name.
 *
 * Narrative (ASSISTANT-01 restore): Ask Francisco is the house renovation
 * decision engine for entire home renovations / home-construction sequencing.
 * Ecowoods commercially performs only hardwood installation, refinishing,
 * dust-free sanding, floor restoration, custom inlays/borders, and stair
 * refinishing — Francisco may advise on kitchens, roofs, pools, windows,
 * HVAC, etc. with sourced market data, but must never claim Ecowoods installs
 * those trades. Renovation questions are in-scope for advising; Ecowoods
 * commercial execution remains floors/stairs; economics adapters (licensed
 * property / market feeds) may still be pending_key — honesty about missing
 * data is required, but public copy must not close the door to whole-house
 * questions.
 *
 * Two products, two names, on purpose. See
 * docs/assistant-workspace/NEW_ASSISTANT_ARCHITECTURE.md's naming-discipline
 * note and docs/assistant-workspace/NO_DUPLICATION_GUARANTEE.md — reusing the
 * corner assistant's identity constant for this product would be the same
 * two-brands-in-one-window problem `verify-assistant.mjs` polices for the
 * corner widget, pointed at a different file.
 */
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const WORKSPACE_ASSISTANT = {
  /** What it calls itself, and what every surface in /assistant renders. */
  name: 'Ask Francisco',
  /** Under the name in the workspace header. */
  subtitle: `${BUSINESS_NAP.shortName} · ${BUSINESS_NAP.region}`,
  /** The route's accessible name — whole-house renovation workspace. */
  ariaWorkspace: 'Ask Francisco about this house',
} as const;

/**
 * The opening line in the conversation pane.
 *
 * Voiced in first person as Francisco Oller — content/claims.ts
 * workforce.francisco is the only sourced fact about him (owner, professional
 * contractor and lead craftsman; no tenure figure, headcount or certification
 * is published, so none is claimed here). Whole-home renovation advising is
 * in scope; Ecowoods commercial bids stay floors/stairs once measured.
 */
/** One-sentence start lede (AGENT_DIRECTIVE v8) — whole-home, not floor-only. */
export const WORKSPACE_GREETING =
  `I'm Francisco. Tell me about this house — what you want done, and what actually moves value.`;

/**
 * Starter prompts under the greeting — renovation decision first, then
 * floor-first shortcuts for visitors who already know it's hardwood.
 *
 * Distinct from the corner assistant's chips (ASSISTANT_CHIPS in
 * lib/assistant-identity.ts) — these open a project, not a quick answer.
 * Renovation questions are in-scope for advising; Ecowoods commercial
 * execution remains floors/stairs; economics adapters may still be pending_key.
 */
export const WORKSPACE_RENOVATION_CHIPS = [
  'What actually increases value on my street?',
  'Kitchen vs floors vs roof — what should I do first?',
  'Ballpark a hardwood refinish in Toronto',
  'My floor is cupping / gapping',
  'What will a lender or appraiser care about?',
  'Book the free in-home measure',
] as const;

/** Floor-first shortcuts when the visitor already knows it's floors. */
export const WORKSPACE_FLOOR_CHIPS = [
  'Already know it\'s floors — start a refinishing project',
  'Already know it\'s floors — start a new-floor project',
  'I already have a Floor Studio design',
] as const;

/**
 * Combined chip list for UIs with a single chip row. Renovation starters
 * first; floor shortcuts after. Prefer WORKSPACE_RENOVATION_CHIPS +
 * WORKSPACE_FLOOR_CHIPS when the UI can render two rows.
 */
export const WORKSPACE_CHIPS = [
  ...WORKSPACE_RENOVATION_CHIPS,
  ...WORKSPACE_FLOOR_CHIPS,
] as const;

/** Composer placeholder — whole-house, not floor-only. */
export const WORKSPACE_COMPOSER_PLACEHOLDER =
  'Ask anything about this house…';
