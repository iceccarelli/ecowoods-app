import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { headlineFeatures } from '@/lib/assistant-site';
import { searchSite } from '@/lib/site-search';

/**
 * /search — the site's search as a page, not only a keyboard shortcut.
 *
 * The ⌘K palette needs JavaScript and a keyboard; this works as a plain GET
 * form, is the target of the WebSite SearchAction, and reads the same
 * navigation registry, so it can only ever return pages the menus link.
 * Result pages are noindex: a query string is not a page worth ranking.
 */
export const metadata: Metadata = {
  title: 'Search Ecowoods',
  description: 'Find a service, price, guide, tool or service area on ecowoods.ca.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

const MAX_QUERY = 120;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').slice(0, MAX_QUERY).trim();
  const results = q ? searchSite(q, 20) : [];
  const popular = headlineFeatures();

  return (
    <main className="shell" style={{ paddingBlock: '3rem' }}>
      <h1 className="tlx-title">Search Ecowoods</h1>
      <form role="search" action="/search" method="get" className="tlx-note">
        <label htmlFor="site-search-q">What are you looking for?</label>{' '}
        <input id="site-search-q" name="q" type="search" defaultValue={q} maxLength={MAX_QUERY} autoComplete="off" />{' '}
        <button type="submit" className="btn btn-copper">Search</button>
      </form>

      {q && (
        <section aria-live="polite" aria-label="Search results">
          <h2 className="tlx-h2">
            {results.length ? `${results.length} ${results.length === 1 ? 'page' : 'pages'} for “${q}”` : `Nothing on the site matches “${q}”`}
          </h2>
          {results.length > 0 && (
            <ul>
              {results.map((r) => (
                <li key={r.href}>
                  <Link href={r.href}>{r.label}</Link>
                  {r.note ? <> — {r.note}</> : null}
                  <span className="tlx-note"> ({r.group})</span>
                </li>
              ))}
            </ul>
          )}
          {results.length === 0 && (
            <p className="tlx-note">
              Try a service, a neighbourhood or a problem, such as “cupping” or “refinishing”. Or{' '}
              <Link href="/estimate">request an estimate</Link>, or call{' '}
              <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
            </p>
          )}
        </section>
      )}

      <section aria-label="Popular pages">
        <h2 className="tlx-h2">Popular</h2>
        <ul>
          {popular.map((p) => (
            <li key={p.href}>
              <Link href={p.href}>{p.label}</Link>
              {p.note ? <> — {p.note}</> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
