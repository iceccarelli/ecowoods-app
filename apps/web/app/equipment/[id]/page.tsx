import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MACHINES, machineById, type PowerSpec } from '@/lib/equipment';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export function generateStaticParams() {
  return MACHINES.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = machineById(id);
  if (!m) return {};
  const title = `${m.manufacturer} ${m.model} — published specifications`;
  return {
    title,
    description: `${m.role} Electrical requirement, weight, drum or disc size and abrasive format as ${m.manufacturer} publishes them, each figure linked to its source document.`,
    alternates: { canonical: `/equipment/${m.id}` },
    openGraph: { title, type: 'article', url: `${SITE_URL}/equipment/${m.id}` },
  };
}

/**
 * One machine.
 *
 * The page is organised around a distinction most spec pages hide: what the
 * manufacturer publishes, what it does not publish, and where its own documents
 * disagree with each other. All three are rendered. A spec sheet that quietly
 * fills its gaps is the reason nobody trusts spec sheets.
 */
function SpecTable({ spec, label }: { spec: PowerSpec; label: string }) {
  const rows: Array<[string, string]> = [
    ['Supply', `${spec.volts} V / ${spec.hertz} Hz, ${spec.phase} phase`],
    ['Power', spec.kilowatts !== null ? `${spec.kilowatts} kW` : spec.horsepower !== null ? `${spec.horsepower} HP` : 'not published'],
    ['Current', spec.amps !== null ? `${spec.amps} A` : 'not published'],
    ['Minimum fuse', spec.fuseAmps !== null ? `${spec.fuseAmps} A` : 'not published'],
    ['Connector', spec.connector ?? 'none specified'],
  ];
  return (
    <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label={`${label} electrical specification`}>
      <table className="wm-table">
        <caption>
          {label} — from{' '}
          <a href={spec.source.url} rel="noopener">
            the {spec.source.kind.replace(/-/g, ' ')}
          </a>
          , read {spec.source.verifiedAt}
          {spec.source.distributorHosted ? ' (manufacturer document, distributor-hosted)' : ''}.
        </caption>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = machineById(id);
  if (!m) notFound();

  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Equipment', url: `${SITE_URL}/equipment` },
          { name: `${m.manufacturer} ${m.model}`, url: `${SITE_URL}/equipment/${m.id}` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/equipment">Equipment</Link> <span aria-hidden="true">/</span>{' '}
            <span>{m.model}</span>
          </nav>
          <h1 className="tlx-title">
            {m.manufacturer} {m.model}
          </h1>
          <p className="tlx-lede">{m.role}</p>
        </div>
      </header>

      <section className="tlx-section" aria-label="Electrical">
        <div className="shell">
          <p className="tlx-kicker">What decides whether it runs</p>
          <h2 className="tlx-h2">Electrical requirement</h2>
          {m.northAmerica && <SpecTable spec={m.northAmerica} label="North America" />}
          {m.europe && <SpecTable spec={m.europe} label="Europe" />}
          {!m.northAmerica && (
            <p className="tlx-note">
              {m.manufacturer} publishes no North American configuration for this machine. That is a
              gap in the source material, not a statement that one does not exist.
            </p>
          )}
        </div>
      </section>

      <section className="tlx-section" aria-label="Mechanical">
        <div className="shell">
          <p className="tlx-kicker">The rest of it</p>
          <h2 className="tlx-h2">Mechanical</h2>
          <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label="Mechanical specification">
            <table className="wm-table">
              <tbody>
                <tr>
                  <th scope="row">Category</th>
                  <td>{m.category.replace(/-/g, ' ')}</td>
                </tr>
                <tr>
                  <th scope="row">Weight</th>
                  <td>{m.weightKg !== null ? `${m.weightKg} kg` : 'not published'}</td>
                </tr>
                <tr>
                  <th scope="row">Drum or disc</th>
                  <td>{m.drumOrDiscMm !== null ? `${m.drumOrDiscMm} mm${m.discCount ? ` × ${m.discCount}` : ''}` : 'not published'}</td>
                </tr>
                <tr>
                  <th scope="row">Speed</th>
                  <td>{m.rpm !== null ? `${m.rpm} rpm` : 'not published'}</td>
                </tr>
                <tr>
                  <th scope="row">Abrasive</th>
                  <td>{m.abrasive ?? 'not published'}</td>
                </tr>
                <tr>
                  <th scope="row">Dust</th>
                  <td>{m.dustExtraction ? m.dustExtraction.replace(/-/g, ' ') : 'not published'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Gaps and contradictions">
        <div className="shell">
          <p className="tlx-kicker">The part other spec pages leave out</p>
          <h2 className="tlx-h2">What {m.manufacturer} does not publish</h2>
          <div className="tlx-body">
            <ul>
              {m.notPublished.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                A price. No manufacturer in this category publishes one, so this page shows none.
              </li>
              <li>
                Any productivity figure. There is no manufacturer-published square-feet-per-hour
                rating for this machine, so there is nothing here to quote.
              </li>
            </ul>
            {m.conflicts.length > 0 && (
              <>
                <h3>Where its own documents disagree</h3>
                <ul>
                  {m.conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p>
                  Both values are shown rather than one being chosen. Picking a side would be
                  inventing certainty the source material does not contain.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="tlx-section" aria-label="Next">
        <div className="shell">
          <p className="tlx-kicker">Next</p>
          <h2 className="tlx-h2">Put it on a circuit</h2>
          <p className="tlx-note pj-note">
            The <Link href="/equipment">circuit planner</Link> takes this machine and whatever else
            would be running beside it and does the arithmetic against the breaker you actually have.
          </p>
        </div>
      </section>
    </div>
  );
}
