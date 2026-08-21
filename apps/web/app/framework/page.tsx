import type { Metadata } from 'next';
import Link from 'next/link';
import {
  PILLARS,
  FRAMEWORK_NAME,
  FRAMEWORK_VERSION,
  FRAMEWORK_PUBLISHED_AT,
  criterionCount,
  severityCount,
  sourceHref,
} from '@/lib/framework';
import { getGuides } from '@/lib/guides';
import { Illustration } from '../components/Illustration';
import { SITE_URL } from '@/lib/seo-data';
import { illustrationImage } from '../data/illustration-images';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /framework — the published specification.
 *
 * This page exists to be cited, not to convert. Every criterion has a stable
 * public id and an anchor, so "Well-Installed Framework v1.0, criterion 2.4"
 * resolves to a URL that will still mean the same thing in five years. That
 * durability is the whole product: a standard that renumbers itself is not a
 * standard.
 *
 * Built on the .tlx-* editorial surface, with a .fw-* component namespace
 * inside it — the same relationship .wp-* has to the papers. Not a third design
 * system.
 */

export const metadata: Metadata = {
  title: `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION} | EcoWoods`,
  description:
    'A published, versioned specification for judging a hardwood flooring installation: six pillars, twenty-seven binary criteria, every one sourced to a technical paper. Use it on any contractor, including us.',
  alternates: { canonical: '/framework' },
  openGraph: {
    title: `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION}`,
    description:
      'Six pillars and twenty-seven criteria for judging a hardwood installation. Publicly versioned, fully sourced, free to cite.',
    type: 'article',
    url: `${SITE_URL}/framework`,
    images: [{ url: illustrationImage('og-framework')?.src ?? '/illustrations/og-framework.webp', width: 1200, height: 630 }],
  },
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  major: 'Major',
  advisory: 'Advisory',
};

export default function FrameworkPage() {
  const guides = getGuides();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${SITE_URL}/framework#specification`,
    headline: `${FRAMEWORK_NAME} v${FRAMEWORK_VERSION}`,
    description:
      'A versioned public specification for judging a hardwood flooring installation across six pillars.',
    url: `${SITE_URL}/framework`,
    datePublished: FRAMEWORK_PUBLISHED_AT,
    version: FRAMEWORK_VERSION,
    inLanguage: 'en-CA',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    hasPart: PILLARS.map((p) => ({
      '@type': 'CreativeWork',
      name: `Pillar ${p.number} — ${p.name}`,
      url: `${SITE_URL}/framework#${p.id}`,
      description: p.intent,
    })),
  };

  return (
    <div className="tlx-page">
      <SchemaScript schema={schema} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Framework', url: `${SITE_URL}/framework` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Framework</span>
          </nav>
          <h1 className="tlx-title">{FRAMEWORK_NAME}</h1>
          <p className="tlx-lede">
            A published specification for judging a hardwood flooring installation — six pillars and{' '}
            {criterionCount()} binary criteria. Every criterion is sourced to a technical paper on
            this site. It is written to be used on any contractor in the GTA, including us.
          </p>
          <p className="fw-meta">
            <span>Version {FRAMEWORK_VERSION}</span>
            <span aria-hidden="true">·</span>
            <span>Published {FRAMEWORK_PUBLISHED_AT}</span>
            <span aria-hidden="true">·</span>
            <span>{severityCount('critical')} critical criteria</span>
            <span aria-hidden="true">·</span>
            <span>Free to cite</span>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/framework/assess">
              Score a quote against the framework →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/papers">
              Read the source papers
            </Link>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="How to use this framework">
        <div className="shell">
          <p className="tlx-kicker">How to use it</p>
          <h2 className="tlx-h2">Three ways this is meant to be used</h2>
          <div className="fw-use">
            <div className="fw-use-item">
              <h3>As a homeowner</h3>
              <p>
                Take the criteria to every quote you are holding. Any critical criterion answered
                &ldquo;no&rdquo; is an unresolved defect in that quote, regardless of the price.
              </p>
            </div>
            <div className="fw-use-item">
              <h3>As a contractor</h3>
              <p>
                Use it as a pre-installation checklist. It is published under CC BY — attribute the
                version and you may reproduce it.
              </p>
            </div>
            <div className="fw-use-item">
              <h3>As a citation</h3>
              <p>
                Every criterion has a permanent id. Cite as{' '}
                <code>Well-Installed Framework v{FRAMEWORK_VERSION}, criterion 2.4</code>; ids are
                never reused or renumbered in place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {PILLARS.map((pillar) => (
        <section key={pillar.id} id={pillar.id} className="tlx-section" aria-label={pillar.name}>
          <div className="shell">
            <p className="tlx-kicker">Pillar {pillar.number}</p>
            <h2 className="tlx-h2">{pillar.name}</h2>
            <p className="tlx-note">{pillar.intent}</p>

            <Illustration id={`pillar-${pillar.id}`} />

            <ol className="fw-criteria">
              {pillar.criteria.map((c) => {
                const href = sourceHref(c);
                return (
                  <li key={c.id} id={`c-${c.id}`} className="fw-criterion">
                    <div className="fw-criterion-head">
                      <span className="fw-id">{c.id}</span>
                      <span className={`fw-sev fw-sev--${c.severity}`}>
                        {SEVERITY_LABEL[c.severity]}
                      </span>
                    </div>
                    <p className="fw-question">{c.question}</p>
                    <p className="fw-risk">
                      <strong>If not:</strong> {c.risk}
                    </p>
                    {href ? (
                      <p className="fw-source">
                        Source: <Link href={href}>{c.source.section.replace(/-/g, ' ')}</Link>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ))}

      <section className="tlx-section" aria-label="Related guides">
        <div className="shell">
          <p className="tlx-kicker">Applied</p>
          <h2 className="tlx-h2">Guides that apply the framework</h2>
          <p className="tlx-note">
            The framework says what to check. These say what to do about the answer.
          </p>
          <div className="tlx-grid">
            {guides.map((g) => (
              <Link key={g.slug} className="tlx-card" href={`/guides/${g.slug}`}>
                <span className="tlx-card-tag">
                  {g.kind === 'decision' ? 'Decision guide' : 'Reference installation'}
                </span>
                <h3>{g.title}</h3>
                <p>{g.question}</p>
                <div className="tlx-card-data">
                  <span>{g.readingMinutes} min</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Versioning">
        <div className="shell">
          <p className="tlx-kicker">Contract</p>
          <h2 className="tlx-h2">What the version number promises</h2>
          <p className="tlx-note">
            Criterion ids are permanent. Adding, removing or rewording a criterion is a minor version
            bump. Changing what a pillar means is a major one. A criterion is never edited in place
            without the version moving, so a citation to v{FRAMEWORK_VERSION} will always resolve to
            the text that was published on {FRAMEWORK_PUBLISHED_AT}.
          </p>
          <p className="tlx-note">
            No criterion in this framework asserts anything that is not already published in a paper
            on this site. That constraint is enforced by a build guard, not by editorial intent —{' '}
            <code>scripts/verify-framework.mjs</code> resolves every citation and fails the build on
            any that does not exist.
          </p>
        </div>
      </section>
    </div>
  );
}
