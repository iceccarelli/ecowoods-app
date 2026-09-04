import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';
import { SITE_URL, SERVICE_AREAS } from '@/lib/seo-data';
import { FRAMEWORK_NAME, FRAMEWORK_VERSION, PILLARS, criterionCount } from '@/lib/framework';
import { buildBreadcrumbList, buildFAQPage } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { CommercialHeadTermRail } from '../components/CommercialHeadTermRail';

/**
 * /team — who actually does the work, answered without inventing anyone.
 *
 * THE QUERY THIS ANSWERS
 *
 * "who installs hardwood floors in Toronto", "hardwood flooring crew Toronto",
 * "does <contractor> use subcontractors". That last one is the highest-value
 * question in this trade and the site answered it in a single line inside
 * /about's entity answers. It deserves the page, because the answer is the
 * company's actual operating structure and everything else on this site
 * depends on it: a published warranty, an enforceable protocol and a
 * versioned standard all require that the same employer controls the crew.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * No names, no photographs, no tenure figures, no headcount. Not because they
 * would not help — they would help a great deal — but because none of them is
 * published anywhere on this site or in the contract, and this page will not
 * be the first place a number appears without a source. The brief that asked
 * for this page proposed naming an individual and asserting that crew members
 * have "been with the company for more than a decade". Neither is verifiable
 * from anything published, so neither is here. When the company supplies real
 * names, real tenure and real photographs, they belong on this page and it is
 * built to take them.
 *
 * EVERY CLAIM BELOW HAS A SOURCE IN THIS REPOSITORY:
 *   · salaried employees, never subcontractors → lib/entity-answers.ts
 *   · lifetime workmanship warranty + exclusions → lib/pdf/contract-document.tsx §4.1
 *   · founded year, years in business → shared/constants BUSINESS_NAP
 *   · the standard, its pillars and criteria → lib/framework.ts
 *   · coverage → lib/seo-data.ts SERVICE_AREAS
 */

const FAQS = [
  {
    question: `Does ${BUSINESS_NAP.shortName} use subcontractors?`,
    answer:
      `No. Every installation, sanding and finishing hour is worked by salaried employees of ` +
      `${BUSINESS_NAP.legalName}. The same crew is on site from the first board to the final coat.`,
  },
  {
    question: 'Who will actually be in my house?',
    answer:
      `The crew that moisture-tests the subfloor during the estimate is the crew that lays the ` +
      `boards, runs the grit sequence and applies the final coat. There is no handover between ` +
      `the company that quotes and a separate crew that turns up, because there is no separate crew.`,
  },
  {
    question: 'Why does employing the crew matter to the finished floor?',
    answer:
      `Because a protocol can only be enforced on people you employ. ${FRAMEWORK_NAME} ` +
      `v${FRAMEWORK_VERSION} sets ${criterionCount()} criteria across ${PILLARS.length} pillars; ` +
      `a subcontracted crew can be asked to follow them and a salaried one can be required to. ` +
      `The same is true of the warranty: a lifetime workmanship commitment is only meaningful ` +
      `from a company that still controls the people whose workmanship it covers.`,
  },
  {
    question: 'What does the workmanship warranty cover?',
    answer:
      `Defects in workmanship on installation and finishing work, for as long as you own the ` +
      `property. Material warranties are the manufacturers' and are passed through to you in ` +
      `writing. It does not cover misuse, flooding, pet damage, or a failure to keep indoor ` +
      `relative humidity within 35–55%. The clause is in the contract you sign, not on a page ` +
      `like this one.`,
  },
  {
    question: `How long has ${BUSINESS_NAP.shortName} been working in Toronto?`,
    answer:
      `Since ${BUSINESS_NAP.foundedYear} — ${yearsInBusiness()} years — across ` +
      `${SERVICE_AREAS.length} municipalities and neighbourhoods in Toronto and the GTA.`,
  },
];

export const metadata: Metadata = {
  title: 'The Ecowoods crew — salaried hardwood craftsmen in Toronto',
  description:
    `Every Ecowoods hardwood installation and refinishing in Toronto is worked by salaried ` +
    `employees, never subcontractors. The same crew from the first board to the final coat — ` +
    `which is what makes a published standard and a lifetime workmanship warranty enforceable.`,
  alternates: { canonical: '/team' },
  openGraph: {
    title: 'The Ecowoods crew — salaried craftsmen, no subcontractors',
    description:
      `Salaried hardwood installers and finishers across Toronto and the GTA since ` +
      `${BUSINESS_NAP.foundedYear}. The same crew start to finish.`,
    type: 'website',
    url: `${SITE_URL}/team`,
  },
};

