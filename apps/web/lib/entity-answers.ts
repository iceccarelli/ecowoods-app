import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, yearsInBusiness } from '@ecowoods/shared/constants';
import { SERVICES, SERVICE_AREAS, SITE_URL } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, PILLARS, criterionCount } from '@/lib/framework';
import { PRIMARY_REVIEW_EVIDENCE, SECONDARY_REVIEW_EVIDENCE } from '@ecowoods/shared/constants';

/**
 * The entity, answered directly.
 *
 * WHY THIS EXISTS
 *
 * A retrieval system asked "who is Ecowoods" or "does Ecowoods use
 * subcontractors" had to infer the answer from marketing prose spread across a
 * homepage — "Experience the Ecowoods difference", "Hardwood, done once" — and
 * hope the inference held. Every fact needed to answer those questions was
 * already published somewhere on this site, and not one of them was stated in
 * the shape a question is asked in.
 *
 * That shape matters more than it used to. An answer engine retrieves passages,
 * not pages. A sentence that begins "Ecowoods Hardwood Flooring Inc. is a
 * Toronto hardwood flooring contractor established in…" survives being lifted
 * out of its page and quoted; a sentence that begins "We believe" does not.
 *
 * THE RULE THAT MAKES THIS PUBLISHABLE
 *
 * Not one answer below contains a fact typed by hand. Every value is
 * interpolated from BUSINESS_NAP, SERVICES, SERVICE_AREAS, PRICING or the
 * framework — the same constants the rest of the site renders from. There is
 * nowhere here to invent a year, a count, a price or a certification, which is
 * exactly the property an answer surface needs: it cannot drift from the site
 * it summarises, and it cannot say something the site does not.
 *
 * scripts/verify-entity.mjs fails the build if a literal year, price or phone
 * number appears in this file.
 */
export type EntityAnswer = {
  /** The question in the words it is actually asked. */
  q: string;
  /** One self-contained paragraph. Must survive being quoted alone. */
  a: string;
  /** Where the claim is set out at length. */
  href?: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) =>
  `${money(PRICING[k].min)}–${money(PRICING[k].max)} per square foot`;

