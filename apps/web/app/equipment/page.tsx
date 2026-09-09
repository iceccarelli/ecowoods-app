import type { Metadata } from 'next';
import Link from 'next/link';
import CircuitPlanner from './CircuitPlanner';
import { MACHINES } from '@/lib/equipment';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: 'Floor sanding equipment — what will run on the circuit you have',
  description: `Published electrical requirements for ${MACHINES.length} professional floor sanding machines from Lägler, Bona and American Sanders, and what happens when two of them share a circuit. Every figure sourced to the manufacturer.`,
  alternates: { canonical: '/equipment' },
  openGraph: {
    title: 'Will this sander run in this house?',
    description:
      'Manufacturer-published electrical requirements for professional floor sanding equipment, and the circuit arithmetic nobody publishes.',
    type: 'website',
    url: `${SITE_URL}/equipment`,
  },
};

/**
 * /equipment — the B2B door.
 *
 * WHY THIS PAGE EXISTS AND WHY IT IS NOT A CATALOGUE
 *
 * A catalogue of machines with prices and productivity figures would be the
 * obvious thing to build and it would be built on sand: Lägler, Bona and
 * American Sanders publish no list prices at all, and not one of them publishes
 * a square-feet-per-hour figure for any machine. Every such number on the
 * internet is somebody's estimate.
 *
 * What all three DO publish, precisely, is electrical requirement. And that is
 * the constraint that decides a job in this city's housing stock — a Bona belt
 * sander needs a 30 A twist-lock, a Lägler needs 220 V, and two American
 * Sanders machines at 12 A each will trip the one 15 A circuit in a 1920s semi.
 * No manufacturer site can tell a contractor that, because each one only
 * describes its own machines.
 *
 * That is a real decision layer over a category Ecowoods does not manufacture,
 * built entirely from other people's published facts, with every one of them
 * cited.
 */
export default function EquipmentPage() {
  const byMaker = [...new Set(MACHINES.map((m) => m.manufacturer))];

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Equipment', url: `${SITE_URL}/equipment` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>Equipment</span>
          </nav>
          <h1 className="tlx-title">Will it run on the circuit you have?</h1>
          <p className="tlx-lede">
            {MACHINES.length} professional floor sanding machines from {byMaker.join(', ')}, with the
            electrical requirement each manufacturer actually publishes — and the arithmetic for what
            happens when two of them share one circuit.
          </p>
          <p className="fw-privacy">
            <strong>No prices, and no square feet per hour.</strong> Not an oversight: none of these
            manufacturers publishes a machine price, and not one of them publishes a productivity
            figure for any machine in this list. Every such number you have seen is an estimate. What
            they do publish — voltage, power, minimum fuse, the connector a machine cannot run
            without — is here, each figure linked to the document it came from.
          </p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Circuit planner">
        <div className="shell">
          <p className="tlx-kicker">The question before the truck is loaded</p>
          <h2 className="tlx-h2">One circuit, however many machines</h2>
          <CircuitPlanner />
        </div>
      </section>

      <section className="tlx-section" aria-label="The machines">
        <div className="shell">
          <p className="tlx-kicker">Sourced, one by one</p>
          <h2 className="tlx-h2">Every machine, and what its maker will not say</h2>
          <div className="pj-index">
            {MACHINES.map((m) => (
              <article key={m.id} className="pj-card">
                <Link href={`/equipment/${m.id}`} className="pj-card-link">
                  <h3 className="pj-card-title">
                    {m.manufacturer} {m.model}
                  </h3>
                </Link>
                <p className="tlx-note pj-note">{m.role}</p>
                <p className="tlx-note pj-note">
                  {m.notPublished.length} field{m.notPublished.length === 1 ? '' : 's'} the
                  manufacturer does not publish
                  {m.conflicts.length > 0
                    ? `, and ${m.conflicts.length} place${m.conflicts.length === 1 ? '' : 's'} where its own documents disagree`
                    : ''}
                  .
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Why this is here">
        <div className="shell">
          <p className="tlx-kicker">Why a flooring company publishes this</p>
          <h2 className="tlx-h2">Because we run these machines</h2>
          <div className="tlx-body">
            <p>
              Ecowoods sands floors with equipment from this list, in houses where the electrical
              service was designed for a radio. The machine sequence we use is set out in{' '}
              <Link href="/papers/hardwood-refinishing-machines-and-sequence">
                the refinishing machines paper
              </Link>
              , and what a floor does between the passes is computed by{' '}
              <Link href="/tools/floor-movement">the movement calculator</Link>.
            </p>
            <p>
              Nothing here is a recommendation to buy, and nothing here is sponsored. If a
              manufacturer wants a figure corrected, the source URL for every number is on the
              machine&rsquo;s own page — send the document that supersedes it.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
