import Link from 'next/link';
import { PRICING } from '@/lib/pricing';
import { SERVICE_AREAS } from '@/lib/seo-data';
import { criterionCount } from '@/lib/framework';

/**
 * CommercialHeadTermRail — the money pages, forced into every crawl path.
 *
 * WHY THIS EXISTS
 *
 * /hardwood-flooring-toronto, /hardwood-floor-refinishing-toronto and
 * /hardwood-stairs-toronto are the highest-intent URLs on this site. Before this component they were
 * reachable from the footer and from each other, and nowhere else. A footer
 * link is the weakest internal signal a page can receive: it appears on every
 * URL, so it distinguishes nothing, and every serious crawler discounts it for
 * exactly that reason.
 *
 * This rail puts them in the body of the homepage, the services index, every
 * one of the {SERVICE_AREAS.length} service-area pages and every guide — in
 * content, with descriptive anchor text, above the fold of the sections that
 * follow. That is roughly fifty in-content links into three URLs, which is the
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

          {/* Stairs, third. Not padding: it is the one commercial cluster on
              this site that had no page at all until /hardwood-stairs-toronto,
              and it is the part of a flooring job most often left out of the
              written price — which makes it the part a homeowner searches for
              separately, usually after signing something that did not include
              it. No price band here because none is published: stairs are
              quoted per tread, and inventing a figure for a card is exactly the
              kind of number an answer engine would quote back. */}
          <Link className="chr-card" href="/hardwood-stairs-toronto">
            <h3>Hardwood stairs in {where}</h3>
            <p>
              Refinishing, carpet removal and new treads, matched to the floor they meet.
              Quoted per tread rather than per square foot, and itemised in the written
              price rather than added to it later.
            </p>
            <p className="chr-meta">Per-tread pricing · Colour matched on site · Fixed price</p>
          </Link>
        </div>

        {/* The foot carries two links, and neither is a fourth money page.
            One is the standard, because the honest version of "pick us" is
            "here is what correct looks like, use it on everyone". The other is
            the failure-mode atlas, because a visitor whose floor is ALREADY
            failing is not shopping and should not be handed a price card —
            they need a diagnosis, and that is a different page and a shorter
            path to a job. */}
        <p className="chr-foot">
          Floor already cupping, gapping or lifting?{' '}
          <Link href="/hardwood-floor-problems-toronto">
            What your floor is telling you
          </Link>{' '}
          gives each symptom its cause and an honest prognosis — including the two
          where the answer is to do nothing yet.
        </p>
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