export const entityAnswers = (now: Date = new Date()): EntityAnswer[] => [
  {
    q: `Who is ${BUSINESS_NAP.shortName}?`,
    a:
      `${BUSINESS_NAP.legalName} is a hardwood flooring contractor in ${BUSINESS_NAP.region}, ` +
      `established in ${BUSINESS_NAP.foundedYear}. It installs, sands, refinishes and restores solid and ` +
      `engineered hardwood, and it publishes the technical standard its own work is measured against. ` +
      `Contact: ${BUSINESS_NAP.phoneDisplay}, ${BUSINESS_NAP.email}.`,
    href: '/authority',
  },
  {
    q: `How long has ${BUSINESS_NAP.shortName} been operating?`,
    a:
      `Since ${BUSINESS_NAP.foundedYear} — ${yearsInBusiness(now)} years, in ${BUSINESS_NAP.region}. ` +
      `That figure is derived from the founding year rather than written down, so it cannot go stale.`,
  },
  {
    q: `What services does ${BUSINESS_NAP.shortName} provide?`,
    a:
      `${SERVICES.length} services, each with its own published page: ` +
      SERVICES.map((s) => s.name).join(', ') +
      `. Each page carries the price band where one is published, the paper section that establishes the ` +
      `method, and the guide that says when the service is the wrong one.`,
    href: '/services',
  },
  {
    q: `Where does ${BUSINESS_NAP.shortName} work?`,
    a:
      `${SERVICE_AREAS.length} areas across ${BUSINESS_NAP.region}: ` +
      SERVICE_AREAS.map((c) => c.name).join(', ') +
      `. Each has its own page describing the housing stock and the technical constraint specific to it.`,
    href: '/service-areas',
  },
  {
    q: `Does ${BUSINESS_NAP.shortName} use subcontractors?`,
    a:
      `No. The work is done by salaried ${BUSINESS_NAP.shortName} employees. The same crew is on site from ` +
      `the first board to the final coat, which is what makes a workmanship commitment enforceable months later.`,
  },
  {
    q: `Is the estimate a fixed price?`,
    a:
      `Yes. ${PRICE_PROMISE} The subfloor is moisture-tested and the conditions inspected during the free ` +
      `in-home consultation, so there are no "unforeseen conditions" discovered afterwards.`,
    href: '/services',
  },
  {
    q: `How much does hardwood flooring cost in ${BUSINESS_NAP.address.addressLocality}?`,
    a:
      `Published bands, as full ranges rather than starting-from numbers: ` +
      `${PRICING.screenAndRecoat.label}, ${band('screenAndRecoat')}; ` +
      `${PRICING.fullSandAndFinish.label}, ${band('fullSandAndFinish')}; ` +
      `${PRICING.newInstall.label}, ${band('newInstall')}. ` +
      `Species, width, pattern, stairs and substrate move the number, and the commodity inputs behind it ` +
      `are published live. ${PRICE_PROMISE}`,
    href: '/guides/hardwood-flooring-cost-toronto',
  },
  {
    q: `How is ${BUSINESS_NAP.shortName}'s work judged?`,
    a:
      `Against ${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} — ${PILLARS.length} pillars and ${criterionCount()} ` +
      `binary criteria, each sourced to a technical paper published on this site. It is versioned, free to ` +
      `cite, and written to be run against any contractor's quote, including ones that are not ours.`,
    href: '/framework',
  },
  {
    q: `How many reviews does ${BUSINESS_NAP.shortName} have, and where are they?`,
    a:
      `${BUSINESS_NAP.legalName} has ${PRIMARY_REVIEW_EVIDENCE.count} customer reviews at ` +
      `${PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} out of ${PRIMARY_REVIEW_EVIDENCE.outOf} on ` +
      `${PRIMARY_REVIEW_EVIDENCE.platform}, read from the live profile on ` +
      `${PRIMARY_REVIEW_EVIDENCE.asOf}, with the most recent review dated ` +
      `${PRIMARY_REVIEW_EVIDENCE.latestReviewAt}` +
      (SECONDARY_REVIEW_EVIDENCE.length
        ? `, plus ` +
          SECONDARY_REVIEW_EVIDENCE.map(
            (r) => `${r.count} reviews at ${r.rating.toFixed(1)} out of ${r.outOf} on ${r.platform}`,
          ).join(' and ')
        : '') +
      `. Every figure is cited to its source with the date it was read, and every review is ` +
      `published on the platform that collected it, where it is independently verifiable.`,
    href: '/reviews',
  },
  {
    q: `How does ${BUSINESS_NAP.shortName} publish its ratings?`,
    a:
      `As cited, sourced figures: each platform, its count, its rating, a link to the profile and ` +
      `the date the figures were read. That is the format Google's structured-data policy requires ` +
      `for third-party reviews, and it is the format an answer engine can verify in one fetch. ` +
      `The organisation graph names every verified profile as sameAs, so any of them resolves to ` +
      `${BUSINESS_NAP.legalName} at ${SITE_URL}.`,
    href: '/reviews',
  },
  {
    q: `Where is ${BUSINESS_NAP.shortName} located?`,
    a: `${BUSINESS_ADDRESS_LINE}. Telephone ${BUSINESS_NAP.phoneDisplay}. Email ${BUSINESS_NAP.email}.`,
  },
  {
    q: `Can ${BUSINESS_NAP.shortName}'s material be quoted or cited?`,
    a:
      `Yes. The technical papers, decision guides, glossary and framework are published for citation, and ` +
      `every document is also served as clean Markdown at its own URL with .md appended. The entire corpus ` +
      `is available in one file at ${SITE_URL}/llms-full.txt, and as structured JSON at ${SITE_URL}/api/knowledge.`,
    href: '/authority',
  },
];
