import type { Metadata } from 'next';
import Link from 'next/link';
import MovementClient from './MovementClient';
import { SPECIES, SPECIES_SOURCE, EMC_SOURCE } from '@/lib/wood';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Hardwood movement calculator — how much will my floor move?',
  description:
    `Compute the seasonal dimensional change of a hardwood floor from published Forest Products Laboratory coefficients: ${SPECIES.length} species, flatsawn against quartersawn, at your own board width and humidity range. Runs in your browser.`,
  alternates: { canonical: '/tools/floor-movement' },
  openGraph: {
    title: 'How much will my hardwood floor move?',
    description:
      'A real calculation from published wood-science constants — not a rule of thumb. Nine species, both grain orientations, your humidity range.',
    type: 'website',
    url: `${SITE_URL}/tools/floor-movement`,
  },
};

export default function FloorMovementPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Tools', url: `${SITE_URL}/tools/floor-movement` },
          { name: 'Hardwood movement calculator', url: `${SITE_URL}/tools/floor-movement` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/papers">Papers</Link> <span aria-hidden="true">/</span>{' '}
            <span>Movement calculator</span>
          </nav>
          <h1 className="tlx-title">How much will your floor move?</h1>
          <p className="tlx-lede">
            Every flooring company in this city will tell you that wood moves with the seasons.
            None of them will tell you how much <em>yours</em> will. This does — from the same
            coefficients a wood scientist would use, for the species and the board width you are
            actually being quoted, over the humidity range a Toronto house actually reaches.
          </p>
          <p className="fw-privacy">
            The arithmetic runs in your browser. Nothing is submitted, nothing is stored, and there
            is no form between you and the answer. The coefficients come from{' '}
            <a href={SPECIES_SOURCE.url} rel="noopener">
              {SPECIES_SOURCE.table}
            </a>{' '}
            and the moisture-content model from{' '}
            <a href={EMC_SOURCE.url} rel="noopener">
              {EMC_SOURCE.equation}
            </a>
            . Neither is ours. That is the point — you can check them.
          </p>
        </div>
      </header>

      <MovementClient />

      <section className="tlx-section" aria-label="What to do with this">
        <div className="shell">
          <p className="tlx-kicker">What this changes</p>
          <h2 className="tlx-h2">Three things this number is good for</h2>
          <div className="tlx-body">
            <ol>
            <li>
              <strong>Judging a width.</strong> A wide plank is not simply a style choice — it moves
              proportionally more, because movement scales with the dimension. Set the slider to the
              width you are being quoted and the width you were considering, and the difference is
              the number nobody put in the quote.
            </li>
            <li>
              <strong>Judging a species.</strong> The comparison table above is the same nine woods
              every showroom sells, ranked by how much they move rather than by colour.
            </li>
            <li>
              <strong>Judging a contractor.</strong> Ask whichever company quoted you what the
              expansion gap is, and what moisture content the material will read at delivery. The{' '}
              <Link href="/framework">Well-Installed Framework</Link> turns that into{' '}
              27 questions you can put in writing — including to us.
            </li>
            </ol>
          </div>
          <p className="tlx-note">
            The physical constants above describe unrestrained solid wood. What an installed floor
            does with that movement depends on the substrate, the fastening method, the expansion
            gaps and how well the material was acclimated — which is the subject of{' '}
            <Link href="/papers/toronto-hardwood-climate-moisture-protocol">Climate Mastery</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