export default function TeamPage() {
  return (
    <div className="tlx-page">
      <SchemaScript schema={buildFAQPage(FAQS)} />
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'The crew', url: `${SITE_URL}/team` },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': `${SITE_URL}/team#webpage`,
          url: `${SITE_URL}/team`,
          name: 'The Ecowoods crew',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
          mainEntity: { '@id': `${SITE_URL}/#organization` },
        }}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>The crew</span>
          </nav>
          <p className="tlx-kicker">Salaried employees · Never subcontractors</p>
          <h1 className="tlx-title">The same crew from the first board to the final coat</h1>
          <p className="tlx-lede">
            Every hour of installation, sanding and finishing on an {BUSINESS_NAP.shortName} project
            is worked by salaried employees of {BUSINESS_NAP.legalName}. That single structural fact
            is what the rest of this site rests on — a published standard, a written protocol and a
            lifetime workmanship warranty are all only enforceable against people the company
            employs.
          </p>
          <p className="fw-meta">
            <span>Established {BUSINESS_NAP.foundedYear}</span>
            <span aria-hidden="true">·</span>
            <span>{yearsInBusiness()} years</span>
            <span aria-hidden="true">·</span>
            <span>{SERVICE_AREAS.length} areas</span>
          </p>
          <div className="fw-actions">
            <Link className="fw-cta" href="/#quote">
              Meet the crew on site — free estimate →
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/framework">
              Read the standard they work to
            </Link>
          </div>
        </div>
      </header>

      <section className="tlx-section" aria-label="Why the employment structure decides the floor">
        <div className="shell">
          <p className="tlx-kicker">The part that is structural, not marketing</p>
          <h2 className="tlx-h2">Why who employs the crew decides how the floor turns out</h2>
          <p className="tlx-note">
            A hardwood floor fails for reasons that are invisible on the day it is handed over. The
            moisture reading that was taken but not written down. The acclimation period that was
            shortened to make a schedule. The grit that was skipped because the next job started
            Monday. None of those show up in a photograph, and all of them show up eighteen months
            later.
          </p>
          <p className="tlx-note">
            Every one of them is a decision made by a person on site under time pressure. Which is
            why the question &ldquo;who employs that person&rdquo; is not an HR detail — it is the
            single variable that determines whether a written protocol is a requirement or a
            request. {FRAMEWORK_NAME} v{FRAMEWORK_VERSION} can be handed to any crew in the GTA; it
            can only be <em>enforced</em> on one that is on payroll.
          </p>
          <ol className="fw-criteria">
            {PILLARS.map((p) => (
              <li key={p.id} className="fw-criterion">
                <div className="fw-criterion-head">
                  <span className="fw-id">{p.number}</span>
                </div>
                <p className="fw-question">
                  <Link href={`/framework#${p.id}`}>{p.name}</Link>
                </p>
                <p className="fw-risk">{p.intent}</p>
              </li>
            ))}
          </ol>
          <p className="tlx-note">
            All {criterionCount()} criteria are published under CC BY at{' '}
            <Link href="/framework">the framework</Link>, free to use on any contractor you are
            considering — including us. If you are holding quotes right now,{' '}
            <Link href="/framework/assess">score them</Link>.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="The warranty">
        <div className="shell">
          <p className="tlx-kicker">What the structure buys you</p>
          <h2 className="tlx-h2">A lifetime workmanship warranty, in the contract</h2>
          <p className="tlx-note">
            {BUSINESS_NAP.shortName} warrants its workmanship on installation and finishing for as
            long as you own the property. Manufacturer material warranties are passed through to you
            in writing and itemised in the agreement. The warranty covers defects in workmanship
            only — not misuse, flooding, pet damage, or a failure to keep indoor relative humidity
            inside the 35–55% band in which hardwood is dimensionally stable.
          </p>
          <p className="tlx-note">
            That clause is in the contract you sign, not a badge on a website. When you are
            comparing companies, the question worth asking is not whether a lifetime warranty is
            offered — it is who will still be employing the crew that did the work when you call.
            The guide on{' '}
            <Link href="/guides/how-to-evaluate-a-hardwood-quote">how to evaluate a quote</Link>{' '}
            sets out the language to look for.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="How this page is sourced">
        <div className="shell">
          <p className="tlx-kicker">Verifiable by design</p>
          <h2 className="tlx-h2">What this page states</h2>
          <p className="tlx-note">
            Every number on this site is derived from something published — the price bands, the
            criterion count, the review figures with the date they were read — and this page is held
            to the same rule: everything here is real and verifiable.
          </p>
          <p className="tlx-note">
            What is stated above is: salaried employees rather than subcontractors, the same crew
            start to finish, {yearsInBusiness()} years of it, and a warranty clause you can read in
            the agreement before you sign. The rest is on{' '}
            <Link href="/reviews">the review evidence page</Link>, written by clients on a platform
            we cannot edit.
          </p>
        </div>
      </section>

      <section className="tlx-section" aria-label="Frequently asked questions">
        <div className="shell">
          <p className="tlx-kicker">Straight answers</p>
          <h2 className="tlx-h2">Questions people ask about the crew</h2>
          <dl className="gd-spec">
            {FAQS.map((f) => (
              <div className="gd-spec-row" key={f.question}>
                <dt>{f.question}</dt>
                <dd>{f.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <CommercialHeadTermRail />

      <section className="tlx-section" aria-label="Talk to us">
        <div className="shell">
          <p className="tlx-kicker">Next</p>
          <h2 className="tlx-h2">The estimate is where you meet them</h2>
          <p className="tlx-note">
            The in-home estimate is free, the subfloor is moisture-tested during it, and the price
            that follows is fixed in writing before any deposit. Call{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a> or{' '}
            <Link href="/#quote">book online</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
