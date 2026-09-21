/**
 * lib/assistant-workspace/identity.ts — the AI Home Advisor's name, in one place.
 *
 * NOT lib/assistant-identity.ts. That file names the corner Quick Assistant,
 * "EcowoodsGuide" — a widget mounted on every page, built around a chat
 * transcript. This file names a different product: a dedicated workspace at
 * /assistant, built around a project's decision state, not a transcript.
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
  name: 'AI Home Advisor',
  /** Under the name in the workspace header. */
  subtitle: `${BUSINESS_NAP.shortName} · ${BUSINESS_NAP.region}`,
  /** The route's accessible name. */
  ariaWorkspace: 'AI Home Advisor project workspace',
} as const;

/**
 * The opening line in the conversation pane.
 *
 * Says what the workspace is — a project plan, not a chat toy — and that
 * every number in it traces to something published, before asking anything.
 */
export const WORKSPACE_GREETING =
  `This is the ${WORKSPACE_ASSISTANT.name}, from ${BUSINESS_NAP.shortName} at ecowoods.ca. Tell me about the ` +
  `floor you're planning and we'll build a project here — the products and services that fit, a cost range from ` +
  `our published bands, and a clear next step. Nothing here is a guess dressed up as a number.`;

/**
 * The three starter prompts under the greeting.
 *
 * Distinct from the corner assistant's chips (ASSISTANT_CHIPS in
 * lib/assistant-identity.ts) — these open a project, not a quick answer.
 */
export const WORKSPACE_CHIPS = [
  'Start a refinishing project',
  'Start a new-floor project',
  'I already have a Floor Studio design',
] as const;
