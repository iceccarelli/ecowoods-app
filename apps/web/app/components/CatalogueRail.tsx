import Link from 'next/link';
import { catalogueHref, cataloguesForRoute } from '@/lib/catalogues';

/**
 * CatalogueRail — the field catalogue that belongs on THIS page.
 *
 * WHY ONE, AND AT MOST TWO
 *
 * AWS does not put the whole whitepaper library at the foot of every service
 * page; it puts the one document that covers that service. A slab of eight
 * downloads reads as a dump and gets skipped whole, which costs the one
 * document that was actually relevant. So the mapping lives in
 * lib/catalogues.ts as CATALOGUE_RAILS, curated per route, and a route absent
 * from it carries no rail at all.
 *
 * WHY THE ROUTE IS PASSED IN
 *
 * A server component cannot read the current path, and passing the catalogue
 * ids at each call site would put the curation in twelve files. The route
 * string is the one thing the page already knows about itself; the map it keys
 * into is a single edit, and a href in it that stops resolving fails
 * `pnpm verify:links` at the one place it is declared.
 *
 * NOTHING IS GATED. No email, no form, no interstitial. These are public
 * documents and a download that asks for an address is a lead form wearing a
 * document's clothes.
 */
export function CatalogueRail({
  route,
  heading = 'Take the catalogue with you',
  intro,
}: {
  /** The canonical path of the page rendering this. Keys CATALOGUE_RAILS. */
  route: string;
  heading?: string;
  intro?: string;
}) {
  const items = cataloguesForRoute(route);
  if (!items.length) return null;

  return (
    <section className="tlx-section" aria-label="Field catalogue">
      <div className="shell">
        <p className="tlx-kicker">Field catalogue</p>
        <h2 className="tlx-h2">{heading}</h2>
        <p className="tlx-note">
          {intro ??
            'The same facts as this page, in a document you can print or forward. Not a quote, and nothing on it asks for your email.'}
        </p>
        <div className="tlx-grid">
          {items.map((c) => (
            <a
              key={c.id}
              className="tlx-card"
              href={catalogueHref(c)}
              target="_blank"
              rel="noopener"
            >
              <span className="tlx-card-tag">
                Catalogue No. {c.id} · PDF
              </span>
              <h3>{c.title}</h3>
              <p>{c.purpose}</p>
              <span className="tlx-card-data">
                <span>{c.pages} pages</span>
                <span>{c.trim}</span>
                <span className="wp-sr">{c.file}, opens in a new tab</span>
              </span>
            </a>
          ))}
        </div>
        <p className="tlx-note">
          <Link href="/catalogues">Every field catalogue</Link> — the company, the services, the
          stair case, the framework and the decisions, indexed by series.
        </p>
      </div>
    </section>
  );
}
