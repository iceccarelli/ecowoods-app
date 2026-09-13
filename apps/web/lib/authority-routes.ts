/**
 * lib/authority-routes.ts — AUTH-01. Where a technical page sends a reader who
 * has decided to act.
 *
 * WHAT THE AUDIT FOUND
 *
 * The authority tier carries the highest inbound internal link counts in the
 * application — /framework 59, /papers 39, /guides 34 — so those surfaces are
 * doing real work. And the 47 glossary entries link to exactly four things:
 * the homepage, the glossary index, a framework pillar, and their source
 * paper. Not one links to a service, a service area, or the estimate form.
 *
 * Meanwhile /estimate has SIX inbound literal links in the entire codebase and
 * none of them is from a paper, a guide, or a glossary entry. A reader who has
 * just understood why their floor cupped has nowhere to go.
 *
 * WHY THIS IS FIVE ENTRIES AND NOT FORTY-SEVEN
 *
 * The obvious version of this file maps every term to a service. That would be
 * forty-seven judgements I am not qualified to make and nobody would ever
 * check — and a wrong one sends somebody with a refinishing question to an
 * installation page, which is worse than sending them nowhere.
 *
 * So it maps the SOURCE PAPER instead. Every glossary term already declares
 * which paper it came from, that mapping was made by somebody who knows the
 * trade, and there are five papers. Each entry below carries the reason it
 * points where it points, so a person who disagrees can argue with a sentence
 * rather than guess at an intention.
 *
 * A term whose paper is not listed gets no commercial block at all. Silence is
 * the correct output for "we do not know what this person needs".
 */

export type AuthorityRoute = {
  /** The service page this paper's subject actually bears on. */
  service: string;
  /** What to call it in a sentence. */
  label: string;
  /** Why this paper points here. Argue with this, not with the code. */
  because: string;
};

/**
 * Keyed by paper slug — the same value `GlossaryTerm.source.paper` holds.
 */
export const AUTHORITY_ROUTES: Record<string, AuthorityRoute> = {
  'toronto-hardwood-climate-moisture-protocol': {
    service: 'floor-restoration',
    label: 'floor restoration',
    because:
      'This paper is about what moisture does to a floor that is already down — cupping, ' +
      'crowning, gaps that open and close with the season. A reader arriving from one of its ' +
      'terms has a floor, not a plan to buy one.',
  },
  'hardwood-refinishing-machines-and-sequence': {
    service: 'floor-refinishing',
    label: 'floor refinishing',
    because: 'The paper is the refinishing sequence itself. There is no second candidate.',
  },
  'hardwood-selection-and-cost-framework-gta': {
    service: 'hardwood-installation',
    label: 'hardwood installation',
    because:
      'Selection and cost are questions asked before a floor exists. Somebody comparing species ' +
      'and price per square foot is buying one.',
  },
  'where-toronto-hardwood-comes-from': {
    service: 'hardwood-installation',
    label: 'hardwood installation',
    because:
      'Provenance matters to the person choosing the boards. It is not a question anybody asks ' +
      'about a floor they already own.',
  },
  'hardwood-grading-standards-nhla-nwfa': {
    service: 'hardwood-installation',
    label: 'hardwood installation',
    because:
      'Grade is what is being bought. A grading question is a purchasing question.',
  },
};

/** The route for a paper, or null when we have no honest answer. */
export const routeForPaper = (paper: string | undefined): AuthorityRoute | null =>
  (paper && AUTHORITY_ROUTES[paper]) || null;

/*
 * THERE IS NO ESTIMATE_HREF CONSTANT HERE, AND THAT IS DELIBERATE.
 *
 * The first version of this file exported one. It read better and it broke
 * `pnpm seo:density`, which extracts LITERAL href strings from the source to
 * check that every commercial page reaches a service, a guide, a case study, a
 * paper, the framework and a call to action. A constant is invisible to it —
 * so the link existed, the page was correct, and the guard reported zero.
 *
 * A constant that hides a link from a link guard is a constant that should not
 * exist. `/estimate` is written literally at every call site, where the guard
 * can see it and so can a person reading the JSX.
 *
 * Why /estimate rather than /#quote, which the authority tier used everywhere:
 * the anchor works — the homepage does render a form there — but it costs a
 * page load, and it means the page built to take an estimate request had SIX
 * inbound links in the entire codebase while the homepage collected every one
 * the authority tier earned.
 */
