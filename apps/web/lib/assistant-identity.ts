/**
 * lib/assistant-identity.ts — the assistant's name, in one place.
 *
 * WHY A CONSTANT FOR A NAME
 *
 * It was "RenoGuide", typed as a literal in nineteen places: the widget header,
 * the greeting, the launch button's aria-label, the dialog's accessible name,
 * the command palette's three entries, the configurator's two buttons, a form
 * hint, and the system prompt the model reads. Renaming it meant finding all
 * nineteen and hoping.
 *
 * The old name was also wrong on its own terms, which is why it changed: it was a
 * product name for a company that does not sell a product under it. Every other surface on this site is relentlessly the same
 * entity — the schema graph, llms.txt, the citation guide, the framework all
 * say Ecowoods — and then the one thing a visitor actually talks to introduced
 * itself as something else. For a business whose whole search strategy is
 * making one entity unmistakable to machines and people, a second brand in the
 * chat window is a leak.
 *
 * `pnpm seo:assistant` fails the build on the retired name reappearing anywhere.
 */
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export const ASSISTANT = {
  /** What it calls itself, and what every surface renders. */
  name: 'EcowoodsGuide',
  /** Under the name in the widget header. Region comes from the one source. */
  subtitle: `${BUSINESS_NAP.shortName} · ${BUSINESS_NAP.region}`,
  /** The launch button and the dialog's accessible name. */
  ariaLaunch: 'Chat with EcowoodsGuide',
  ariaDialog: 'EcowoodsGuide chat',
} as const;

/**
 * The opening line.
 *
 * Rewritten alongside the rename, because the old one asked for three things
 * before offering anything: "Tell me the wood species, rough square footage and
 * your area". That is a form with a chat interface painted on it. Someone whose
 * floor is cupping does not know their square footage and has now been asked
 * for it twice before anyone acknowledged the problem.
 *
 * This one says what Ecowoods does, then asks one open question.
 */
export const ASSISTANT_GREETING =
  `Hi — I'm ${ASSISTANT.name}, from ${BUSINESS_NAP.shortName}. We install, refinish and repair ` +
  `hardwood across ${BUSINESS_NAP.region}, with our prices published before you call and fixed ` +
  `in writing after a free in-home measure. Tell me what's going on with your floor and I'll ` +
  `tell you what we'd do about it.`;

/**
 * The three chips under the greeting.
 *
 * The third one is new. "Which species suits pets & kids?" and "Get a ballpark"
 * both assume a buyer who is shopping; the largest single group of people who
 * open a flooring chat window have a floor that is already misbehaving, and
 * until now the widget had nothing to say to them.
 */
export const ASSISTANT_CHIPS = [
  'Get a ballpark estimate',
  'My floor is cupping or gapping',
  'Book a free in-home measure',
] as const;
