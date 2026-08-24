import Link from 'next/link';
import { PRICING } from '@/lib/pricing';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { criterionCount } from '@/lib/framework';

/**
 * CommercialHeadTermRail — the two money pages, forced into every crawl path.
 *
 * WHY THIS EXISTS
 *
 * /hardwood-flooring-toronto and /hardwood-floor-refinishing-toronto are the
 * two highest-intent URLs on this site. Before this component they were
 * reachable from the footer and from each other, and nowhere else. A footer
 * link is the weakest internal signal a page can receive: it appears on every
 * URL, so it distinguishes nothing, and every serious crawler discounts it for
 * exactly that reason.
 *
 * This rail puts them in the body of the homepage, the services index, every
 * one of the {SERVICE_AREAS.length} service-area pages and every guide — in
 * content, with descriptive anchor text, above the fold of the sections that
 * follow. That is roughly fifty in-content links into two URLs, which is the
 * mechanism by which a site tells a crawler which of its pages it considers
 * most important.
 *
 * EVERY FIGURE IS DERIVED. The bands come from lib/pricing.ts and the criterion
 * count from lib/framework.ts, so this component cannot state a price the rest
 * of the site does not state. Nothing is typed by hand — which is the only
 * reason it is safe to render the same numbers in fifty places.
 *
 * ONE DESIGN SYSTEM, NOT A THIRD. This site has two: .section/.shell for
 * marketing and .tlx-* for editorial. The rail appears in both, so it uses
 * .shell (common to both) and its own .chr-* block for the interior rather
 * than borrowing .clp-card or .tlx-card across the boundary. See the note
 * above the .chr rules in globals.css.
 */

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

export function CommercialHeadTermRail({ city }: { city?: string }) {
  /* The city variant exists because the service-area pages are where this rail
     does the most work: it is the only in-content path from a local query to
     the page that answers the commercial one. The anchor text changes; the
     destination does not. */
  const where = city ?? 'Toronto';

  return (
    <section className="chr" aria-label="Most searched hardwood services">
      <div className="shell">
        <p className="chr-kicker">Most searched in {where}</p>
        <div className="chr-grid">
          <Link className="chr-card" href="/hardwood-flooring-toronto">
            <h3>Hardwood flooring in {where}</h3>
            <p>
              Installation and refinishing, with the price bands published before you call.
              New hardwood installed runs {band('newInstall')} per square foot.
            </p>
            <p className="chr-meta">Fixed written price · Salaried crews · No subcontractors</p>
          </Link>

          <Link className="chr-card" href="/hardwood-floor-refinishing-toronto">
            <h3>Hardwood floor refinishing in {where}</h3>
            <p>
              Dust-free sanding in an occupied home. A full sand and finish runs{' '}
              {band('fullSandAndFinish')} per square foot; a screen and recoat{' '}
              {band('screenAndRecoat')} where the existing finish is sound.
            </p>
            <p className="chr-meta">HEPA containment · Most clients stay home · Fixed price</p>
          </Link>
        </div>

        {/* The third link is not a third money page. It is the standard, and it
            goes here because the honest version of "pick us" is "here is what
            correct looks like, use it on everyone". */}
        <p className="chr-foot">
          Judging quotes rather than buying yet?{' '}
          <Link href="/framework">The Well-Installed Framework</Link> sets out {criterionCount()}{' '}
          criteria, published free to use on any contractor in the GTA — including us — or{' '}
          <Link href="/framework/assess">score a quote you already have</Link>.
        </p>
      </div>
    </section>
  );
}
