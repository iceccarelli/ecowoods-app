import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import {
  PRICE_BANDS_BY_KEY,
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBandBare,
  type PriceBandKey,
} from '@/content/constants/pricing';
import { PRICE_PROMISE } from '@/lib/pricing';
import { SITE_URL, FAQ_ITEMS } from '@/lib/seo-data';
import { getServicePages, serviceFor, priceLabel } from '@/lib/service-pages';
import { getGuide } from '@/lib/guides';
import { getRegistry, type PricePrimitive } from '@/lib/registry';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { EstimateForm } from '../components/EstimateForm';
import { Illustration } from '../components/Illustration';

/**
 * /pricing — the canonical statement of the three published bands.
 *
 * Protocol v2 §15 (P0 page IA), Stage 30 (conversion). Every Price primitive in
 * lib/registry points its `canonical_url` at a fragment of THIS page —
 * /pricing#screen-and-recoat, /pricing#full-sand-and-finish, /pricing#new-install
 * — so an agent that resolves a price id lands on the row that states it. The
 * three row ids are a public contract: they are written as literals below,
 * checked against the registry's own fragment at render time, and must never
 * change.
 *
 * NOT ONE FIGURE IS TYPED HERE. Every band is `formatBandBare` over
 * content/constants/pricing.ts; the conditions that move each band are
 * `reg.prices[].data.conditions` from the registry; the FAQ is the FAQ_ITEMS
 * entry every other page already emits. scripts/verify-pricing-source.mjs
 * fails the build on a price literal anywhere under app/, this file included.
 */

const url = `${SITE_URL}/pricing`;

export const metadata: Metadata = {
  title: 'Hardwood flooring prices in Toronto — three published bands',
  description:
    `Three published price bands per sq ft in CAD: screen and recoat ${formatBandBare(SCREEN_RECOAT)}, ` +
    `full sand and finish ${formatBandBare(FULL_SAND_FINISH)}, new hardwood ${formatBandBare(NEW_INSTALL)}. ` +
    `Fixed in writing after a free in-home measure.`,
  alternates: { canonical: '/pricing', types: { 'text/markdown': '/pricing.md' } },
  openGraph: {
    title: 'Hardwood flooring prices in Toronto — Ecowoods',
    description:
      `Three published bands per square foot in CAD, from ${formatBandBare(SCREEN_RECOAT)} for a screen and recoat ` +
      `to ${formatBandBare(NEW_INSTALL)} for new hardwood. The fixed price is written after a free in-home measure.`,
    type: 'website',
    url,
  },
};

/**
 * What each band covers, in one sentence. Editorial, no figures — the figure is
 * the band itself, and the conditions that move it are the registry's. Typed
 * over PriceBandKey so a fourth band cannot be added to the constants without
 * tsc failing here.
 */
const COVERS: Record<PriceBandKey, string> = {
  screenAndRecoat:
    'Abrade the existing finish and apply fresh coats without taking the floor to bare wood.',
  fullSandAndFinish: 'Sand to bare wood, stain where specified, and apply the finish system.',
  newInstall: 'Solid or engineered hardwood supplied and installed over a prepared, moisture-tested substrate.',
};

/**
 * One table row per published band.
 *
 * `id` is passed as a literal at the call site rather than derived from the
 * registry, because scripts/verify-destinations.mjs resolves every
 * `/pricing#…` link on the site against the literal ids it can read in this
 * file — and the registry, the service pages and the citation packs all link
 * these three fragments. A derived id would render identically and leave that
 * guard blind. The literal is then checked against the registry's own
 * canonical fragment, so the two cannot drift silently either way.
 */
function BandRow({ id, price }: { id: string; price: PricePrimitive }) {
  const fragment = price.canonical_url.split('#')[1];
  if (fragment !== id) {
    throw new Error(`/pricing: row id "${id}" does not match the registry fragment "#${fragment}" for ${price.id}`);
  }
  const key = price.data.band_key as PriceBandKey;
  const band = PRICE_BANDS_BY_KEY[key];
  const pricedHere = getServicePages().filter((p) => p.pricing === key);
  return (
    <tr id={id}>
      <th scope="row">{band.label}</th>
      <td>{formatBandBare(band)}</td>
      <td>
        {COVERS[key]}
        {pricedHere.length > 0 && (
          <>
            {' '}
            Priced in this band:{' '}
            {pricedHere.map((p, i) => (
              <span key={p.slug}>
                {i > 0 && ', '}
                <Link href={`/services/${p.slug}`}>{serviceFor(p)?.name ?? p.h1}</Link>
              </span>
            ))}
            .
          </>
        )}
      </td>
    </tr>
  );
}

