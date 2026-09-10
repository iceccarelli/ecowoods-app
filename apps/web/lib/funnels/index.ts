/**
 * lib/funnels — six funnels, by what the visitor came to do.
 *
 * WHY THIS FILE EXISTS
 *
 * This site has more than one job. A homeowner with a cupped floor, a homeowner
 * comparing three quotes, and a designer specifying a species are three
 * different people with three different next steps, and until now every page
 * measured the same thing: did they ask for an estimate.
 *
 * That is one funnel measured six times, and it makes the other five invisible.
 * A page that sends a quote-comparing visitor to "book a free measure" is not
 * converting badly — it is converting the wrong thing, and nothing in the
 * analytics could say so.
 *
 * WHAT A FUNNEL IS HERE
 *
 * An intent, the tool that serves it, the events that mark progress through it,
 * and the one action that completes it. Nothing more. Six funnels, six numbers,
 * each answerable from events that already fire.
 *
 * THE RULE THAT MAKES THIS HONEST
 *
 * `completion` is the LAST event in `steps`, and every event named here exists
 * in the AnalyticsEvent union — the type system enforces both. A funnel whose
 * completion event nothing emits is a funnel that reports 0% forever and looks
 * like a broken page rather than a missing instrument. scripts/verify-strategy.mjs
 * fails the build on either.
 */
import type { AnalyticsEvent } from '@/lib/analytics';

export type FunnelId =
  | 'problem'
  | 'decision'
  | 'price'
  | 'evaluation'
  | 'design'
  | 'purchase';

export interface Funnel {
  id: FunnelId;
  /** What the visitor is actually trying to do, in their words. */
  intent: string;
  /** The surface that serves it. A route on this site. */
  tool: string;
  /**
   * Ordered events marking progress. The last one is completion.
   * Every one must exist in the AnalyticsEvent union.
   */
  steps: AnalyticsEvent[];
  /**
   * The forward move for a visitor who has used `tool`. Distinct from `tool`
   * except where the funnel is terminal (`purchase`), and for four of six
   * funnels deliberately not the estimate form — matching the call to the
   * intent is the whole point of the file. A page whose own route equals this
   * href renders no call at all: <NextStep> suppresses a link to itself.
   */
  nextStep: { href: string; label: string };
  /**
   * What a visitor in this funnel is NOT ready for. Naming it stops a
   * well-meaning edit from putting an estimate button at the top of a
   * diagnostic page.
   */
  notYet: string;
}

export const FUNNELS: Funnel[] = [
  {
    id: 'problem',
    intent: 'Something is wrong with my floor and I do not know what.',
    tool: '/hardwood-floor-problems-toronto',
    steps: ['quote_view', 'photo_triage_submit'],
    nextStep: { href: '/estimate#form', label: 'Send three photos and get the diagnosis in writing' },
    notYet: 'A price. They do not yet know what the job is, and a number now is a number they will not believe later.',
  },
  {
    id: 'decision',
    intent: 'Should I refinish this or replace it?',
    tool: '/guides/reference-refinishing-existing-hardwood',
    steps: ['quote_view', 'jobcard_click', 'quote_start'],
    nextStep: { href: '/tools/floor-movement', label: 'See how far this species will actually move' },
    notYet: 'A booking. The decision is not made; asking for the calendar reads as not having listened.',
  },
  {
    id: 'price',
    intent: 'What does this cost?',
    tool: '/pricing',
    steps: ['quote_view', 'design_handoff', 'quote_start'],
    nextStep: { href: '/design', label: 'Configure the floor and see the installed range' },
    notYet: 'A fixed number. It does not exist before the measure, and pretending otherwise is the thing this business publishes bands to avoid.',
  },
  {
    id: 'evaluation',
    intent: 'I have quotes. Is this one fair?',
    tool: '/quote-check',
    steps: ['quote_view', 'framework_assess_complete', 'quote_review_submit'],
    nextStep: { href: '/framework/assess', label: 'Score the quote you are leaning toward, criterion by criterion' },
    notYet: 'Our own quote. A visitor comparing three contractors did not come here to be sold a fourth.',
  },
  {
    id: 'design',
    intent: 'What should this floor look like?',
    tool: '/design',
    steps: ['quote_view', 'design_handoff', 'quote_start'],
    nextStep: { href: '/estimate#form', label: 'Book the measure with this configuration attached' },
    notYet: 'Technical detail about substrate. It matters and it is not what they are here for yet.',
  },
  {
    id: 'purchase',
    intent: 'I want Ecowoods to do the work.',
    tool: '/estimate',
    steps: ['quote_view', 'quote_start', 'quote_submit'],
    nextStep: { href: '/estimate', label: 'Book the free in-home measure' },
    notYet: 'Nothing. This is the end of the road; get out of the way.',
  },
];

export const funnelById = (id: string): Funnel | undefined =>
  FUNNELS.find((f) => f.id === id);

/** The event that completes a funnel: always the last step. */
export const completionOf = (f: Funnel): AnalyticsEvent => f.steps[f.steps.length - 1]!;

/**
 * Which funnel a route belongs to, for the next-step component.
 *
 * A route absent from this map deliberately carries no intent-matched call —
 * the generic chrome CTA is correct for a page whose visitor could be anyone.
 */
export const ROUTE_FUNNEL: Record<string, FunnelId> = {
  '/hardwood-floor-problems-toronto': 'problem',
  '/tools/floor-movement': 'decision',
  '/guides/reference-refinishing-existing-hardwood': 'decision',
  '/guides/solid-vs-engineered-hardwood-toronto': 'decision',
  '/pricing': 'price',
  '/guides/hardwood-flooring-cost-toronto': 'price',
  '/quote-check': 'evaluation',
  '/framework': 'evaluation',
  '/framework/assess': 'evaluation',
  '/guides/how-to-evaluate-a-hardwood-quote': 'evaluation',
  '/design': 'design',
  '/estimate': 'purchase',
};

export const funnelForRoute = (route: string): Funnel | undefined => {
  const id = ROUTE_FUNNEL[route];
  return id ? funnelById(id) : undefined;
};
