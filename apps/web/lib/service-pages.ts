/**
 * One page per service, at /services/{slug}.
 *
 * WHY THIS EXISTS
 *
 * F-146. `lib/schema/builders.ts` has always emitted a `Service` node per
 * service inside the LocalBusiness graph, each with:
 *
 *     '@id': `${siteUrl}/services/${config.id}#service`
 *
 * There has never been a `/services` route. Every one of those six `@id`s
 * pointed at a 404. An `@id` is the identifier a crawler uses to decide that
 * two mentions are the same thing; pointing it at a URL that does not resolve
 * asks Google to hang six service entities off nothing.
 *
 * The site footer made the same shape of mistake in the other direction: seven
 * links in its Services column, all pointing at `/#services`, an anchor on the
 * homepage. Seven of the highest-intent phrases this business could rank for —
 * hardwood installation, refinishing, dust-free sanding, restoration, stairs,
 * inlays — had no URL of their own to rank.
 *
 * WHAT IS AND IS NOT IN HERE
 *
 * Not one new claim. Every service's name and description is `SERVICES` from
 * seo-data, already published on the homepage. Every price band is `PRICING`,
 * already published. Everything else on the page is a cross-link: the decision
 * guides that answer the questions buyers actually ask about this service, the
 * paper sections that establish the technique, the framework criteria the work
 * is judged against, and the glossary terms the page uses.
 *
 * That constraint is what makes these pages worth publishing rather than
 * padding. A service page that restates marketing copy competes with ten
 * thousand identical ones. A service page that says "here is the price band,
 * here is the standard we are judged by, here is the paper that explains the
 * method, here is the guide that tells you when this is the wrong service" is a
 * different document, and it is the only kind this site is equipped to write.
 *
 * The FAQ on each page is the `question` and `recommendation` of the guides
 * linked to it — published Q&A, cited back to the guide, rather than questions
 * invented to fill a schema block.
 */
import { SERVICES, type Service } from '@/lib/seo-data';
import { PRICING, PRICE_PROMISE, type PricingService } from '@/lib/pricing';
import { getGuide } from '@/lib/guides';
import { getTerm } from '@/lib/glossary';
import { PILLARS } from '@/lib/framework';

export type ServicePage = {
  slug: string;
  /** The H1. The service, and the city, in the words the query uses. */
  h1: string;
  /** One line under the H1. Not a slogan — what the page is for. */
  standfirst: string;
  /** Key into PRICING, where this service has a published band. */
  pricing?: PricingService;
  /** Decision guides that bear on choosing or judging this service. */
  guides: string[];
  /** Paper sections that establish the method. */
  papers: { paper: string; section: string; label: string }[];
  /** Framework pillar ids this service is judged against. */
  pillars: string[];
  /** Glossary slugs a reader of this page will need. */
  terms: string[];
};

/**
 * Ordered as the footer lists them, which is roughly descending by search
 * volume. The slugs match SERVICES exactly — verify-services.mjs fails the
 * build if they ever drift, because the schema `@id` is built from them.
 */