export default async function PricingPage() {
  const reg = await getRegistry();
  const priceFor = (key: PriceBandKey): PricePrimitive => {
    const p = reg.prices.find((x) => x.data.band_key === key);
    if (!p) throw new Error(`/pricing: the registry publishes no Price primitive for band "${key}"`);
    return p;
  };

  /* Cheapest intervention first — the order a homeowner meets them. */
  const rows = [
    <BandRow key="screen-and-recoat" id="screen-and-recoat" price={priceFor('screenAndRecoat')} />,
    <BandRow key="full-sand-and-finish" id="full-sand-and-finish" price={priceFor('fullSandAndFinish')} />,
    <BandRow key="new-install" id="new-install" price={priceFor('newInstall')} />,
  ];
  if (rows.length !== reg.prices.length) {
    throw new Error(`/pricing renders ${rows.length} band row(s) but the registry publishes ${reg.prices.length}`);
  }
  const prices = (['screenAndRecoat', 'fullSandAndFinish', 'newInstall'] as const).map(priceFor);

  const costGuide = getGuide('hardwood-flooring-cost-toronto');
  const servicePages = getServicePages();
  const perProject = servicePages.filter((p) => !p.pricing);
  const faq = FAQ_ITEMS.find((f) => f.q.startsWith('How much does hardwood flooring cost'));

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Pricing', url },
        ])}
      />
      <SchemaScript
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: 'Hardwood flooring prices in Toronto — Ecowoods',
          inLanguage: 'en-CA',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${SITE_URL}/#organization` },
        }}
      />

      {/* (a) The quotable opening. One paragraph, declarative, every figure interpolated. */}
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Pricing</span>
          </nav>
          <h1 className="tlx-title">Hardwood flooring prices in Toronto</h1>
          <p className="tlx-lede">
            {BUSINESS_NAP.legalName} publishes three price bands for hardwood work in{' '}
            {BUSINESS_NAP.region}, each per square foot in Canadian dollars: a screen and recoat at{' '}
            {formatBandBare(SCREEN_RECOAT)}, a full sand and finish at {formatBandBare(FULL_SAND_FINISH)},
            and new hardwood supplied and installed at {formatBandBare(NEW_INSTALL)}. A band is an
            informational range, not a quote. The fixed price is written after a free in-home
            measure, and it does not move afterwards.
          </p>
        </div>
      </header>

      {/* (b) The table, first. The rows carry the fragment ids the registry cites. */}
      <section className="tlx-section" id="bands" aria-label="Published price bands">
        <div className="shell">
          <p className="tlx-kicker">Published bands</p>
          <h2 className="tlx-h2">The three bands</h2>
          <div className="wp-table-wrap" role="region" tabIndex={0} aria-label="Published price bands">
            <table className="wp-table">
              <caption>Published price bands, per square foot, in CAD, before tax</caption>
              <thead>
                <tr>
                  <th scope="col">Service band</th>
                  <th scope="col">Price per sq ft (CAD)</th>
                  <th scope="col">What it covers</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
          <p className="tlx-note">
            Stairs, transitions, furniture moving, removal of existing flooring and moisture
            mitigation are itemised separately in the written estimate. Nothing above is a
            starting-from number: the band is the whole published range.
          </p>
          <Illustration id="fig-installed-cost-bands" />
        </div>
      </section>

      {/* (c) What moves each band — the registry's conditions, one list per band. */}
      <section className="tlx-section" id="conditions" aria-label="What moves the number">
        <div className="shell">
          <p className="tlx-kicker">Inside the band</p>
          <h2 className="tlx-h2">What moves the number</h2>
          <p className="tlx-note">
            Each band is a range because the work inside it varies. These are the conditions that
            decide where a job lands, band by band. The estimator confirms them on site, not from
            a phone description.
          </p>
          <ul className="fw-criteria">
            {prices.map((p) => (
              <li key={p.id} className="fw-criterion">
                <div className="fw-criterion-head">
                  <span className="fw-id">{p.data.formatted}</span>
                </div>
                <p className="fw-question">{p.data.label}</p>
                <ul className="wp-steps">
                  {p.data.conditions.map((c) => (
                    <li key={c}>
                      <span className="fw-risk">{c}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="tlx-note">
            The commodity inputs behind the bands — lumber, finish and labour — are tracked on{' '}
            <Link href="/market">what moves a hardwood quote</Link>
            {costGuide && (
              <>
                , and the decision guide{' '}
                <Link href={`/guides/${costGuide.slug}`}>{costGuide.question}</Link> sets out what
                a quote inside these bands should itemise
              </>
            )}
            .
          </p>
        </div>
      </section>

      {/* (d) The promise, the path to a fixed number, and the work with no band. */}
      <section className="tlx-section" id="fixed-price" aria-label="The fixed written price">
        <div className="shell">
          <p className="tlx-kicker">From band to number</p>
          <h2 className="tlx-h2">The fixed written price</h2>
          <p className="tlx-lede">{PRICE_PROMISE}</p>
          <p className="tlx-note">
            The path from a band to a number is a visit. A senior estimator comes to the house,
            moisture-tests the floor and the subfloor, measures the rooms and the stairs, and
            writes one price with a committed schedule. That written price is the contract price;
            there is no unforeseen-conditions clause to reopen it later.{' '}
            <Link href="/estimate">Request the free in-home estimate</Link> to start.
          </p>
          <p className="tlx-note">
            Where each service sits:{' '}
            {servicePages.map((p, i) => (
              <span key={p.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${p.slug}`}>{serviceFor(p)?.name ?? p.h1}</Link>
                {priceLabel(p) ? ` — ${priceLabel(p)}` : ' — quoted per project'}
              </span>
            ))}
            .
          </p>
          <h3 className="tlx-h2" id="per-project">
            When this is quoted per project
          </h3>
          <p className="tlx-note">
            Two services carry no published band, because the work does not reduce to an area:{' '}
            {perProject.map((p, i) => (
              <span key={p.slug}>
                {i > 0 && ' and '}
                <Link href={`/services/${p.slug}`}>{serviceFor(p)?.name ?? p.h1}</Link>
              </span>
            ))}
            . Custom inlays are priced on the pattern, the species and the cutting; dust-free
            sanding is a containment method inside a refinishing scope rather than a separate
            line. Both are quoted per project after the in-home measure, on the same
            fixed-in-writing terms as everything else.
          </p>
          <p className="tlx-note">
            What the price buys is documented job by job in the{' '}
            <Link href="/case-studies">case studies</Link>, with the readings taken before the
            work started; what customers said afterwards is cited to source on{' '}
            <Link href="/reviews">reviews</Link>.
          </p>
        </div>
      </section>

      {/* (e) The one FAQ the page answers, rendered visibly. No FAQPage markup here:
          F-27 keeps that node on pages whose main content IS the FAQ. */}
      {faq && (
        <section className="tlx-section" id="faq" aria-label="Frequently asked question">
          <div className="shell">
            <p className="tlx-kicker">The question behind this page</p>
            <h2 className="tlx-h2">Asked most often</h2>
            <dl className="gd-spec">
              <div className="gd-spec-row">
                <dt>{faq.q}</dt>
                <dd>{faq.a}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* (f) The ask. EstimateForm renders its own <section id="estimate">, so the
          fragment the registry cites resolves to the form itself; the wrapper
          deliberately carries no id, because two elements with one id is invalid
          HTML and the second would never be scrolled to. */}
      <section className="tlx-section" aria-label="Request an estimate">
        <div className="shell">
          <p className="tlx-kicker">Turn a band into a number</p>
          <h2 className="tlx-h2">Get the fixed written price</h2>
          <p className="tlx-note">
            The bands above are real ranges, not a starting-from number. Book the free in-home
            measure below, or call{' '}
            <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a> and speak to the office.
          </p>
          <EstimateForm
            source="pricing"
            heading="Book the free in-home measure"
            intro="A senior estimator measures and moisture-tests, then writes one price. It does not move afterwards."
          />
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/framework/assess">
              Score a quote you already have
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
