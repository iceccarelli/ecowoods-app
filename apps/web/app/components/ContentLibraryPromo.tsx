/**
 * ContentLibraryPromo — the homepage's door into the reference corpus.
 *
 * WHY THIS IS BIGGER THAN IT WAS
 *
 * Measured on 2026-08-20: the entire homepage body contained FIVE outbound
 * internal links — a phone number, /design, #quote, and the two buttons this
 * component used to render. 875 lines of the most-crawled, most-visited page on
 * the site, dead-ending into itself.
 *
 * Meanwhile the site had grown a technical corpus reachable only from the nav
 * and the footer: a versioned framework, a self-assessment, six guides, 32
 * glossary terms, sixteen city pages. Crawl equity enters at the homepage and
 * distributes by links. There were none to distribute through. See F-84.
 *
 * SERVER COMPONENT, DELIBERATELY. It reads the manifests — lib/papers.ts
 * reaches for node:fs — so it is rendered in app/page.tsx and passed into the
 * client homepage as a prop. Importing it from home-client.tsx would bundle fs
 * for the browser and break the build, which is precisely what F-80 was.
 *
 * EVERY COUNT IS DERIVED. Nothing here is typed by hand, so a new paper, guide
 * or glossary term cannot make this section wrong.
 */
import Link from 'next/link';
import { getPapers } from '@/lib/papers';
import { getGuides } from '@/lib/guides';
import { getTerms } from '@/lib/glossary';
import { PILLARS, criterionCount, FRAMEWORK_VERSION } from '@/lib/framework';
import { CITIES } from '@/lib/seo-data';

export function ContentLibraryPromo() {
  const papers = getPapers();
  const guides = getGuides();
  const terms = getTerms();

  const cards = [
    {
      href: '/framework',
      eyebrow: `Standard · v${FRAMEWORK_VERSION}`,
      title: 'The Well-Installed Framework',
      body: 'A published specification for judging any hardwood installation — including ours. Use it on every quote you are holding.',
      meta: `${PILLARS.length} pillars · ${criterionCount()} criteria`,
    },
    {
      href: '/papers',
      eyebrow: 'Technical papers',
      title: 'The engineering, written down',
      body: 'Moisture protocol, selection and cost, and the four machines behind a refinish — published in full, not gated.',
      meta: `${papers.length} papers · ${papers.reduce((n, p) => n + p.sections.length, 0)} sections`,
    },
    {
      href: '/guides',
      eyebrow: 'Decision guides',
      title: 'The choices, settled',
      body: 'Solid or engineered. Nail-down, glue-down or floating. How to read a quote. Plus complete reference specifications for the common Toronto scenarios.',
      meta: `${guides.filter((g) => g.kind === 'decision').length} guides · ${guides.filter((g) => g.kind === 'reference').length} reference installations`,
    },
    {
      href: '/glossary',
      eyebrow: 'Glossary',
      title: 'Every term, defined',
      body: 'Acclimation, cupping, crowning, moisture differential, cross-ply core. One page per term, each one sourced to a paper above.',
      meta: `${terms.length} terms`,
    },
  ];

  return (
    <section className="section section--tint" id="library" aria-label="Reference library">
      <div className="shell">
        <div className="section-head reveal">
          <span className="eyebrow">The reference library</span>
          <h2>
            The science behind <span className="serif-italic">the price.</span>
          </h2>
          <p>
            Moisture testing, finish chemistry, dust-free methodology — the technical standards the
            estimate is built on, documented from the job site and published in full. Free to read,
            free to cite, and written to be used on any contractor in the GTA.
          </p>
        </div>

        <div className="clp-cards reveal">
          {cards.map((c) => (
            <article key={c.href} className="clp-card">
              <span className="clp-card-eyebrow">{c.eyebrow}</span>
              <h3>
                <Link href={c.href}>{c.title}</Link>
              </h3>
              <p>{c.body}</p>
              <p className="clp-card-meta">{c.meta}</p>
              <div className="clp-card-actions">
                <Link href={c.href} className="clp-more">
                  Open <span aria-hidden>→</span>
                </Link>
                {/* Written as a literal rather than threaded through the card
                    data. scripts/verify-links.mjs reads hrefs statically, the
                    same way a crawler does, and a route that only ever appears
                    as a variable is a route the guard cannot see. */}
                {c.href === '/framework' && (
                  <Link href="/framework/assess" className="clp-more clp-more--strong">
                    Score a quote <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="clp-secondary reveal">
          <div className="clp-secondary-col">
            <h3>Also published</h3>
            <ul className="clp-links">
              <li>
                <Link href="/resources">Every resource, in one index</Link>
              </li>
              <li>
                <Link href="/technical-library">Technical library</Link>
              </li>
              <li>
                <Link href="/case-studies">Engineering case studies</Link>
              </li>
              <li>
                <Link href="/blog">Articles</Link>
              </li>
              <li>
                <Link href="/authority">Citation guide for researchers and AI</Link>
              </li>
              <li>
                <a href="/feed.xml">RSS feed</a>
              </li>
              <li>
                <Link href="/whats-new">What&rsquo;s new</Link>
              </li>
              <li>
                <Link href="/standards">Standards register</Link>
              </li>
              <li>
                <Link href="/data">Data &amp; figures</Link>
              </li>
              <li>
                <a href="/api/knowledge">Public JSON API</a>
              </li>
            </ul>
          </div>

          {/* The sixteen city pages are prerendered, in the sitemap at priority
              0.85, and were reachable from one link in the entire application
              before patch 33. On a local trade site this is the highest-intent
              surface there is. Derived from CITIES so it cannot drift. */}
          <div className="clp-secondary-col">
            <h3>Where we work</h3>
            <ul className="clp-areas">
              {CITIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
            <Link href="/service-areas" className="clp-more">
              All service areas <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
