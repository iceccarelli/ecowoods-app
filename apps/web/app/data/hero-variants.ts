/**
 * apps/web/app/data/hero-variants.ts — the fifteen things this business can
 * truthfully say about itself in six seconds.
 *
 * WHY A FILE AND NOT FIFTEEN STRINGS IN THE HERO
 *
 * Three of these lines contain a business fact that goes stale or drifts:
 * the founding year, the years-in-business count, and the street address.
 * Typed as literals in JSX they would (a) fail `pnpm seo:claims`, which bans
 * a current phone number, email, street address or founding year written as
 * a literal anywhere under apps/web, and (b) be wrong on 1 January 2027 with
 * nothing to catch it. Every one of them is interpolated from
 * `@ecowoods/shared/constants`, so the hero cannot disagree with the footer,
 * the schema or the estimate email.
 *
 * WHAT WAS CHANGED FROM THE SUBMITTED COPY, AND WHY — all four are recorded
 * here rather than fixed silently, because a copy change with no reason is
 * how the retired claims got back in the first place:
 *
 *   v05  "99.7% dust capture" → "HEPA-sealed dust containment."
 *        F-165 retired 99.7% across the site: it appeared in nine files with
 *        no source recorded anywhere, while this site's own case studies
 *        measure 99.5%. `verify-business-facts.mjs` fails the build on it.
 *        A published performance percentage with no measurement behind it is
 *        a Competition Act problem in Canada, not a tone problem.
 *
 *   v13  "Salaried craftsmen · 10+ years with us" → "· Not a subcontractor list"
 *        /team states in its own copy: "There are no names, headcounts,
 *        tenure figures or crew photographs on this page." A tenure figure in
 *        the hero would contradict the page that explains why there isn't one.
 *        The claim the site CAN make — salaried, not subcontracted — is
 *        registered as `workforce.salaried` and owner-confirmed.
 *
 *   v03  "since 2000"          → `since ${BUSINESS_NAP.foundedYear}`
 *   v06  "26+ years"           → `${yearsInBusiness()}+ years`
 *   v09  "Since 2000 · 32 Norfield Crescent" → both interpolated
 *
 *   ALL  "Zero dust." → "HEPA-sealed dust containment." (P0-4)
 *        The site's own dust-free-sanding copy and guides state, verbatim:
 *        "Dustless never means zero dust. It means controlled, captured, and
 *        contained dust." The homepage was the one surface still claiming the
 *        absolute the inner pages explicitly refuse. The replacement is the
 *        registered claim (content/claims.ts: HEPA at the machine, containment
 *        at the room), which the company can stand behind in a contract.
 *
 *   v01  headline "Hardwood, Done Once." → "Hardwood Flooring in Toronto,"
 *        The server-rendered H1 must name the job and the city (P4), not only
 *        the slogan; the slogan survives in the em line.
 *
 * ORDER IS LOAD-BEARING. `HERO_VARIANTS[0]` is what the server renders and
 * what every crawler that does not execute JavaScript reads. It is the
 * canonical brand line and must stay first; the other fourteen are a
 * client-side rotation on top of it.
 */
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';

export type HeroVariant = {
  /** stable key — used for React reconciliation and for the pause control's label */
  id: string;
  /** small caps line above the headline */
  eyebrow: string;
  /** the h1. `em` renders in the display italic, on its own line. */
  headline: { lead: string; em?: string };
  /**
   * The sentence. Optional: several variants are a headline plus a staccato
   * fact line and nothing in between.
   */
  lede?: string;
  /** the four-fact line that closes the block */
  support: string;
};

