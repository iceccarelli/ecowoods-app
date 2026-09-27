import type { Metadata } from 'next';
import Link from 'next/link';
import { FilmStage } from '../components/FilmStage';
import { FILMS, AUDIO_TRACKS, videoObjectsFor, audioObjectFor } from '@/lib/films';
import { AudioStage } from '../components/AudioStage';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /films — the durable hub for every film on this site.
 *
 * The header, footer and ⌘K each need ONE stable destination to point at, not
 * a scroll position inside /library that can move the day that page's layout
 * changes. This route is that destination: every FILMS entry, in order, each
 * with a link into the money page it actually sells — not a second index of
 * /library's own "Films" section, which stays where it is for anyone browsing
 * the whole visual library instead of arriving to watch.
 */

const MONEY_LINKS: Record<string, { href: string; label: string }[]> = {
  'the-work': [
    { href: '/hardwood-stairs-toronto', label: 'Stairs in Toronto' },
    { href: '/case-studies', label: 'Case studies' },
  ],
  'the-brief': [
    { href: '/services', label: 'All six services' },
    { href: '/hardwood-flooring-toronto', label: 'Hardwood flooring in Toronto' },
  ],
  'the-how': [
    { href: '/services/dust-free-sanding', label: 'Dust-free sanding' },
    { href: '/hardwood-floor-refinishing-toronto', label: 'Refinishing in Toronto' },
    { href: '/guides/dustless-hardwood-refinishing-toronto', label: 'The dustless guide' },
  ],
  'the-price-menu': [
    { href: '/pricing', label: 'The published bands' },
    { href: '/estimate', label: 'Book the free in-home measure' },
  ],
  'the-vision': [
    { href: '/floor-studio', label: 'Floor Studio' },
    { href: '/pricing', label: 'The published bands' },
  ],
  'see-it': [
    { href: '/floor-studio', label: 'Floor Studio' },
    { href: '/hardwood-floor-refinishing-toronto', label: 'Refinishing in Toronto' },
  ],
};

export const metadata: Metadata = {
  title: 'Films',
  description:
    'Every film and audio piece Ecowoods has published: real camera footage of real jobs, animated explainers on dust, staying home during the work, hidden quote costs and the published price menu, and two product films on Floor Studio and the fixed-price system.',
  alternates: { canonical: '/films' },
  openGraph: {
    title: 'Films — Ecowoods',
    description: 'Real job footage, animated explainers, and the two films behind Floor Studio and the published price menu.',
    type: 'website',
    url: `${SITE_URL}/films`,
  },
};

export default function FilmsPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${SITE_URL}/films#collection`,
          name: 'Films — Ecowoods',
          description: 'Every film Ecowoods has published, indexed.',
          url: `${SITE_URL}/films`,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          publisher: { '@id': `${SITE_URL}/#organization` },
        }}
      />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Films', url: `${SITE_URL}/films` },
        ])}
      />
      {FILMS.flatMap((f) => videoObjectsFor(f)).map((v) => (
        <SchemaScript key={v.contentUrl} schema={v} />
      ))}
      {AUDIO_TRACKS.map((t) => (
        <SchemaScript key={t.src} schema={audioObjectFor(t)} />
      ))}

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Films</span>
          </nav>
          <h1 className="tlx-title">Films</h1>
          <p className="tlx-lede">
            {FILMS.length} series, {FILMS.reduce((n, f) => n + f.chapters.length, 0)} chapters,
            plus one long-form audio piece. Real camera footage of real jobs, animated explainers
            on dust, living at home during the work, hidden quote costs and the published price
            menu, and two product films on Floor Studio and the fixed-price system.
          </p>
        </div>
      </header>

      {FILMS.map((f) => (
        <section key={f.slug} id={f.slug} className="tlx-section" aria-label={f.headline}>
          <div className="shell">
            <p className="tlx-kicker">{f.kicker}</p>
            <h2 className="tlx-h2">{f.headline}</h2>
            <p className="tlx-note">{f.lede}</p>
            <FilmStage film={f} />
            {f.slug === 'the-price-menu' &&
              AUDIO_TRACKS.map((t) => <AudioStage key={t.src} track={t} />)}
            {MONEY_LINKS[f.slug] && (
              <p className="tlx-note">
                {MONEY_LINKS[f.slug].map((l, i) => (
                  <span key={l.href}>
                    {i > 0 ? ' · ' : ''}
                    <Link href={l.href}>{l.label} →</Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </section>
      ))}

      <section className="tlx-section" aria-label="Everything else">
        <div className="shell">
          <p className="tlx-kicker">More</p>
          <h2 className="tlx-h2">The rest of the visual library</h2>
          <p className="tlx-note">
            Diagrams, job photography and the floor collection live at{' '}
            <Link href="/library">the visual library</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