export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: 'hardwood-installation',
    h1: 'Custom hardwood floor installation in Toronto and the GTA',
    standfirst:
      'What the substrate allows, what it costs, and the standard the finished floor is judged against — solid and engineered, including condominium slabs.',
    pricing: 'newInstall',
    guides: ['solid-vs-engineered-hardwood-toronto', 'nail-down-glue-down-or-floating', 'hardwood-flooring-cost-toronto', 'white-oak-flooring-toronto', 'herringbone-chevron-parquet-toronto'],
    papers: [
      { paper: 'toronto-hardwood-climate-moisture-protocol', section: 'protocol', label: 'The moisture protocol before any board is opened' },
      { paper: 'hardwood-selection-and-cost-framework-gta', section: 'decision-tree', label: 'The selection decision tree' },
    ],
    pillars: ['moisture', 'substrate', 'specification'],
    terms: ['acclimation', 'moisture-content', 'expansion-gap', 'subfloor'],
  },
  {
    slug: 'floor-refinishing',
    h1: 'Dust-free hardwood floor refinishing in Toronto and the GTA',
    standfirst:
      'Four machines, one sequence, containment at the source — and the difference between a floor that was sanded and a floor that was refinished.',
    pricing: 'fullSandAndFinish',
    guides: ['reference-refinishing-existing-hardwood', 'dustless-hardwood-refinishing-toronto', 'hardwood-flooring-cost-toronto'],
    papers: [
      { paper: 'hardwood-refinishing-machines-and-sequence', section: 'the-four-machines', label: 'The four machines and what each one can and cannot fix' },
      { paper: 'hardwood-refinishing-machines-and-sequence', section: 'sequence', label: 'The order the machines run in' },
    ],
    pillars: ['containment', 'accountability'],
    terms: ['progressive-grits', 'intercoat-screening', 'wear-layer'],
  },
  {
    slug: 'dust-free-sanding',
    h1: 'Dustless hardwood floor sanding in Toronto and the GTA',
    standfirst:
      'Containment at the source, measured at the machine — and what it means for whether you can stay in the house.',
    guides: ['reference-refinishing-existing-hardwood', 'dustless-hardwood-refinishing-toronto'],
    papers: [
      { paper: 'hardwood-refinishing-machines-and-sequence', section: 'belt-sander', label: 'The belt sander, and where the dust is actually made' },
    ],
    pillars: ['containment'],
    terms: ['hepa-dust-containment'],
  },
  {
    slug: 'floor-restoration',
    h1: 'Heritage hardwood floor restoration in Toronto and the GTA',
    standfirst:
      'Heritage and water-damaged floors: what can be saved, what has to be replaced, and how the join is made invisible.',
    pricing: 'fullSandAndFinish',
    guides: ['reference-refinishing-existing-hardwood', 'how-to-evaluate-a-hardwood-quote', 'how-to-choose-hardwood-contractor-toronto', 'hardwood-flooring-cost-toronto'],
    papers: [
      { paper: 'toronto-hardwood-climate-moisture-protocol', section: 'failure-modes', label: 'The failure modes, and which are recoverable' },
    ],
    pillars: ['moisture', 'accountability'],
    terms: ['cupping', 'crowning', 'wear-layer'],
  },
  {
    slug: 'stair-refinishing',
    h1: 'Stair refinishing in Toronto and the GTA',
    standfirst:
      'Treads, risers and nosings, matched to the floor they meet — the detail that gives a refinish away.',
    pricing: 'fullSandAndFinish',
    guides: ['reference-refinishing-existing-hardwood', 'hardwood-flooring-cost-toronto'],
    papers: [
      { paper: 'hardwood-refinishing-machines-and-sequence', section: 'edger', label: 'The edger — stairs, and everywhere the big machine cannot reach' },
    ],
    pillars: ['containment'],
    terms: ['progressive-grits'],
  },
  {
    slug: 'custom-inlays',
    h1: 'Custom inlays and borders in Toronto and the GTA',
    standfirst:
      'Feature strips, medallions and borders — cut and fitted to a floor that still has to move with the seasons.',
    guides: ['reference-refinishing-existing-hardwood', 'herringbone-chevron-parquet-toronto'],
    papers: [
      { paper: 'hardwood-selection-and-cost-framework-gta', section: 'decision-tree', label: 'Species and pattern selection' },
    ],
    pillars: ['specification', 'movement'],
    terms: ['expansion-gap', 'acclimation'],
  },
];

/** The SERVICES entry a page belongs to. The name and blurb come from there. */
export const serviceFor = (page: ServicePage): Service | undefined =>
  SERVICES.find((s) => s.slug === page.slug);

export const getServicePages = (): ServicePage[] => SERVICE_PAGES;
export const getServicePage = (slug: string): ServicePage | undefined =>
  SERVICE_PAGES.find((p) => p.slug === slug);

/** The rendered band, or undefined where no band is published.  pricing-allow
 *  (the literal above is the FORMAT this returns, quoted in documentation —
 *  not a price anyone is shown. The value itself comes from PRICING.) */
export const priceBand = (page: ServicePage): string | undefined => {
  if (!page.pricing) return undefined;
  const p = PRICING[page.pricing];
  return `$${p.min.toFixed(2)}–$${p.max.toFixed(2)} per sq ft`;
};

export const priceLabel = (page: ServicePage): string | undefined =>
  page.pricing ? PRICING[page.pricing].label : undefined;

export { PRICE_PROMISE };

/**
 * The FAQ for a service page: the question each linked guide answers, and the
 * recommendation it lands on. Published material, cited back to the guide.
 * Nothing here is written for the schema block.
 */
export const faqsFor = (page: ServicePage): { q: string; a: string; href: string }[] =>
  page.guides
    .map((slug) => {
      const g = getGuide(slug);
      if (!g) return null;
      return { q: g.question, a: g.recommendation.text, href: `/guides/${g.slug}` };
    })
    .filter((x): x is { q: string; a: string; href: string } => x !== null);

export const pillarsFor = (page: ServicePage) =>
  PILLARS.filter((p) => page.pillars.includes(p.id));

export const termsFor = (page: ServicePage) =>
  page.terms.map((s) => getTerm(s)).filter((t): t is NonNullable<typeof t> => Boolean(t));
