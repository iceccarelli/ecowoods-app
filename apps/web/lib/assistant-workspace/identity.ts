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
  /** The route's accessible name. */
  ariaWorkspace: 'Ask Francisco project workspace',
} as const;

/**
 * The opening line in the conversation pane.
 *
 * Voiced in first person as Francisco Oller — content/claims.ts
 * workforce.francisco is the only sourced fact about him (owner, professional
 * contractor and lead craftsman; no tenure figure, headcount or certification
 * is published, so none is claimed here). Says what the workspace is — a
 * project plan, not a chat toy — and that every number in it traces to
 * something published, before asking anything.
 */
export const WORKSPACE_GREETING =
  `I'm Francisco Oller — I own ${BUSINESS_NAP.shortName} and I'm still the one working the floors. This is a ` +
  `project workspace, not a chat toy: tell me about the floor you're planning and I'll build a project here — ` +
  `the products and services that fit, a cost range from our published bands, and a clear next step. Nothing ` +
  `here is a guess dressed up as a number.`;

/**
 * The three starter prompts under the greeting.
 *
 * Distinct from the corner assistant's chips (ASSISTANT_CHIPS in
 * lib/assistant-identity.ts) — these open a project, not a quick answer.
 * Scoped to what this workspace can actually do today (floor/service
 * selection and published-band pricing) — not the wider renovation-economics
 * questions ("kitchen vs. floors vs. roof," market/appraisal analysis) that
 * later ASSISTANT phases may add once that engine exists.
 */
export const WORKSPACE_CHIPS = [
  'Start a refinishing project',
  'Start a new-floor project',
  'I already have a Floor Studio design',
] as const;