export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: 'v01-done-once',
    eyebrow: 'Installation · Refinishing · Toronto & the GTA',
    /* The server-rendered H1. It must name the job and the city, not only the
       slogan — "Done Once" alone is a brand line, not an answer to "what is
       this page". P4: hardwood + Toronto + install/refinish in the H1. */
    headline: { lead: 'Hardwood Flooring in Toronto,', em: 'Done Once. Done Right.' },
    support:
      'Fixed price in writing. HEPA-sealed dust containment. Salaried master artisans. ' +
      'FSC-certified materials. Toronto homes transformed with certainty — not hope.',
  },
  {
    id: 'v02-price-you-pay',
    eyebrow: 'Installation and refinishing · GTA',
    headline: { lead: 'Done once.', em: 'Done right.' },
    lede: 'The price you are given is the price you pay.',
    support:
      'HEPA containment. Salaried craftsmen. Sustainable wood. A written estimate — not a guess.',
  },
  {
    id: 'v03-certainty',
    eyebrow: `Ecowoods · Toronto since ${BUSINESS_NAP.foundedYear}`,
    headline: { lead: 'Certainty.', em: 'Not hope.' },
    lede: 'Hardwood installed and refinished the way a home deserves.',
    support:
      'Fixed price in writing. HEPA-sealed dust containment. Master artisans on salary. FSC-certified materials.',
  },
  {
    id: 'v04-finished-once',
    eyebrow: 'Dust-free hardwood · Toronto',
    headline: { lead: 'Your floor.', em: 'Finished once.' },
    lede: 'No second sanding. No surprise invoice.',
    support:
      'Salaried artisans, HEPA containment, written price, FSC wood. That is the job.',
  },
  {
    id: 'v05-one-shop',
    eyebrow: 'One shop. One name. Toronto.',
    headline: { lead: 'Hardwood,', em: 'done properly.' },
    lede: 'Installation, refinishing, stairs, inlays — no revolving crews.',
    // "99.7% dust capture" removed — see the header note on v05.
    support:
      'Fixed price in writing. HEPA-sealed dust containment. Materials you can stand behind.',
  },
  {
    id: 'v06-estimate-is-contract',
    eyebrow: 'Master artisans · Not subcontractors',
    headline: { lead: 'The estimate', em: 'is the contract.' },
    lede: 'Toronto hardwood with a number that does not move.',
    support: `HEPA-sealed dust containment. FSC-certified stock. ${yearsInBusiness()}+ years in this city.`,
  },
  {
    id: 'v07-stay-finished',
    eyebrow: 'Toronto homes · GTA service',
    headline: { lead: 'Floors that', em: 'stay finished.' },
    lede: 'Refinished or installed once, by people on our payroll.',
    support:
      'Written price. HEPA sanding. Sustainable materials. No hope. A date and a number.',
  },
  {
    id: 'v08-held-to-it',
    eyebrow: 'The Ecowoods Standard · Toronto',
    headline: { lead: 'Done once.', em: 'Held to it.' },
    lede: 'Hardwood without the usual dust, drift, and excuses.',
    support:
      'Salaried masters. FSC wood. Fixed price in writing. Free in-home estimate.',
  },
  {
    id: 'v09-in-writing',
    eyebrow: `Since ${BUSINESS_NAP.foundedYear} · ${BUSINESS_NAP.address.streetAddress}`,
    headline: { lead: 'Hardwood for people who want', em: 'the answer in writing.' },
    lede: 'Installation and refinishing with one accountable crew.',
    support: 'HEPA dust containment. Fixed price. FSC-certified materials. Toronto and the GTA.',
  },
  {
    id: 'v10-not-an-ordeal',
    eyebrow: 'Dust-free sanding · Fixed price',
    headline: { lead: 'A floor,', em: 'not a renovation ordeal.' },
    lede: 'We contain the dust. We keep the number. We send our own people.',
    support: 'Master artisans. Sustainable wood. Certainty for Toronto homes.',
  },
  {
    id: 'v11-one-price',
    eyebrow: 'Installation · Refinishing · Restoration',
    headline: { lead: 'One floor. One shop.', em: 'One price.' },
    lede: 'No subcontractors. No floating quotes. No film of dust on the furniture.',
    support: 'FSC materials. Salaried craftsmen. Written estimate before we start.',
  },
  {
    id: 'v12-without-the-mess',
    eyebrow: 'Toronto · Vaughan · Mississauga · the GTA',
    headline: { lead: 'Hardwood,', em: 'without the usual mess.' },
    lede: 'The work is done once because the spec is settled first.',
    support:
      'Fixed price in writing. HEPA containment. Artisans on salary. FSC-certified stock.',
  },
  {
    id: 'v13-no-crew-flipping',
    // tenure figure removed — see the header note on v13.
    eyebrow: 'Salaried craftsmen · Not a subcontractor list',
    headline: { lead: 'We do not flip crews', em: 'on your house.' },
    lede: 'The same people who estimate the floor are the people who finish it.',
    support: 'HEPA dust containment. Written price. Sustainable materials. Toronto, done right.',
  },
  {
    id: 'v14-get-the-number',
    eyebrow: 'Free in-home estimate · Toronto',
    headline: { lead: 'Get the number.', em: 'Then we work.' },
    lede: 'Hardwood installation and refinishing with the price locked on paper.',
    support: 'HEPA dust containment. FSC-certified wood. Master artisans. Certainty — not hope.',
  },
  {
    id: 'v15-transformed',
    eyebrow: 'Ecowoods · Hardwood flooring Toronto',
    headline: { lead: 'Hardwood, Done Once.', em: 'Done Right.' },
    support:
      'Fixed price in writing. HEPA-sealed dust containment. Salaried master artisans using FSC-certified ' +
      'materials. Toronto homes transformed with certainty — not hope.',
  },
];

/** Flat text of a headline — for `aria-label`, so assistive technology never
 *  reads a half-resolved string while the decode animation is mid-flight. */
export function headlineText(v: HeroVariant): string {
  return v.headline.em ? `${v.headline.lead} ${v.headline.em}` : v.headline.lead;
}
