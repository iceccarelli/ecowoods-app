import type { Metadata } from 'next';
import Link from 'next/link';
import { getSeries, fetchSeries, VALET_BASE } from '@/lib/market';
import { Sparkline } from '../components/Sparkline';
import { getPaper } from '@/lib/papers';
import { SITE_URL } from '@/lib/seo-data';
import { illustrationImage } from '../data/illustration-images';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/**
 * /market — why a hardwood quote moves.
 *
 * The page a homeowner reaches from "why is this more than last year". It shows
 * the three traded inputs behind an installed floor, live from the Bank of
 * Canada, with the mechanism for each — and it stops short of converting an
 * index into a dollar figure, because that relationship is real but not linear
 * and pretending otherwise would be a fabrication dressed as data.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'What moves a hardwood quote',
  description:
    'The traded commodity inputs behind an installed hardwood floor in Ontario — forestry, energy and the US dollar — live from the Bank of Canada, with the mechanism for each and why they are volatile. Published so a price change can be evaluated rather than suspected.',
  alternates: { canonical: '/market' },
  openGraph: {
    title: 'What moves a hardwood quote — EcoWoods',
    description:
      'Forestry, energy and FX: the three inputs that move the price of a hardwood floor, live from the Bank of Canada.',
    type: 'website',
    url: `${SITE_URL}/market`,
    images: [{ url: illustrationImage('og-market')?.src ?? '/illustrations/og-market.webp', width: 1200, height: 630 }],
  },
};

const fmt = (n: number, frac = 2) =>
  n.toLocaleString('en-CA', { minimumFractionDigits: frac, maximumFractionDigits: frac });

export default async function MarketPage() {
  const meta = getSeries();
  const results = await fetchSeries(meta.map((s) => s.id), 24);
  const byId = new Map(results.map((r) => [r.id, r]));
  const live = results.filter((r) => r.latest).length;

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'What moves a quote', url: `${SITE_URL}/market` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span>What moves a quote</span>
          </nav>
          <h1 className="tlx-title">What moves a hardwood quote</h1>
          <p className="tlx-lede">
            A hardwood floor is an assembly of traded inputs — sawn wood, petrochemical-derived
            finish and adhesive, freight — most of it priced in US dollars before it reaches a
            Canadian invoice. Every one of those moves independently of the installer. These are
            the three that matter, live from the Bank of Canada.
          </p>
          <p className="fw-meta">
            <span>{live} of {meta.length} series live</span>
            <span aria-hidden="true">·</span>
            <span>Refreshed hourly</span>
            <span aria-hidden="true">·</span>
            <span>
              <a href="/api/market">JSON</a>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <a href="/api/health">Status</a>
            </span>
          </p>
          <p className="fw-privacy">
            Published so a price change can be <em>evaluated</em> rather than suspected. This is not
            investment information and nothing here is a recommendation to buy or sell anything.
            Index values are reproduced from the Bank of Canada, which does not endorse this site.
          </p>
        </div>
      </header>

      {meta.map((s) => {
        const r = byId.get(s.id);
        const paper = s.paperRef ? getPaper(s.paperRef.paper) : undefined;
        const up = (r?.changePct ?? 0) > 0;
        return (
          <section key={s.id} className="tlx-section" aria-label={s.name} id={s.id.toLowerCase()}>
            <div className="shell">
              <article className="mkt">
                <div className="mkt-top">
                  <div className="mkt-id">
                    <h2 className="mkt-name">{s.name}</h2>
                    <p className="mkt-series">
                      {s.sourceLabel} · {s.frequency}
                    </p>
                  </div>

                  {r?.latest ? (
                    <div className="mkt-figure">
                      <span className="mkt-value">{fmt(r.latest.value, s.id === 'FXUSDCAD' ? 4 : 2)}</span>
                      <span className="mkt-asof">
                        as of <time dateTime={r.latest.date}>{r.latest.date}</time>
                      </span>
                      {r.changePct !== null && (
                        <span className={`mkt-change mkt-change--${up ? 'up' : 'down'}`}>
                          {up ? '▲' : '▼'} {fmt(Math.abs(r.changePct), 2)}% vs previous
                        </span>
                      )}
                    </div>
                  ) : (
                    /* A source that could not be reached says so. It does not
                       quietly show the last number we happened to have — a
                       figure that is present is trusted whether or not it is
                       current, which is exactly how the stale runtime report
                       misled three separate investigations (F-41). */
                    <div className="mkt-figure mkt-figure--out">
                      <span className="mkt-value">—</span>
                      <span className="mkt-asof">
                        Source unreachable{r?.error ? `: ${r.error}` : ''}. No figure is shown
                        rather than a stale one.
                      </span>
                    </div>
                  )}
                </div>

                {r?.history && r.history.length > 1 && (
                  <div className="mkt-spark">
                    <Sparkline points={r.history} label={`${s.name}, last ${r.history.length} observations`} />
                    <div className="mkt-spark-axis">
                      <span>{r.history[0].date}</span>
                      <span>{r.history[r.history.length - 1].date}</span>
                    </div>
                  </div>
                )}

                <div className="mkt-copy">
                  <h3>What it drives</h3>
                  <p>{s.drives}</p>
                  <h3>Why it is volatile</h3>
                  <p>{s.volatility}</p>
                </div>

                <p className="fig-source">
                  Data: <a href={`${VALET_BASE}/observations/${s.id}/json`} rel="noopener nofollow" target="_blank">Bank of Canada, {s.id}</a>
                  {paper && s.paperRef && (
                    <>
                      {' '}· In our work:{' '}
                      <Link href={`/papers/${s.paperRef.paper}#${s.paperRef.section}`}>
                        {s.paperRef.label}
                      </Link>
                    </>
                  )}
                </p>
              </article>
            </div>
          </section>
        );
      })}

      <section className="tlx-section" aria-label="What this does not tell you">
        <div className="shell">
          <p className="tlx-kicker">The limit</p>
          <h2 className="tlx-h2">What these numbers do not tell you</h2>
          <p className="tlx-note">
            An index does not convert into the price of your floor. The relationship is real but
            not linear: at job level, <strong>labour, substrate condition and scope dominate</strong>,
            and a slab that needs flattening will move a quote further than a quarter of forestry
            movement ever will. Drawing a straight line from &ldquo;forestry index up 6%&rdquo; to
            &ldquo;your floor costs 6% more&rdquo; would be a fabrication dressed as data, so this
            page does not do it.
          </p>
          <p className="tlx-note">
            The published installed-cost ranges are in the papers, and they are what an estimate is
            actually built against.
          </p>
          <div className="fw-actions">
            <Link className="fw-cta fw-cta--ghost" href="/papers/hardwood-selection-and-cost-framework-gta#installed-cost">
              Installed cost in the GTA
            </Link>
            <Link className="fw-cta fw-cta--ghost" href="/papers/hardwood-selection-and-cost-framework-gta#fixed-price">
              What a fixed price protects
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
