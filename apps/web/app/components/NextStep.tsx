import Link from 'next/link';
import { funnelForRoute } from '@/lib/funnels';

/**
 * NextStep — the one call that matches why this visitor is on this page.
 *
 * WHY THIS EXISTS
 *
 * Every page on this site used to end the same way: book a free measure. That
 * is correct for exactly one of the six intents in lib/funnels. A homeowner
 * halfway through comparing three quotes is not refusing to book — they have
 * not decided, and a booking button at that moment reads as not having
 * listened. So the call is read from the funnel that owns the route, and a
 * route absent from ROUTE_FUNNEL renders nothing here: the generic chrome CTA
 * is the right answer for a page whose visitor could be anyone.
 *
 * WHY IT CAN RENDER NOTHING
 *
 * Two cases, both deliberate:
 *
 *  · The route carries no funnel. Nothing is asserted about the visitor.
 *  · The funnel's next step IS this page. /estimate is the end of the
 *    `purchase` funnel; a band telling the visitor to go to the page they are
 *    already reading is noise, and pretending otherwise would make the band
 *    appear everywhere and mean nothing anywhere.
 *
 * WHY `notYet` IS RENDERED AND NOT ONLY A COMMENT
 *
 * It is not rendered. It is in the data so that the next person editing this
 * page — human or model — reads what this visitor is NOT ready for before
 * adding a second, louder button. scripts/verify-strategy.mjs fails the build
 * if any funnel drops it.
 */
export function NextStep({
  route,
  className = '',
}: {
  /** The canonical path of the page rendering this. Keys ROUTE_FUNNEL. */
  route: string;
  className?: string;
}) {
  const funnel = funnelForRoute(route);
  if (!funnel) return null;

  const target = funnel.nextStep.href;
  if (target === route || target.split('#')[0] === route) return null;

  return (
    <section className={`tlx-section ${className}`.trim()} aria-label="Next step">
      <div className="shell">
        <p className="tlx-kicker">Next step</p>
        <h2 className="tlx-h2">{funnel.intent}</h2>
        <p className="tlx-note">
          That is what this page is for. When you are ready to move, this is the next thing worth
          doing — not a quote, unless a quote is what you came for.
        </p>
        <p>
          <Link className="btn btn-copper btn-lg" href={target}>
            {funnel.nextStep.label}
          </Link>
        </p>
      </div>
    </section>
  );
}
