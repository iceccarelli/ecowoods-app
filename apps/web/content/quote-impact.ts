/**
 * content/quote-impact.ts — the sentence a technical paper owes a buyer.
 *
 * WHY THIS EXISTS
 *
 * Five technical papers sit on this site because they are true and because
 * being the company that can explain moisture differential is the whole
 * positioning. What none of them did was tell the person reading what the
 * physics means for the document in their hand. A homeowner finishes the
 * climate paper better informed and no closer to a decision, and the business
 * that taught them the concept is not the business they call.
 *
 * So each paper gets one box, at the end, that answers exactly one question:
 * given what you have just read, what should be true of your quote?
 *
 * THE RULES THIS FILE KEEPS, AND WHY EACH ONE IS HERE
 *
 * · ≤120 words. Enforced by scripts/verify-quote-impact.mjs. A CTA that grows
 *   into an essay is a second paper nobody asked for, and the reason the box
 *   works is that it is short enough to read after 4,000 words of hydrology.
 *
 * · IT DOES NOT DUMB THE PAPER DOWN. The paper above it is unchanged. This is
 *   an additional, clearly-separated commercial paragraph — not a rewrite of
 *   technical prose into marketing prose. E-E-A-T is the asset; the box is a
 *   door next to it, not a renovation of it.
 *
 * · NO NUMBER APPEARS HERE THAT THE PAPER DOES NOT PUBLISH. Where a figure is
 *   quoted it is quoted from the paper's own table, and the guard checks the
 *   section it names actually exists in that paper.
 *
 * · IT IS SIGNED BY A DESK, NOT A PERSON. `SIGNER` is "the Ecowoods estimating
 *   desk" because this repository contains no verified named estimator. When
 *   a real principal or craftsman is recorded in /team with their consent,
 *   change it there — inventing a person to sign a commercial box is exactly
 *   the class of small fiction this project refuses.
 */

export const QUOTE_IMPACT_SIGNER = 'the Ecowoods estimating desk';

export type QuoteImpact = {
  /** Paper slug this belongs to. */
  readonly paper: string;
  /** A section id in that paper — the guard checks it resolves. */
  readonly anchor: string;
  /** ≤120 words. What the reader should now require of their quote. */
  readonly body: string;
  /** Where the box sends them. */
  readonly cta: { readonly href: string; readonly label: string };
};

export const QUOTE_IMPACTS: readonly QuoteImpact[] = [
  {
    paper: 'toronto-hardwood-climate-moisture-protocol',
    anchor: 'climate-reality',
    body:
      'A Toronto quote that does not mention humidity is quoting a floor for a climate this city does not have. Indoor air here runs 18–25% RH in a January cold snap and above 60% in August, against a safe operating band of 35–55% — so the wood you sign for in a heated house in February arrives at a moisture content it will not keep. Ask for three things in writing: the moisture readings taken on your subfloor, the acclimation period before installation, and the expansion gap specified for your widest board. A quote that answers all three has been priced by someone who has read what you just read.',
    cta: { href: '/#quote', label: 'Get a fixed written price' },
  },
  {
    paper: 'hardwood-selection-and-cost-framework-gta',
    anchor: 'installed-cost',
    body:
      'Two quotes for the same floor differ honestly when they assume different work, and dishonestly when one of them has left work out. Before comparing prices, make each quote state the same five things: the square footage it is priced on, the substrate it found, the number of finish coats, what happens to the stairs, and what happens if a board has to be replaced. Most of the spread between a cheap quote and a fair one lives in those five lines rather than in the rate per square foot. Send us the quote you already have and we will tell you which of the five are missing.',
    cta: { href: '/framework/assess', label: 'Score the quote you have' },
  },
  {
    paper: 'hardwood-refinishing-machines-and-sequence',
    anchor: 'sequence',
    body:
      'Refinishing is a sequence, and a quote is really a description of which steps are included. Ask which machines will be on your floor and in what order, how many abrasive grades the sand steps through, and where the dust goes — extraction at the machine and containment at the room are two different commitments, and "dustless" on its own is neither. Ask how many coats and what the cure schedule is before furniture returns. A contractor who answers in that order is describing a process they run; one who answers in price is describing a number they hope you accept.',
    cta: { href: '/#quote', label: 'Get a fixed written price' },
  },
  {
    paper: 'where-toronto-hardwood-comes-from',
    anchor: 'why-provenance',
    body:
      'Provenance is not a sentiment on an invoice — it decides how the boards behave in your house and whether the warranty behind them is worth anything. Ask your quote to name the species, the mill or the supplier, and the certification, and to say whether the material is in stock or being ordered. Substitution after the deposit is the most common way a quoted floor becomes a different floor, and the sentence that prevents it is a specified product on a signed document rather than a species named in conversation.',
    cta: { href: '/#quote', label: 'Get a fixed written price' },
  },
  {
    paper: 'hardwood-grading-standards-nhla-nwfa',
    anchor: 'nwfa-appearance',
    body:
      'Grade describes appearance, not durability, and a quote that says only "premium" has told you nothing checkable. Ask which grading system the material is sold under and which grade within it, because that single line decides how much colour variation and how many knots arrive on a pallet you have already paid for. It also decides waste: a lower grade laid to a tight visual standard is bought in greater quantity, and whoever absorbs that difference should be named before the order goes in rather than after.',
    cta: { href: '/framework/assess', label: 'Score the quote you have' },
  },
];

export const quoteImpactFor = (paperSlug: string): QuoteImpact | undefined =>
  QUOTE_IMPACTS.find((q) => q.paper === paperSlug);
